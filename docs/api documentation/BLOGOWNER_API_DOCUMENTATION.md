# BLOGOWNER_API_DOCUMENTATION

> Tài liệu API **Blog Owner** cho dự án Quản lý Blog (NestJS + Prisma). Cấu trúc tài liệu được xây dựng cùng kiểu với `ADMIN_API_DOCUMENTATION.md`: mô tả request backend thực sự chấp nhận, JSON response, HTTP status và các quy tắc nghiệp vụ theo source cuối sau clean code.

- **Phạm vi:** 14 endpoint Blog Owner
- **Base URL:** `/api/v1`
- **Controller prefix:** `/blog-owner`
- **JWT / Role bắt buộc:** `BLOG_OWNER`
- **Ngày rà soát:** 18/09/2026
- **Công nghệ liên quan:** NestJS 11, Prisma 7, PostgreSQL, Cloudinary, LibreTranslate, BullMQ, Redis
- **Lưu ý dữ liệu mẫu:** ID, token, URL, số liệu và timestamp chỉ mang tính minh họa; tên field, vị trí payload, kiểu dữ liệu, HTTP status và luồng nghiệp vụ bám theo source cuối.

## Mục lục

- [Quy tắc chung backend áp dụng](#quy-tắc-chung-backend-áp-dụng)
- [Post Group và vòng đời trạng thái](#post-group-và-vòng-đời-trạng-thái)
- [Dịch nền với BullMQ và Redis](#dịch-nền-với-bullmq-và-redis)
- [Quy tắc upload thumbnail và media](#quy-tắc-upload-thumbnail-và-media)
- [Danh mục API Blog Owner](#danh-mục-api-blog-owner)
- [API Blog Owner — request và response](#api-blog-owner--request-và-response)
- [Bảng lỗi thường gặp](#bảng-lỗi-thường-gặp)

## Quy tắc chung backend áp dụng

### Success envelope

Dữ liệu controller/service trả về được `TransformInterceptor` bọc theo cấu trúc:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "example": "payload nghiệp vụ"
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

### Error envelope

`HttpExceptionFilter` chuẩn hóa lỗi. `message` có thể là chuỗi hoặc mảng chuỗi nếu lỗi đến từ `class-validator`.

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["translationLanguageIds không được chứa ngôn ngữ trùng nhau"],
  "path": "/api/v1/blog-owner/posts",
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

### JWT và role

Tất cả endpoint Blog Owner yêu cầu access token:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

- Không có token hoặc token không hợp lệ: `401`.
- Token hợp lệ nhưng role không phải `BLOG_OWNER`: `403`.
- Backend lấy `ownerId` từ JWT; không nhận `authorId` từ body/query để quyết định quyền sở hữu.
- Tài nguyên thuộc Blog Owner khác bị từ chối theo rule của service.

### Validation, trim và field thừa

- `ValidationPipe` dùng `transform=true`, `whitelist=true`, `forbidNonWhitelisted=true`.
- Field ngoài DTO làm request thất bại `400`.
- `TrimPipe` trim đệ quy string trong body.
- `title` bắt buộc khi create, tối đa 255 ký tự.
- `title` và `content` được kiểm tra từ cấm ở DTO **và** kiểm tra lại tại service để không thể bypass validation khi gọi nội bộ.
- `content` được sanitize trước khi xử lý nghiệp vụ.
- Khi submit trực tiếp hoặc finalize translation batch sang `PENDING_REVIEW`, backend đọc lại toàn Post Group và kiểm tra từ cấm thêm một lần.
- Output từ LibreTranslate cũng được kiểm tra; translation có từ cấm không được ghi vào DB.
- Bài phải có ít nhất một category.
- Category phải tồn tại, chưa bị soft-delete, đúng language và thuộc Category Group còn hoạt động.
- Language phải tồn tại, chưa bị xóa và đang `isActive=true`.
- Tổng tag sau khi xử lý `tagIds` + `tagNames` tối đa 5.
- `translationLanguageIds` phải là mảng integer, không trùng và không chứa language của root.
- `submitForReview` hỗ trợ boolean; multipart chấp nhận chuỗi `"true"` / `"false"` qua transform DTO.

### Pagination

Các API danh sách dùng pagination chuẩn:

| Query   | Kiểu    | Mặc định | Quy tắc                  |
| ------- | ------- | -------: | ------------------------ |
| `page`  | integer |        1 | nhỏ hơn 1 được chuẩn hóa |
| `limit` | integer |       10 | tối đa thực tế 50        |

Response:

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

### Enum chính

| Enum                     | Giá trị hợp lệ                                                   |
| ------------------------ | ---------------------------------------------------------------- |
| `UserRole`               | `NORMAL` \| `BLOG_OWNER` \| `CONTENT_MODERATOR` \| `SUPER_ADMIN` |
| `PostStatus`             | `DRAFT` \| `PENDING_REVIEW` \| `PUBLISH` \| `REJECT`             |
| `MediaType`              | `IMAGE` \| `VIDEO`                                               |
| Translation batch status | `QUEUED` \| `PROCESSING` \| `COMPLETED` \| `FAILED`              |

## Post Group và vòng đời trạng thái

### Cấu trúc nhóm bài đa ngôn ngữ

```text
ROOT (parentPostId = null)
├─ Translation EN (parentPostId = root.id)
├─ Translation JA (parentPostId = root.id)
└─ Translation ...
```

Quy tắc:

- Một logical article được quản lý theo **Post Group**.
- Root là post có `parentPostId=null`.
- Translation luôn trỏ về root qua `parentPostId`.
- Mỗi language chỉ có tối đa một translation active trong group.
- Danh sách Blog Owner phân trang theo group, không phân trang từng translation.
- Filter chọn group khớp, sau đó backend trả toàn bộ version active trong group.
- Update, submit, delete và standalone media chỉ thực hiện bằng **root ID**.
- Không được chỉnh sửa hoặc xóa riêng một translation.
- Translation được upsert theo `(parentPostId, languageId)` để không tạo duplicate khi chỉnh sửa.

### Tạo bài

| Trường hợp                                              | Trạng thái                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Không có translation, `submitForReview=false/undefined` | `DRAFT`                                                                                       |
| Không có translation, `submitForReview=true`            | tạo `DRAFT`, hoàn tất file rồi cả group → `PENDING_REVIEW`                                    |
| Có translation                                          | root/group giữ `DRAFT`, enqueue BullMQ; finalize mới quyết định `DRAFT` hoặc `PENDING_REVIEW` |

### Chỉnh sửa bài

- Chỉ root được update.
- Nếu bất kỳ version nào đang `PENDING_REVIEW` thì khóa toàn group.
- `DRAFT`: chỉnh sửa và tiếp tục theo lựa chọn `submitForReview`.
- `REJECT`: phải có thay đổi thật; sau update group quay về `DRAFT` hoặc đi tiếp `PENDING_REVIEW` nếu submit.
- `PUBLISH`: khi thay đổi nội dung, group rời trạng thái public và đi qua quy trình duyệt lại.
- Request không có thay đổi thật trả `400` với message `Không có dữ liệu nào để cập nhật.`.
- Các translation cũ luôn được giữ; `translationLanguageIds` chỉ bổ sung target language mới, không xóa translation hiện có.

### Gửi duyệt

Chỉ chấp nhận root ID và toàn group phải `DRAFT`:

```text
DRAFT (root + translations)
        ↓
PENDING_REVIEW (toàn group)
```

### Xóa bài

- Chỉ root ID.
- Soft-delete root và toàn bộ translations active cùng một timestamp.
- Không xóa riêng translation.

## Dịch nền với BullMQ và Redis

### Kiến trúc

```text
Create / Update root
      ↓
Post Group = DRAFT
      ↓
BullMQ FlowProducer
      ↓
Redis
      ├─ queue state
      ├─ progress
      ├─ retry
      └─ parent-child dependency
      ↓
translate-post jobs
      ↓
LibreTranslate
      ↓
upsert translations
      ↓
finalize-translation-batch
      ↓
DRAFT / PENDING_REVIEW
```

### Thành phần

| Thành phần    | Giá trị / trách nhiệm                              |
| ------------- | -------------------------------------------------- |
| Queue         | `blogowner-translation`                            |
| Flow producer | `blogowner-translation-flow`                       |
| Child job     | `translate-post`                                   |
| Parent job    | `finalize-translation-batch`                       |
| Storage queue | Redis                                              |
| Dịch nội dung | shared `LibreTranslateService`                     |
| Retry         | exponential backoff cho lỗi tạm thời               |
| Stale guard   | so sánh `sourceUpdatedAt` với `updatedAt` hiện tại |

Job chỉ mang ID/metadata cần thiết, không lưu toàn bộ HTML vào Redis. Worker đọc lại database trước khi dịch/ghi dữ liệu.

### Mapping category

Khi tạo translation của post:

- backend không dịch lại tên category;
- lấy `categoryGroupId` từ category nguồn;
- tìm category trong cùng Category Group và đúng target language;
- nếu mapping nghiệp vụ không hợp lệ, job không được ghi translation sai.

### Batch progress

Create/Update có translation trả thêm:

```json
{
  "translationBatch": {
    "batchId": "translation-batch-1766-...",
    "status": "QUEUED"
  }
}
```

Batch status API trả progress toàn batch và từng language.

## Quy tắc upload thumbnail và media

### Create/Update Post

Controller chấp nhận:

| Mục đích  | Field chính | Alias           | Giới hạn                                           |
| --------- | ----------- | --------------- | -------------------------------------------------- |
| Thumbnail | `thumbnail` | `thumbnailFile` | 1 file; **JPEG / PNG / WEBP thật**; tối đa 10 MB   |
| Media     | `media`     | `files`, `file` | ảnh/video theo MediaService; mỗi file tối đa 10 MB |

Đối với **thumbnail**, backend không tin tên file hoặc MIME do client khai báo. `BlogownerPostHelperService` kiểm tra đồng thời:

1. buffer tồn tại và không rỗng;
2. kích thước thực tế không vượt quá 10 MB;
3. magic bytes nhận diện đúng JPEG / PNG / WEBP;
4. `mimetype` phải khớp loại file được nhận diện;
5. extension phải khớp loại file được nhận diện.

Các file HTML, SVG, JS, PDF, ZIP hoặc file giả `.png/.jpg/.webp` sẽ bị từ chối trước khi upload lên Cloudinary. `thumbnailUrl` không được nhận trực tiếp từ payload Blog Owner; thumbnail phải đi qua luồng upload file.

`categoryIds`, `tagIds`, `tagNames`, `translationLanguageIds` hỗ trợ JSON array hoặc dạng chuỗi phù hợp transform DTO.

### Standalone media sau clean code

`POST /posts/:postId/media` và `DELETE /posts/:postId/media/:mediaId` áp dụng theo group:

- `postId` bắt buộc là root ID.
- Translation ID trả `400`.
- Media standalone được gắn với root.
- Media phải thuộc đúng root khi delete.
- Nếu một version đang `PENDING_REVIEW`, cả group bị khóa thao tác media.

| Trạng thái group    | Hành vi                                              |
| ------------------- | ---------------------------------------------------- |
| `DRAFT`             | thao tác media, giữ `DRAFT`                          |
| `REJECT`            | sau thao tác thành công, cả group → `DRAFT`          |
| `PUBLISH`           | cả group → `PENDING_REVIEW` trước khi thay đổi media |
| có `PENDING_REVIEW` | từ chối thao tác                                     |

## Danh mục API Blog Owner

| Mã  | Method | Endpoint                                          | JWT / Role                         | HTTP |
| --- | ------ | ------------------------------------------------- | ---------------------------------- | ---: |
| B01 | GET    | `/api/v1/blog-owner/dashboard/summary`            | JWT; `BLOG_OWNER`                  |  200 |
| B02 | GET    | `/api/v1/blog-owner/dashboard/activity`           | JWT; `BLOG_OWNER`                  |  200 |
| B03 | GET    | `/api/v1/blog-owner/dashboard/featured`           | JWT; `BLOG_OWNER`                  |  200 |
| B04 | GET    | `/api/v1/blog-owner/options`                      | JWT; `BLOG_OWNER`                  |  200 |
| B05 | GET    | `/api/v1/blog-owner/posts`                        | JWT; `BLOG_OWNER`                  |  200 |
| B06 | GET    | `/api/v1/blog-owner/posts/:id`                    | JWT; `BLOG_OWNER`; ownership       |  200 |
| B07 | POST   | `/api/v1/blog-owner/posts`                        | JWT; `BLOG_OWNER`                  |  201 |
| B08 | PATCH  | `/api/v1/blog-owner/posts/:id`                    | JWT; `BLOG_OWNER`; root ownership  |  200 |
| B09 | DELETE | `/api/v1/blog-owner/posts/:id`                    | JWT; `BLOG_OWNER`; root ownership  |  200 |
| B10 | POST   | `/api/v1/blog-owner/posts/:id/submit`             | JWT; `BLOG_OWNER`; root ownership  |  200 |
| B11 | POST   | `/api/v1/blog-owner/posts/:id/translate-preview`  | JWT; `BLOG_OWNER`; ownership       |  200 |
| B12 | POST   | `/api/v1/blog-owner/posts/:postId/media`          | JWT; `BLOG_OWNER`; root ownership  |  201 |
| B13 | DELETE | `/api/v1/blog-owner/posts/:postId/media/:mediaId` | JWT; `BLOG_OWNER`; root ownership  |  200 |
| B14 | GET    | `/api/v1/blog-owner/translation-batches/:batchId` | JWT; `BLOG_OWNER`; batch ownership |  200 |

## API Blog Owner — request và response

### B01 — GET /api/v1/blog-owner/dashboard/summary

**Lấy KPI tổng quan của Blog Owner**

| Xác thực / phân quyền    | HTTP thành công | Content-Type request |
| ------------------------ | --------------: | -------------------- |
| Bearer JWT; `BLOG_OWNER` |             200 | không có body        |

#### Request backend chấp nhận

```http
GET /api/v1/blog-owner/dashboard/summary
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "postCounts": {
      "total": 12,
      "draft": 3,
      "pendingReview": 2,
      "published": 6,
      "rejected": 1
    },
    "totals": {
      "views": 1250,
      "likes": 210,
      "comments": 45
    }
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- `postCounts` đếm logical article bằng **root post**.
- `totals.views/likes/comments` cộng trên toàn bộ version của owner gồm root + translations.

### B02 — GET /api/v1/blog-owner/dashboard/activity

**Lấy biến động view/like theo ngày**

| Xác thực / phân quyền    | HTTP thành công | Content-Type request |
| ------------------------ | --------------: | -------------------- |
| Bearer JWT; `BLOG_OWNER` |             200 | không có body        |

#### Request backend chấp nhận

| Vị trí | Field  | Kiểu    | Bắt buộc | Validation                |
| ------ | ------ | ------- | -------- | ------------------------- |
| Query  | `days` | integer | Không    | mặc định 7; min 1; max 30 |

```http
GET /api/v1/blog-owner/dashboard/activity?days=7
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "days": 7,
    "last7Days": [
      {
        "date": "2026-09-18",
        "views": 18,
        "likes": -1
      }
    ]
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- View là valid view phát sinh trong ngày.
- Like là **net change**: like `+1`, unlike `-1`; vì vậy có thể âm.
- Backend luôn lấp đủ số ngày yêu cầu, ngày không có dữ liệu trả 0.

### B03 — GET /api/v1/blog-owner/dashboard/featured

**Lấy bài đã xuất bản nổi bật**

#### Request backend chấp nhận

| Vị trí | Field   | Kiểu    | Bắt buộc | Validation                             |
| ------ | ------- | ------- | -------- | -------------------------------------- |
| Query  | `sort`  | string  | Không    | `views` hoặc `likes`; mặc định `views` |
| Query  | `limit` | integer | Không    | min 1; max 20; mặc định 5              |

```http
GET /api/v1/blog-owner/dashboard/featured?sort=views&limit=5
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "sort": "views",
    "posts": [
      {
        "id": 1766,
        "title": "NestJS và BullMQ",
        "thumbnailUrl": null,
        "status": "PUBLISH",
        "views": 300,
        "likes": 25,
        "language": {
          "id": 18,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      }
    ]
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

Featured **không group root + translation**. Mỗi exact Post cạnh tranh độc lập; nhiều version của cùng logical article có thể cùng xuất hiện.

### B04 — GET /api/v1/blog-owner/options

**Lấy dữ liệu lựa chọn cho form bài viết**

```http
GET /api/v1/blog-owner/options
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "languages": [
      {
        "id": 18,
        "code": "vi",
        "name": "Tiếng Việt",
        "flag": "🇻🇳",
        "isDefault": true,
        "isActive": true
      }
    ],
    "categories": [
      {
        "id": 133,
        "name": "Công nghệ",
        "languageId": 18,
        "categoryGroupId": 67,
        "language": {
          "id": 18,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳",
          "isDefault": true,
          "isActive": true
        },
        "categoryGroup": {
          "id": 67,
          "code": "technology"
        }
      }
    ],
    "tags": [
      {
        "id": 46,
        "name": "NestJS"
      }
    ]
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ language active/chưa xóa.
- Chỉ category active, thuộc language active và Category Group chưa xóa.
- Chỉ tag chưa soft-delete.
- Default language được sắp lên trước.

### B05 — GET /api/v1/blog-owner/posts

**Lấy danh sách bài của owner theo Post Group**

#### Request backend chấp nhận

Các query từ `GetBlogownerPostsDto`:

| Field                 | Kiểu           | Ghi chú                                            |
| --------------------- | -------------- | -------------------------------------------------- |
| `search`              | string         | search title/content theo Core                     |
| `categoryId`          | integer        | lọc group có category                              |
| `languageId`          | integer        | lọc language                                       |
| `lang`                | string         | mã language                                        |
| `status`              | `PostStatus`   | lọc trạng thái                                     |
| `tagId`               | integer        | lọc tag ID                                         |
| `tagName`             | string         | lọc tag name                                       |
| `page`                | integer        | pagination                                         |
| `limit`               | integer        | pagination                                         |
| `sortBy`              | string         | group hỗ trợ `updatedAt`, `viewCount`, `likeCount` |
| `sortOrder` / `order` | `asc` / `desc` | hướng sort                                         |

`authorId` và `bookmarkedByUserId` không nhận từ query Blog Owner.

```http
GET /api/v1/blog-owner/posts?status=DRAFT&page=1&limit=10&sortBy=updatedAt&sortOrder=desc
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "root": {
          "id": 1766,
          "title": "NestJS và BullMQ",
          "status": "DRAFT",
          "languageId": 18,
          "parentPostId": null,
          "viewCount": 100,
          "likeCount": 8
        },
        "translations": [
          {
            "id": 1767,
            "title": "NestJS and BullMQ",
            "status": "DRAFT",
            "languageId": 19,
            "parentPostId": 1766,
            "viewCount": 20,
            "likeCount": 3
          }
        ],
        "totals": {
          "views": 120,
          "likes": 11
        },
        "latestUpdatedAt": "2026-09-18T07:50:00.000Z"
      }
    ],
    "meta": {
      "totalItems": 1,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 1,
      "currentPage": 1
    }
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- Một group chỉ tính một item phân trang.
- Filter xác định group khớp; response trả lại toàn bộ version active của group.
- Tổng view/like là tổng của root + translations.

### B06 — GET /api/v1/blog-owner/posts/:id

**Xem chi tiết một version và context của Post Group**

| Vị trí | Field | Kiểu    | Bắt buộc |
| ------ | ----- | ------- | -------- |
| Path   | `id`  | integer | Có       |

```http
GET /api/v1/blog-owner/posts/1766
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 1766,
    "title": "NestJS và BullMQ",
    "thumbnailUrl": null,
    "content": "<p>Nội dung...</p>",
    "status": "DRAFT",
    "viewCount": 100,
    "likeCount": 8,
    "publishedAt": null,
    "parentPostId": null,
    "authorId": 21,
    "languageId": 18,
    "reviewedAt": null,
    "rejectionReason": null,
    "media": [],
    "translations": [
      {
        "id": 1766,
        "title": "NestJS và BullMQ",
        "thumbnailUrl": null,
        "status": "DRAFT",
        "parentPostId": null,
        "languageId": 18,
        "language": {
          "id": 18,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      },
      {
        "id": 1767,
        "title": "NestJS and BullMQ",
        "thumbnailUrl": null,
        "status": "DRAFT",
        "parentPostId": 1766,
        "languageId": 19,
        "language": {
          "id": 19,
          "code": "en",
          "name": "English",
          "flag": "🇬🇧"
        }
      }
    ]
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- Có thể gọi bằng root ID hoặc translation ID.
- Backend resolve group nhưng trả full detail của version được yêu cầu.
- `translations` chứa summary các version active trong cùng group.
- `reviewedById` và `deletedAt` bị ẩn.

### B07 — POST /api/v1/blog-owner/posts

**Tạo root post và tùy chọn dịch nền**

| Xác thực / phân quyền    | HTTP thành công | Content-Type request                          |
| ------------------------ | --------------: | --------------------------------------------- |
| Bearer JWT; `BLOG_OWNER` |             201 | `application/json` hoặc `multipart/form-data` |

#### Request backend chấp nhận

| Vị trí | Field                    | Kiểu          | Bắt buộc | Backend xử lý                                                           |
| ------ | ------------------------ | ------------- | -------- | ----------------------------------------------------------------------- |
| Body   | `title`                  | string        | Có       | không rỗng; max 255; kiểm tra từ cấm                                    |
| Body   | `content`                | string        | Có       | sanitize; không rỗng; kiểm tra từ cấm                                   |
| Body   | `languageId`             | integer       | Có       | language active                                                         |
| Body   | `categoryIds`            | integer[]     | Có       | ít nhất 1; unique; đúng language                                        |
| Body   | `tagIds`                 | integer[]     | Không    | unique; tag active                                                      |
| Body   | `tagNames`               | string[]      | Không    | unique; backend tái sử dụng/tạo tag hợp lệ                              |
| Body   | `translationLanguageIds` | integer[]     | Không    | unique; không trùng source language                                     |
| Body   | `submitForReview`        | boolean       | Không    | mặc định `false`                                                        |
| File   | `thumbnail`              | image         | Không    | max 1; JPEG/PNG/WEBP thật; magic bytes + MIME + extension; tối đa 10 MB |
| File   | `media`                  | image/video[] | Không    | max 10 mỗi field, 10 MB/file                                            |

Không được gửi `status`, `parentPostId`, `authorId`, `thumbnailUrl`.

#### Request mẫu

```json
{
  "title": "NestJS và BullMQ",
  "content": "<p>Nội dung...</p>",
  "languageId": 18,
  "categoryIds": [133],
  "tagNames": ["NestJS", "BullMQ"],
  "translationLanguageIds": [19],
  "submitForReview": true
}
```

#### Response khi có translation

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 1766,
    "title": "NestJS và BullMQ",
    "status": "DRAFT",
    "languageId": 18,
    "parentPostId": null,
    "translationBatch": {
      "batchId": "translation-batch-1766-...",
      "status": "QUEUED"
    }
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- `title`/`content` chứa từ cấm bị từ chối trước khi lưu.
- Thumbnail được kiểm tra file thật **trước khi tạo Post DRAFT**; thumbnail giả/không hợp lệ không để lại Post rác trong DB.
- Khi có translation, request **không chờ LibreTranslate**.
- Dù `submitForReview=true`, response ban đầu vẫn `DRAFT`; parent finalize mới chuyển cả group `PENDING_REVIEW`.
- Khi không có translation, backend không dùng BullMQ và có thể quyết định status ngay sau khi file hoàn tất.
- Media chỉ gắn root.

### B08 — PATCH /api/v1/blog-owner/posts/:id

**Cập nhật root và đồng bộ translations**

| Xác thực / phân quyền                    | HTTP thành công |
| ---------------------------------------- | --------------: |
| Bearer JWT; `BLOG_OWNER`; root ownership |             200 |

#### Request backend chấp nhận

Các field editable là partial của create trừ `status`, `parentPostId`, `languageId`, cộng:

- `translationLanguageIds?: integer[]`
- `submitForReview?: boolean`
- thumbnail/media multipart

```json
{
  "title": "NestJS, Redis và BullMQ",
  "categoryIds": [133],
  "translationLanguageIds": [19, 20],
  "submitForReview": false
}
```

#### Điểm cần chú ý

- Translation ID ở path trả `400`.
- Existing translations luôn được giữ và dịch lại.
- Target language mới được union với language đã tồn tại.
- Nếu cần dịch, response có `translationBatch`.
- Không có thay đổi thật trả `400`.

### B09 — DELETE /api/v1/blog-owner/posts/:id

**Soft-delete toàn Post Group**

```http
DELETE /api/v1/blog-owner/posts/1766
Authorization: Bearer <ACCESS_TOKEN>
```

#### Response

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đã xóa bài viết ID 1766 và tất cả bản dịch."
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

- Chỉ root ID.
- Root + translations được soft-delete cùng timestamp.

### B10 — POST /api/v1/blog-owner/posts/:id/submit

**Gửi toàn Post Group sang Moderator**

```http
POST /api/v1/blog-owner/posts/1766/submit
Authorization: Bearer <ACCESS_TOKEN>
```

- Không body.
- Chỉ root ID.
- Mọi version active trong group phải `DRAFT`.
- Backend đọc lại root + translations và kiểm tra `title`/`content` chứa từ cấm trước khi chuyển trạng thái.
- Sau thành công toàn group → `PENDING_REVIEW`.
- Với create/update có translation và `submitForReview=true`, parent job cũng kiểm tra lại toàn group trước khi finalize `PENDING_REVIEW`.

### B11 — POST /api/v1/blog-owner/posts/:id/translate-preview

**Preview dịch title/content bằng LibreTranslate**

#### Request

```json
{
  "targetLanguageId": 19
}
```

#### Response nghiệp vụ mẫu

```json
{
  "sourcePostId": 1766,
  "sourceLanguage": {
    "id": 18,
    "code": "vi",
    "name": "Tiếng Việt"
  },
  "targetLanguage": {
    "id": 19,
    "code": "en",
    "name": "English"
  },
  "title": "NestJS and BullMQ",
  "content": "<p>Translated content...</p>"
}
```

#### Điểm cần chú ý

- Chỉ preview; không tạo/update Post.
- Source post phải thuộc owner.
- Target language phải active.
- Shared `LibreTranslateService` dịch `title` + `content`.
- Với background translation thật, output dịch chứa từ cấm bị đánh dấu lỗi không thể retry và **không được upsert vào Post translation**.

### B12 — POST /api/v1/blog-owner/posts/:postId/media

**Upload một media cho root**

| Field  | Kiểu        | Bắt buộc |
| ------ | ----------- | -------- |
| `file` | image/video | Có       |

```http
POST /api/v1/blog-owner/posts/1766/media
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: multipart/form-data

file=<diagram.png>
```

- Mỗi file tối đa 10 MB.
- `postId` bắt buộc là root ID.
- Status group được xử lý theo bảng media phía trên.

### B13 — DELETE /api/v1/blog-owner/posts/:postId/media/:mediaId

**Xóa media của root**

```http
DELETE /api/v1/blog-owner/posts/1766/media/900
Authorization: Bearer <ACCESS_TOKEN>
```

- `postId` phải là root ID.
- Media phải thuộc đúng root và chưa soft-delete.
- Xóa qua MediaService; state transition áp dụng cho toàn group.

### B14 — GET /api/v1/blog-owner/translation-batches/:batchId

**Theo dõi trạng thái BullMQ translation batch**

```http
GET /api/v1/blog-owner/translation-batches/translation-batch-1766-abc
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "batchId": "translation-batch-1766-abc",
    "rootPostId": 1766,
    "status": "PROCESSING",
    "progress": 63,
    "translations": [
      {
        "languageId": 19,
        "status": "PROCESSING",
        "progress": 40
      },
      {
        "languageId": 20,
        "status": "COMPLETED",
        "progress": 100
      }
    ]
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- `QUEUED`: progress có thể 0.
- `PROCESSING`: progress tổng được tính từ child jobs và phần finalize.
- Parent completed: batch `COMPLETED`, progress 100.
- Một child fail: batch `FAILED`.
- Batch không tồn tại hoặc không thuộc owner trả cùng dạng `404`.
- API không trả raw `failedReason` nội bộ.

## Bảng lỗi thường gặp

| Trường hợp                                                                                       | HTTP |
| ------------------------------------------------------------------------------------------------ | ---: |
| DTO/body/query không hợp lệ; title/content có từ cấm                                             |  400 |
| Translation ID dùng cho update/submit/delete/media                                               |  400 |
| Không có thay đổi thật khi update                                                                |  400 |
| Group có version `PENDING_REVIEW` nhưng cố sửa/media                                             |  400 |
| Language/category/tag không hợp lệ; thumbnail giả/sai JPEG-PNG-WEBP/sai MIME-extension/quá 10 MB |  400 |
| Thiếu/sai JWT                                                                                    |  401 |
| Sai role hoặc không sở hữu tài nguyên                                                            |  403 |
| Không tìm thấy post/media/batch                                                                  |  404 |
| Xung đột nghiệp vụ/dữ liệu                                                                       |  409 |
| LibreTranslate upstream lỗi/response lỗi                                                         |  502 |
| Dịch vụ/cấu hình dịch chưa sẵn sàng                                                              |  503 |
