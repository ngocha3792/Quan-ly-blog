# TÀI LIỆU CƠ SỞ DỮ LIỆU — DỰ ÁN QUẢN LÝ BLOG

> Tài liệu mô tả thiết kế PostgreSQL và Prisma của backend Quản lý Blog: domain dữ liệu, model, quan hệ, constraint, index, vòng đời bản ghi, transaction, migration, seed, rủi ro hiện tại và hướng mở rộng.

## 1. Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Dự án | Quản lý Blog |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| PostgreSQL driver | `pg` qua `@prisma/adapter-pg` |
| Schema chính | `database/schema.prisma` |
| Migration | `database/migrations` |
| Seed | `database/seed.ts` |
| Số Prisma model | 20 |
| Số enum nghiệp vụ đang dùng | 8 |
| Kiểu khóa chính chủ đạo | `Int` tự tăng / PostgreSQL `SERIAL` |
| Quy ước tên Prisma | `camelCase` |
| Quy ước tên database | `snake_case` qua `@map` và `@@map` |
| Ngày rà soát source | 30/07/2026 |


---


## 2. Công nghệ và kết nối database

### 2.1. PrismaService

Ứng dụng sử dụng một `PrismaService` kế thừa `PrismaClient` và được cung cấp toàn cục qua `PrismaModule`.

```mermaid
flowchart LR
    Nest[NestJS Modules]
    PrismaService[PrismaService]
    Adapter[PrismaPg Adapter]
    Pool[pg Connection Pool]
    DB[(PostgreSQL)]

    Nest --> PrismaService
    PrismaService --> Adapter
    Adapter --> Pool
    Pool --> DB
```

Luồng khởi tạo:

1. `ConfigService` đọc `database.url` và `database.logQueries`.
2. `pg.Pool` được tạo từ connection string.
3. `PrismaPg` bọc connection pool.
4. Adapter được truyền vào `PrismaClient`.
5. `$connect()` chạy trong `onModuleInit()`.
6. `$disconnect()` chạy trong `onModuleDestroy()`.

### 2.2. Biến môi trường liên quan

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_LOG_QUERIES=false
```

Tên biến thực tế cần đối chiếu với namespace config của dự án. Không đưa mật khẩu thật vào `.env.example`, Git hoặc log.

### 2.3. Cấu hình pool cần bổ sung

Source hiện chỉ truyền `connectionString`. Môi trường production nên cấu hình có kiểm soát:

- Số kết nối tối đa theo số instance.
- `idleTimeoutMillis`.
- `connectionTimeoutMillis`.
- SSL theo nhà cung cấp database.
- Thời gian chờ statement hoặc transaction ở phía PostgreSQL.
- Theo dõi số connection đang dùng và query chậm.

Không nên tăng pool tùy ý. Tổng số connection xấp xỉ:

```text
số instance × pool max mỗi instance + connection từ migration/monitoring
```

---

## 3. Tổng quan domain dữ liệu

20 model được chia thành sáu nhóm.

| Domain | Model |
|---|---|
| Identity và bảo mật | `User`, `UserSession`, `PasswordResetToken`, `SecurityLog` |
| Phân quyền nghiệp vụ | `BlogOwnerRequest` |
| Phân loại và đa ngôn ngữ | `Language`, `CategoryGroup`, `Category` |
| Nội dung | `Post`, `PostCategory`, `Media`, `Tag`, `PostTag` |
| Cộng đồng | `Comment`, `PostLike`, `PostBookmark`, `UserFollow`, `Report` |
| Phân tích bài viết | `PostDailyMetric`, `PostViewLog` |

```mermaid
flowchart TB
    Identity[Identity & Security]
    Taxonomy[Language & Taxonomy]
    Content[Content]
    Interaction[Community Interaction]
    Moderation[Moderation]
    Analytics[Analytics]

    Identity --> Content
    Identity --> Interaction
    Identity --> Moderation
    Taxonomy --> Content
    Content --> Interaction
    Content --> Moderation
    Content --> Analytics
```

---

## 4. Enum nghiệp vụ

### 4.1. `UserRole`

| Giá trị | Ý nghĩa |
|---|---|
| `NORMAL` | Người dùng thông thường |
| `BLOG_OWNER` | Tác giả/chủ blog |
| `CONTENT_MODERATOR` | Kiểm duyệt nội dung |
| `SUPER_ADMIN` | Quản trị cao nhất |

### 4.2. `UserStatus`

| Giá trị | Ý nghĩa |
|---|---|
| `ACTIVE` | Tài khoản có thể hoạt động |
| `LOCKED` | Tài khoản bị khóa |

### 4.3. `PostStatus`

| Giá trị | Ý nghĩa |
|---|---|
| `DRAFT` | Bản nháp |
| `PENDING_REVIEW` | Chờ kiểm duyệt |
| `PUBLISH` | Đã xuất bản |
| `REJECT` | Bị từ chối |

Luồng trạng thái chính:

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING_REVIEW: gửi duyệt
    PENDING_REVIEW --> PUBLISH: Moderator duyệt
    PENDING_REVIEW --> REJECT: Moderator từ chối
    REJECT --> DRAFT: tác giả chỉnh sửa
    PUBLISH --> DRAFT: sửa nội dung theo workflow
    DRAFT --> PENDING_REVIEW
```

### 4.4. `MediaType`

- `IMAGE`
- `VIDEO`

### 4.5. `BlogOwnerRequestStatus`

- `PENDING`
- `APPROVED`
- `REJECTED`

### 4.6. `ReportTargetType`

- `POST`
- `COMMENT`

### 4.7. `ReportStatus`

- `PENDING`
- `RESOLVED`
- `REJECTED`

### 4.8. `ReportReason`

- `SPAM`
- `HARASSMENT`
- `INAPPROPRIATE`
- `COPYRIGHT`
- `MISINFORMATION`
- `OTHER`

---

## 5. Sơ đồ quan hệ tổng quát

Sơ đồ dưới đây lược bỏ một số field thời gian để tập trung vào quan hệ.

```mermaid
erDiagram
    USER ||--o{ USER_SESSION : owns
    USER ||--o{ PASSWORD_RESET_TOKEN : receives
    USER ||--o{ POST : authors
    USER ||--o{ COMMENT : writes
    USER ||--o{ POST_LIKE : likes
    USER ||--o{ POST_BOOKMARK : bookmarks
    USER ||--o{ BLOG_OWNER_REQUEST : requests
    USER ||--o{ REPORT : reports
    USER ||--o{ SECURITY_LOG : generates

    LANGUAGE ||--o{ CATEGORY : localizes
    LANGUAGE ||--o{ POST : localizes
    CATEGORY_GROUP ||--o{ CATEGORY : groups

    POST ||--o{ POST_CATEGORY : classified_by
    CATEGORY ||--o{ POST_CATEGORY : contains
    POST ||--o{ POST_TAG : tagged_by
    TAG ||--o{ POST_TAG : labels
    POST ||--o{ MEDIA : has
    POST ||--o{ COMMENT : receives
    POST ||--o{ POST_LIKE : receives
    POST ||--o{ POST_BOOKMARK : receives
    POST ||--o{ POST_DAILY_METRIC : aggregates
    POST ||--o{ POST_VIEW_LOG : logs
    POST ||--o{ REPORT : reported

    COMMENT ||--o{ COMMENT : replies
    COMMENT ||--o{ REPORT : reported

    USER ||--o{ USER_FOLLOW : follower
    USER ||--o{ USER_FOLLOW : following

    POST ||--o{ POST : translations
```

---

## 6. Quy ước thiết kế chung

### 6.1. Khóa chính

- Các bảng thực thể dùng `Int @id @default(autoincrement())`.
- PostgreSQL migration tạo `SERIAL`.
- Các bảng liên kết dùng composite primary key để chống trùng quan hệ.

Các composite primary key:

```text
post_categories(post_id, category_id)
post_tags(post_id, tag_id)
post_likes(post_id, user_id)
post_bookmarks(post_id, user_id)
user_follows(follower_id, following_id)
```

### 6.2. Timestamp

| Field | Mục đích |
|---|---|
| `createdAt` | Thời điểm tạo |
| `updatedAt` | Prisma tự cập nhật khi bản ghi thay đổi |
| `deletedAt` | Đánh dấu xóa mềm |
| `publishedAt` | Thời điểm xuất bản lần đầu |
| `reviewedAt` | Thời điểm duyệt nghiệp vụ |
| `revokedAt` | Thời điểm thu hồi session |
| `usedAt` | Thời điểm dùng reset token |
| `lockedAt` | Thời điểm khóa user |

Tất cả timestamp API nên được coi là UTC và serialize theo ISO 8601.

### 6.3. Soft delete

Các model có `deletedAt`:

- `User`
- `Language`
- `CategoryGroup`
- `Category`
- `Post`
- `Media`
- `Comment`
- `Tag`

Phần lớn query nghiệp vụ phải thêm:

```ts
where: {
  deletedAt: null,
}
```

Các bảng lịch sử, session, quan hệ và report không dùng soft delete trong schema hiện tại.

### 6.4. Tên cột

Ví dụ:

```prisma
passwordHash String @map("password_hash")

@@map("users")
```

Code TypeScript dùng `passwordHash`, database dùng `password_hash`.

### 6.5. Text dài

Các field dùng PostgreSQL `TEXT`:

- `User.bio`
- `User.lockReason`
- `BlogOwnerRequest.reason`
- `BlogOwnerRequest.topics`
- `BlogOwnerRequest.rejectionReason`
- `Post.content`
- `Post.rejectionReason`
- `Comment.content`
- `Report.description`
- `Report.resolutionNote`
- `SecurityLog.userAgent`

---

# PHẦN I — IDENTITY VÀ BẢO MẬT

## 8. Model `User`

### 8.1. Mục đích

Lưu tài khoản, role, trạng thái, hồ sơ và thông tin khóa tài khoản. Đây là thực thể trung tâm của hệ thống.

### 8.2. Cấu trúc field

| Field Prisma | Kiểu | Null | Mặc định | Cột DB | Ghi chú |
|---|---|---:|---|---|---|
| `id` | `Int` | Không | Auto increment | `id` | Primary key |
| `username` | `String` | Không | — | `username` | Unique |
| `email` | `String` | Không | — | `email` | Unique |
| `passwordHash` | `String` | Không | — | `password_hash` | Không được trả ra API |
| `role` | `UserRole` | Không | `NORMAL` | `role` | Phân quyền |
| `status` | `UserStatus` | Không | `ACTIVE` | `status` | Khóa/mở tài khoản |
| `bio` | `String?` | Có | `null` | `bio` | `TEXT` |
| `avatarUrl` | `String?` | Có | `null` | `avatar_url` | URL Cloudinary |
| `lockedAt` | `DateTime?` | Có | `null` | `locked_at` | Thời điểm khóa |
| `lockedById` | `Int?` | Có | `null` | `locked_by` | Self-reference tới admin khóa |
| `lockReason` | `String?` | Có | `null` | `lock_reason` | `TEXT` |
| `createdAt` | `DateTime` | Không | `now()` | `created_at` | — |
| `updatedAt` | `DateTime` | Không | `@updatedAt` | `updated_at` | — |
| `deletedAt` | `DateTime?` | Có | `null` | `deleted_at` | Soft delete |

### 8.3. Constraint và index

- Unique: `username`.
- Unique: `email`.
- Index: `role`.
- Index: `status`.
- Self-reference `lockedById → users.id`.

### 8.4. Quan hệ

- Một user có nhiều session và reset token.
- Một user có thể gửi nhiều yêu cầu Blog Owner.
- Một user có thể review request, post hoặc report.
- Một user có nhiều post, comment, like, bookmark và report.
- Quan hệ follow là self many-to-many qua `UserFollow`.

### 8.5. Vòng đời xóa

`UsersService.remove()` thực hiện transaction:

1. Đặt `users.deleted_at`.
2. Chuyển `status = LOCKED`.
3. Thu hồi tất cả session chưa revoke.
4. Soft-delete toàn bộ post của user.
5. Soft-delete toàn bộ comment của user.

Cleanup job có thể hard-delete user sau 30 ngày. Do nhiều relation có `ON DELETE CASCADE`, hard delete user có thể xóa vĩnh viễn session, post, comment, like, bookmark, follow và report do user tạo.

**Rủi ro cần xem xét:** hard-delete report khi reporter bị xóa có thể làm mất lịch sử kiểm duyệt. Nên cân nhắc `Report.reporterId` cho phép null và dùng `ON DELETE SET NULL`, hoặc ẩn danh reporter thay vì cascade.

---

## 9. Model `UserSession`

### 9.1. Mục đích

Lưu phiên đăng nhập và refresh token đã hash theo từng thiết bị.

| Field | Kiểu | Null | Constraint/Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | Primary key |
| `userId` | `Int` | Không | FK tới `User`, cascade |
| `refreshTokenHash` | `String` | Không | Unique |
| `deviceInfo` | `String?` | Có | Thường lấy từ `User-Agent` |
| `ipAddress` | `String?` | Có | IP khi tạo session |
| `expiresAt` | `DateTime` | Không | Hết hạn refresh token |
| `revokedAt` | `DateTime?` | Có | Thu hồi nhưng giữ lịch sử |
| `createdAt` | `DateTime` | Không | `now()` |

Index:

- `userId`.
- `expiresAt`.

Quy tắc sử dụng:

- Không lưu refresh token dạng rõ.
- Logout đặt `revokedAt` thay vì xóa session.
- Thay role, khóa tài khoản hoặc duyệt Blog Owner sẽ revoke session cũ.
- Cần job dọn session hết hạn hoặc revoke quá lâu; source hiện chưa thấy retention job riêng cho bảng này.

---

## 10. Model `PasswordResetToken`

Lưu token đặt lại mật khẩu đã hash.

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | Primary key |
| `userId` | `Int` | Không | FK cascade tới user |
| `tokenHash` | `String` | Không | Unique |
| `expiresAt` | `DateTime` | Không | Thời điểm hết hạn |
| `usedAt` | `DateTime?` | Có | Chống tái sử dụng |
| `createdAt` | `DateTime` | Không | — |

Index: `userId`, `expiresAt`.

Khuyến nghị:

- Chỉ một token chưa dùng gần nhất có hiệu lực hoặc vô hiệu token cũ khi tạo token mới.
- Tạo job xóa token hết hạn/đã dùng theo retention.
- Không log token thô hoặc token hash.

---


# PHẦN II — NGÔN NGỮ VÀ PHÂN LOẠI

## 12. Model `Language`

### 12.1. Mục đích

Quản lý ngôn ngữ của post và category.

| Field | Kiểu | Null | Mặc định | Ghi chú |
|---|---|---:|---|---|
| `id` | `Int` | Không | Auto increment | PK |
| `code` | `String` | Không | — | Unique, ví dụ `vi`, `en` |
| `name` | `String` | Không | — | Tên hiển thị |
| `flag` | `String?` | Có | `null` | Emoji/cờ |
| `isDefault` | `Boolean` | Không | `false` | Ngôn ngữ mặc định |
| `isActive` | `Boolean` | Không | `true` | Có được sử dụng hay không |
| `createdAt` | `DateTime` | Không | `now()` | — |
| `updatedAt` | `DateTime` | Không | `@updatedAt` | — |
| `deletedAt` | `DateTime?` | Có | `null` | Soft delete |

Quan hệ tới `Category` và `Post` dùng `onDelete: Restrict`, do đó không thể hard-delete language nếu vẫn còn category hoặc post tham chiếu.

### 12.2. Ràng buộc còn thiếu

Schema cho phép nhiều record cùng `isDefault = true`. Nên bổ sung partial unique index ở PostgreSQL:

```sql
CREATE UNIQUE INDEX languages_single_default_idx
ON languages (is_default)
WHERE is_default = true AND deleted_at IS NULL;
```

Hoặc service phải đảm bảo việc đổi default diễn ra trong transaction.

---

## 13. Model `CategoryGroup`

Nhóm khái niệm category xuyên ngôn ngữ. Ví dụ một group `technology` có các category dịch là `Công nghệ`, `Technology`, `テクノロジー`, `기술`.

| Field | Kiểu | Null | Constraint |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `code` | `String` | Không | Unique |
| `createdAt` | `DateTime` | Không | — |
| `updatedAt` | `DateTime` | Không | — |
| `deletedAt` | `DateTime?` | Có | Soft delete |

Quan hệ:

```text
CategoryGroup 1 ─── N Category
```

`Category.categoryGroupId` dùng `onDelete: Restrict`.

---

## 14. Model `Category`

### 14.1. Mục đích

Lưu bản dịch tên category theo ngôn ngữ và liên kết về cùng một `CategoryGroup`.

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `categoryGroupId` | `Int` | Không | FK `CategoryGroup`, restrict |
| `name` | `String` | Không | Tên đã localize |
| `languageId` | `Int` | Không | FK `Language`, restrict |
| `createdAt` | `DateTime` | Không | — |
| `updatedAt` | `DateTime` | Không | — |
| `deletedAt` | `DateTime?` | Có | Soft delete |

### 14.2. Unique constraint

```text
UNIQUE(name, language_id)
UNIQUE(category_group_id, language_id)
```

Ý nghĩa:

- Một tên category không lặp trong cùng ngôn ngữ.
- Một group chỉ có tối đa một bản dịch trong mỗi ngôn ngữ.

### 14.3. Quan hệ với post

Category và Post là nhiều-nhiều qua `PostCategory`.

Category dùng `ON DELETE RESTRICT` tại bảng nối. Muốn hard-delete category phải bảo đảm không còn `post_categories` tham chiếu hoặc phải có quy trình chuyển category.

Seed hiện có logic xử lý xung đột giữa hai unique constraint và di chuyển quan hệ `PostCategory` trước khi xóa category trùng.

---

# PHẦN III — NỘI DUNG

## 15. Model `Post`

### 15.1. Mục đích

Lưu bài viết, trạng thái kiểm duyệt, bản dịch, tác giả, ngôn ngữ và số lượt xem tổng.

| Field | Kiểu | Null | Mặc định | Ghi chú |
|---|---|---:|---|---|
| `id` | `Int` | Không | Auto increment | PK |
| `title` | `String` | Không | — | Chưa có slug |
| `thumbnailUrl` | `String?` | Có | `null` | URL thumbnail |
| `content` | `String` | Không | — | `TEXT` |
| `status` | `PostStatus` | Không | `DRAFT` | Workflow duyệt |
| `viewCount` | `Int` | Không | `0` | Tổng lượt xem |
| `publishedAt` | `DateTime?` | Có | `null` | Xuất bản lần đầu |
| `parentPostId` | `Int?` | Có | `null` | Bài gốc của bản dịch |
| `authorId` | `Int` | Không | — | FK user, cascade |
| `languageId` | `Int` | Không | — | FK language, restrict |
| `reviewedById` | `Int?` | Có | `null` | Moderator duyệt |
| `reviewedAt` | `DateTime?` | Có | `null` | — |
| `rejectionReason` | `String?` | Có | `null` | `TEXT` |
| `createdAt` | `DateTime` | Không | `now()` | — |
| `updatedAt` | `DateTime` | Không | `@updatedAt` | — |
| `deletedAt` | `DateTime?` | Có | `null` | Soft delete |

### 15.2. Unique và index

Unique:

```text
(parent_post_id, language_id)
```

Mục đích: một bài gốc chỉ có tối đa một bản dịch cho mỗi ngôn ngữ.

Index:

- `authorId`
- `languageId`
- `parentPostId`
- `status`
- `createdAt`
- `publishedAt`
- `(status, languageId)`
- `(status, publishedAt)`
- `(authorId, status)`

### 15.3. Quan hệ

- N–1 với `User` qua tác giả.
- N–1 với `Language`.
- Self-reference cho bản dịch.
- N–N với category và tag.
- 1–N với media, comment, metrics, view log và report.
- N–N với user qua like và bookmark.

### 15.4. Bản dịch bài viết

Mô hình hiện tại:

```mermaid
flowchart LR
    Root[Post gốc\nparentPostId = null]
    Vi[Post tiếng Việt]
    En[Post tiếng Anh]
    Ja[Post tiếng Nhật]

    Root --> Vi
    Root --> En
    Root --> Ja
```

Trong thực tế, bài gốc cũng là một bản ngôn ngữ. Các bản dịch liên kết bằng `parentPostId`.


### 15.5. `publishedAt`

Migration thứ hai backfill:

```text
publishedAt = reviewedAt nếu có, nếu không dùng createdAt
```

Khi Moderator duyệt:

- Bài xuất bản lần đầu: đặt `publishedAt = reviewedAt`.
- Bài từng xuất bản rồi sửa: giữ `publishedAt` cũ.

### 15.6. Xóa

- API thường soft-delete post.
- Hard delete post cascade tới category link, tag link, media, comments, likes, bookmarks, daily metric và view logs.
- Report tới post dùng `SET NULL`, giúp giữ report sau khi post bị hard-delete.

---

## 16. Model `PostCategory`

Bảng nối nhiều-nhiều giữa Post và Category.

| Field | Kiểu | Constraint |
|---|---|---|
| `postId` | `Int` | FK cascade tới Post |
| `categoryId` | `Int` | FK restrict tới Category |

Primary key:

```text
(post_id, category_id)
```

Index bổ sung: `categoryId` để lấy các post thuộc category.

Migration thứ hai chuyển dữ liệu từ cột cũ `posts.category_id` sang bảng này trước khi drop cột, và dừng migration nếu có bài không chuyển được.

---

## 17. Model `Tag`

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `name` | `String` | Không | Unique toàn hệ thống |
| `createdAt` | `DateTime` | Không | — |
| `deletedAt` | `DateTime?` | Có | Soft delete |

---

## 18. Model `PostTag`

Bảng nối Post–Tag.

| Field | Kiểu | Constraint |
|---|---|---|
| `postId` | `Int` | FK cascade |
| `tagId` | `Int` | FK cascade |

Primary key `(post_id, tag_id)` ngăn một tag gắn hai lần trên cùng bài. Index `tagId` phục vụ tìm bài theo tag và thống kê top tag.

---

## 19. Model `Media`

Lưu media gắn với bài viết.

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `postId` | `Int` | Không | FK cascade |
| `mediaType` | `MediaType` | Không | `IMAGE` hoặc `VIDEO` |
| `mediaUrl` | `String` | Không | URL truy cập |
| `publicId` | `String` | Không | ID Cloudinary, mặc định chuỗi rỗng |
| `createdAt` | `DateTime` | Không | — |
| `deletedAt` | `DateTime?` | Có | Soft delete |

Index: `postId`, `mediaType`.

`publicId` dùng để xóa file thật trên Cloudinary khi cleanup. Giá trị mặc định `""` giúp tương thích dữ liệu cũ nhưng không nên dùng cho record mới.

---

# PHẦN IV — TƯƠNG TÁC CỘNG ĐỒNG

## 20. Model `Comment`

### 20.1. Cấu trúc

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `postId` | `Int` | Không | FK cascade tới post |
| `userId` | `Int` | Không | FK cascade tới user |
| `parentId` | `Int?` | Có | Self-reference |
| `content` | `String` | Không | `TEXT` |
| `createdAt` | `DateTime` | Không | — |
| `updatedAt` | `DateTime` | Không | — |
| `deletedAt` | `DateTime?` | Có | Soft delete |

Index: `postId`, `userId`, `parentId`, `createdAt`.

### 20.2. Cây bình luận

Schema cho phép cây nhiều cấp, nhưng service hiện chuẩn hóa reply về comment gốc để API hiển thị hai cấp:

```text
Comment gốc
└── Replies
```

Khi xóa comment gốc, transaction soft-delete comment và toàn bộ reply trực tiếp. Khi restore, các reply cũng được khôi phục.
---

## 21. Model `PostLike`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `postId` | `Int` | FK cascade |
| `userId` | `Int` | FK cascade |
| `createdAt` | `DateTime` | — |

Composite PK `(post_id, user_id)` bảo đảm một user chỉ like một bài một lần. Index `userId` hỗ trợ danh sách bài đã like.

---

## 22. Model `PostBookmark`

Cấu trúc tương tự `PostLike`.

Composite PK `(post_id, user_id)` chống bookmark trùng. Index `userId` phục vụ trang bookmark cá nhân.

---

## 23. Model `UserFollow`

Biểu diễn self many-to-many giữa user.

| Field | Kiểu | Ghi chú |
|---|---|---|
| `followerId` | `Int` | Người thực hiện follow |
| `followingId` | `Int` | Người được follow |
| `createdAt` | `DateTime` | — |

Composite PK `(follower_id, following_id)` chống follow trùng. Index `followingId` hỗ trợ lấy followers.

### 23.1. Ràng buộc còn thiếu

Database chưa có check constraint ngăn user tự follow chính mình:

```sql
ALTER TABLE user_follows
ADD CONSTRAINT user_follows_no_self_follow
CHECK (follower_id <> following_id);
```

Service có thể kiểm tra, nhưng constraint database vẫn cần thiết để bảo vệ invariant từ mọi luồng ghi dữ liệu.

---

## 24. Model `BlogOwnerRequest`

Lưu yêu cầu nâng role từ `NORMAL` lên `BLOG_OWNER`.

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `userId` | `Int` | Không | FK cascade |
| `reason` | `String` | Không | `TEXT` |
| `topics` | `String?` | Có | `TEXT` |
| `status` | `BlogOwnerRequestStatus` | Không | Default `PENDING` |
| `reviewedById` | `Int?` | Có | Admin review |
| `reviewedAt` | `DateTime?` | Có | — |
| `rejectionReason` | `String?` | Có | — |
| `createdAt` | `DateTime` | Không | — |
| `updatedAt` | `DateTime` | Không | — |

Index: `userId`, `status`, `reviewedById`.

Duyệt request dùng transaction có conditional `updateMany` với `status = PENDING` để chống hai admin xử lý đồng thời. Khi approved, cùng transaction sẽ:

1. Đổi role user thành `BLOG_OWNER`.
2. Revoke tất cả session cũ.


## 25. Model `Report`

### 25.1. Mục đích

Lưu report bài viết hoặc comment và kết quả Moderator xử lý.

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `reporterId` | `Int` | Không | FK user, cascade |
| `targetType` | `ReportTargetType` | Không | `POST`/`COMMENT` |
| `postId` | `Int?` | Có | FK set null |
| `commentId` | `Int?` | Có | FK set null |
| `reason` | `ReportReason` | Không | — |
| `description` | `String?` | Có | `TEXT` |
| `status` | `ReportStatus` | Không | `PENDING` |
| `reviewedById` | `Int?` | Có | FK set null |
| `reviewedAt` | `DateTime?` | Có | — |
| `resolutionNote` | `String?` | Có | `TEXT` |
| `createdAt` | `DateTime` | Không | — |
| `updatedAt` | `DateTime` | Không | — |

Index:

- `reporterId`
- `postId`
- `commentId`
- `status`
- `targetType`
- `reviewedById`



### 25.2. Xử lý đồng thời

Moderator claim report bằng `updateMany` với điều kiện `status = PENDING`. Nếu count khác 1, transaction báo conflict. Khi resolve report:

- Ẩn post hoặc comment tương ứng.
- Resolve các report pending cùng target theo logic service.
- Ghi reviewer, thời điểm và resolution note.

---

# PHẦN V — THỐNG KÊ VÀ VIEW

## 26. Model `PostDailyMetric`

Lưu số liệu theo ngày cho mỗi bài.

| Field | Kiểu | Null | Mặc định |
|---|---|---:|---|
| `id` | `Int` | Không | Auto increment |
| `postId` | `Int` | Không | — |
| `metricDate` | `DateTime @db.Date` | Không | — |
| `viewCount` | `Int` | Không | `0` |
| `likeCount` | `Int` | Không | `0` |

Unique `(post_id, metric_date)` bảo đảm một dòng cho mỗi bài/ngày. Index `metricDate` hỗ trợ dashboard theo thời gian.

### 26.1. Vai trò

- `Post.viewCount`: tổng đếm nhanh.
- `PostDailyMetric.viewCount`: chuỗi thời gian theo ngày.
- `PostDailyMetric.likeCount`: tương tác like theo ngày.


## 27. Model `PostViewLog`

Lưu lượt xem gần nhất theo `viewerKey` để giới hạn một lượt xem hợp lệ trong khoảng thời gian.

| Field | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | `Int` | Không | PK |
| `postId` | `Int` | Không | FK cascade |
| `viewerKey` | `String @db.VarChar(128)` | Không | User/session/IP-derived key |
| `viewedAt` | `DateTime` | Không | `now()` |

Index:

```text
(post_id, viewer_key, viewed_at)
viewed_at
```

Source dùng log để giới hạn một view trong khoảng 30 phút.


## 28. Ma trận quan hệ và hành vi xóa

| Quan hệ | On delete hiện tại | Hệ quả |
|---|---|---|
| User → UserSession | Cascade | Xóa user xóa session |
| User → PasswordResetToken | Cascade | Xóa user xóa reset token |
| User → Post (author) | Cascade | Hard-delete user xóa post |
| User → Comment | Cascade | Hard-delete user xóa comment |
| User → Like/Bookmark/Follow | Cascade | Xóa tương tác liên quan |
| User → Report (reporter) | Cascade | Có thể mất lịch sử report |
| User → SecurityLog | SetNull | Giữ log, ẩn user |
| Language → Post/Category | Restrict | Không xóa khi còn tham chiếu |
| CategoryGroup → Category | Restrict | Không xóa khi còn bản dịch |
| Post → các bảng con | Cascade | Xóa sạch dữ liệu nội dung con |
| Category → PostCategory | Restrict | Phải gỡ/chuyển category trước |
| Post/Comment → Report | SetNull | Giữ report sau khi target bị xóa |
| Reviewer User → Report | SetNull | Giữ kết quả review |


## 29. Transaction và tính nhất quán

### 29.1. Transaction đang được sử dụng

Các luồng quan trọng đã dùng Prisma transaction:

- Soft-delete user và revoke session/ẩn nội dung.
- Lock user hoặc đổi role và revoke session.
- Duyệt yêu cầu Blog Owner và nâng role.
- Xóa/restore comment cùng replies.
- Duyệt hoặc từ chối bài.
- Resolve hoặc reject report.
- Quản lý category group đa ngôn ngữ.
- Dashboard đọc nhiều aggregate trong một transaction batch.

### 29.2. Chống race condition

Các workflow review dùng pattern:

```ts
updateMany({
  where: {
    id,
    status: 'PENDING',
  },
  data: {
    status: 'RESOLVED',
  },
});
```

Sau đó kiểm tra `count === 1`. Đây là optimistic claim phù hợp để chống hai admin/moderator xử lý cùng record.

## 30. Danh mục index hiện tại

### 30.1. Identity

| Bảng | Index/Unique |
|---|---|
| `users` | unique username, unique email, role, status |
| `user_sessions` | unique refresh token hash, user ID, expires at |
| `password_reset_tokens` | unique token hash, user ID, expires at |
| `security_logs` | user ID, action, created at |

### 30.2. Content và taxonomy

| Bảng | Index/Unique |
|---|---|
| `languages` | unique code |
| `category_groups` | unique code |
| `categories` | unique name/language, unique group/language, group ID, language ID |
| `posts` | author, language, parent, status, created, published, composite status/language, status/published, author/status |
| `post_categories` | PK post/category, category ID |
| `tags` | unique name |
| `post_tags` | PK post/tag, tag ID |
| `media` | post ID, media type |

### 30.3. Interaction và analytics

| Bảng | Index/Unique |
|---|---|
| `comments` | post ID, user ID, parent ID, created at |
| `post_likes` | PK post/user, user ID |
| `post_bookmarks` | PK post/user, user ID |
| `user_follows` | PK follower/following, following ID |
| `reports` | reporter, post, comment, status, target type, reviewer |
| `post_daily_metrics` | unique post/date, date |
| `post_view_logs` | post/viewer/time, viewed time |

---

## 31. Soft delete và retention

### 31.1. Chính sách hiện tại

Cleanup cron chạy mỗi ngày lúc 00:00 và hard-delete dữ liệu soft-delete quá 30 ngày.

Media được xử lý hai bước:

1. Xóa file Cloudinary theo `publicId`.
2. Hard-delete row trong database.

## 32. Bảo mật dữ liệu

### 32.1. Dữ liệu nhạy cảm

- `users.password_hash`
- `user_sessions.refresh_token_hash`
- `password_reset_tokens.token_hash`
- Email, IP, user agent.
- Lý do khóa và report.

