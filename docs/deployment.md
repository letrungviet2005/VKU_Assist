# Chạy backend nền tảng

Yêu cầu: Windows PowerShell, Python 3.11 (kiểm tra `py -3.11 --version`),
kết nối mạng để cài dependencies. Docker cần Docker Desktop với Linux engine
đang hoạt động (`docker version` phải hiển thị cả Client và Server).
Không cần AWS credentials, model hay dữ liệu.

## Python cục bộ

Chạy từ **thư mục gốc repository**:

```powershell
py -3.11 -m venv backend/.venv
& ./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
& ./backend/.venv/Scripts/python.exe -m pip check
Set-Location backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
& ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log
```

Dừng bằng Ctrl+C. Dùng trực tiếp Python của venv nên không cần thay execution policy
hoặc activate venv. Dependencies không được cài vào Python toàn cục.

Ứng dụng đọc `.env` tại thư mục chạy (chạy từ `backend`); biến môi trường được ưu tiên.
Không commit `.env` thật. Cấu hình:

| Biến | Mặc định / định dạng |
| --- | --- |
| APP_NAME | `VKU Assist`, chuỗi không rỗng |
| APP_ENV | `development`, nhận `development`, `test`, `production` |
| LOG_LEVEL | `INFO`, nhận `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| CORS_ORIGINS | Mảng JSON, mặc định hai origin localhost/127.0.0.1 cổng 5173 |

Origin cần có `http://` hoặc `https://`, không có path hay dấu `/` cuối.
Ví dụ `CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]`.
Không bọc giá trị trong dấu nháy ngoài để dùng cùng file với Docker `--env-file`.
Cấu hình sai làm ứng dụng không khởi động. `/docs` và `/openapi.json` được bật.

## Docker

Chạy từ **thư mục gốc repository**, sau khi tạo `backend/.env` như trên:

```powershell
docker version
docker build -t vku-assist-backend:local ./backend
docker run --rm --name vku-assist-backend -p 127.0.0.1:8000:8000 --env-file ./backend/.env vku-assist-backend:local
```

Container chạy user UID 10001, Uvicorn tại `0.0.0.0:8000`, không reload.
Image chỉ sao chép source `app/` và requirements; không chứa `.env`, venv, cache,
dữ liệu hoặc credentials. HEALTHCHECK gọi `/health` bằng thư viện chuẩn Python.
Giá trị môi trường được truyền khi chạy container, không nhúng vào image.

Trong **PowerShell thứ hai, thư mục bất kỳ**, chạy các lệnh kiểm tra trong
[API](api.md) với cùng base URL. Kiểm tra và dừng container:

```powershell
docker inspect --format '{{.State.Health.Status}}' vku-assist-backend
docker stop vku-assist-backend
```

`/health` phải trả 200; `/ready` **phải trả 503** với
`retrieval_not_initialized` vì giai đoạn này chưa có retrieval/chỉ mục.

## Kiểm chứng tự động cục bộ

Từ **thư mục gốc repository**:

```powershell
& ./backend/.venv/Scripts/python.exe backend/tests/smoke.py
```

Script tự khởi động Uvicorn trên cổng tạm, kiểm tra endpoint, CORS, request ID
và trường log, rồi dừng tiến trình. Không cần cài thêm thư viện kiểm thử.

Ở lần triển khai nền tảng này, Python 3.11.9 và các endpoint được kiểm chứng cục bộ.
Docker CLI có sẵn nhưng Linux engine chưa chạy (pipe Docker Desktop không tồn tại),
nên build image, runtime container và HEALTHCHECK chưa được kiểm chứng.
Khởi động Docker Desktop và chạy các lệnh Docker phía trên để kiểm tra tiếp.

## Bộ triển khai ECR → EC2 (nhóm tự thực hiện)

Các script chỉ được chuẩn bị và kiểm tra tại máy phát triển; **chưa chạy trên AWS**.
Lần kiểm tra tiếp theo vẫn không kết nối được Docker Desktop Linux Engine;
AWS CLI chưa được cài trên máy này. Chưa build/push image, tạo tài nguyên hay deploy EC2.
Không có thay đổi backend, frontend hoặc dependencies Python trong bước này.

### 1. Chọn môi trường, quyền và ngân sách

Nhóm điền Region, tên private repository, AWS profile (nếu dùng), image tag,
EC2 instance ID, IP người kiểm thử `/32` và digest triển khai. Không suy đoán Account ID:
script lấy từ `sts get-caller-identity` của danh tính đang đăng nhập.

Trên **Windows PowerShell, thư mục gốc repository**, sau khi nhóm cài AWS CLI v2,
khởi động Docker Desktop Linux Engine và đăng nhập (ưu tiên IAM Identity Center/SSO):

```powershell
$Region = '<AWS_REGION>'
$Repository = 'vku-assist-backend'
$Profile = '<AWS_PROFILE>'
aws sso login --profile $Profile
aws sts get-caller-identity --region $Region --profile $Profile
docker version
```

Xác nhận đúng tài khoản/Region và quyền được cấp trước khi thực hiện. Tạo AWS Budget
và cảnh báo chi phí theo ngân sách nhóm; cảnh báo không tự ngăn phát sinh phí.
EC2, EBS, public IPv4, ECR storage, network transfer, NAT/VPC endpoints có thể phát sinh phí;
không mặc định cấu hình thử nghiệm là miễn phí. Xem giá hiện hành tại
[EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/) và
[ECR pricing](https://aws.amazon.com/ecr/pricing/).

**Người quản trị**, dùng console hoặc lệnh sau để tạo repository một lần
(script build không tạo tài nguyên):

```powershell
aws ecr create-repository --region $Region --profile $Profile --repository-name $Repository --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
if ($LASTEXITCODE -ne 0) { throw 'Create repository failed; inspect the error before continuing.' }
```

Nếu repository đã tồn tại, dùng repository đó và kiểm tra cấu hình, không chạy lại lệnh tạo.
Scan kết quả là một đầu vào đánh giá image, không đảm bảo image không có lỗ hổng.

Tách quyền **người push** và **instance role kéo image**:

| Danh tính | Quyền trên ARN của đúng repository |
| --- | --- |
| Người push | `ecr:DescribeRepositories`, `ecr:DescribeImages`, `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:BatchGetImage` |
| EC2 pull | `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage` |

Cả hai cần `ecr:GetAuthorizationToken` với `Resource: "*"`; không cấp quyền push cho EC2.
ARN mẫu: `arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/<REPOSITORY>`.
`sts:GetCallerIdentity` được dùng để xác nhận danh tính. Quyền tạo ECR/EC2/IAM và
`iam:PassRole` dành riêng cho người quản trị, không cần đưa vào role runtime.
Tham khảo [quyền push ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html)
và [xác thực private ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html).

### 2. Tạo EC2 và cấu hình mạng

Trong **AWS Console**, chọn Amazon Linux 2023 **x86_64**, cùng Region với ECR.
Cấu hình gợi ý cho thử nghiệm backend trống: `t3.small` (2 vCPU, 2 GiB RAM),
EBS gp3 khoảng 16 GiB. Đây là gợi ý cho tải nhỏ, chưa được load test; dung lượng
image/log/OS có thể cần nhiều hơn. Chưa có sizing cho RAG/model.

Gắn instance profile có trust principal `ec2.amazonaws.com`, policy
`AmazonSSMManagedInstanceCore` và policy ECR pull giới hạn như bảng trên.
Bật yêu cầu IMDSv2. Amazon Linux AMI cần SSM Agent đang chạy; kiểm tra trạng thái
Managed node/Session Manager trước khi tiếp tục.
Quản trị qua **Systems Manager → Session Manager**, không mở inbound SSH/22 mặc định.
Xem [quyền instance cho Systems Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/setup-instance-permissions.html).

Mạng cần DNS và outbound HTTPS/443 đến ECR API, registry ECR, S3 chứa image layers,
Systems Manager (`ssm`, `ssmmessages`, và `ec2messages` khi Region/agent yêu cầu),
cùng package repositories để bootstrap. Với thử nghiệm trực tiếp, có thể dùng public
subnet có route Internet Gateway và public IP. Private subnet cần NAT hoặc thiết kế
VPC endpoints phù hợp; chỉ thêm ECR endpoints chưa đủ cho tải package.
ECR private endpoint cần `ecr.api`, `ecr.dkr` và đường đến S3; tham khảo
[ECR VPC endpoints](https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html).

Security group inbound: TCP/8000 **chỉ từ IP công cộng người kiểm thử `/32`**,
không mở `0.0.0.0/0`. Không mở cổng frontend hoặc database trong bước này.
Local Docker bind `127.0.0.1:8000` chỉ nhận kết nối trên máy phát triển;
script EC2 bind `0.0.0.0:8000` để nhận kết nối ngoài host, được giới hạn bằng security group.
HTTP trực tiếp chỉ để kiểm tra `/health`, không truyền đăng nhập hoặc dữ liệu nhạy cảm.
HTTPS API được dành cho bước ALB sau này.

### 3. Build và push từ Windows

**PowerShell, thư mục gốc repository** (đường dẫn có khoảng trắng được script hỗ trợ):

```powershell
# Code chưa commit: đặt tag riêng, không coi là bản phát hành từ một commit.
$ImageTag = 'dev-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
& ./infra/scripts/build-push-ecr.ps1 -Region $Region -Repository $Repository -ImageTag $ImageTag -Profile $Profile
```

Nếu dùng danh tính AWS mặc định, bỏ `-Profile`. Không truyền access key vào script.
Với bản phát hành từ cây Git sạch, có thể đặt `$ImageTag = git rev-parse HEAD`
(kiểm tra exit code và `git status --porcelain` trước). Tag luôn phải được chỉ định,
không dùng `latest`; cây Git chưa sạch bắt buộc tiền tố `dev-`. Không cần commit để chạy
bộ triển khai phát triển này. Không dùng lại tag immutable đã push.

Script kiểm tra CLI, Docker Engine, STS, repository tồn tại và lấy token đăng nhập
trước build. Build cho `linux/amd64`, dừng theo exit code AWS/Docker, dùng Docker config
tạm và xóa config đó sau khi chạy. Quyền ghi layer được ECR kiểm tra trong lúc push;
preflight không chứng minh trước toàn bộ quyền push. Không ghi token ra terminal.
Ghi lại **Image URI**, **Deploy URI có digest**, thời gian, tag và trạng thái Git.
Digest xác định image; cùng Git SHA không đảm bảo rebuild byte-identical vì base image
và dependencies bắc cầu chưa được khóa toàn bộ.

### 4. Bootstrap và cấu hình EC2

Chuyển hai file `.sh` trong `infra/scripts/` lên EC2 qua kênh nhóm quản lý,
ví dụ download từ URL artifact nội bộ được cấp quyền, hoặc paste nội dung script
qua Session Manager. Không gửi `.env` hoặc credentials qua Git. Giữ LF và đặt script
tại `/home/ec2-user/vku-assist/infra/scripts/`; không cần clone repository riêng tư
hoặc lưu token Git trên EC2. Có thể so SHA256 giữa nguồn và bản chuyển.

**Bash trên EC2 qua Session Manager, thư mục `/home/ec2-user/vku-assist`**:

```bash
cd /home/ec2-user/vku-assist
sudo bash infra/scripts/ec2-bootstrap.sh
sudo install -d -m 700 /etc/vku-assist
# Chỉ khởi tạo nếu chưa có, không ghi đè cấu hình cũ.
sudo test -e /etc/vku-assist/backend.env || sudo install -m 600 /dev/null /etc/vku-assist/backend.env
sudo vi /etc/vku-assist/backend.env
sudo chown root:root /etc/vku-assist/backend.env
sudo chmod 600 /etc/vku-assist/backend.env
```

Điền cấu hình mẫu sau bằng editor, không cần bí mật ở giai đoạn này:

```dotenv
APP_NAME=VKU Assist
APP_ENV=production
LOG_LEVEL=INFO
CORS_ORIGINS=[]
```

CORS `[]` phù hợp kiểm tra health trực tiếp; chỉ thêm origin frontend thực tế khi cần.
File ở ngoài repository, root-owned mode 600/400; không in nội dung vào log/ticket.
Bootstrap kiểm tra đúng OS/kiến trúc, chỉ cài Docker nếu thiếu và bật service;
nếu thiếu AWS CLI thì dừng và dẫn tới hướng dẫn AWS CLI v2 Linux x86_64 chính thức
(xác minh chữ ký gói cài). Không cài lại Docker hoặc xóa dữ liệu cũ.

### 5. Deploy, kiểm tra và ghi nhận

**Bash trên EC2, `/home/ec2-user/vku-assist`**; điền Deploy URI từ bước push:

```bash
REGION='<AWS_REGION>'
IMAGE='<ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/<REPOSITORY>@sha256:<DIGEST>'
sudo bash infra/scripts/deploy-backend.sh "$REGION" "$IMAGE" /etc/vku-assist/backend.env
curl --fail --max-time 5 -i http://127.0.0.1:8000/health
sudo docker ps --filter name=vku-assist-backend
sudo docker inspect --format '{{.State.Health.Status}}' vku-assist-backend
sudo docker inspect --format '{{.Config.Image}}' vku-assist-backend
```

Script bắt buộc digest, dùng instance role qua IMDS (bỏ qua file/profile và biến
credentials), đăng nhập bằng stdin vào Docker config tạm. Kéo image thành công và
kiểm tra amd64 trước khi thay container. Chỉ nhận thay container có tên cố định
`vku-assist-backend` và label `com.vku-assist.service=backend`; nếu trùng tên container
khác sẽ dừng. Không dùng `prune`, không xóa image hoặc container không liên quan.

Container chạy nền, restart `unless-stopped`, log `json-file` tối đa 3 file × 10 MiB.
Một container sẽ có **gián đoạn ngắn** khi đổi phiên bản. Script kiểm tra HTTP `/health`
200 trong thời gian hữu hạn (khoảng tối đa 120 giây); Docker HEALTHCHECK chạy độc lập,
có thể cần thêm một chu kỳ 30 giây để thấy `healthy`. `/ready` vẫn 503 có chủ đích.

**PowerShell trên máy kiểm thử, thư mục bất kỳ**, từ IP `/32` đã cho phép:

```powershell
$Ec2Address = '<EC2_PUBLIC_IP_OR_DNS>'
curl.exe --fail --max-time 10 -i "http://${Ec2Address}:8000/health"
```

Ghi lại HTTP 200, `status/service`, `X-Request-ID`, digest thực chạy, instance ID,
Region, thời gian và người kiểm tra. Không đánh dấu đã triển khai thành công chỉ dựa
vào việc push image thành công.

### 6. Vận hành và rollback

**Bash trên EC2, thư mục bất kỳ** (log có thể chứa dữ liệu vận hành, chỉ xem nội bộ):

```bash
sudo docker logs --tail 100 vku-assist-backend
sudo docker inspect --format '{{.State.Status}} {{.RestartCount}}' vku-assist-backend
sudo docker restart vku-assist-backend
curl --fail --max-time 5 -i http://127.0.0.1:8000/health
```

Sau khi thay phiên bản, container cũ được giữ lại ở trạng thái dừng với tên
`vku-assist-backend-previous`, giữ image và môi trường cũ. Khi deploy thất bại,
script trả lỗi và in lệnh rollback tương ứng; không tự xóa bằng chứng hoặc tự báo thành công.
Nếu lỗi trước bước thay container, bản đang chạy được giữ nguyên. Nếu chưa có bản cũ,
không có rollback, cần sửa lỗi và xóa container thử thất bại theo tên trước khi chạy lại.

Rollback khi có container cũ, **Bash trên EC2**:

```bash
sudo docker rm -f vku-assist-backend
sudo docker rename vku-assist-backend-previous vku-assist-backend
sudo docker start vku-assist-backend
curl --fail --max-time 5 -i http://127.0.0.1:8000/health
```

Chỉ sau khi chấp nhận bản mới, xóa container backup để cho phép lần deploy tiếp:

```bash
sudo docker rm vku-assist-backend-previous
```

Script sẽ từ chối deploy nếu backup còn tồn tại, tránh ghi đè rollback.
Giữ digest và cấu hình của các bản đã chấp nhận. Sau khi xóa backup, rollback bằng
cách chạy lại deploy script với digest cũ và file môi trường tương thích đã lưu an toàn.

### 7. Thu hồi tài nguyên thử nghiệm

Nhóm chỉ thu hồi tài nguyên do nhóm tạo: dừng/xóa container thử, đóng inbound 8000,
terminate EC2 khi hết nhu cầu (khác với stop), kiểm tra EBS gắn/rời và snapshot,
release Elastic IP không dùng, xóa image/repository ECR thử nghiệm khi không cần rollback.
Kiểm tra NAT Gateway, interface endpoints, CloudWatch logs, snapshot và storage còn lại.
**Stop EC2 không xóa EBS, snapshot hay ECR**; các tài nguyên đó và một số tài nguyên
mạng có thể tiếp tục tính phí. Xem Billing/Cost Explorer sau khi thu hồi; không xóa
role/VPC/security group dùng chung chỉ vì đã xong thử nghiệm này.

### Trạng thái kiểm chứng bộ triển khai

- Docker Engine: bị chặn bởi môi trường (pipe Docker Desktop Linux Engine không tồn tại).
  Chưa kiểm chứng build, endpoints trong container, UID, HEALTHCHECK hoặc filesystem image.
- AWS CLI: chưa có tại máy phát triển; không chạy ECR/EC2, không tạo tài nguyên AWS.
- Script được kiểm tra cú pháp bằng PowerShell parser và Git Bash `bash -n` tại máy phát triển;
  điều này không thay thế kiểm thử triển khai thực tế trên Amazon Linux 2023.
- Script PowerShell được kiểm tra bằng lệnh AWS/Docker giả lập: luồng thành công
  trả digest, lỗi truy cập repository dừng trước build, và code chưa commit bị từ chối
  nếu tag không có tiền tố `dev-`. Các kiểm tra này không gọi AWS/Docker thật.
- Các bước AWS ở trên phải do nhóm chạy và ghi kết quả thực tế. Chưa chuyển sang RAG/ALB/CI/CD.

Khi Docker Engine hoạt động, kiểm thử image riêng bằng **PowerShell, thư mục gốc repository**.
Không dùng `.env` thật; Docker tự chọn cổng host để tránh backend đang chạy:

```powershell
$TestImage = 'vku-assist-backend:docker-check'
$TestContainer = 'vku-assist-check-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
docker build --platform linux/amd64 -t $TestImage ./backend
if ($LASTEXITCODE -ne 0) { throw 'Docker test build failed' }
try {
    docker run -d --name $TestContainer -p 127.0.0.1::8000 -e APP_NAME=VKU-Docker-Test -e APP_ENV=test -e LOG_LEVEL=INFO -e 'CORS_ORIGINS=[]' $TestImage
    if ($LASTEXITCODE -ne 0) { throw 'Docker test run failed' }
    $Port = docker inspect --format '{{(index (index .NetworkSettings.Ports "8000/tcp") 0).HostPort}}' $TestContainer
    if ($LASTEXITCODE -ne 0) { throw 'Port lookup failed' }
    for ($i = 0; $i -lt 45; $i++) {
        $Health = docker inspect --format '{{.State.Health.Status}}' $TestContainer
        if ($LASTEXITCODE -ne 0) { throw 'Health lookup failed' }
        if ($Health -eq 'healthy') { break }
        Start-Sleep -Seconds 2
    }
    if ($Health -ne 'healthy') { throw 'Docker HEALTHCHECK did not become healthy' }
    # Kiểm tra status/body và X-Request-ID; /ready phải là 503.
    foreach ($Path in @('health', 'ready', 'docs', 'openapi.json')) {
        curl.exe --max-time 5 -i "http://127.0.0.1:${Port}/$Path"
        if ($LASTEXITCODE -ne 0) { throw "HTTP request failed: $Path" }
    }
    docker exec $TestContainer id -u
    if ($LASTEXITCODE -ne 0) { throw 'UID check failed' }
    # UID phải khác 0. Chỉ kiểm tra tên file/thư mục, không in nội dung.
    docker exec $TestContainer python -c 'from pathlib import Path; bad=[str(p) for root in ("/app", "/home/appuser") for p in Path(root).rglob("*") if p.name.startswith(".env") or p.name in {".aws", ".venv", "venv", "data", "__pycache__", ".cache", ".pytest_cache", "credentials", "credentials.json"} or p.suffix in {".pem", ".key"}]; assert not bad, bad; print("PASS image filesystem exclusions")'
    if ($LASTEXITCODE -ne 0) { throw 'Image filesystem audit failed' }
} finally {
    # Chỉ xóa container test có tên ngẫu nhiên vừa tạo, không prune.
    docker rm -f $TestContainer
}
```

Đối chiếu `/health` 200 với service `VKU-Docker-Test`, `/ready` 503 cùng reason
`retrieval_not_initialized`, `/docs` và `/openapi.json` 200, tất cả có `X-Request-ID`.
Việc kiểm tra filesystem ở đây bổ sung cho rà soát Dockerfile/context, không phải
chứng minh mọi loại bí mật đều không tồn tại. Image test được giữ lại để xem xét;
nhóm có thể xóa riêng tag `$TestImage` sau khi dùng, không xóa image dùng chung.
