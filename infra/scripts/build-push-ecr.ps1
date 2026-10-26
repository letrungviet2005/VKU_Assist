[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[a-z]{2}(-[a-z]+)+-\d+$')][string]$Region,
    [Parameter(Mandatory)][ValidatePattern('^[a-z0-9]+(?:[._/-][a-z0-9]+)*$')][string]$Repository,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$')][string]$ImageTag,
    [string]$Profile
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)." }
}
foreach ($command in @('aws', 'docker', 'git')) {
    if (!(Get-Command $command -ErrorAction SilentlyContinue)) { throw "Required command missing: $command" }
}
if ($ImageTag -eq 'latest') { throw 'Specify a version tag; latest is not allowed.' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$awsArgs = @('--region', $Region, '--no-cli-pager')
if ($Profile) { $awsArgs += @('--profile', $Profile) }
& aws --version
Assert-Exit 'AWS CLI check'
$engineOS = & docker info --format '{{.OSType}}'
Assert-Exit 'Docker Engine check'
if ($engineOS -ne 'linux') { throw 'Docker must use the Linux containers engine.' }
$changes = & git -C $repoRoot status --porcelain
Assert-Exit 'Git status'
if ($changes) {
    if ($ImageTag -notmatch '^dev-') { throw 'Uncommitted code requires an explicit dev- tag.' }
    Write-Warning 'Development image: uncommitted code; this tag does not represent a released commit.'
}
$account = & aws sts get-caller-identity @awsArgs --query Account --output text
Assert-Exit 'STS identity'
if ($account -notmatch '^\d{12}$') { throw 'STS returned an invalid account ID.' }
$repositoryUri = & aws ecr describe-repositories @awsArgs --registry-id $account --repository-names $Repository --query 'repositories[0].repositoryUri' --output text
Assert-Exit 'Existing ECR repository access'
if (!$repositoryUri -or $repositoryUri -eq 'None') { throw 'Repository URI missing.' }
$registry = ($repositoryUri -split '/')[0]
$imageUri = "${repositoryUri}:$ImageTag"
# Capture the AWS exit code before piping, and never emit the token.
$token = & aws ecr get-login-password @awsArgs
Assert-Exit 'ECR authentication token'
$dockerConfig = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
[void][IO.Directory]::CreateDirectory($dockerConfig)
try {
    $token | & docker --config $dockerConfig login --username AWS --password-stdin $registry
    Assert-Exit 'Docker ECR login'
    $token = $null
    & docker --config $dockerConfig build --platform linux/amd64 -t $imageUri (Join-Path $repoRoot 'backend')
    Assert-Exit 'Image build'
    & docker --config $dockerConfig push $imageUri
    Assert-Exit 'Image push'
    $digest = & aws ecr describe-images @awsArgs --registry-id $account --repository-name $Repository --image-ids "imageTag=$ImageTag" --query 'imageDetails[0].imageDigest' --output text
    Assert-Exit 'Image digest lookup'
    if ($digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Invalid image digest returned by ECR.' }
    Write-Output "Image URI: $imageUri"
    Write-Output "Deploy URI: ${repositoryUri}@$digest"
} finally {
    $token = $null
    # Only this script's freshly created credential directory is removed.
    $resolvedConfig = (Resolve-Path -LiteralPath $dockerConfig).Path
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (!$resolvedConfig.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing credential-directory cleanup outside the temporary directory.'
    }
    Remove-Item -LiteralPath $dockerConfig -Recurse -Force
}
