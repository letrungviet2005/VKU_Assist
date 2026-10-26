#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash.' >&2; exit 1; }
source /etc/os-release
[[ ${ID:-} == amzn && ${VERSION_ID:-} == 2023 && $(uname -m) == x86_64 ]] || {
    echo 'Requires Amazon Linux 2023 x86_64.' >&2; exit 1;
}
if ! command -v docker >/dev/null; then
    dnf install -y docker
fi
systemctl enable --now docker
docker info --format '{{.ServerVersion}}'
if ! command -v aws >/dev/null; then
    echo 'AWS CLI missing. Install AWS CLI v2 for Linux x86_64, verify its signature, then rerun:' >&2
    echo 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' >&2
    exit 1
fi
aws --version
echo 'Bootstrap complete. Use sudo for Docker; no existing data/config was removed.'
