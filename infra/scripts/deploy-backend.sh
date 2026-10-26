#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 3 ]] || { echo "Usage: sudo bash $0 REGION ECR_URI@sha256:DIGEST /absolute/backend.env" >&2; exit 2; }
region=$1
image=$2
env_file=$3
name=vku-assist-backend
previous=vku-assist-backend-previous
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash.' >&2; exit 1; }
[[ $region =~ ^[a-z]{2}(-[a-z]+)+-[0-9]+$ ]] || { echo 'Invalid Region.' >&2; exit 2; }
[[ $image =~ ^[0-9]{12}\.dkr\.ecr\.${region}\.amazonaws\.com(\.cn)?/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] || {
    echo 'Use a private ECR image URI pinned by digest in the supplied Region.' >&2; exit 2;
}
[[ $env_file == /* && -f $env_file && -r $env_file && ! -L $env_file ]] || {
    echo 'Environment file must be an absolute, readable regular file, not a symlink.' >&2; exit 2;
}
[[ $(stat -c '%u' "$env_file") == 0 && $(stat -c '%a' "$env_file") =~ ^(400|600)$ ]] || {
    echo 'Environment file must be root-owned with mode 400 or 600.' >&2; exit 2;
}
for tool in aws docker curl; do
    command -v "$tool" >/dev/null || { echo "Missing command: $tool" >&2; exit 1; }
done
docker info >/dev/null
# Force the AWS CLI to use the instance role via IMDS, not saved credentials.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE
unset AWS_ROLE_ARN AWS_WEB_IDENTITY_TOKEN_FILE AWS_CONTAINER_CREDENTIALS_RELATIVE_URI AWS_CONTAINER_CREDENTIALS_FULL_URI
unset AWS_ENDPOINT_URL AWS_ENDPOINT_URL_STS AWS_ENDPOINT_URL_ECR AWS_EC2_METADATA_SERVICE_ENDPOINT
export AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_EC2_METADATA_DISABLED=false
export AWS_PAGER='' AWS_CLI_AUTO_PROMPT=off
docker_config=$(mktemp -d)
chmod 700 "$docker_config"
replacing=false
had_previous=false
rollback() {
    echo 'Deployment failed. Inspect Docker logs locally; do not publish environment contents.' >&2
    if [[ $replacing == true && $had_previous == true ]]; then
        echo 'Rollback (Bash on EC2):' >&2
        echo "sudo docker rm -f $name; sudo docker rename $previous $name; sudo docker start $name" >&2
    elif [[ $replacing == true ]]; then
        echo "No previous deployment. Inspect/remove only this attempt: sudo docker rm -f $name" >&2
    else
        echo 'Existing backend was not replaced.' >&2
    fi
}
trap 'rc=$?; rm -rf -- "$docker_config"; if (( rc != 0 )); then rollback; fi' EXIT
registry=${image%%/*}
aws ecr get-login-password --region "$region" | docker --config "$docker_config" login --username AWS --password-stdin "$registry"
docker --config "$docker_config" pull "$image"
[[ $(docker image inspect --format '{{.Architecture}}' "$image") == amd64 ]] || { echo 'Image must be amd64.' >&2; exit 1; }
if docker container inspect "$previous" >/dev/null 2>&1; then
    echo "Rollback container $previous already exists. Keep it until verified; remove it explicitly before a later deploy." >&2
    exit 1
fi
if docker container inspect "$name" >/dev/null 2>&1; then
    [[ $(docker inspect --format '{{index .Config.Labels "com.vku-assist.service"}}' "$name") == backend ]] || {
        echo 'Existing container is not owned by this deployment script; aborting.' >&2; exit 1;
    }
    old_image=$(docker inspect --format '{{.Config.Image}}' "$name")
    echo "Previous image: $old_image"
    docker rename "$name" "$previous"
    had_previous=true
    replacing=true
    docker stop --time 20 "$previous"
fi
replacing=true
docker run -d --name "$name" --label com.vku-assist.service=backend \
    --restart unless-stopped --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
    -p 0.0.0.0:8000:8000 --env-file "$env_file" "$image"
for ((attempt=0; attempt<30; attempt++)); do
    http_code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 http://127.0.0.1:8000/health || true)
    if [[ $http_code == 200 ]]; then
        echo "Deployment healthy: $image"
        echo '/ready remains intentionally 503 until retrieval is initialized.'
        if [[ $had_previous == true ]]; then
            echo "Rollback container retained: $previous. Remove only after acceptance: sudo docker rm $previous"
        fi
        exit 0
    fi
    sleep 2
done
echo 'Health check timed out (at most approximately 120 seconds).' >&2
exit 1
