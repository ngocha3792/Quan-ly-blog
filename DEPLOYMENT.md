# Deployment — Blog API + Blog Frontend

Ghi lại đúng những gì đang chạy thật ở production, không phải kế hoạch.
Tài liệu khảo sát ban đầu (trước khi có Docker) nằm ở
`docs/future development documentation/DOCKER_DEPLOYMENT_PLAN.md` — giữ lại
để tham khảo lộ trình dài hạn (staging riêng, managed Postgres, nhiều
replica...), còn file này mô tả setup một-VPS hiện tại.

## 1. Kiến trúc hiện tại

```
Internet
   |
   v
Nginx (80/443)  — container "nginx", VPS 103.72.57.142
   |-- /api/v1/*  -> container "api"      (NestJS, port 8080 nội bộ)
   `-- /*         -> container "frontend" (Angular SSR, port 4000 nội bộ)
                          |
container "api" -------- backend network (internal, không public) -------- container "postgres"
```

- VPS: Ubuntu 20.04, Docker Engine 28 + Compose v2, ~1.9GB RAM — máy yếu,
  **không build image trên VPS** trong CI/CD (chỉ build thủ công lúc cần).
- Compose project sống ở `/opt/blog-api/backend` trên VPS
  (`compose.prod.yml` + `.env.production`, file `.env.production` **không**
  nằm trong git, chỉ tồn tại trên VPS).
- Postgres chạy local trong Docker (đúng yêu cầu ban đầu), không mở cổng
  5432 ra Internet.
- `frontend` (từ repo `blog-frontend`) và `api`/`postgres`/`nginx` (từ repo
  `blog-backend`) nằm chung một compose project trên cùng VPS — hai repo
  chia sẻ một target deploy.

Repo:
- Backend: `github.com/ngocha3792/Quan-ly-blog`, thư mục `backend/`.
- Frontend: `github.com/mytmatmong/blog-frontend`.

## 2. CI/CD

Push (hoặc merge) vào nhánh `develop` sẽ tự deploy. Không cần làm gì thêm
sau khi đã setup secret một lần (mục 3).

| Workflow | Repo | Trigger | Việc làm |
|---|---|---|---|
| `.github/workflows/deploy-backend.yml` | Quan-ly-blog | push `develop`, path `backend/**` | build image `production` + `migration`, ship qua VPS, chạy migration, recreate `api` + `nginx` |
| `.github/workflows/deploy-frontend.yml` | blog-frontend | push `develop` | build image SSR, ship qua VPS, recreate `frontend` |

**Chiến lược**: build image ngay trên GitHub Actions runner (nhanh, nhiều
RAM hơn VPS), nén lại, chuyển sang VPS bằng `scp` rồi `docker load` —
**không dùng container registry**, VPS chỉ nhận file tar.gz đã build sẵn.
Trade-off: đơn giản, không cần đăng ký/đăng nhập registry, nhưng ảnh không
được scan bởi registry và không có lịch sử image version — cân nhắc
chuyển sang GHCR nếu dự án lớn hơn.

Mỗi lần deploy xong đều có smoke test (`curl .../health/live`,
`.../health/ready`, hoặc trang chủ) — workflow fail nếu health check
không pass.

## 3. Setup secret SSH (one-time, đã làm — ghi lại để tái thiết lập nếu cần)

CI dùng một SSH key **riêng cho CI**, khác key cá nhân dùng để thao tác
tay lên server:

1. Tạo key riêng: `ssh-keygen -t ed25519 -f ci_deploy_key -N ""`.
2. Add public key vào `~/.ssh/authorized_keys` trên VPS (thao tác tay
   trên server, không qua agent — đây là hành động thay đổi quyền truy
   cập nên cần làm trực tiếp).
3. Copy **private key** vào clipboard bằng PowerShell, tránh Notepad làm
   hỏng format (CRLF khiến OpenSSH báo `error in libcrypto`):
   ```powershell
   Get-Content -Raw "<path-tới-private-key>" | Set-Clipboard
   ```
4. Paste vào secret `DEPLOY_SSH_KEY` ở **cả hai repo**
   (Settings → Secrets and variables → Actions).

Workflow tự `tr -d '\r'` khi ghi key ra file trên runner, phòng khi vẫn bị
dính CRLF lúc paste.

**Nếu key bị lộ** (dán nhầm vào chat, commit nhầm...): coi như compromised
ngay lập tức — generate key mới, gỡ public key cũ khỏi
`~/.ssh/authorized_keys` trên VPS, thay `DEPLOY_SSH_KEY` ở cả hai repo.

## 4. Deploy thủ công (khi CI không dùng được)

```bash
# Trên máy có Docker + đã build image blog-api-runtime:local / blog-api-migration:local
docker save blog-api-runtime:local blog-api-migration:local | gzip | \
  ssh root@103.72.57.142 "gunzip | docker load"

ssh root@103.72.57.142
cd /opt/blog-api/backend
./scripts/backup-postgres.sh
API_IMAGE=blog-api-runtime:local MIGRATION_IMAGE=blog-api-migration:local \
  docker compose --env-file .env.production -f compose.prod.yml run --rm -T migrate
API_IMAGE=blog-api-runtime:local MIGRATION_IMAGE=blog-api-migration:local \
  docker compose --env-file .env.production -f compose.prod.yml up -d --force-recreate api nginx
```

`scripts/deploy.sh` là bản đóng gói sẵn của quy trình này cho trường hợp
dùng registry thật (khác cách CI hiện tại đang dùng — CI dùng save/load,
không pull từ registry).

## 5. Backup / Restore

```bash
cd /opt/blog-api/backend
./scripts/backup-postgres.sh                 # ghi vào ./backups, kèm sha256
CONFIRM_RESTORE=yes ./scripts/restore-postgres.sh ./backups/blog_<timestamp>.dump
```

Giữ 14 backup gần nhất trong `./backups` trên VPS — đây **không phải**
backup ngoài VPS, cần tự chép ra nơi khác định kỳ nếu dữ liệu quan trọng.

## 6. Các lỗi thật đã gặp khi dựng pipeline (để không lặp lại)

- **`docker compose run` không có `-T`** khi chạy trong script feed qua
  `ssh host bash -s <<HEREDOC`: lệnh này mặc định gắn vào stdin, "nuốt"
  mất phần còn lại của heredoc đang được feed cho bash ở ngoài — các bước
  sau (recreate container, health check) im lặng không chạy, không báo
  lỗi gì. Luôn thêm `-T` khi `run` được gọi theo kiểu này.
- **`pg_dump`/`pg_restore` không hiểu `?schema=public`** trong
  `DATABASE_URL` — đó là quy ước riêng của Prisma, không phải tham số
  libpq hợp lệ. Phải cắt bỏ phần query trước khi truyền cho `pg_dump`.
- **`docker run` trần không cùng network với compose** nên không resolve
  được hostname service (`postgres`) — Docker embedded DNS chỉ hoạt động
  trong network do compose tạo (user-defined network), không có ở default
  bridge. `scripts/backup-postgres.sh`/`restore-postgres.sh` tự dò network
  của container `postgres` đang chạy rồi `--network` vào đúng đó.
- **`core.autocrlf=true` trên Windows** âm thầm chuyển `.sh`/`Dockerfile`
  sang CRLF sau một số thao tác git (checkout/merge), phá shebang khi
  chạy trên Linux. Đã thêm `.gitattributes` ép `eol=lf` cho các file này.
- **Dán private key qua Notepad vào GitHub secret** có thể làm hỏng định
  dạng (`error in libcrypto` khi OpenSSH đọc key) — dùng PowerShell
  `Set-Clipboard` thay vì mở file bằng editor.

## 7. Dịch tự động (LibreTranslate) — chưa triển khai được

`TranslationService` (`backend/src/blogowner/services/translation.service.ts`)
gọi `TRANSLATE_API_URL` theo đúng API contract của LibreTranslate
(`POST /translate`). Đã thử tự host trên VPS này ngày 2026-09-03, **không
khả thi**:

- Image chính thức `libretranslate/libretranslate` có một layer riêng
  ~3GB (PyTorch runtime), tải dở đã ăn gần hết 7GB đĩa trống lúc đó —
  phải hủy giữa chừng để không ảnh hưởng Postgres đang chạy thật.
- Dù tải xong, mỗi cặp ngôn ngữ khi *chạy* tốn thêm khoảng 1-2GB RAM
  (theo tài liệu cộng đồng) — VPS chỉ có 1.9GB RAM tổng, không đủ để
  chạy dù chỉ 1 ngôn ngữ cùng lúc với stack hiện có.
- Service `libretranslate` trong `compose.prod.yml` **đang để tắt** (có
  comment cảnh báo ngay tại đó) — không tự chạy, tránh lặp lại sự cố
  đầy đĩa nếu ai đó chạy `docker compose up -d` không chỉ định service.

Các hướng đã cân nhắc, chưa hướng nào được chọn (đang tạm gác tính năng):

| Hướng | Chi phí | Việc cần làm |
|---|---|---|
| Nâng VPS (~20GB đĩa, 4GB RAM riêng cho service này) | Tiền hạ tầng hàng tháng | Bật lại đúng service `libretranslate` đã viết sẵn |
| LibreTranslate API trả phí (`portal.libretranslate.com`) | Từ $29/tháng, không có free tier | Chỉ cần đổi `TRANSLATE_API_URL` + API key, code không đổi |
| MyMemory API (miễn phí, không cần đăng ký) | Miễn phí, ~5000 từ/ngày/IP | Phải sửa `translation.service.ts`: tách request, cắt đoạn text >~500 ký tự, chấp nhận rủi ro dịch hỏng HTML vì MyMemory không có mode `format: html` |
| Mirror cộng đồng miễn phí (`translate.cutie.dating`, `translate.fedilab.app`) | Miễn phí | Đã test 2026-09-03: cả hai đều không truy cập được (chết/403) — không dùng được hiện tại |

## 8. Kiểm tra nhanh

```bash
curl http://103.72.57.142/api/v1/health/live
curl http://103.72.57.142/api/v1/health/ready
curl http://103.72.57.142/
```
