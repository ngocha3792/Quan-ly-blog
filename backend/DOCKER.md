# Triển khai Blog API bằng Docker và Nginx trên Azure VPS

## Chuẩn bị

1. Copy `.env.example` thành `.env`.
2. Điền credential production đã được tạo mới.
3. Đặt `NODE_ENV=production`, `DB_LOG_QUERIES=false` và cấu hình đúng
   `FRONTEND_URL`, `TRUST_PROXY_HOPS`.
4. Tạo password database bằng `openssl rand -hex 32`, sau đó đặt cùng giá trị
   vào `POSTGRES_PASSWORD` và phần password của `DATABASE_URL`.

PostgreSQL chạy trong container `postgres` trên cùng VPS. Vì vậy hostname trong
`DATABASE_URL` phải là `postgres`, không phải `localhost`. Không mở cổng 5432
trong Azure NSG hoặc Docker Compose.

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
docker compose --env-file .env -f compose.production.yml config --quiet
docker compose --env-file .env -f compose.production.yml up -d postgres
docker compose --env-file .env -f compose.production.yml exec postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose --env-file .env -f compose.production.yml up -d --build
```

Compose sẽ đợi PostgreSQL healthy rồi chạy `prisma migrate deploy`. API chỉ
được khởi động nếu migration hoàn tất thành công; Nginx chỉ khởi động sau khi
API healthy.

## Kiểm tra

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs -f postgres
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

## Backup PostgreSQL

Volume `postgres_data` giữ dữ liệu khi container được tạo lại. Volume không
thay thế cho backup vì nó vẫn nằm trên disk của VPS.

```bash
docker compose -f compose.production.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > blog-backup.dump
```

Chép `blog-backup.dump` ra khỏi VPS. Không chạy `docker compose down -v` nếu
muốn giữ database vì tùy chọn `-v` sẽ xóa volume.

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

Lệnh này không xóa volume `postgres_data`. Không thêm tùy chọn `-v` nếu muốn
giữ database.
