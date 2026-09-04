# Deployment — Blog API + Blog Frontend

Ghi lại đúng những gì đang chạy thật ở production, không phải kế hoạch.
Tài liệu khảo sát ban đầu (trước khi có Docker) nằm ở
`docs/future development documentation/DOCKER_DEPLOYMENT_PLAN.md` — giữ lại
để tham khảo lộ trình dài hạn (staging riêng, managed Postgres, nhiều
replica...), còn file này mô tả setup một-VPS hiện tại.

## 1. Kiến trúc hiện tại — blue-green

```
                              GitHub Actions
                                    │
                        lint / test / build / prisma validate
                                    │
                                    ▼
                                  GHCR
                    ghcr.io/ngocha3792/quan-ly-blog-api:<sha>
                    ghcr.io/ngocha3792/quan-ly-blog-migration:<sha>
                                    │ docker pull
                                    ▼
┌───────────────────────────────── VPS 103.72.57.142 ─────────────────────┐
│                                                                          │
│  Internet ──► Nginx (80/443, container "blog-nginx")                    │
│                 │                                                       │
│                 ├── upstream blog_api  ──► include                      │
│                 │   docker/nginx-blogy/upstream-current.conf            │
│                 │   (symlink, đổi khi deploy)                           │
│                 │        │                                              │
│                 │        ├──► api-blue  :8080  (project blog-api-blue)  │
│                 │        └──► api-green :8080  (project blog-api-green) │
│                 │            chỉ 1 trong 2 đang "current" nhận traffic  │
│                 │                                                       │
│                 └── upstream blog_frontend ──► frontend:4000            │
│                     (Angular SSR, 1 instance, không blue-green)         │
│                                                                          │
│  network "edge": nginx, frontend, api-blue, api-green                   │
│  network "backend" (internal, không ra Internet):                       │
│      postgres, libretranslate, api-blue, api-green, migrate             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- VPS: Ubuntu 20.04, Docker Engine 28 + Compose v2, ~1.9GB RAM — máy yếu,
  **không build image trên VPS** (chỉ `docker pull` từ GHCR).
- Compose project sống ở `/opt/blog-api/backend` trên VPS
  (`compose.shared.yml` + `compose.slot.yml` + `.env.production`, file
  `.env.production` **không** nằm trong git, chỉ tồn tại trên VPS).
- **2 file compose, không phải 1**:
  - `compose.shared.yml` — nginx, postgres, certbot, libretranslate,
    frontend. Chạy 1 project (`blog-shared`), sống lâu dài, hiếm khi
    recreate.
  - `compose.slot.yml` — chỉ có `api` (+ `migrate` one-shot), tham số hoá
    bằng `COLOR`/`API_PORT`/`API_IMAGE`/`MIGRATION_IMAGE`. Chạy **2 lần**,
    mỗi lần một Docker Compose project riêng (`-p blog-api-blue`,
    `-p blog-api-green`) — đây chính là 2 "slot" của blue-green.
- Postgres chạy local trong Docker, không mở cổng 5432 ra Internet, không
  join network `edge` — nginx không có đường trực tiếp tới Postgres.
- `frontend` (từ repo `blog-frontend`) và `api`/`postgres`/`nginx` (từ repo
  `blog-backend`) nằm chung một VPS/thư mục deploy — hai repo chia sẻ một
  target deploy, nhưng chỉ `api` đi theo blue-green; `frontend` vẫn 1
  instance (không có migration/state cần bảo vệ kiểu app nên giá trị
  blue-green ở đây thấp, không đáng đổi thêm độ phức tạp).

Repo:
- Backend: `github.com/ngocha3792/Quan-ly-blog`, thư mục `backend/`.
- Frontend: `github.com/mytmatmong/blog-frontend`.

## 2. CI/CD

Push (hoặc merge) vào nhánh `develop` chạm `backend/**` sẽ tự deploy. 3 job
tuần tự trong `.github/workflows/deploy-backend.yml`, mỗi job `needs:` job
trước — **một bước fail thì không có job sau, không có deployment nào xảy
ra**:

| Job | Việc làm |
|---|---|
| `ci` | `npm ci`, `lint`, `test`, `build`, `prisma validate` |
| `build-push` | build 2 image (`production`, `migration`), push GHCR, tag **duy nhất là commit SHA** — không `:latest`, không `:prod` |
| `deploy` | ship `compose.shared.yml`/`compose.slot.yml`/`docker/`/`scripts/` qua SSH, chạy `scripts/deploy-blue-green.sh <sha>` trên VPS (có `flock` chống 2 deploy chạy song song), rồi smoke test domain công khai |

Frontend vẫn deploy riêng qua `.github/workflows/deploy-frontend.yml` (repo
`blog-frontend`), không đổi trong lần sửa này.

**GHCR thay vì scp+docker load**: trước đây build image ngay trên runner,
nén tar.gz rồi `scp` + `docker load` xuống VPS — không có lịch sử version,
không immutable theo nghĩa "một SHA luôn ra đúng một image". Giờ mỗi commit
build **một lần duy nhất**, push GHCR với tag = SHA; VPS chỉ `docker pull`.
Nếu production lỗi, biết chính xác image nào (SHA nào) đang chạy, và có
thể pull lại đúng bản cũ để rollback (xem mục 6) mà không cần build lại.

**Deploy lock 2 tầng**:
- GitHub Actions: `concurrency: group: production, cancel-in-progress:
  false` trên job `deploy` — 2 workflow run không SSH vào VPS đồng thời.
- VPS: `flock -n .deploy.lock ./scripts/deploy-blue-green.sh ...` — chặn cả
  trường hợp ai đó chạy tay `deploy-blue-green.sh`/`rollback.sh` trong lúc
  CI cũng đang deploy. `-n` (non-blocking): script thứ hai fail ngay thay
  vì xếp hàng chờ vô thời hạn.

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

## 3b. Bootstrap GHCR pull credential trên VPS (one-time)

Job `build-push` push lên GHCR bằng `GITHUB_TOKEN` tự động của Actions —
không cần secret riêng cho bước push. Nhưng **VPS pull image thì cần
đăng nhập riêng**, vì `GITHUB_TOKEN` chỉ sống trong phạm vi một workflow
run, không thể mang sang máy khác:

1. Tạo một Personal Access Token (fine-grained hoặc classic) với quyền
   tối thiểu `read:packages`, gắn với tài khoản có quyền đọc package của
   repo `Quan-ly-blog`.
2. SSH vào VPS, đăng nhập **một lần**:
   ```bash
   echo '<PAT>' | docker login ghcr.io -u ngocha3792 --password-stdin
   ```
3. Docker cache credential ở `~/.docker/config.json` (của user chạy lệnh
   trên VPS — deploy chạy bằng `root` nên login cũng bằng `root`). Các lần
   `docker pull` sau (kể cả từ `deploy-blue-green.sh`/`rollback.sh`) dùng
   lại credential này, không cần login lại mỗi lần deploy.

**Nếu PAT hết hạn/bị thu hồi**: `docker pull` sẽ báo lỗi auth ngay ở bước
`[1/8] Pull image` của `deploy-blue-green.sh`, dừng deploy sớm, BLUE/GREEN
đang chạy không hề bị ảnh hưởng — tạo PAT mới rồi `docker login` lại là đủ.

## 4. Bootstrap blue-green lần đầu (thao tác tay, một lần)

**Mình (Claude) không có SSH access vào VPS thật, không thể tự chạy phần
này** — đây là runbook để bạn tự làm, từng bước, tự xác nhận trước khi qua
bước sau. Đừng để CI tự động deploy vào `develop` trước khi đã xác nhận
xong bootstrap này thủ công ít nhất một lần.

```bash
ssh root@103.72.57.142
cd /opt/blog-api/backend

# 1. Đưa compose.shared.yml/compose.slot.yml/docker/scripts mới lên VPS
#    (lần đầu: git pull hoặc scp tay; các lần sau CI tự làm).

# 2. Tạo network + start layer dùng chung TRƯỚC (nginx, postgres, frontend...).
#    compose.shared.yml tự tạo network "blog-edge"/"blog-backend-net" lúc "up".
docker compose --env-file .env.production -f compose.shared.yml pull
docker compose --env-file .env.production -f compose.shared.yml up -d

# 3. Tạo symlink upstream ban đầu (mặc định trỏ blue — chưa có api-blue
#    thật nào chạy nên nginx sẽ 502 cho /api/v1/* tới khi bước 5 xong,
#    /  (frontend) vẫn hoạt động bình thường).
ln -sfn upstream-blue.conf docker/nginx-blogy/upstream-current.conf
docker exec blog-nginx nginx -t

# 4. Đăng nhập GHCR (xem mục 3b) nếu chưa làm.

# 5. Deploy lần đầu — vì releases/current chưa tồn tại,
#    deploy-blue-green.sh coi CURRENT_COLOR=blue (chưa có SHA thật) và
#    TARGET_COLOR=green, tức là lần đầu tiên sẽ dựng "green" trước.
chmod +x scripts/*.sh scripts/lib/*.sh
GRACE_SECONDS=90 ./scripts/deploy-blue-green.sh <sha-image-đã-push-GHCR>

# 6. Theo dõi log của chính script — nó tự in từng bước [1/8]..[8/8].
#    Nếu dừng giữa chừng (backup/migration/healthcheck/smoke fail), BLUE
#    coi như chưa từng tồn tại thật nên không "rollback" gì cả — chỉ cần
#    sửa lỗi rồi chạy lại đúng lệnh trên.
```

Sau khi bước 5 thành công lần đầu, các lần deploy tiếp theo (qua CI hoặc
chạy tay `./scripts/deploy-blue-green.sh <sha>`) tự động biết
current/target dựa vào `releases/current`.

## 5. Backup / Restore

```bash
cd /opt/blog-api/backend
./scripts/backup-postgres.sh                 # ghi vào ./backups, kèm sha256
CONFIRM_RESTORE=yes ./scripts/restore-postgres.sh ./backups/blog_<timestamp>.dump
```

Giữ 14 backup gần nhất trong `./backups` trên VPS — đây **không phải**
backup ngoài VPS, cần tự chép ra nơi khác định kỳ nếu dữ liệu quan trọng.

`deploy-blue-green.sh` gọi `backup-postgres.sh` **trước** migration ở mỗi
lần deploy, và **dừng deploy ngay nếu backup fail** — không có kiểu
"backup lỗi, vẫn tiếp tục deploy" như workflow cũ trước đây.

Backup không phục vụ rollback thông thường (xem mục 6, rollback app không
đụng gì tới DB) — nó phục vụ trường hợp migration/thao tác thật sự phá dữ
liệu, cần restore thủ công có chủ đích. Backup chưa từng restore thử thì
chưa chắc là backup — nên test restore định kỳ, không chỉ tin vào việc
file `.dump` tồn tại.

## 6. Rollback

**Application rollback là tự động** (bên trong `deploy-blue-green.sh`):
nếu smoke test domain công khai fail ngay sau khi switch Nginx, script tự
switch ngược lại slot cũ và exit 1 — CI báo fail, nhưng user gần như không
thấy gì bất thường vì traffic đã quay lại slot vẫn đang chạy tốt.

**Rollback thủ công** (sau khi deploy đã "xong" — vd phát hiện bug vài
phút/giờ sau) dùng một lệnh, không cần nhớ SHA nào đang chạy:

```bash
cd /opt/blog-api/backend
flock -n .deploy.lock ./scripts/rollback.sh
```

`rollback.sh` đọc `releases/current`/`releases/previous`, tự dựng lại slot
trước đó nếu nó đã bị dừng (sau grace period của lần deploy trước), smoke
test slot đó trực tiếp, switch Nginx, rồi smoke test domain công khai lần
nữa. Chạy được độc lập qua SSH kể cả khi GitHub Actions không dùng được —
đây là "operational escape hatch".

**`rollback.sh` KHÔNG chạy migration, KHÔNG đụng tới Postgres.** Chỉ an
toàn khi migration của lần deploy gần nhất tuân thủ nguyên tắc
expand-contract ở mục 7 — nếu vi phạm (vd đã `DROP COLUMN` mà app cũ vẫn
cần cột đó), rollback code sẽ làm app cũ crash vì thiếu cột, không phải vì
script rollback sai.

**Database KHÔNG bao giờ tự động rollback**, kể cả khi rollback app. Ví
dụ: 12:00 deploy → 12:01 migration → 12:02 user tạo bài mới → 12:03 phát
hiện app lỗi. Nếu tự động restore backup lúc 12:00, bài user vừa tạo biến
mất. Vì vậy: rollback app = tự động (đổi code + traffic); restore database
= thao tác tay có chủ đích, dùng backup ở mục 5, chỉ làm khi migration
thật sự phá dữ liệu — không phải phản xạ mặc định mỗi lần rollback.

## 7. Chính sách migration — expand → migrate → contract

Blue-green không cứu được một migration tệ: trong lúc GREEN đang chạy
migration + healthcheck, **BLUE (code cũ) vẫn đang phục vụ traffic thật**
trên cùng schema. Vì vậy nguyên tắc bắt buộc cho mọi migration đổi/xoá dữ
liệu đang dùng:

> Schema sau migration phải vẫn tương thích với version app N-1 (đang chạy
> trước khi deploy) — không chỉ với version app N-1 (vừa deploy xong).

Ví dụ đổi `username` thành `display_name`, **không** làm trong một release:

```sql
-- SAI — rollback là chết ngay vì app cũ không còn cột username.
ALTER TABLE users DROP COLUMN username;
ALTER TABLE users ADD display_name text;
```

Chia 3 release:

1. **Expand**: `ALTER TABLE users ADD COLUMN display_name text;` — app mới
   đọc/ghi cả `username` lẫn `display_name`. BLUE cũ (chưa biết
   `display_name`) vẫn chạy bình thường vì `username` chưa mất.
2. **Migrate**: backfill (`UPDATE users SET display_name = username WHERE
   display_name IS NULL;`), app chuyển hẳn sang dùng `display_name`.
3. **Contract**: `ALTER TABLE users DROP COLUMN username;` — chỉ làm sau
   khi chắc chắn không còn version nào (kể cả bản để rollback khẩn cấp)
   còn cần `username`, cách release Migrate ít nhất một khoảng đủ an tâm.

Không có schema change nào đang chờ áp dụng nguyên tắc này ngay lúc viết
tài liệu — đây là chính sách cho **lần review schema tiếp theo**, không
phải việc cần làm ngay.

## 8. Retention / cleanup image

VPS chỉ giữ tối đa 3 SHA gần nhất cho mỗi image (`api`, `migration`):
`current`, `previous`, và một bản cũ hơn nữa ("emergency") — đủ để
`rollback.sh` luôn dựng lại được slot trước đó mà không cần `docker pull`
lại. `scripts/cleanup-images.sh` chạy tự động ở cuối `deploy-blue-green.sh`
(sau khi đã switch + dừng slot cũ thành công), suy ra danh sách SHA cần
giữ từ `releases/current` + `releases/previous` + `releases/audit.log`,
xoá phần còn lại bằng `docker rmi` — không dùng `docker image prune -f`
kiểu prune mù như workflow cũ, vì nó không phân biệt được image nào còn
cần giữ để rollback.

GHCR (`ghcr.io/ngocha3792/...`) giữ toàn bộ lịch sử image, không bị
retention này ảnh hưởng — retention chỉ áp dụng cho bản sao local trên VPS
để tiết kiệm đĩa.

## 9. Các lỗi thật đã gặp khi dựng pipeline (để không lặp lại)

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
  chạy trên Linux. Đã thêm `.gitattributes` ép `eol=lf` cho các file này
  (bao gồm cả `compose*.yml`, `*.conf` — quan trọng với bộ file
  blue-green mới vì `compose.shared.yml`/`compose.slot.yml`/nginx conf
  đều khớp pattern này).
- **Dán private key qua Notepad vào GitHub secret** có thể làm hỏng định
  dạng (`error in libcrypto` khi OpenSSH đọc key) — dùng PowerShell
  `Set-Clipboard` thay vì mở file bằng editor.

## 10. Dịch tự động (LibreTranslate) — đang chạy, 4 ngôn ngữ

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
xuống bằng `docker save | ssh | docker load` — image này không đi qua GHCR
(không phải image do CI của repo này build), vẫn ship kiểu cũ.

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

**Vì sao grace period của blue-green chỉ 90s, không phải 5-15 phút**: số
đo RAM ở trên (~900MB/1.9GB với 1 instance API) không còn nhiều margin để
giữ **2 instance API** sống song song lâu — mỗi container Nest thêm
~100-200MB, cộng với việc LibreTranslate có thể đang ở gần peak 1.074GB
cùng lúc. 90 giây là đủ để chắc chắn traffic đã ổn định ở slot mới mà
không kéo dài thời gian có 2 API sống song song trên một máy RAM hạn chế.
Có thể chỉnh bằng `GRACE_SECONDS=<giây> ./scripts/deploy-blue-green.sh
<sha>` nếu sau này nâng cấp VPS.

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
`TRANSLATE_IMAGE` và `TRANSLATE_MEM_LIMIT` trong `compose.shared.yml`
(trước đây là `compose.prod.yml` — đã tách sang file này, xem mục 1) khớp
số đo được. Chi tiết cách đo ở `docker/libretranslate/README.md`.

### Bug đã gặp: gunicorn worker tự thoát mà không nạp lại — dịch vụ đơ hoàn toàn

Phát hiện 2026-09-03 khi chạy dịch hàng loạt (~1600 request) để build từ
điển zh/ja cho frontend. Log container cho thấy pattern lặp lại 3 lần:

```
[INFO] Autorestarting worker after current request.
[INFO] Worker exiting (pid: N)
```

...và sau đó **không có dòng "Booting worker" nào tiếp theo** — arbiter
của gunicorn (`LT_THREADS=1`, 1 worker duy nhất) thỉnh thoảng không tự nạp
lại worker thay thế sau khi worker cũ tự thoát (`Autorestarting worker`,
có vẻ do một giới hạn kiểu `max_requests` trong config LibreTranslate,
không nằm trong `compose.shared.yml`). Khi đó container vẫn "healthy" về
mặt Docker (process chính còn sống) nhưng **không còn worker nào xử lý
request** — mọi request tới `/translate` (kể cả từ tính năng dịch bài viết
thật của user) sẽ treo vô thời hạn cho tới khi bị timeout ở tầng nginx.

Xảy ra độc lập với việc request có thành công hay không (lần thứ 3 tái
hiện dù toàn bộ request đang lỗi 400 do bug ở script gọi, không phải do
tải nặng) — nghiêng về nguyên nhân là **đếm theo số request**, không phải
theo thời gian hay theo lỗi.

**Cách phát hiện**: `/languages` (hoặc bất kỳ endpoint nào) timeout dù
container Docker vẫn "healthy"; `docker logs` có "Worker exiting" mà
không có "Booting worker" theo sau.

**Cách khắc phục tạm thời**: `docker restart blog-libretranslate`
— khôi phục ngay lập tức, không mất dữ liệu (dịch vụ không có state).
(Tên container cũ trước khi tách file compose:
`blog-backend-prod-libretranslate-1` — nếu tài liệu/script cũ nào còn ghi
tên đó thì đã lỗi thời, xem mục 1.)

**Chưa xử lý tận gốc** (ngoài phạm vi lần sửa i18n frontend này): cần sửa
gunicorn config trong image (`Dockerfile.cpu-slim`) để tắt auto-restart
theo `max_requests` hoặc tăng số worker (đánh đổi RAM), hoặc thêm một
watchdog bên ngoài tự `docker restart` khi healthcheck thất bại liên tục.
Vì `LT_THREADS=1` là lựa chọn có chủ đích để tiết kiệm RAM, việc tăng
worker cần cân nhắc lại ngân sách RAM đã tính ở mục trên.

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

## 11. Domain + HTTPS

Production chạy ở **`https://blogy.id.vn`** (domain thật, trỏ về IP VPS
`103.72.57.142`). `www.blogy.id.vn` cũng trỏ về cùng IP nhưng luôn
redirect 301 về domain gốc (không phục vụ nội dung riêng) — cả `nginx.conf`
lẫn cert Let's Encrypt đều cấu hình cho cả hai tên.

Trước đó dùng tạm `mainbloggy.duckdns.org` (DuckDNS, free dynamic DNS)
trong lúc chưa có domain thật — cert đó đã bị xoá
(`certbot delete --cert-name mainbloggy.duckdns.org`), không còn dùng.

### Cấp/gia hạn certificate (Let's Encrypt qua Certbot, webroot mode)

Certbot chạy dạng service one-shot trong `compose.shared.yml` (trước đây
là `compose.prod.yml` — xem mục 1), dùng chung volume `certbot_webroot`
với Nginx để phục vụ HTTP-01 challenge. Cert lưu ở `./docker/certs` (bind
mount, **không commit vào git** — đã thêm `.gitignore`).

Cấp lần đầu (Nginx phải đang chạy config chỉ-HTTP, chưa có khối
`listen 443` tham chiếu cert chưa tồn tại — nếu không nginx sẽ không khởi
động được vì thiếu file cert):

```bash
docker compose -f compose.shared.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d blogy.id.vn -d www.blogy.id.vn \
  --email <email-thật> --agree-tos --no-eff-email --non-interactive
```

Sau khi có cert, đổi `docker/nginx.conf` sang bản đầy đủ (HTTP redirect
sang HTTPS + server block 443 cho từng domain, `www` chỉ redirect về gốc)
rồi `docker exec blog-nginx nginx -s reload` (không cần recreate
container, bind mount đã cập nhật ngay).

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

## 12. Kiểm tra nhanh

```bash
curl https://blogy.id.vn/api/v1/health/live
curl https://blogy.id.vn/api/v1/health/ready
curl https://blogy.id.vn/
```

Xem slot nào đang thật sự nhận traffic:

```bash
cat /opt/blog-api/backend/releases/current   # "blue <sha>" hoặc "green <sha>"
readlink /opt/blog-api/backend/docker/nginx-blogy/upstream-current.conf
```
