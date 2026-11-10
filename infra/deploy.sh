#!/usr/bin/env bash
# ==============================================================================
# VKU Assist - Production Deployment Automation Script (Linux/EC2)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== [VKU Assist] Khởi động quy trình triển khai Docker Compose ==="

# 1. Kiểm tra các công cụ phụ thuộc
for tool in docker curl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "[LỖI] Thiếu công cụ bắt buộc: $tool" >&2
        exit 1
    fi
done

# Kiểm tra Docker daemon đang hoạt động
if ! docker info >/dev/null 2>&1; then
    echo "[LỖI] Docker daemon chưa khởi động. Vui lòng kiểm tra dịch vụ Docker." >&2
    exit 1
fi

# 2. Kiểm tra tệp môi trường .env
ENV_FILE="${REPO_ROOT}/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[THÔNG BÁO] Không tìm thấy backend/.env. Đang sao chép từ backend/.env.example..."
    cp "${REPO_ROOT}/backend/.env.example" "$ENV_FILE"
fi

cd "$SCRIPT_DIR"

# 3. Tiến hành đóng gói và triển khai containers
echo "[BƯỚC 1/3] Đóng gói và khởi chạy Docker Compose..."
docker compose -f compose.yaml up -d --build

# 4. Kiểm tra sức khỏe của dịch vụ (Health Check)
echo "[BƯỚC 2/3] Chờ backend chuyển sang trạng thái sẵn sàng (Healthcheck)..."
MAX_ATTEMPTS=30
SLEEP_SECS=2
BACKEND_OK=false

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    HTTP_CODE=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 http://127.0.0.1:8000/health || true)
    if [[ "$HTTP_CODE" == "200" ]]; then
        BACKEND_OK=true
        echo "[THÀNH CÔNG] Backend đã sẵn sàng (HTTP 200) tại lượt thử $i."
        break
    fi
    echo "  Lượt $i/$MAX_ATTEMPTS: Backend phản hồi HTTP $HTTP_CODE, chờ ${SLEEP_SECS}s..."
    sleep "$SLEEP_SECS"
done

if [[ "$BACKEND_OK" != "true" ]]; then
    echo "[CẢNH BÁO] Backend chưa đạt trạng thái khỏe mạnh sau $((MAX_ATTEMPTS * SLEEP_SECS)) giây."
    echo "Logs gần nhất:"
    docker compose -f compose.yaml logs --tail=20 backend
    exit 1
fi

# 5. Hoàn tất triển khai
echo "[BƯỚC 3/3] Trạng thái các containers:"
docker compose -f compose.yaml ps

echo ""
echo "=============================================================================="
echo " [VKU Assist] TRIỂN KHAI THÀNH CÔNG!"
echo " - Giao diện Web Người dùng: http://localhost/"
echo " - Backend API Probe:        http://localhost:8000/health"
echo " - Tài liệu API Swagger:     http://localhost:8000/docs"
echo " - Quản trị kho văn bản:     http://localhost/ (Menu Quản trị viên)"
echo "=============================================================================="
