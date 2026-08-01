# TỔNG QUAN DỰ ÁN QUẢN LÝ BLOG

> Backend NestJS + Prisma + PostgreSQL, hỗ trợ xuất bản nội dung đa ngôn ngữ, tương tác cộng đồng, kiểm duyệt và quản trị theo vai trò.

## 1. Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Tên dự án | Quản lý Blog |
| Kiến trúc | Modular Monolith |
| Backend | NestJS 11, TypeScript |
| ORM | Prisma 7 |
| Cơ sở dữ liệu | PostgreSQL |
| Base URL mặc định | `/api/v1` |
| Cổng mặc định | `8080` |
| Ngày rà soát source | 30/07/2026 |
| Phạm vi source | Backend, Prisma schema, migrations, seed, static UI template và tài liệu API |
| Tổng số API phát hiện trong source | 83 endpoint |
| Số model Prisma | 20 model |
| Số enum nghiệp vụ | 8 enum |
| Số file unit test/spec | 58 file |

Tài liệu này cung cấp bức tranh tổng thể về mục tiêu, kiến trúc, vai trò, module, luồng nghiệp vụ, mô hình dữ liệu, tích hợp ngoài, bảo mật, cách chạy và các điểm cần hoàn thiện của hệ thống.

---

## 2. Mục tiêu dự án

Dự án xây dựng một nền tảng blog có quy trình xuất bản và kiểm duyệt nội dung hoàn chỉnh. Hệ thống phục vụ năm nhóm chức năng chính:

1. **Khách truy cập** đọc bài viết, tìm kiếm nội dung, xem tác giả, danh mục, tag và bình luận.
2. **Người dùng** quản lý tài khoản, tương tác với bài viết, bình luận, theo dõi tác giả và gửi báo cáo vi phạm.
3. **Blog Owner** tạo, chỉnh sửa, dịch, quản lý media và gửi bài viết sang quy trình kiểm duyệt.
4. **Content Moderator** duyệt bài, xử lý báo cáo và quản lý nhóm danh mục đa ngôn ngữ.
5. **Super Admin** quản lý người dùng, vai trò, trạng thái tài khoản, ngôn ngữ và yêu cầu nâng cấp Blog Owner.

Hệ thống được thiết kế để giải quyết các nhu cầu sau:

- Quản lý nội dung theo nhiều ngôn ngữ.
- Phân quyền rõ ràng theo vai trò.
- Tách trạng thái soạn thảo, chờ duyệt, xuất bản và từ chối.
- Hỗ trợ like, bookmark, follow, comment và report.
- Quản lý upload ảnh/video qua Cloudinary.
- Quản lý phiên đăng nhập bằng access token và refresh token.
- Khôi phục mật khẩu qua email.
- Tự động dọn dữ liệu đã xóa mềm sau một khoảng thời gian.

---

## 3. Phạm vi chức năng theo nhóm API

Source hiện có **83 endpoint**, chia thành năm nhóm:

| Nhóm API | Prefix chính | Số endpoint | Đối tượng sử dụng |
|---|---:|---:|---|
| Public | `/register`, `/login`, `/posts`, `/authors`, `/categories`, `/tags` | 13 | Khách và mọi người dùng |
| User | `/auth`, `/user` | 28 | Người dùng đã xác thực |
| Blog Owner | `/blog-owner` | 12 | Vai trò `BLOG_OWNER` |
| Moderator | `/moderator` | 14 | Vai trò `CONTENT_MODERATOR` |
| Admin | `/admin` | 16 | Chủ yếu `SUPER_ADMIN`; một số route cho Moderator |
| **Tổng** |  | **83** |  |

Ba tài liệu API chi tiết hiện có:

- `PUBLIC_API_DOCUMENTATION.md`: 13 API Public.
- `USER_API_DOCUMENTATION.md`: 28 API User.
- `ADMIN_API_DOCUMENTATION.md`: 16 API Admin.

Source còn có 26 endpoint Blog Owner và Moderator nhưng chưa có hai tài liệu API chi tiết tương ứng.

---

## 4. Vai trò và quyền hạn

### 4.1. `NORMAL`

Người dùng thông thường có thể:

- Đăng nhập và quản lý hồ sơ.
- Bình luận hoặc trả lời bình luận.
- Like và bookmark bài viết.
- Follow hoặc unfollow người dùng khác.
- Xem danh sách follower/following.
- Báo cáo bài viết hoặc bình luận.
- Gửi yêu cầu trở thành Blog Owner.

### 4.2. `BLOG_OWNER`

Blog Owner có toàn bộ khả năng tương tác phù hợp của người dùng và thêm các quyền:

- Tạo bài viết.
- Chỉnh sửa hoặc xóa mềm bài viết của chính mình.
- Upload thumbnail và media đính kèm.
- Gửi bài sang Moderator duyệt.
- Xem dashboard nội dung cá nhân.
- Xem các tùy chọn ngôn ngữ, danh mục và tag.
- Tạo bản dịch thủ công hoặc nhận bản dịch tự động để xem trước.

### 4.3. `CONTENT_MODERATOR`

Moderator chịu trách nhiệm vận hành nội dung:

- Xem dashboard kiểm duyệt.
- Xem bài đang chờ duyệt.
- Duyệt hoặc từ chối bài viết.
- Xem và xử lý báo cáo bài viết/bình luận.
- Quản lý Category Group và các bản dịch danh mục.

### 4.4. `SUPER_ADMIN`

Super Admin có quyền quản trị cao nhất:

- Xem dashboard hệ thống.
- Quản lý ngôn ngữ.
- Xem, tạo, cập nhật, khóa, mở khóa và xóa người dùng.
- Tạo tài khoản Moderator.
- Thay đổi vai trò người dùng.
- Duyệt hoặc từ chối yêu cầu Blog Owner.

---

## 5. Kiến trúc tổng thể

Dự án sử dụng kiến trúc **Modular Monolith**: toàn bộ chức năng chạy trong một ứng dụng NestJS, nhưng được chia thành các module API và module lõi riêng biệt.

```mermaid
flowchart LR
    Client[Web / Mobile / Static UI]

    subgraph NestJS[Ứng dụng NestJS Modular Monolith]
        MW[Logger + Maintenance Middleware]
        GUARD[JWT + Roles Guards]
        PIPE[Trim + Validation Pipes]
        API[Public / User / Blog Owner / Moderator / Admin Controllers]
        SERVICE[API Services]
        CORE[Core Domain Modules]
        INTERCEPTOR[Transform Interceptor]
        FILTER[HTTP + Prisma Exception Filters]
    end

    DB[(PostgreSQL)]
    CLOUD[Cloudinary]
    MAIL[SMTP Mail Server]
    TRANS[Translation Service]

    Client --> MW --> PIPE --> GUARD --> API --> SERVICE --> CORE
    CORE --> DB
    CORE --> CLOUD
    CORE --> MAIL
    SERVICE --> TRANS
    API --> INTERCEPTOR --> Client
    FILTER --> Client
```

### 5.1. Tầng API

Nằm trong `src/`, gồm năm module:

```text
src/
├── public/
├── user/
├── blogowner/
├── moderator/
├── admin/
├── app.module.ts
└── main.ts
```

Mỗi module API thường bao gồm:

- `controllers/`: nhận HTTP request, kiểm tra path/query/body và gọi service.
- `services/`: triển khai logic riêng cho nhóm người dùng.
- `dto/`: mô tả và validate dữ liệu đầu vào.
- `entities/`: chuẩn hóa dữ liệu trả về và ẩn field nội bộ.

### 5.2. Tầng core dùng chung

Nằm trong `libs/core/src/`, bao gồm:

- Domain services: users, auths, posts, comments, categories, tags, languages, reports, media.
- Prisma service và kết nối PostgreSQL.
- Guard, decorator, filter, interceptor, middleware và pipe dùng chung.
- Cloudinary, email, cleanup scheduler và các utility bảo mật.

Việc tách `src/*` và `libs/core/*` giúp controller theo vai trò không phải lặp lại toàn bộ logic truy cập dữ liệu.

### 5.3. Tầng dữ liệu

- Prisma schema nằm tại `database/schema.prisma`.
- PostgreSQL là hệ quản trị cơ sở dữ liệu chính.
- Prisma 7 sử dụng `@prisma/adapter-pg` và pool từ package `pg`.
- Source có hai migration chính và một seed script.

---

## 6. Các module nghiệp vụ

## 6.1. Public Module

Public Module cung cấp nội dung không cần đăng nhập:

- Đăng ký tài khoản.
- Đăng nhập.
- Quên và đặt lại mật khẩu.
- Danh sách, top và chi tiết bài viết đã xuất bản.
- Danh sách tác giả nổi bật và trang tác giả.
- Danh mục và tag.
- Bình luận công khai của bài viết.
- Lọc nội dung theo ngôn ngữ.

Public service luôn giới hạn bài viết ở trạng thái `PUBLISH`, kể cả khi query DTO có field `status`.

## 6.2. User Module

User Module tập trung vào tài khoản và tương tác cộng đồng:

- Refresh token, logout một thiết bị, logout tất cả thiết bị.
- Xem, cập nhật, xóa hồ sơ và upload avatar.
- Follow/unfollow.
- Like/unlike và bookmark/unbookmark.
- Bình luận, trả lời, sửa và xóa bình luận.
- Báo cáo bài viết hoặc bình luận.
- Tạo, xem và hủy yêu cầu nâng cấp Blog Owner.

Các thao tác tương tác sử dụng khóa duy nhất ở tầng database để tránh like, bookmark hoặc follow trùng.

## 6.3. Blog Owner Module

Blog Owner Module chịu trách nhiệm vòng đời nội dung của tác giả:

- Dashboard thống kê bài viết.
- Danh sách và chi tiết bài viết của chính tác giả.
- Tạo bài với `multipart/form-data` hoặc payload thông thường tùy route.
- Chỉnh sửa bài, thumbnail và media.
- Xóa mềm bài viết.
- Gửi bài sang trạng thái chờ duyệt.
- Upload và xóa media riêng lẻ.
- Lấy danh sách lựa chọn ngôn ngữ, danh mục và tag.
- Dịch tự động title/content để preview.
- Tạo bản dịch liên kết với bài gốc.

Blog Owner chỉ được thao tác trên bài có `authorId` trùng với ID từ JWT.

## 6.4. Moderator Module

Moderator Module chịu trách nhiệm chất lượng và an toàn nội dung:

- Dashboard số liệu kiểm duyệt.
- Danh sách và chi tiết bài viết cần xử lý.
- Duyệt bài: `PENDING_REVIEW → PUBLISH`.
- Từ chối bài: `PENDING_REVIEW → REJECT`.
- Danh sách và chi tiết báo cáo.
- Xác nhận báo cáo đúng và ẩn nội dung vi phạm.
- Bác bỏ báo cáo không hợp lệ.
- Quản lý Category Group cùng các bản dịch theo ngôn ngữ.

Các thao tác duyệt bài và xử lý báo cáo dùng transaction cùng điều kiện trạng thái để giảm race condition khi nhiều Moderator thao tác đồng thời.

## 6.5. Admin Module

Admin Module quản trị tài khoản và cấu hình nền tảng:

- Dashboard tổng quan.
- Quản lý ngôn ngữ.
- Quản lý danh sách và chi tiết người dùng.
- Tạo Moderator.
- Cập nhật người dùng.
- Khóa và mở khóa tài khoản.
- Đổi role.
- Xóa mềm tài khoản.
- Duyệt yêu cầu Blog Owner.

Khi yêu cầu Blog Owner được duyệt:

1. Request chuyển sang `APPROVED`.
2. User được đổi role thành `BLOG_OWNER`.
3. Các session đang hoạt động của user bị thu hồi.
4. User phải đăng nhập lại để nhận token có role mới.

---

## 7. Các luồng nghiệp vụ chính

## 7.1. Đăng ký và đăng nhập

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant DB as PostgreSQL

    C->>A: POST /register
    A->>DB: Kiểm tra username/email
    A->>DB: Lưu passwordHash
    A-->>C: User đã tạo

    C->>A: POST /login
    A->>DB: Kiểm tra trạng thái và mật khẩu
    A->>DB: Tạo UserSession, lưu refreshTokenHash
    A-->>C: User + accessToken + refreshToken
```

Mật khẩu được băm bằng bcrypt kết hợp `PASSWORD_PEPPER`. Refresh token được băm trước khi lưu vào bảng `user_sessions`.

## 7.2. Làm mới và thu hồi phiên đăng nhập

- Access token có thời gian sống ngắn.
- Refresh token có thời gian sống dài hơn và liên kết với một session.
- Refresh token phải chưa hết hạn và chưa bị revoke.
- Backend có thể đối chiếu `User-Agent` với `deviceInfo` lúc đăng nhập.
- `logout` thu hồi một session.
- `logout-all` thu hồi toàn bộ session của user.
- Đổi mật khẩu hoặc nâng cấp role cũng thu hồi các session liên quan.

## 7.3. Yêu cầu trở thành Blog Owner

```mermaid
stateDiagram-v2
    [*] --> PENDING: User gửi yêu cầu
    PENDING --> APPROVED: Admin/Moderator duyệt
    PENDING --> REJECTED: Admin/Moderator từ chối
    APPROVED --> [*]
    REJECTED --> [*]
```

Ràng buộc chính:

- User đã là Blog Owner không được gửi yêu cầu mới.
- User không được có nhiều request `PENDING` cùng lúc.
- User chỉ được hủy request của chính mình và request phải còn `PENDING`.

## 7.4. Vòng đời bài viết

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Blog Owner tạo bài
    DRAFT --> PENDING_REVIEW: Gửi duyệt
    PENDING_REVIEW --> PUBLISH: Moderator duyệt
    PENDING_REVIEW --> REJECT: Moderator từ chối
    REJECT --> DRAFT: Blog Owner chỉnh sửa
    PUBLISH --> PENDING_REVIEW: Blog Owner chỉnh sửa bài đã xuất bản
    PENDING_REVIEW --> PUBLISH: Duyệt lại
```

Quy tắc đáng chú ý:

- Bài đang `PENDING_REVIEW` không được sửa nội dung hoặc media.
- Chỉ bài `DRAFT` được gửi duyệt.
- Bài `REJECT` sau khi sửa trở lại `DRAFT`.
- Bài `PUBLISH` sau khi sửa chuyển sang `PENDING_REVIEW`.
- Khi xuất bản lần đầu, `publishedAt` được gán thời điểm duyệt.
- Nếu bài đã từng xuất bản rồi được sửa và duyệt lại, hệ thống giữ `publishedAt` ban đầu.

## 7.5. Bài viết đa ngôn ngữ

Bản dịch được biểu diễn bằng quan hệ tự tham chiếu của `Post`:

- Bài gốc có `parentPostId = null`.
- Bản dịch trỏ tới bài gốc bằng `parentPostId`.
- Mỗi bài gốc chỉ có tối đa một bản dịch cho mỗi `languageId`.
- Category được ánh xạ qua `CategoryGroup`, giúp các tên danh mục khác ngôn ngữ cùng đại diện cho một nhóm khái niệm.

Dịch tự động gọi dịch vụ ngoài được cấu hình bằng `TRANSLATE_API_URL` và gửi title/content tới endpoint `/translate`. Kết quả preview không tự động được lưu thành bài dịch.

## 7.6. Comment và reply

- Chỉ bài `PUBLISH` chưa xóa mới nhận comment.
- Comment hỗ trợ một cấp comment gốc và danh sách reply.
- Khi reply vào một reply, service quy về comment gốc để tránh cây bình luận quá sâu.
- Comment gốc được phân trang; replies được lồng trong item cha.
- Nội dung comment được kiểm tra từ cấm.
- Source có cơ chế chống spam theo số lượng và nội dung trùng trong khoảng thời gian ngắn.

## 7.7. Báo cáo và kiểm duyệt vi phạm

User có thể báo cáo:

- Bài viết (`POST`).
- Bình luận (`COMMENT`).

Moderator có hai lựa chọn:

- **Resolve**: báo cáo được xác nhận; nội dung bị soft delete và các report `PENDING` khác cùng target được chuyển sang `RESOLVED`.
- **Reject**: chỉ report đang xét chuyển sang `REJECTED`; nội dung không thay đổi.

## 7.8. Xóa mềm và dọn dữ liệu

Các bảng quan trọng như User, Post, Comment, Media, Category, Language và Tag dùng `deletedAt` để xóa mềm.

`CleanupService` chạy mỗi ngày lúc nửa đêm:

1. Tìm dữ liệu đã soft delete từ 30 ngày trở lên.
2. Xóa file media tương ứng trên Cloudinary nếu có `publicId`.
3. Xóa vĩnh viễn bản ghi khỏi database.

---

## 8. Mô hình dữ liệu

Prisma schema hiện có 20 model, có thể chia thành các nhóm sau.

### 8.1. Tài khoản và xác thực

| Model | Mục đích |
|---|---|
| `User` | Tài khoản, role, trạng thái, hồ sơ và thông tin khóa |
| `UserSession` | Phiên đăng nhập và refresh token đã băm |
| `PasswordResetToken` | Token đặt lại mật khẩu |
| `SecurityLog` | Nhật ký hành động bảo mật |

### 8.2. Nội dung và đa ngôn ngữ

| Model | Mục đích |
|---|---|
| `Language` | Ngôn ngữ được hỗ trợ |
| `CategoryGroup` | Nhóm danh mục độc lập ngôn ngữ |
| `Category` | Tên danh mục theo từng ngôn ngữ |
| `Post` | Bài viết, trạng thái, tác giả, ngôn ngữ và quan hệ bản dịch |
| `PostCategory` | Quan hệ nhiều-nhiều giữa bài viết và danh mục |
| `Tag` | Tag nội dung |
| `PostTag` | Quan hệ nhiều-nhiều giữa bài viết và tag |
| `Media` | Ảnh/video đính kèm bài viết |

### 8.3. Tương tác và thống kê

| Model | Mục đích |
|---|---|
| `Comment` | Bình luận và reply |
| `PostLike` | Like bài viết |
| `PostBookmark` | Bookmark bài viết |
| `UserFollow` | Quan hệ follower/following |
| `PostViewLog` | Log lượt xem theo viewer key |
| `PostDailyMetric` | Chỉ số view/like theo ngày |

### 8.4. Quy trình xét duyệt

| Model | Mục đích |
|---|---|
| `BlogOwnerRequest` | Yêu cầu nâng cấp Blog Owner |
| `Report` | Báo cáo bài viết hoặc bình luận |

### 8.5. Quan hệ dữ liệu rút gọn

```mermaid
erDiagram
    USER ||--o{ USER_SESSION : has
    USER ||--o{ POST : authors
    USER ||--o{ COMMENT : writes
    USER ||--o{ BLOG_OWNER_REQUEST : submits
    USER ||--o{ REPORT : reports
    USER ||--o{ POST_LIKE : likes
    USER ||--o{ POST_BOOKMARK : bookmarks
    USER ||--o{ USER_FOLLOW : follows

    LANGUAGE ||--o{ POST : contains
    LANGUAGE ||--o{ CATEGORY : translates
    CATEGORY_GROUP ||--o{ CATEGORY : groups

    POST ||--o{ POST_CATEGORY : categorized
    CATEGORY ||--o{ POST_CATEGORY : assigned
    POST ||--o{ POST_TAG : tagged
    TAG ||--o{ POST_TAG : assigned
    POST ||--o{ MEDIA : contains
    POST ||--o{ COMMENT : receives
    POST ||--o{ POST_VIEW_LOG : viewed
    POST ||--o{ POST_DAILY_METRIC : measured
    POST ||--o{ REPORT : reported
    COMMENT ||--o{ REPORT : reported
    COMMENT ||--o{ COMMENT : replies
    POST ||--o{ POST : translated
```

---

## 9. Quy ước API dùng chung

## 9.1. Base URL

```text
/api/v1
```

Giá trị có thể thay đổi qua biến môi trường `API_PREFIX`.

## 9.2. Success envelope

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

Với Axios, payload nghiệp vụ nằm trong:

```text
response.data.data
```

## 9.3. Error envelope

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Nội dung lỗi hoặc mảng lỗi validation",
  "path": "/api/v1/example",
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

## 9.4. Validation

Global pipes gồm:

- `TrimPipe`: trim đệ quy mọi string trong request body.
- `ValidationPipe` với `transform: true`.
- `whitelist: true`.
- `forbidNonWhitelisted: true`.

Frontend không được gửi field ngoài DTO; field thừa gây lỗi `400` thay vì bị bỏ qua.

## 9.5. Xác thực

Các route cần đăng nhập sử dụng:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Refresh token được gửi trong JSON body của các API refresh/logout, không đặt trong Authorization header.

## 9.6. Pagination

Quy ước mặc định:

- `page = 1`.
- `limit = 10`.
- `limit` thực tế bị giới hạn tối đa 50 khi đi qua `Pagination` decorator.

Response phân trang có dạng:

```json
{
  "items": [],
  "meta": {
    "totalItems": 0,
    "itemCount": 0,
    "itemsPerPage": 10,
    "totalPages": 0,
    "currentPage": 1
  }
}
```

## 9.7. Ngôn ngữ

Nội dung public có thể xác định ngôn ngữ qua:

1. `languageId`.
2. Query `lang`.
3. Header `Accept-Language`.

Tùy service, `languageId` hoặc query `lang` có thể được ưu tiên hơn header.

## 9.8. Upload file

- Avatar, thumbnail và media sử dụng `multipart/form-data`.
- Cloudinary là nơi lưu file ngoài.
- Database lưu URL và, đối với media, lưu `publicId` để phục vụ xóa file.

---

## 10. Công nghệ và tích hợp

| Thành phần | Công nghệ / dịch vụ |
|---|---|
| Framework | NestJS 11 |
| Ngôn ngữ | TypeScript 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| DB Driver/Adapter | `pg`, `@prisma/adapter-pg` |
| Authentication | JWT access/refresh token |
| Hash mật khẩu | bcrypt + password pepper |
| Validation | class-validator, class-transformer |
| Upload | Multer |
| Media storage | Cloudinary |
| Email | Nodemailer, `@nestjs-modules/mailer`, EJS |
| Scheduler | `@nestjs/schedule` |
| Translation | Dịch vụ tương thích LibreTranslate qua HTTP |
| Testing | Jest, ts-jest, Supertest |
| Static UI | HTML, CSS, JavaScript, Bootstrap CDN |

---

## 11. Bảo mật và tính toàn vẹn

### 11.1. Cơ chế đang có

- Password hash bằng bcrypt và pepper.
- Access token và refresh token dùng secret riêng.
- Refresh token chỉ lưu dạng hash trong database.
- Guard kiểm tra user còn tồn tại, chưa soft delete và không bị khóa.
- Role được đọc lại từ database ở mỗi request có JWT, tránh phụ thuộc hoàn toàn vào role cũ trong token.
- Session có thông tin thiết bị, IP, thời gian hết hạn và thời gian revoke.
- Password reset token chỉ dùng một lần và có thời hạn.
- DTO validation chặn field thừa.
- Entity serializer ẩn các field nhạy cảm như `passwordHash`, token hash và một số field nội bộ.
- Prisma transaction được dùng cho các thao tác cần tính nguyên tử.
- Conditional update chống hai quản trị viên cùng xử lý một bản ghi.
- Có kiểm tra từ cấm cho tìm kiếm và nội dung cộng đồng ở các luồng liên quan.
- Maintenance mode có thể chặn toàn bộ request bằng biến môi trường.

### 11.2. Các điểm cần ưu tiên xử lý

#### Mức nghiêm trọng cao

1. **Không giữ credential thật trong `.env.example`.** File hiện chứa các giá trị có hình thức giống database URL, Cloudinary secret, JWT secret và SMTP credential thực. Cần thu hồi/rotate toàn bộ credential liên quan và thay file mẫu bằng placeholder.

#### Mức quan trọng

3. Chưa thấy cấu hình global rate limiting bằng `@nestjs/throttler`; nên bổ sung cho login, register, forgot-password, comment, report và upload.
4. Chưa thấy `helmet`, security headers hoặc chính sách CSP ở backend.
5. CORS chỉ cho một origin cấu hình qua `FRONTEND_URL` và bật `credentials: true`; production cần cấu hình whitelist rõ ràng.
6. Logger hiện ghi URL, IP và User-Agent ra console; cần kết hợp log rotation, masking và centralized logging khi deploy.
7. Chưa thấy tài liệu Swagger/OpenAPI được sinh tự động từ DTO và controller.
8. Cần kiểm tra giới hạn kích thước file, MIME type và dung lượng tổng cho mọi route upload.
9. Cleanup hiện quản lý `Media.publicId`; cần kiểm tra thêm vòng đời avatar và thumbnail để tránh file Cloudinary mồ côi.

---

## 12. Cấu hình môi trường

Tạo `.env` từ `.env.example`, nhưng chỉ sử dụng placeholder và secret mới.

### 12.1. Ứng dụng

```dotenv
NODE_ENV=development
APP_NAME="Blog API"
APP_PORT=8080
API_PREFIX=api/v1
FRONTEND_URL=http://localhost:3000
MAINTENANCE_MODE=false
```

### 12.2. Database

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
DB_POOL_SIZE=10
DB_LOG_QUERIES=true
```

Lưu ý: `DB_POOL_SIZE` đã có trong config nhưng `PrismaService` hiện chưa truyền giá trị này vào `pg.Pool`; pool đang chỉ nhận `connectionString`.

### 12.3. JWT và mật khẩu

```dotenv
PASSWORD_PEPPER="<RANDOM_SECRET>"
JWT_ACCESS_TOKEN_SECRET="<RANDOM_SECRET>"
JWT_REFRESH_TOKEN_SECRET="<DIFFERENT_RANDOM_SECRET>"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 12.4. Cloudinary

```dotenv
CLOUDINARY_CLOUD_NAME="<CLOUD_NAME>"
CLOUDINARY_API_KEY="<API_KEY>"
CLOUDINARY_API_SECRET="<API_SECRET>"
CLOUDINARY_DEFAULT_FOLDER="nestjs_blog"
```

### 12.5. Email

```dotenv
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER="<SMTP_USER>"
MAIL_PASSWORD="<SMTP_PASSWORD>"
MAIL_FROM="Blog System <noreply@example.com>"
MAIL_IGNORE_TLS=false
```

### 12.6. Dịch tự động

```dotenv
TRANSLATE_API_URL=http://localhost:5000
```

Service dịch cần cung cấp endpoint:

```text
POST /translate
```

và trả `translatedText` là mảng chứa bản dịch của title và content.

---

## 13. Cài đặt và chạy dự án

Thực hiện trong thư mục `backend`.

### 13.1. Cài dependency

```bash
npm install
```

### 13.2. Tạo file môi trường

```bash
cp .env.example .env
```

Sau đó thay toàn bộ secret và credential bằng giá trị của môi trường local.

### 13.3. Sinh Prisma Client

```bash
npx prisma generate
```

### 13.4. Khởi tạo database

Môi trường development:

```bash
npx prisma migrate dev
```

Môi trường đã có migration và chỉ cần apply:

```bash
npx prisma migrate deploy
```

### 13.5. Seed dữ liệu

```bash
npx prisma db seed
```

Seed tạo dữ liệu mẫu cho ngôn ngữ, danh mục, tag, bài viết, tương tác và các vai trò. Không sử dụng credential mặc định của seed trong production.

### 13.6. Chạy development

```bash
npm run start:dev
```

Ứng dụng mặc định chạy tại:

```text
http://localhost:8080/api/v1
```

### 13.7. Build và chạy production

```bash
npm run build
npm run start:prod
```

### 13.8. Kiểm tra chất lượng

```bash
npm run lint
npm run test
npm run test:cov
npm run test:e2e
```

Tài liệu này chỉ xác nhận source có 58 file spec; chưa xác nhận toàn bộ test đang chạy thành công trong môi trường hiện tại.

---

## 14. Cấu trúc thư mục quan trọng

```text
backend/
├── database/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── libs/core/src/
│   ├── common/
│   │   ├── decorators/
│   │   ├── exceptions/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── middlewares/
│   │   ├── pipes/
│   │   └── utils/
│   ├── config/
│   ├── core/prisma/
│   └── modules/
├── src/
│   ├── public/
│   ├── user/
│   ├── blogowner/
│   ├── moderator/
│   ├── admin/
│   ├── app.module.ts
│   └── main.ts
├── ADMIN_API_DOCUMENTATION.md
├── PUBLIC_API_DOCUMENTATION.md
├── USER_API_DOCUMENTATION.md
├── package.json
└── README.md
```

Static UI demo nằm ngoài backend:

```text
template/
├── assets/
├── components/
└── pages/
```

Có thể mở trực tiếp:

```text
template/pages/public/index.html
```

---


## 15. Hạn chế và hướng phát triển đề xuất

### Ưu tiên 1 — An toàn triển khai

- Rotate toàn bộ credential từng xuất hiện trong `.env.example` hoặc Git history.
- Bổ sung secret scanning trong CI.
- Thêm rate limiting và security headers.
- Định nghĩa chính sách upload file rõ ràng.
- Không log dữ liệu nhạy cảm.

### Ưu tiên 2 — Tài liệu và hợp đồng API

- Sinh Swagger/OpenAPI.
- Bổ sung tài liệu Blog Owner và Moderator.
- Đồng bộ quyền Admin giữa code và tài liệu.
- Bổ sung bảng error code và trường hợp lỗi cho từng endpoint.
- Cập nhật README chính thức.

### Ưu tiên 3 — Vận hành

- Bổ sung Dockerfile và Docker Compose cho backend, PostgreSQL và translation service.
- Kiểm soát retry/timeout cho Cloudinary, SMTP và translation service.

### Ưu tiên 4 — Chất lượng code

- Chạy test và lưu baseline coverage trong CI.
- Bổ sung e2e test cho các workflow xuyên module.
- Đưa `DB_POOL_SIZE` vào cấu hình `pg.Pool`.
- Chuẩn hóa naming `blogowner` và `blog-owner` trong folder/class/route.
- Xem xét tách các service dài thành use case nhỏ hơn.

### Ưu tiên 5 — Sản phẩm

- Thông báo khi bài được duyệt/từ chối hoặc report được xử lý.
- Tìm kiếm full-text PostgreSQL.
- Draft autosave và version history.
- Dashboard theo thời gian thực hoặc theo khoảng ngày.

---