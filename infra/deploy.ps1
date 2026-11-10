# ==============================================================================
# VKU Assist - Production Deployment Automation Script (Windows PowerShell)
# ==============================================================================
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path

Write-Host "=== [VKU Assist] Khởi động quy trình triển khai Docker Compose ===" -ForegroundColor Cyan

# 1. Kiểm tra Docker
if (!(Get-Command 'docker' -ErrorAction SilentlyContinue)) {
    Write-Error "Lệnh 'docker' không tìm thấy. Vui lòng cài đặt Docker Desktop."
}

# 2. Kiểm tra file cấu hình .env
$EnvFile = Join-Path $RepoRoot 'backend\.env'
$ExampleEnvFile = Join-Path $RepoRoot 'backend\.env.example'
if (!(Test-Path $EnvFile)) {
    Write-Host "[THÔNG BÁO] Chưa có backend/.env. Đang tự động tạo từ .env.example..." -ForegroundColor Yellow
    Copy-Item $ExampleEnvFile $EnvFile
}

Set-Location $ScriptDir

# 3. Build & Up containers
Write-Host "[BƯỚC 1/3] Đóng gói và khởi chạy Docker Compose..." -ForegroundColor Green
docker compose -f compose.yaml up -d --build

# 4. Kiểm tra sức khỏe backend
Write-Host "[BƯỚC 2/3] Chờ dịch vụ Backend phản hồi /health..." -ForegroundColor Green
$MaxAttempts = 30
$SleepSecs = 2
$Healthy = $false

for ($i = 1; $i -le $MaxAttempts; $i++) {
    try {
        $res = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -Method Get -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) {
            $Healthy = $true
            Write-Host "[THÀNH CÔNG] Backend đã sẵn sàng (HTTP 200) tại lượt $i." -ForegroundColor Green
            break
        }
    } catch {
        # Chưa sẵn sàng
    }
    Write-Host "  Lượt $i/$MaxAttempts: Chờ $SleepSecs giây..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $SleepSecs
}

if (!$Healthy) {
    Write-Warning "Backend chưa sẵn sàng sau khoảng $($MaxAttempts * $SleepSecs) giây. Logs gần nhất:"
    docker compose -f compose.yaml logs --tail=25 backend
    exit 1
}

# 5. Báo cáo trạng thái
Write-Host "[BƯỚC 3/3] Trạng thái các containers:" -ForegroundColor Green
docker compose -f compose.yaml ps

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " [VKU Assist] TRIỂN KHAI THÀNH CÔNG!" -ForegroundColor Green
Write-Host " - Giao diện Web:         http://localhost/" -ForegroundColor White
Write-Host " - Backend API Probe:     http://localhost:8000/health" -ForegroundColor White
Write-Host " - Tài liệu API Swagger:  http://localhost:8000/docs" -ForegroundColor White
Write-Host " - Đăng nhập Quản trị:    admin / vku2026" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Cyan
