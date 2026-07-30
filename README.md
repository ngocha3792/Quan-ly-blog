# Quản lý Blog — Backend API

Backend cho nền tảng blog đa ngôn ngữ, hỗ trợ xuất bản nội dung, tương tác cộng đồng, kiểm duyệt và quản trị theo vai trò.

<p align="center">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white">
</p>

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc](#kiến-trúc)
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

Dự án **Quản lý Blog** được xây dựng theo kiến trúc **Modular Monolith** bằng NestJS. Hệ thống cung cấp quy trình hoàn chỉnh từ đăng ký tài khoản, viết bài, gửi duyệt, xuất bản, tương tác cộng đồng đến xử lý vi phạm và quản trị nền tảng.

Các đặc điểm chính:

- Nội dung đa ngôn ngữ và liên kết các bản dịch của cùng một bài viết.
- Phân quyền theo `NORMAL`, `BLOG_OWNER`, `CONTENT_MODERATOR` và `SUPER_ADMIN`.
- Vòng đời bài viết gồm `DRAFT`, `PENDING_REVIEW`, `PUBLISH` và `REJECT`.
- Like, bookmark, follow, comment, reply và report.
- Upload avatar, thumbnail, ảnh và video qua Cloudinary.
- Access token, refresh token và quản lý phiên đăng nhập theo thiết bị.
- Khôi phục mật khẩu qua email.
- Soft delete và lịch dọn dữ liệu tự động.

### Quy mô hiện tại

| Hạng mục | Số lượng |
|---|---:|
| Nhóm API | 5 |
| Endpoint | 83 |
| Prisma model | 20 |
| Enum nghiệp vụ | 8 |
| File unit test/spec | 58 |
| Base URL mặc định | `/api/v1` |
| Cổng mặc định | `8080` |

---

## Tính năng chính

### Public API — 13 endpoint

- Đăng ký, đăng nhập, quên và đặt lại mật khẩu.
- Xem danh sách, bài nổi bật và chi tiết bài viết đã xuất bản.
- Lọc bài theo tác giả, ngôn ngữ, danh mục và tag.
- Xem tác giả nổi bật và trang cá nhân công khai của Blog Owner.
- Xem danh mục, tag và bình luận công khai.

### User API — 28 endpoint

- Refresh token, logout một thiết bị và logout toàn bộ thiết bị.
- Xem, cập nhật, upload avatar và xóa tài khoản.
- Follow/unfollow người dùng.
- Like/unlike và bookmark/unbookmark bài viết.
- Tạo, sửa, xóa comment hoặc reply.
- Báo cáo bài viết hoặc bình luận.
- Gửi và quản lý yêu cầu trở thành Blog Owner.

### Blog Owner API — 12 endpoint

- Dashboard nội dung cá nhân.
- Tạo, sửa, xóa mềm và gửi duyệt bài viết.
- Upload thumbnail và media.
- Tạo hoặc xem trước bản dịch bài viết.
- Lấy danh sách ngôn ngữ, danh mục và tag phục vụ soạn bài.

### Moderator API — 14 endpoint

- Dashboard kiểm duyệt.
- Duyệt hoặc từ chối bài viết.
- Xem và xử lý report.
- Quản lý Category Group và bản dịch danh mục.

### Admin API — 16 endpoint

- Dashboard toàn hệ thống.
- Quản lý ngôn ngữ.
- Quản lý user, role và trạng thái tài khoản.
- Tạo Content Moderator.
- Khóa, mở khóa hoặc xóa mềm user.
- Duyệt yêu cầu nâng cấp Blog Owner.

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
        Output[Interceptor & Exception Filters]
    end

    PostgreSQL[(PostgreSQL)]
    Cloudinary[Cloudinary]
    SMTP[SMTP Server]
    Translation[Translation Service]

    Client --> Middleware --> Pipeline --> Security --> APIs --> Core
    Core --> PostgreSQL
    Core --> Cloudinary
    Core --> SMTP
    Core --> Translation
    APIs --> Output --> Client
```

### Nguyên tắc tổ chức

- `src/*` chứa controller, service, DTO và entity theo từng nhóm người dùng.
- `libs/core/*` chứa nghiệp vụ dùng chung, Prisma, guard, filter, pipe, interceptor và tích hợp ngoài.
- Controller nhận HTTP request và kiểm tra quyền truy cập.
- API service triển khai logic riêng theo vai trò.
- Core service thực hiện nghiệp vụ và truy cập dữ liệu dùng chung.
- Prisma quản lý PostgreSQL thông qua `@prisma/adapter-pg`.

---

## Vai trò và phân quyền

| Vai trò | Khả năng chính |
|---|---|
| `NORMAL` | Quản lý hồ sơ, tương tác bài viết, comment, follow, report và gửi yêu cầu Blog Owner |
| `BLOG_OWNER` | Toàn bộ quyền tương tác phù hợp và quản lý bài viết của chính mình |
| `CONTENT_MODERATOR` | Duyệt bài, xử lý report và quản lý nhóm danh mục |
| `SUPER_ADMIN` | Quản lý user, role, trạng thái, ngôn ngữ và yêu cầu Blog Owner |

> `RolesGuard` kiểm tra role theo danh sách được khai báo tại từng route. Hệ thống hiện không tự động kế thừa quyền theo cấp bậc.

---

## Công nghệ sử dụng

| Nhóm | Công nghệ |
|---|---|
| Runtime | Node.js 20 trở lên(24.15.0) |
| Backend | NestJS 11, TypeScript 5.7 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt và password pepper |
| Validation | class-validator, class-transformer |
| File storage | Cloudinary |
| Email | Nodemailer, SMTP, EJS |
| Scheduler | `@nestjs/schedule` |
| Testing | Jest, ts-jest, Supertest |
| Code quality | ESLint, Prettier |

---

## Cấu trúc thư mục

```text
backend/
├── database/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── libs/
│   └── core/
│       └── src/
│           ├── common/
│           ├── config/
│           ├── core/prisma/
│           └── modules/
├── src/
│   ├── admin/
│   ├── blogowner/
│   ├── moderator/
│   ├── public/
│   ├── user/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── .env.example
├── package.json
├── prisma.config.ts
└── README.md
```

Các domain module dùng chung trong `libs/core` gồm:

```text
auths               blog-owner-requests
categories          cleanup
cloudinary          comments
languages           mail
media               posts
reports             security-logs
tags                users
```

---

## Cài đặt và chạy dự án

### 1. Yêu cầu hệ thống

- Node.js `>= 20`.
- npm.
- PostgreSQL.
- Tài khoản Cloudinary nếu sử dụng upload.
- SMTP account nếu sử dụng quên mật khẩu.

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
| `SUPER_ADMIN` | `superadmin` | `admin@system.local` | `password123` |
| `CONTENT_MODERATOR` | `moderator1` | `mod@system.local` | `password123` |
| `BLOG_OWNER` | `pro_blogger` | `blogger@system.local` | `password123` |
| `NORMAL` | `normal_user` | `user@system.local` | `password123` |

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

---

## Tài liệu dự án

| Tài liệu | Nội dung |
|---|---|
| [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | Kiến trúc, module, mô hình dữ liệu và luồng nghiệp vụ tổng thể |
| [`PUBLIC_API_DOCUMENTATION.md`](./PUBLIC_API_DOCUMENTATION.md) | 13 API Public |
| [`USER_API_DOCUMENTATION.md`](./USER_API_DOCUMENTATION.md) | 28 API User |
| [`ADMIN_API_DOCUMENTATION.md`](./ADMIN_API_DOCUMENTATION.md) | 16 API Admin |


Tài liệu chi tiết cho Blog Owner và Moderator cần được bổ sung ở giai đoạn tiếp theo:

```text
BLOG_OWNER_API_DOCUMENTATION.md
MODERATOR_API_DOCUMENTATION.md
```

---
