# Quản lý Blog — Backend API

Backend cho nền tảng blog đa ngôn ngữ **Blogy**: xuất bản nội dung, tương tác cộng đồng, kiểm duyệt, dịch tự động và quản trị theo vai trò. Dự án không chỉ dừng ở mức chạy local — hệ thống đang **chạy thật trên production** tại [blogy.id.vn](https://blogy.id.vn), triển khai theo mô hình blue-green trên một VPS, tự động deploy qua GitHub Actions mỗi khi có thay đổi.

<p align="center">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Blue--Green-2496ED?logo=docker&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white">
</p>

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc](#kiến-trúc)
- [Triển khai production](#triển-khai-production)
- [Vai trò và phân quyền](#vai-trò-và-phân-quyền)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt và chạy dự án](#cài-đặt-và-chạy-dự-án)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
- [Tài khoản seed](#tài-khoản-seed)
- [Quy ước API](#quy-ước-api)
- [Kiểm thử và chất lượng mã](#kiểm-thử-và-chất-lượng-mã)
- [Tài liệu dự án](#tài-liệu-dự-án)
- [Phân công](#phân-công)
- [Lộ trình phát triển](#lộ-trình-phát-triển)
- [Lưu ý bảo mật](#lưu-ý-bảo-mật)

---

## Giới thiệu

Dự án **Quản lý Blog** được xây dựng theo kiến trúc **Modular Monolith** bằng NestJS, đóng vai trò backend cho một nền tảng blog đa ngôn ngữ có tên **Blogy**. Hệ thống cung cấp quy trình hoàn chỉnh từ đăng ký tài khoản, viết bài, gửi duyệt, xuất bản, tương tác cộng đồng, dịch tự động sang nhiều ngôn ngữ, cho tới xử lý vi phạm và quản trị toàn nền tảng.

Repo này (`blog-backend`) chỉ là một nửa hệ thống — phần giao diện người dùng nằm ở repo riêng [`blog-frontend`](https://github.com/mytmatmong/blog-frontend), xây dựng bằng Angular 21 + Tailwind CSS 4, cũng deploy độc lập lên cùng VPS. Hai repo chia sẻ chung một nginx làm reverse proxy phía trước.

Các đặc điểm chính:

- Nội dung đa ngôn ngữ: mỗi bài viết có một bản gốc (ROOT) và nhiều bản dịch, liên kết với nhau thành một "logical article" — view, like, comment được tính gộp theo cả nhóm chứ không tách rời từng bản dịch.
- Dịch bài viết **tự động, chạy nền** qua BullMQ + Redis, gọi tới một service LibreTranslate tự host (self-hosted, không phụ thuộc API dịch trả phí) — không còn chặn request tạo/sửa bài chờ dịch xong như thiết kế ban đầu.
- Phân quyền theo 4 vai trò: `NORMAL`, `BLOG_OWNER`, `CONTENT_MODERATOR`, `SUPER_ADMIN`.
- Vòng đời bài viết gồm `DRAFT`, `PENDING_REVIEW`, `PUBLISH`, `REJECT`.
- Like, bookmark, follow, comment, reply và report vi phạm.
- Upload avatar, thumbnail, ảnh và video qua Cloudinary.
- Access token, refresh token và quản lý phiên đăng nhập theo từng thiết bị.
- Khôi phục mật khẩu qua email (SMTP + template EJS).
- Rate limiting (`@nestjs/throttler`), soft delete và lịch dọn dữ liệu tự động.
- Deploy tự động theo mô hình **blue-green** (2 slot API thay phiên nhận traffic), không có downtime khi release phiên bản mới.

### Quy mô hiện tại

| Hạng mục | Số lượng |
|---|---:|
| Nhóm API | 5 |
| Endpoint | 92 |
| Prisma model | 20 |
| Enum nghiệp vụ | 8 |
| File unit test/spec | 68 (518 test case) |
| Base URL mặc định | `/api/v1` |
| Cổng mặc định | `8080` |

---

## Tính năng chính

### Public API — 16 endpoint

- Đăng ký, đăng nhập, quên và đặt lại mật khẩu.
- Xem danh sách, bài nổi bật và chi tiết bài viết đã xuất bản.
- Lọc bài theo tác giả, ngôn ngữ, danh mục và tag.
- Ghi nhận lượt xem hợp lệ cho bài viết (chống trùng theo viewer + thời gian).
- Xem tác giả nổi bật và trang cá nhân công khai của Blog Owner.
- Xem danh mục, tag và bình luận công khai (kèm reply).

### User API — 28 endpoint

- Refresh token, logout một thiết bị và logout toàn bộ thiết bị.
- Xem, cập nhật, upload avatar và xóa tài khoản.
- Follow/unfollow người dùng, xem follower/following.
- Like/unlike và bookmark/unbookmark bài viết.
- Tạo, sửa, xóa comment hoặc reply.
- Báo cáo bài viết hoặc bình luận vi phạm.
- Gửi, xem và hủy yêu cầu trở thành Blog Owner.

### Blog Owner API — 14 endpoint

- Dashboard nội dung cá nhân (tổng quan, hoạt động, bài nổi bật).
- Tạo, sửa, xóa mềm và gửi duyệt bài viết.
- Upload thumbnail và media riêng cho từng bài.
- Xem trước bản dịch trước khi lưu, hoặc **enqueue dịch nền** sang nhiều ngôn ngữ cùng lúc — bài dài dịch ra 3-4 ngôn ngữ có thể chạy hợp lệ 10-20 phút mà không làm request bị treo.
- Theo dõi tiến độ một batch dịch (đang chờ / đang dịch / xong / lỗi) theo từng ngôn ngữ.
- Lấy danh sách ngôn ngữ, danh mục và tag phục vụ soạn bài.

### Moderator API — 18 endpoint

- Dashboard kiểm duyệt: tổng quan nhanh, thống kê report theo trạng thái/lý do, xu hướng report 7 ngày gần nhất.
- Duyệt hoặc từ chối bài viết đang chờ kiểm duyệt.
- Xem và xử lý report (resolve/reject).
- Tạo, sửa, xóa Category Group cùng bản dịch đa ngôn ngữ; dịch thử tên danh mục trước khi lưu; xóa từng bản dịch riêng lẻ.

### Admin API — 16 endpoint

- Dashboard toàn hệ thống.
- Quản lý ngôn ngữ (thêm/sửa/xóa/kích hoạt).
- Quản lý user: xem, cập nhật, đổi role, khóa/mở khóa, xóa mềm.
- Tạo tài khoản Content Moderator.
- Duyệt hoặc từ chối yêu cầu nâng cấp lên Blog Owner.

---

## Kiến trúc

```mermaid
flowchart LR
    Client[Web / Mobile Client]

    subgraph Application[NestJS Modular Monolith]
        Middleware[Logger & Maintenance Middleware]
        Pipeline[Trim & Validation Pipes]
        Security[JWT & Roles Guards]
        APIs[Public / User / Blog Owner / Moderator / Admin]
        Core[Core Domain Services]
        Queue[BullMQ Translation Worker]
        Output[Interceptor & Exception Filters]
    end

    PostgreSQL[(PostgreSQL)]
    Redis[(Redis)]
    Cloudinary[Cloudinary]
    SMTP[SMTP Server]
    LibreTranslate[LibreTranslate — self-hosted]

    Client --> Middleware --> Pipeline --> Security --> APIs --> Core
    Core --> PostgreSQL
    Core --> Cloudinary
    Core --> SMTP
    Core -.enqueue.-> Queue
    Queue <--> Redis
    Queue --> LibreTranslate
    Queue --> PostgreSQL
    APIs --> Output --> Client
```

### Nguyên tắc tổ chức

- `src/*` chứa controller, service, DTO và entity theo từng nhóm người dùng (public, user, blogowner, moderator, admin).
- `libs/core/*` chứa nghiệp vụ dùng chung: Prisma, guard, filter, pipe, interceptor và các tích hợp ngoài (Cloudinary, mail, translation...).
- Controller nhận HTTP request, kiểm tra quyền truy cập, chuyển việc cho service.
- API service triển khai logic riêng theo vai trò; Core service thực hiện nghiệp vụ dùng chung và truy cập dữ liệu.
- Prisma quản lý PostgreSQL thông qua `@prisma/adapter-pg`.
- Job dịch bài viết chạy nền qua `BullMQ` (`src/blogowner/queues/`) — worker chạy ngay trong process API, không phải container riêng; Redis chỉ đóng vai trò backing store cho hàng đợi, không dùng làm cache.

---

## Triển khai production

Đây là phần khác biệt lớn nhất so với một đồ án chỉ chạy local: dự án được **deploy thật, có domain thật, có CI/CD, có giám sát tự phục hồi**.

- **Domain**: [blogy.id.vn](https://blogy.id.vn), HTTPS qua Let's Encrypt, redirect `www` về domain gốc.
- **Hạ tầng**: một VPS (~1.9GB RAM) chạy Docker Compose, chia làm 2 lớp:
  - `compose.shared.yml` — các service sống lâu dài: Nginx, PostgreSQL, Redis, LibreTranslate, autoheal, frontend.
  - `compose.slot.yml` — riêng service `api`, chạy thành **2 slot song song** (`api-blue`, `api-green`) để deploy kiểu blue-green: build image mới, chạy migration, health-check, smoke-test slot mới **trước khi** chuyển traffic sang, slot cũ vẫn giữ sống thêm một khoảng grace period rồi mới tắt — gần như không có downtime, và tự động rollback traffic nếu smoke-test sau khi chuyển bị lỗi.
- **CI/CD**: push vào `develop` chạm `backend/**` → GitHub Actions chạy `lint → test → build → prisma validate`, build 2 image (production + migration) đẩy lên GHCR gắn tag theo commit SHA, rồi SSH vào VPS chạy script deploy blue-green.
- **Tự phục hồi (autoheal)**: LibreTranslate (dịch tự động) chạy trên tài nguyên rất hẹp nên occasionally cần restart — có một container giám sát tự động `docker restart` khi healthcheck báo lỗi kéo dài, thay vì phải có người phát hiện thủ công.
- **Backup**: tự động backup PostgreSQL trước mỗi lần migrate, giữ lại các bản gần nhất kèm checksum.

Chi tiết đầy đủ (kiến trúc, runbook rollback, các sự cố thật đã gặp và cách xử lý) nằm ở [`DEPLOYMENT.md`](./DEPLOYMENT.md) — tài liệu này được cập nhật liên tục theo đúng những gì đang chạy thật, không phải kế hoạch trên giấy.

---

## Vai trò và phân quyền

| Vai trò | Khả năng chính |
|---|---|
| `NORMAL` | Quản lý hồ sơ, tương tác bài viết, comment, follow, report và gửi yêu cầu Blog Owner |
| `BLOG_OWNER` | Toàn bộ quyền tương tác phù hợp và quản lý bài viết của chính mình, kể cả dịch tự động |
| `CONTENT_MODERATOR` | Duyệt bài, xử lý report và quản lý nhóm danh mục |
| `SUPER_ADMIN` | Quản lý user, role, trạng thái, ngôn ngữ và yêu cầu Blog Owner |

> `RolesGuard` kiểm tra role theo danh sách được khai báo tại từng route. Hệ thống hiện không tự động kế thừa quyền theo cấp bậc.

---

## Công nghệ sử dụng

| Nhóm | Công nghệ |
|---|---|
| Runtime | Node.js `>= 20` |
| Backend | NestJS 11, TypeScript 5.7 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Job queue | BullMQ + Redis (`ioredis`) — dịch bài viết chạy nền |
| Dịch tự động | LibreTranslate — tự build, tự host, không qua API trả phí |
| Authentication | JWT, bcrypt và password pepper |
| Validation | class-validator, class-transformer |
| Rate limiting | `@nestjs/throttler` |
| Scheduler | `@nestjs/schedule` |
| File storage | Cloudinary |
| Email | Nodemailer, SMTP, EJS |
| Testing | Jest, ts-jest, Supertest |
| Code quality | ESLint, Prettier |
| Hạ tầng | Docker, Docker Compose, Nginx, GitHub Actions, GHCR |

---

## Cấu trúc thư mục

```text
backend/
├── database/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── docker/
│   ├── nginx.conf
│   ├── nginx-blogy/
│   └── libretranslate/
├── libs/
│   └── core/
│       └── src/
│           ├── common/
│           ├── config/
│           ├── core/prisma/
│           └── modules/          # auths, categories, cleanup, cloudinary,
│                                  # comments, health, languages, mail, media,
│                                  # posts, reports, security-logs, tags,
│                                  # translation, users
├── scripts/                      # deploy-blue-green.sh, rollback.sh,
│                                  # backup/restore-postgres.sh, ...
├── src/
│   ├── admin/
│   ├── blogowner/
│   │   └── queues/                # BullMQ: processor, queue service, status
│   ├── moderator/
│   ├── public/
│   ├── user/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── compose.local.yml              # dev: Postgres + Redis + API
├── compose.shared.yml             # prod: layer sống lâu dài
├── compose.slot.yml               # prod: template 1 slot API blue-green
├── .env.example
├── package.json
├── prisma.config.ts
└── README.md
```

---

## Cài đặt và chạy dự án

### 1. Yêu cầu hệ thống

- Node.js `>= 20`.
- npm.
- PostgreSQL.
- Redis (bắt buộc nếu muốn thử tính năng dịch tự động — không có Redis thì các API khác vẫn chạy bình thường, chỉ riêng enqueue dịch sẽ lỗi).
- Tài khoản Cloudinary nếu sử dụng upload.
- SMTP account nếu sử dụng quên mật khẩu.

Cách nhanh nhất để có đủ Postgres + Redis cho dev mà không cần cài tay: `docker compose -f compose.local.yml up -d postgres redis`.

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file môi trường

Linux/macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Sau đó cập nhật các giá trị trong `.env`.

### 4. Sinh Prisma Client

```bash
npx prisma generate
```

### 5. Chạy migration

Môi trường phát triển:

```bash
npx prisma migrate dev
```

Môi trường production:

```bash
npx prisma migrate deploy
```

### 6. Tạo dữ liệu mẫu

```bash
npx prisma db seed
```

### 7. Khởi động ứng dụng

```bash
# Development
npm run start:dev

# Development không watch
npm run start

# Build
npm run build

# Production sau khi build
npm run start:prod
```

Ứng dụng mặc định chạy tại:

```text
http://localhost:8080/api/v1
```

---

## Cấu hình môi trường

Ví dụ cấu hình tối thiểu:

```dotenv
DATABASE_URL="postgresql://postgres:password@localhost:5432/blog_management"

APP_PORT=8080
NODE_ENV=development
APP_NAME="Blog Management API"
API_PREFIX=api/v1
FRONTEND_URL=http://localhost:4200
MAINTENANCE_MODE=false

DB_POOL_SIZE=10
DB_LOG_QUERIES=false

PASSWORD_PEPPER=replace-with-a-long-random-value
JWT_ACCESS_TOKEN_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_TOKEN_SECRET=replace-with-a-different-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_DEFAULT_FOLDER=nestjs_blog

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM="Blog Management <noreply@example.com>"
MAIL_IGNORE_TLS=false

TRANSLATE_API_URL=

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
```

### Nhóm biến môi trường

| Nhóm | Biến |
|---|---|
| Database | `DATABASE_URL`, `DB_POOL_SIZE`, `DB_LOG_QUERIES` |
| Application | `APP_PORT`, `NODE_ENV`, `APP_NAME`, `API_PREFIX`, `FRONTEND_URL`, `MAINTENANCE_MODE` |
| JWT | `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Password | `PASSWORD_PEPPER` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_DEFAULT_FOLDER` |
| Mail | `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_IGNORE_TLS` |
| Translation | `TRANSLATE_API_URL` |
| Redis / BullMQ | `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD` |

---

## Cơ sở dữ liệu

Prisma schema nằm tại:

```text
database/schema.prisma
```

Hệ thống có 20 model chính:

```text
User                  UserSession
PasswordResetToken    Language
CategoryGroup         Category
BlogOwnerRequest      Post
PostCategory          PostDailyMetric
PostViewLog           Media
Comment               Tag
PostTag               PostLike
PostBookmark          UserFollow
Report                SecurityLog
```

Các lệnh Prisma thường dùng:

```bash
# Sinh client
npx prisma generate

# Tạo migration mới
npx prisma migrate dev --name <migration_name>

# Chạy migration production
npx prisma migrate deploy

# Seed dữ liệu
npx prisma db seed

# Mở giao diện quản lý dữ liệu
npx prisma studio
```

---

## Tài khoản seed

Lệnh `npx prisma db seed` tạo các tài khoản sau cho môi trường phát triển:

| Role | Username | Email | Mật khẩu |
|---|---|---|---|
| `SUPER_ADMIN` | `super_admin` | `super.admin@seed.local` | `Admin123!` |
| `CONTENT_MODERATOR` | `moderator_001` | `moderator.001@seed.local` | `Test123!` |
| `BLOG_OWNER` | `owner_001` | `owner.001@seed.local` | `Test123!` |
| `NORMAL` | `user_001` | `user.001@seed.local` | `Test123!` |

Ngoài `moderator_001`/`owner_001`/`user_001`, seed script còn sinh thêm nhiều tài khoản khác cùng vai trò (đánh số `_002`, `_003`...) để có đủ dữ liệu giả lập tương tác thật.

> Các tài khoản và mật khẩu này chỉ dành cho local/test. Không chạy seed mặc định trên production nếu chưa thay đổi dữ liệu mẫu.

---

## Quy ước API

### Authentication

Các route bảo vệ sử dụng header:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Refresh token được gửi trong JSON body ở các route refresh/logout:

```json
{
  "refreshToken": "<JWT_REFRESH_TOKEN>"
}
```

### Success response

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "example": "business payload"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### Error response

```json
{
  "success": false,
  "statusCode": 400,
  "message": [
    "property extraField should not exist"
  ],
  "path": "/api/v1/example",
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### Validation

Global `ValidationPipe` đang bật:

```ts
{
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true
}
```

Vì vậy field không thuộc DTO sẽ làm request thất bại thay vì được tự động bỏ qua.

`TrimPipe` cắt khoảng trắng đệ quy trong request body. Query và path parameter được xử lý riêng bởi decorator hoặc pipe tương ứng.

### Pagination

Các route dùng pagination có giá trị mặc định:

```text
page = 1
limit = 10
maximum limit = 50
```

### Ngôn ngữ

Tùy route, ngôn ngữ được xác định theo thứ tự:

1. `languageId`.
2. Query `lang`.
3. Header `Accept-Language`.
4. Ngôn ngữ mặc định của hệ thống.

---

## Kiểm thử và chất lượng mã

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# End-to-end tests
npm run test:e2e

# Debug tests
npm run test:debug

# ESLint và tự sửa lỗi có thể sửa
npm run lint

# Prettier
npm run format

# Build để kiểm tra TypeScript
npm run build
```

Trước khi mở pull request, nên chạy tối thiểu:

```bash
npm run lint
npm run test
npm run build
```

CI (`.github/workflows/deploy-backend.yml`) chạy đúng 3 lệnh trên (cộng `prisma validate`) trước khi build image — một bước fail thì không có bản deploy nào được tạo ra.

---

## Tài liệu dự án

| Tài liệu | Nội dung |
|---|---|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Kiến trúc blue-green thật đang chạy, CI/CD, rollback, các sự cố production đã gặp và cách xử lý |
| [`docs/Preview Documentation/PROJECT_OVERVIEW.md`](./docs/Preview%20Documentation/PROJECT_OVERVIEW.md) | Tổng quan mục tiêu, kiến trúc, luồng nghiệp vụ |
| [`docs/Preview Documentation/ARCHITECTURE.md`](./docs/Preview%20Documentation/ARCHITECTURE.md) | Kiến trúc chi tiết theo module |
| [`docs/Preview Documentation/BUSINESS_WORKFLOWS.md`](./docs/Preview%20Documentation/BUSINESS_WORKFLOWS.md) | Luồng nghiệp vụ (vòng đời bài viết, report, yêu cầu Blog Owner...) |
| [`docs/Preview Documentation/DATABASE_DOCUMENTATION.md`](./docs/Preview%20Documentation/DATABASE_DOCUMENTATION.md) | Chi tiết schema, quan hệ giữa các model |
| [`docs/Preview Documentation/ROLE_AND_PERMISSION_MATRIX.md`](./docs/Preview%20Documentation/ROLE_AND_PERMISSION_MATRIX.md) | Ma trận quyền theo vai trò |
| [`docs/api documentation/PUBLIC_API_DOCUMENTATION.md`](./docs/api%20documentation/PUBLIC_API_DOCUMENTATION.md) | 16 API Public |
| [`docs/api documentation/USER_API_DOCUMENTATION.md`](./docs/api%20documentation/USER_API_DOCUMENTATION.md) | 28 API User |
| [`docs/api documentation/BLOGOWNER_API_DOCUMENTATION.md`](./docs/api%20documentation/BLOGOWNER_API_DOCUMENTATION.md) | 14 API Blog Owner |
| [`docs/api documentation/MODERATOR_API_DOCUMENTATION.md`](./docs/api%20documentation/MODERATOR_API_DOCUMENTATION.md) | 18 API Moderator |
| [`docs/api documentation/ADMIN_API_DOCUMENTATION.md`](./docs/api%20documentation/ADMIN_API_DOCUMENTATION.md) | 16 API Admin |
| [`docs/future development documentation/`](./docs/future%20development%20documentation) | Roadmap chưa triển khai: OAuth2, Search 2.0, mở rộng Security Logs |

> Một vài số liệu trong các tài liệu ở `docs/` (ngày rà soát cũ hơn README này) có thể chưa cập nhật theo các thay đổi gần nhất — README này và `DEPLOYMENT.md` là 2 nguồn được đồng bộ thường xuyên nhất.

---

## Phân công

Dự án do 2 thành viên phụ trách phần backend:

| Thành viên | Phạm vi phụ trách |
|---|---|
| **Hoàng** | `libs/core`, Public API, User API, Admin API — nền tảng dùng chung, xác thực, tương tác người dùng, quản trị hệ thống |
| **Sơn** | Blog Owner API, Moderator API, hàng đợi dịch nền (BullMQ/Redis), tích hợp LibreTranslate |

Chi tiết công việc từng người ở [`docs/phancongcongviec/`](./docs/phancongcongviec).

---

## Lộ trình phát triển

Các hướng chưa triển khai, đã có tài liệu khảo sát riêng ở [`docs/future development documentation/`](./docs/future%20development%20documentation):

- Đăng nhập qua OAuth2 (Google...).
- Search 2.0 — tìm kiếm nâng cao.
- Mở rộng Security Logs.
- Tách worker dịch nền ra container riêng thay vì chạy chung process với API — cân nhắc khi VPS được nâng cấp thêm RAM, hiện tại chưa đủ ngân sách để đánh đổi (xem thảo luận trong `DEPLOYMENT.md`).

---

## Lưu ý bảo mật

- Không commit `.env`, `.env.production` hay bất kỳ file chứa secret thật nào — `.env.production` trên VPS không nằm trong git, chỉ tồn tại trên server.
- `PASSWORD_PEPPER` và các secret JWT phải là giá trị ngẫu nhiên, đủ dài, khác nhau giữa các môi trường.
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) là lớp phòng thủ đầu tiên chống payload thừa/độc hại — không tắt khi thêm route mới.
- Các tài khoản seed ở mục [Tài khoản seed](#tài-khoản-seed) chỉ dùng cho local/test, không seed mặc định lên production.
- Đổi khóa SSH dùng để deploy ngay khi nghi ngờ bị lộ (xem `DEPLOYMENT.md` mục Setup secret SSH).
