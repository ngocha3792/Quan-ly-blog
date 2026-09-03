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

## 7. Dịch tự động (LibreTranslate) — đang chạy, 4 ngôn ngữ

`TranslationService` (`backend/src/blogowner/services/translation.service.ts`)
gọi `TRANSLATE_API_URL` theo đúng API contract của LibreTranslate
(`POST /translate`). Lần thử đầu (2026-09-03, image chính thức) thất bại vì
một layer ~3GB (PyTorch+CUDA) suýt làm đầy đĩa VPS giữa chừng. Đào sâu hơn
thì phát hiện phần lớn size đó (~4.7GB) là `nvidia-*` + `triton` — CUDA
runtime hoàn toàn không cần thiết khi chạy CPU, không phải do model ngôn
ngữ.

**Giải pháp**: build lại image từ source
(`backend/docker/libretranslate/Dockerfile.cpu-slim` — xem README cùng
thư mục để biết cách build/đo RAM), ép `torch` về bản CPU-only rồi gỡ
`nvidia-*`/`triton`. Build trên máy dev (VPS quá yếu để tự build), ship
xuống bằng `docker save | ssh | docker load` — giống hệt cách deploy
`api`/`frontend`.

**Production đang chạy `en, vi, zh, ja` (4 ngôn ngữ, 6 model,
`libretranslate-cpu-slim:4lang`)**. Từng thử 6 ngôn ngữ
(`en,vi,zh,ja,ko,fr`, 10 model) nhưng RAM khi dùng hết các cặp lên tới
~1.465GB — gần chạm hết ngân sách thực tế của VPS (~1.4GB sau khi trừ
các container khác + OS), không còn margin cho traffic thật nên đã lùi
về 4 ngôn ngữ. Bảng số liệu đầy đủ (2, 4, 10 ngôn ngữ) ở
`docker/libretranslate/README.md`.

Đã test thật trên VPS (2026-09-03), request đúng định dạng
`TranslationService` gửi (`q` là mảng `[title, content]`,
`format: "html"`, `LT_THREADS=1`):

- Dịch đúng cả 4 ngôn ngữ, cả hai chiều, giữ nguyên thẻ HTML.
- RAM: idle ~278MB, peak khi dùng hết cả 6 model ~1.074GB — cap cứng
  `TRANSLATE_MEM_LIMIT=1300M`. Tổng cả 5 container thực tế ~900MB/1.9GB.
- Đĩa VPS sau khi ship: ~5.4GB trống.

**Bài học vận hành**: không chạy `docker build`/`docker save | ssh |
docker load` nặng đồng thời lúc site có traffic thật — đã gây 504 timeout
thật cho user khi build 6-ngôn-ngữ + ship 2 image lớn (2.25GB, 3.88GB)
chạy song song với giờ người dùng đang thao tác. Hết tải thì hết 504
ngay, không phải bug code.

### Thêm/bớt ngôn ngữ

Phải build lại image (`--build-arg models=en,vi,...`) rồi ship lại —
không có tải model lúc runtime trong setup này. **Bắt buộc đo lại RAM
bằng cách gọi `/translate` qua toàn bộ cặp ngôn ngữ (cả 2 chiều)** trước
khi deploy thật — model chỉ load lúc dùng lần đầu và không tự giải phóng,
nên RAM chỉ tăng dần theo thời gian sử dụng thật, không giảm. Cập nhật cả
`TRANSLATE_IMAGE` và `TRANSLATE_MEM_LIMIT` trong `compose.prod.yml` khớp
số đo được. Chi tiết cách đo ở `docker/libretranslate/README.md`.

### Hành vi "thêm ngôn ngữ làm cả nhóm về chờ duyệt"

Khi Blog Owner thêm bản dịch ngôn ngữ mới cho một bài **đã có sẵn** (kể cả
đã PUBLISH), `updateOwnedPostGroupStatus`
(`blogowner-post-helper.service.ts`) đưa **toàn bộ group** (bài gốc + mọi
bản dịch) về `DRAFT`/`PENDING_REVIEW` — không chỉ riêng bản dịch mới. Đây
là hành vi **cố ý** (comment trong code: không để một số version PUBLISH
trong khi bản khác chưa duyệt), đã xác nhận với người vận hành
2026-09-03, giữ nguyên không sửa. Ghi lại ở đây vì dễ bị hiểu nhầm là bug
— bài đã publish "tự nhiên" chuyển về chờ duyệt ngay khi ai đó thêm ngôn
ngữ dịch cho nó.

## 8. Domain + HTTPS

Production chạy ở **`https://blogy.id.vn`** (domain thật, trỏ về IP VPS
`103.72.57.142`). `www.blogy.id.vn` cũng trỏ về cùng IP nhưng luôn
redirect 301 về domain gốc (không phục vụ nội dung riêng) — cả `nginx.conf`
lẫn cert Let's Encrypt đều cấu hình cho cả hai tên.

Trước đó dùng tạm `mainbloggy.duckdns.org` (DuckDNS, free dynamic DNS)
trong lúc chưa có domain thật — cert đó đã bị xoá
(`certbot delete --cert-name mainbloggy.duckdns.org`), không còn dùng.

### Cấp/gia hạn certificate (Let's Encrypt qua Certbot, webroot mode)

Certbot chạy dạng service one-shot trong `compose.prod.yml`, dùng chung
volume `certbot_webroot` với Nginx để phục vụ HTTP-01 challenge. Cert lưu
ở `./docker/certs` (bind mount, **không commit vào git** — đã thêm
`.gitignore`).

Cấp lần đầu (Nginx phải đang chạy config chỉ-HTTP, chưa có khối
`listen 443` tham chiếu cert chưa tồn tại — nếu không nginx sẽ không khởi
động được vì thiếu file cert):

```bash
docker compose -f compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d blogy.id.vn -d www.blogy.id.vn \
  --email <email-thật> --agree-tos --no-eff-email --non-interactive
```

Sau khi có cert, đổi `docker/nginx.conf` sang bản đầy đủ (HTTP redirect
sang HTTPS + server block 443 cho từng domain, `www` chỉ redirect về gốc)
rồi `docker exec ... nginx -s reload` (không cần recreate container, bind
mount đã cập nhật ngay).

Gia hạn tự động: `scripts/renew-cert.sh` + cron 2 lần/ngày (khuyến nghị
của certbot — chỉ renew thật khi còn <30 ngày tới hạn, gọi thường xuyên
không sao):

```bash
(crontab -l 2>/dev/null; echo '17 3,15 * * * /opt/blog-api/backend/scripts/renew-cert.sh >> /var/log/certbot-renew.log 2>&1') | crontab -
```

Cert hiện tại hết hạn **2026-12-02**.

**Đổi/thêm domain sau này**: dùng đúng trình tự bootstrap (config
chỉ-HTTP → cấp cert → chuyển config đầy đủ) — đã làm 2 lần thật
(DuckDNS rồi domain thật), quy trình này luôn cần thiết vì Nginx không
khởi động nổi nếu `listen 443` tham chiếu cert chưa tồn tại.

### Lưu ý allowedHosts (frontend)

Đổi/thêm domain phải cập nhật `angular.json` →
`security.allowedHosts` bên repo `blog-frontend` (xem DEPLOYMENT.md của
repo đó) — để trống hoặc thiếu domain sẽ khiến Angular SSR từ chối mọi
request với Host header không khớp, trả lỗi trông như tới từ Nginx nhưng
thực ra từ Express (`X-Powered-By: Express`, dễ nhầm là lỗi Nginx/config).

## 9. Kiểm tra nhanh

```bash
curl https://blogy.id.vn/api/v1/health/live
curl https://blogy.id.vn/api/v1/health/ready
curl https://blogy.id.vn/
```
