# Triển khai Blog API bằng Docker và Nginx trên Azure VPS

## Chuẩn bị

1. Copy `.env.example` thành `.env`.
2. Điền credential production đã được tạo mới.
3. Đặt `NODE_ENV=production`, `DB_LOG_QUERIES=false` và cấu hình đúng
   `FRONTEND_URL`, `TRUST_PROXY_HOPS`.
4. Đảm bảo PostgreSQL trong `DATABASE_URL` cho phép máy triển khai kết nối.

Trên Azure Portal, Network Security Group của VM cần cho phép inbound TCP 22
(SSH) và TCP 80 (HTTP). Không mở cổng 8080: container API chỉ nhận kết nối từ
Nginx qua Docker network.

Nếu VPS dùng UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

Không copy hoặc commit file `.env` vào repository.

## Build và khởi động

Chạy từ thư mục `backend`:

```bash
docker compose -f compose.production.yml build
docker compose -f compose.production.yml up -d
```

Compose sẽ chạy `prisma migrate deploy` trước. API chỉ được khởi động nếu
migration hoàn tất thành công; Nginx chỉ khởi động sau khi API healthy.

## Kiểm tra

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs -f api
docker compose -f compose.production.yml logs -f nginx
curl http://localhost/nginx-health
curl http://localhost/api/v1/health
curl http://localhost/api/v1/health/ready
```

`/health` dùng cho Docker liveness. `/health/ready` kiểm tra thêm kết nối
PostgreSQL và trả HTTP 503 nếu database chưa sẵn sàng.

Từ máy cá nhân, thay `localhost` bằng public IP của Azure VM:

```bash
curl http://<AZURE_VM_PUBLIC_IP>/api/v1/health/ready
```

Khi frontend chạy ở một domain khác, đặt `FRONTEND_URL` đúng origin của
frontend, ví dụ `https://blog.example.com`. `TRUST_PROXY_HOPS=1` là cấu hình
đúng khi chỉ có một lớp Nginx đứng trước NestJS.

## Cập nhật phiên bản

```bash
git pull
docker compose -f compose.production.yml build
docker compose -f compose.production.yml up -d --remove-orphans
docker image prune -f
```

## HTTPS

Cấu hình hiện tại dùng HTTP để có thể chạy ngay bằng public IP. Chỉ bật HTTPS
sau khi domain đã trỏ bản ghi A về public IP của VPS; không tạo hoặc commit
chứng chỉ giả vào repository.

## Dừng dịch vụ

```bash
docker compose -f compose.production.yml down
```

Lệnh này không xóa database vì production sử dụng PostgreSQL managed bên ngoài.
