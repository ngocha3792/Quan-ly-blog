# BLOGOWNER_API_DOCUMENTATION

> Tài liệu API **Blog Owner** cho dự án Quản lý Blog (NestJS + Prisma). Nội dung mô tả payload frontend/backend thực sự chấp nhận, JSON response và quy tắc trạng thái theo source code đã rà soát.

- **Phạm vi:** 12 endpoint Blog Owner
- **Base URL:** `/api/v1`
- **Controller prefix:** `/blog-owner`
- **JWT / Role bắt buộc:** `BLOG_OWNER`
- **Ngày rà soát:** 01/08/2026
- **Lưu ý dữ liệu mẫu:** ID, token, URL, số liệu và timestamp chỉ mang tính minh họa. Tên field, vị trí payload, kiểu dữ liệu, HTTP status và luồng nghiệp vụ bám theo source hiện tại.

## Mục lục

- [Quy tắc chung frontend phải tuân theo](#quy-tắc-chung-frontend-phải-tuân-theo)
- [Vòng đời trạng thái bài viết](#vòng-đời-trạng-thái-bài-viết)
- [Quy tắc upload file](#quy-tắc-upload-file)
- [Quy tắc bản dịch](#quy-tắc-bản-dịch)
- [Danh mục API Blog Owner](#danh-mục-api-blog-owner)
- [API Blog Owner — request và response chính xác](#api-blog-owner--request-và-response-chính-xác)
- [Bảng lỗi thường gặp](#bảng-lỗi-thường-gặp)

## Quy tắc chung frontend phải tuân theo

### Success envelope

Mọi dữ liệu controller/service trả về đều được `TransformInterceptor` bọc vào cấu trúc sau. Với Axios, payload nghiệp vụ nằm trong `response.data.data`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "example": "payload nghiệp vụ"
  },
  "timestamp": "2026-08-01T07:00:00.000Z"
}
```

### Error envelope

`HttpExceptionFilter` chuẩn hóa lỗi. `message` có thể là chuỗi hoặc mảng chuỗi nếu lỗi đến từ `class-validator`.

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["property status should not exist"],
  "path": "/api/v1/blog-owner/posts",
  "timestamp": "2026-08-01T07:00:00.000Z"
}
```

### JWT và role

Tất cả endpoint trong tài liệu này yêu cầu access token của tài khoản có role `BLOG_OWNER`.

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Các trường hợp phổ biến:

- Thiếu token, token hết hạn hoặc token không hợp lệ: `401 Unauthorized`.
- Token hợp lệ nhưng role không phải `BLOG_OWNER`: `403 Forbidden`.
- Bài viết tồn tại nhưng thuộc Blog Owner khác: `403 Forbidden`.

### Validation, trim và field thừa

- `ValidationPipe` bật `transform=true`, `whitelist=true`, `forbidNonWhitelisted=true`.
- Field không có trong DTO không bị bỏ qua mà làm request thất bại `400`.
- `TrimPipe` cắt khoảng trắng đệ quy đối với string trong request body.
- `title` tối đa 255 ký tự.
- `title`, `content`, `search` và tên tag chịu kiểm tra từ cấm theo decorator tương ứng.
- Bài viết phải có ít nhất một category.
- Category phải tồn tại, chưa bị soft-delete, thuộc Category Group chưa bị xóa và cùng ngôn ngữ với bài.
- Ngôn ngữ phải tồn tại, chưa bị soft-delete và đang `isActive=true`.
- Tổng số tag sau khi gộp `tagIds` và `tagNames` tối đa 5.
- Tag ID đã bị xóa hoặc tên tag trùng với tag đã soft-delete bị từ chối.

### Pagination

Các API danh sách sử dụng:

| Query   | Kiểu    | Mặc định | Quy tắc                                            |
| ------- | ------- | -------- | -------------------------------------------------- |
| `page`  | integer | `1`      | Giá trị nhỏ hơn 1 được ép về 1.                    |
| `limit` | integer | `10`     | Giá trị nhỏ hơn 1 được ép về 1; tối đa thực tế 50. |

Response phân trang:

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

### Enum chính xác

| Enum         | Giá trị hợp lệ                                                   |
| ------------ | ---------------------------------------------------------------- |
| `UserRole`   | `NORMAL` \| `BLOG_OWNER` \| `CONTENT_MODERATOR` \| `SUPER_ADMIN` |
| `PostStatus` | `DRAFT` \| `PENDING_REVIEW` \| `PUBLISH` \| `REJECT`             |
| `MediaType`  | `IMAGE` \| `VIDEO`                                               |

### Quyền sở hữu

Backend luôn lấy `ownerId` từ JWT, không nhận `authorId` từ client. Blog Owner chỉ có thể:

- xem bài của chính mình;
- sửa bài của chính mình;
- xóa bài của chính mình;
- gửi duyệt bài của chính mình;
- quản lý media của bài thuộc chính mình;
- tạo preview/bản dịch từ bài thuộc chính mình.

## Vòng đời trạng thái bài viết

### Tạo bài

| Thao tác                                             | Trạng thái kết quả                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| Tạo với `submitForReview=false` hoặc không gửi field | `DRAFT`                                                               |
| Tạo với `submitForReview=true`                       | Tạo `DRAFT`, hoàn tất thumbnail/media, sau đó chuyển `PENDING_REVIEW` |

Blog Owner không được gửi trực tiếp `status` và không được tự chuyển bài sang `PUBLISH`.

### Chỉnh sửa bài

| Trạng thái trước khi sửa | Có được sửa? | Trạng thái sau khi sửa thành công         |
| ------------------------ | ------------ | ----------------------------------------- |
| `DRAFT`                  | Có           | `DRAFT`                                   |
| `REJECT`                 | Có           | `DRAFT`; xóa thông tin review cũ          |
| `PUBLISH`                | Có           | `PENDING_REVIEW`; xóa thông tin review cũ |
| `PENDING_REVIEW`         | Không        | Trả `400`                                 |

Request `PATCH` không có field và không có file bị từ chối với message:

```text
Không có dữ liệu nào để cập nhật.
```

### Gửi duyệt

Chỉ cho phép:

```text
DRAFT -> PENDING_REVIEW
```

- `REJECT` phải được chỉnh sửa trước để chuyển về `DRAFT`.
- `PUBLISH` chỉ gửi duyệt lại thông qua thao tác chỉnh sửa.
- `PENDING_REVIEW` không được submit lần nữa.

### Thay đổi media

| Trạng thái hiện tại | Kết quả khi thêm/xóa media                        |
| ------------------- | ------------------------------------------------- |
| `DRAFT`             | Giữ `DRAFT`                                       |
| `REJECT`            | Sau khi thao tác media thành công, chuyển `DRAFT` |
| `PUBLISH`           | Chuyển `PENDING_REVIEW` trước khi thay đổi media  |
| `PENDING_REVIEW`    | Không được thêm/xóa media                         |

## Quy tắc upload file

### Tạo và cập nhật bài

Controller chấp nhận các field multipart sau:

| Mục đích  | Field khuyến nghị | Alias tương thích | Giới hạn                                                       |
| --------- | ----------------- | ----------------- | -------------------------------------------------------------- |
| Thumbnail | `thumbnail`       | `thumbnailFile`   | 1 file; phải là ảnh; tối đa 10 MB                              |
| Media     | `media`           | `files`, `file`   | Mỗi field tối đa 10 file; mỗi file tối đa 10 MB; chỉ ảnh/video |

Frontend nên dùng duy nhất field chuẩn `thumbnail` và `media`, không trộn nhiều alias trong cùng request.

Trong `multipart/form-data`, các mảng `categoryIds`, `tagIds`, `tagNames` có thể gửi dưới dạng JSON string hoặc chuỗi phân tách bằng dấu phẩy, ví dụ:

```text
categoryIds = [73,75]
tagIds      = 46,47
tagNames    = NestJS,Prisma
```

### An toàn khi upload

- Upload nhiều media có rollback: nếu một file phía sau thất bại, media đã upload trước đó được xóa theo thứ tự ngược lại.
- Khi upload thumbnail mới nhưng cập nhật database thất bại, thumbnail mới được cleanup và lỗi database ban đầu được giữ nguyên.
- Khi cập nhật thumbnail, thumbnail cũ chỉ bị xóa sau khi database đã lưu URL mới thành công.
- Xóa media thực hiện soft-delete trong database trước; lỗi cleanup Cloudinary không làm media xuất hiện lại.

## Quy tắc bản dịch

- `translate-preview` gọi LibreTranslate để dịch `title` và `content`, nhưng không ghi database.
- `translations` nhận nội dung đã dịch hoặc nội dung người dùng chỉnh sửa để lưu thành Post mới.
- Bản dịch mới hoặc bản dịch được restore luôn ở trạng thái `DRAFT`.
- Tất cả bản dịch trỏ về bài gốc bằng `parentPostId`.
- Mỗi nhóm bài chỉ có một phiên bản chưa xóa cho mỗi ngôn ngữ.
- Category không được dịch tự động; backend ánh xạ category cùng `CategoryGroup` sang ngôn ngữ đích.
- Tag chưa bị soft-delete được sao chép từ bài nguồn.
- Ngôn ngữ đích phải đang hoạt động.
- Mã ngôn ngữ được trim/lowercase; các alias Chinese được chuẩn hóa (`zh-CN`/`zh-Hans` → `zh`, `zh-TW`/`zh-Hant` → `zt`).
- Thiếu cấu hình LibreTranslate trả `503`; mất kết nối hoặc response hỏng trả `502`; request/cặp ngôn ngữ không được hỗ trợ trả `400`.

## Danh mục API Blog Owner

| Mã  | Method | Endpoint                                          | Chức năng                                  | HTTP thành công |
| --- | ------ | ------------------------------------------------- | ------------------------------------------ | --------------- |
| B01 | GET    | `/api/v1/blog-owner/dashboard`                    | Dashboard của Blog Owner                   | 200             |
| B02 | GET    | `/api/v1/blog-owner/options`                      | Dữ liệu ngôn ngữ, category và tag cho form | 200             |
| B03 | GET    | `/api/v1/blog-owner/posts`                        | Danh sách bài của chính Blog Owner         | 200             |
| B04 | GET    | `/api/v1/blog-owner/posts/:id`                    | Chi tiết bài và nhóm bản dịch              | 200             |
| B05 | POST   | `/api/v1/blog-owner/posts`                        | Tạo bài                                    | 201             |
| B06 | PATCH  | `/api/v1/blog-owner/posts/:id`                    | Chỉnh sửa bài                              | 200             |
| B07 | DELETE | `/api/v1/blog-owner/posts/:id`                    | Soft-delete bài                            | 200             |
| B08 | POST   | `/api/v1/blog-owner/posts/:id/submit`             | Gửi bài để Moderator duyệt                 | 200             |
| B09 | POST   | `/api/v1/blog-owner/posts/:id/translate-preview`  | Xem trước bản dịch tự động                 | 200             |
| B10 | POST   | `/api/v1/blog-owner/posts/:id/translations`       | Tạo hoặc restore bản dịch                  | 201             |
| B11 | POST   | `/api/v1/blog-owner/posts/:postId/media`          | Thêm một media                             | 201             |
| B12 | DELETE | `/api/v1/blog-owner/posts/:postId/media/:mediaId` | Xóa một media                              | 200             |

## API Blog Owner — request và response chính xác

### B01 — GET /api/v1/blog-owner/dashboard

**Lấy thống kê dashboard của Blog Owner đang đăng nhập**

| Xác thực / phân quyền         | HTTP thành công | Content-Type request |
| ----------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER` | 200             | Không có body        |

#### Frontend phải gửi

Không có body hoặc query bắt buộc.

#### Request hoàn chỉnh

```http
GET /api/v1/blog-owner/dashboard
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
      "views": 15420,
      "likes": 985,
      "comments": 241
    },
    "last7Days": [
      {
        "date": "2026-07-26",
        "views": 180,
        "likes": 12
      },
      {
        "date": "2026-07-27",
        "views": 205,
        "likes": 17
      },
      {
        "date": "2026-07-28",
        "views": 0,
        "likes": 0
      },
      {
        "date": "2026-07-29",
        "views": 260,
        "likes": 21
      },
      {
        "date": "2026-07-30",
        "views": 310,
        "likes": 28
      },
      {
        "date": "2026-07-31",
        "views": 288,
        "likes": 25
      },
      {
        "date": "2026-08-01",
        "views": 95,
        "likes": 8
      }
    ],
    "featuredPosts": {
      "byViews": [
        {
          "id": 501,
          "title": "Hướng dẫn NestJS với Prisma",
          "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/501/cover.jpg",
          "status": "PUBLISH",
          "views": 4200,
          "likes": 245,
          "language": {
            "id": 26,
            "code": "vi",
            "name": "Tiếng Việt",
            "flag": "🇻🇳"
          }
        }
      ],
      "byLikes": [
        {
          "id": 508,
          "title": "Thiết kế REST API an toàn",
          "thumbnailUrl": null,
          "status": "PUBLISH",
          "views": 3100,
          "likes": 320,
          "language": {
            "id": 26,
            "code": "vi",
            "name": "Tiếng Việt",
            "flag": "🇻🇳"
          }
        }
      ]
    }
  },
  "timestamp": "2026-08-01T07:00:00.000Z"
}
```

#### Điểm cần chú ý

- `postCounts` và `totals` chỉ tính bài chưa bị soft-delete của owner hiện tại.
- `last7Days` luôn đủ 7 phần tử; ngày không có dữ liệu trả `views=0`, `likes=0`.
- Ngày được tính theo lịch Việt Nam.
- Hai danh sách nổi bật chỉ lấy bài `PUBLISH`, tối đa 5 bài mỗi danh sách.

### B02 — GET /api/v1/blog-owner/options

**Lấy dữ liệu lựa chọn cho form tạo/sửa bài**

| Xác thực / phân quyền         | HTTP thành công | Content-Type request |
| ----------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER` | 200             | Không có body        |

#### Frontend phải gửi

Không có body hoặc query bắt buộc. Frontend chỉ gửi Bearer access token của tài khoản `BLOG_OWNER`.

#### Request hoàn chỉnh

```http
GET /api/v1/blog-owner/options
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "languages": [
      {
        "id": 26,
        "code": "vi",
        "name": "Tiếng Việt",
        "flag": "🇻🇳",
        "isDefault": true,
        "isActive": true
      },
      {
        "id": 27,
        "code": "en",
        "name": "English",
        "flag": "🇬🇧",
        "isDefault": false,
        "isActive": true
      }
    ],
    "categories": [
      {
        "id": 73,
        "name": "Backend",
        "languageId": 26,
        "categoryGroupId": 33,
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳",
          "isDefault": true,
          "isActive": true
        },
        "categoryGroup": {
          "id": 33,
          "code": "BACKEND"
        }
      }
    ],
    "tags": [
      {
        "id": 46,
        "name": "NestJS"
      },
      {
        "id": 53,
        "name": "Prisma"
      }
    ]
  },
  "timestamp": "2026-08-01T07:00:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ trả ngôn ngữ `isActive=true` và chưa bị xóa.
- Ngôn ngữ mặc định đứng đầu; các ngôn ngữ còn lại sắp xếp theo `code`.
- Chỉ trả category chưa bị xóa, thuộc ngôn ngữ đang hoạt động và Category Group chưa bị xóa.
- Chỉ trả tag chưa bị soft-delete.

### B03 — GET /api/v1/blog-owner/posts

**Lấy danh sách bài của Blog Owner đang đăng nhập**

| Xác thực / phân quyền         | HTTP thành công | Content-Type request |
| ----------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER` | 200             | Không có body        |

#### Frontend phải gửi

| Vị trí | Field          | Kiểu         | Bắt buộc | Backend xử lý                                                        |
| ------ | -------------- | ------------ | -------- | -------------------------------------------------------------------- |
| Query  | `search`       | string       | Không    | Tìm theo tiêu đề, không phân biệt hoa thường.                        |
| Query  | `categoryId`   | integer      | Không    | Lọc bài có category này.                                             |
| Query  | `languageId`   | integer      | Không    | Lọc theo ngôn ngữ.                                                   |
| Query  | `parentPostId` | integer      | Không    | Lọc các bản dịch có parent cụ thể.                                   |
| Query  | `status`       | `PostStatus` | Không    | Lọc theo trạng thái.                                                 |
| Query  | `tagId`        | integer      | Không    | Lọc theo tag ID.                                                     |
| Query  | `tagName`      | string       | Không    | Lọc theo tên tag; chỉ dùng khi không gửi `tagId`.                    |
| Query  | `page`         | integer      | Không    | Mặc định 1.                                                          |
| Query  | `limit`        | integer      | Không    | Mặc định 10; tối đa 50.                                              |
| Query  | `lang`         | string       | Không    | DTO hiện chấp nhận nhưng truy vấn Blog Owner chưa áp dụng field này. |
| Query  | `sortBy`       | string       | Không    | DTO hiện chấp nhận nhưng service vẫn cố định sort `updatedAt desc`.  |
| Query  | `sortOrder`    | `asc`/`desc` | Không    | Chưa thay đổi sort cố định.                                          |
| Query  | `order`        | `asc`/`desc` | Không    | Chưa thay đổi sort cố định.                                          |

`authorId` và `bookmarkedByUserId` không thuộc DTO Blog Owner; gửi hai field này sẽ trả `400`.

#### Request hoàn chỉnh

```http
GET /api/v1/blog-owner/posts?status=DRAFT&languageId=26&page=1&limit=10
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": 601,
        "title": "NestJS Guards và Interceptors",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.jpg",
        "content": "<p>Nội dung bài viết...</p>",
        "status": "DRAFT",
        "viewCount": 0,
        "publishedAt": null,
        "parentPostId": null,
        "authorId": 102,
        "languageId": 26,
        "reviewedAt": null,
        "rejectionReason": null,
        "createdAt": "2026-08-01T06:30:00.000Z",
        "updatedAt": "2026-08-01T06:45:00.000Z",
        "author": {
          "id": 102,
          "username": "son_backend",
          "bio": "Backend Developer",
          "avatarUrl": null
        },
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳",
          "isDefault": true,
          "isActive": true,
          "createdAt": "2026-07-20T02:00:00.000Z",
          "updatedAt": "2026-07-20T02:00:00.000Z",
          "deletedAt": null
        },
        "categories": [
          {
            "id": 73,
            "name": "Backend",
            "categoryGroupId": 33,
            "languageId": 26
          }
        ],
        "tags": [
          {
            "id": 46,
            "name": "NestJS"
          }
        ],
        "media": []
      }
    ],
    "meta": {
      "totalItems": 3,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 1,
      "currentPage": 1
    }
  },
  "timestamp": "2026-08-01T07:00:00.000Z"
}
```

#### Điểm cần chú ý

- Backend luôn ép `authorId` bằng user ID trong JWT.
- Danh sách sắp xếp theo `updatedAt desc`.
- Có thể xem đủ bốn trạng thái của chính owner.
- `reviewedById` và `deletedAt` của Post bị ẩn khỏi `BlogownerPostEntity`.
- Trường `translations` chỉ được bổ sung ở API chi tiết, không phải API danh sách.

### B04 — GET /api/v1/blog-owner/posts/:id

**Xem chi tiết một bài và toàn bộ phiên bản ngôn ngữ trong cùng nhóm**

| Xác thực / phân quyền                          | HTTP thành công | Content-Type request |
| ---------------------------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài | 200             | Không có body        |

#### Frontend phải gửi

| Vị trí | Field | Kiểu    | Bắt buộc | Validation      |
| ------ | ----- | ------- | -------- | --------------- |
| Path   | `id`  | integer | Có       | `ParseIntPipe`. |

#### Request hoàn chỉnh

```http
GET /api/v1/blog-owner/posts/601
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 601,
    "title": "NestJS Guards và Interceptors",
    "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.jpg",
    "content": "<p>Nội dung bài viết...</p>",
    "status": "REJECT",
    "viewCount": 20,
    "publishedAt": null,
    "parentPostId": null,
    "authorId": 102,
    "languageId": 26,
    "reviewedAt": "2026-08-01T05:30:00.000Z",
    "rejectionReason": "Cần bổ sung nguồn tham khảo.",
    "createdAt": "2026-08-01T04:30:00.000Z",
    "updatedAt": "2026-08-01T05:30:00.000Z",
    "author": {
      "id": 102,
      "username": "son_backend",
      "bio": "Backend Developer",
      "avatarUrl": null
    },
    "language": {
      "id": 26,
      "code": "vi",
      "name": "Tiếng Việt",
      "flag": "🇻🇳",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-07-20T02:00:00.000Z",
      "updatedAt": "2026-07-20T02:00:00.000Z",
      "deletedAt": null
    },
    "categories": [
      {
        "id": 73,
        "name": "Backend",
        "categoryGroupId": 33,
        "languageId": 26
      }
    ],
    "tags": [
      {
        "id": 46,
        "name": "NestJS"
      }
    ],
    "media": [
      {
        "id": 900,
        "postId": 601,
        "mediaType": "IMAGE",
        "mediaUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/diagram.png",
        "publicId": "nestjs_blog/posts/601/diagram",
        "createdAt": "2026-08-01T04:40:00.000Z",
        "deletedAt": null
      }
    ],
    "translations": [
      {
        "id": 602,
        "title": "NestJS Guards and Interceptors",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.jpg",
        "status": "DRAFT",
        "parentPostId": 601,
        "languageId": 27,
        "language": {
          "id": 27,
          "code": "en",
          "name": "English",
          "flag": "🇬🇧"
        }
      },
      {
        "id": 601,
        "title": "NestJS Guards và Interceptors",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.jpg",
        "status": "REJECT",
        "parentPostId": null,
        "languageId": 26,
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      }
    ]
  },
  "timestamp": "2026-08-01T07:00:00.000Z"
}
```

#### Điểm cần chú ý

- `translations` gồm bài gốc và các bản dịch chưa bị xóa của cùng owner.
- Có thể gọi bằng ID bài gốc hoặc ID một bản dịch; backend tự xác định `rootPostId`.
- Bài không tồn tại/đã xóa trả `404`.
- Bài thuộc owner khác trả `403`.

### B05 — POST /api/v1/blog-owner/posts

**Tạo bài viết mới**

| Xác thực / phân quyền         | HTTP thành công | Content-Type request                          |
| ----------------------------- | --------------- | --------------------------------------------- |
| Bearer JWT; role `BLOG_OWNER` | 201             | `application/json` hoặc `multipart/form-data` |

#### Frontend phải gửi

| Vị trí | Field             | Kiểu          | Bắt buộc | Backend xử lý / validation                                           |
| ------ | ----------------- | ------------- | -------- | -------------------------------------------------------------------- |
| Body   | `title`           | string        | Có       | Không rỗng; tối đa 255 ký tự; kiểm tra từ cấm.                       |
| Body   | `content`         | string        | Có       | Không rỗng; kiểm tra từ cấm. Có thể chứa HTML.                       |
| Body   | `languageId`      | integer       | Có       | Ngôn ngữ phải tồn tại và đang hoạt động.                             |
| Body   | `categoryIds`     | integer[]     | Có       | Ít nhất 1; không trùng; category phải cùng ngôn ngữ.                 |
| Body   | `thumbnailUrl`    | URL string    | Không    | Dùng khi frontend đã có URL; file `thumbnail` sẽ ghi đè giá trị này. |
| Body   | `tagIds`          | integer[]     | Không    | ID tag active; không trùng.                                          |
| Body   | `tagNames`        | string[]      | Không    | Tag mới được tạo nếu chưa tồn tại; tên đã soft-delete bị từ chối.    |
| Body   | `submitForReview` | boolean       | Không    | Mặc định `false`; multipart chấp nhận chuỗi `true`/`false`.          |
| File   | `thumbnail`       | image         | Không    | Tối đa 1 file, 10 MB.                                                |
| File   | `media`           | image/video[] | Không    | Tối đa 10 file ở field chuẩn; mỗi file 10 MB.                        |

Không được gửi `status`, `parentPostId`, `authorId`.

#### Request hoàn chỉnh

##### Cách 1 — multipart/form-data

```http
POST /api/v1/blog-owner/posts
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: multipart/form-data

Form fields:
title           = NestJS Guards và Interceptors
content         = <p>Nội dung bài viết...</p>
languageId      = 26
categoryIds     = [73]
tagIds          = [46,53]
submitForReview = true
thumbnail       = <cover.png>
media           = <diagram.png>
```

##### Cách 2 — application/json không có file

```http
POST /api/v1/blog-owner/posts
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "title": "NestJS Guards và Interceptors",
  "content": "<p>Nội dung bài viết...</p>",
  "languageId": 26,
  "categoryIds": [73],
  "tagIds": [46, 53],
  "submitForReview": false
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 601,
    "title": "NestJS Guards và Interceptors",
    "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
    "content": "<p>Nội dung bài viết...</p>",
    "status": "PENDING_REVIEW",
    "viewCount": 0,
    "publishedAt": null,
    "parentPostId": null,
    "authorId": 102,
    "languageId": 26,
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-08-01T07:00:00.000Z",
    "updatedAt": "2026-08-01T07:00:02.000Z",
    "categories": [
      {
        "id": 73,
        "name": "Backend",
        "categoryGroupId": 33,
        "languageId": 26
      }
    ],
    "tags": [
      {
        "id": 46,
        "name": "NestJS"
      },
      {
        "id": 53,
        "name": "Prisma"
      }
    ],
    "media": [
      {
        "id": 900,
        "postId": 601,
        "mediaType": "IMAGE",
        "mediaUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/diagram.png",
        "publicId": "nestjs_blog/posts/601/diagram",
        "createdAt": "2026-08-01T07:00:01.000Z",
        "deletedAt": null
      }
    ],
    "translations": [
      {
        "id": 601,
        "title": "NestJS Guards và Interceptors",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
        "status": "PENDING_REVIEW",
        "parentPostId": null,
        "languageId": 26,
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      }
    ]
  },
  "timestamp": "2026-08-01T07:00:02.000Z"
}
```

#### Điểm cần chú ý

- Backend luôn tạo Post `DRAFT` trước, kể cả khi `submitForReview=true`.
- Chỉ sau khi thumbnail và media hoàn tất, backend mới chuyển sang `PENDING_REVIEW`.
- Nếu không gửi `submitForReview` hoặc gửi `false`, response có `status=DRAFT`.
- Upload media theo lô có rollback nếu một file thất bại.
- Thumbnail mới được cleanup nếu upload thành công nhưng lưu URL vào database thất bại.

### B06 — PATCH /api/v1/blog-owner/posts/:id

**Chỉnh sửa bài viết của chính Blog Owner**

| Xác thực / phân quyền                          | HTTP thành công | Content-Type request                          |
| ---------------------------------------------- | --------------- | --------------------------------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài | 200             | `application/json` hoặc `multipart/form-data` |

#### Frontend phải gửi

Tất cả field đều không bắt buộc riêng lẻ, nhưng request phải có ít nhất một field hoặc file thực sự.

| Vị trí | Field          | Kiểu          | Backend xử lý                                                  |
| ------ | -------------- | ------------- | -------------------------------------------------------------- |
| Body   | `title`        | string        | Không rỗng nếu gửi; tối đa 255; kiểm tra từ cấm.               |
| Body   | `content`      | string        | Không rỗng nếu gửi; kiểm tra từ cấm.                           |
| Body   | `thumbnailUrl` | URL string    | Cập nhật URL; file thumbnail ghi đè nếu cùng gửi.              |
| Body   | `categoryIds`  | integer[]     | Thay toàn bộ category; ít nhất 1; phải cùng ngôn ngữ hiện tại. |
| Body   | `tagIds`       | integer[]     | Thay cấu hình tag khi gửi cùng/hoặc `tagNames`.                |
| Body   | `tagNames`     | string[]      | Tái sử dụng tag active hoặc tạo tag mới.                       |
| File   | `thumbnail`    | image         | Tối đa 1 file, 10 MB.                                          |
| File   | `media`        | image/video[] | Upload thêm media; mỗi file 10 MB.                             |

Không được gửi `status`, `parentPostId`, `languageId`, `submitForReview`, `authorId`.

#### Request hoàn chỉnh

```http
PATCH /api/v1/blog-owner/posts/601
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "title": "NestJS Guards, Interceptors và Pipes",
  "content": "<p>Nội dung đã chỉnh sửa...</p>",
  "categoryIds": [73],
  "tagIds": [46, 53]
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 601,
    "title": "NestJS Guards, Interceptors và Pipes",
    "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
    "content": "<p>Nội dung đã chỉnh sửa...</p>",
    "status": "DRAFT",
    "viewCount": 20,
    "publishedAt": null,
    "parentPostId": null,
    "authorId": 102,
    "languageId": 26,
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-08-01T04:30:00.000Z",
    "updatedAt": "2026-08-01T07:10:00.000Z",
    "categories": [
      {
        "id": 73,
        "name": "Backend",
        "categoryGroupId": 33,
        "languageId": 26
      }
    ],
    "tags": [
      {
        "id": 46,
        "name": "NestJS"
      },
      {
        "id": 53,
        "name": "Prisma"
      }
    ],
    "media": [],
    "translations": [
      {
        "id": 601,
        "title": "NestJS Guards, Interceptors và Pipes",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
        "status": "DRAFT",
        "parentPostId": null,
        "languageId": 26,
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      }
    ]
  },
  "timestamp": "2026-08-01T07:10:00.000Z"
}
```

#### Điểm cần chú ý

- `PENDING_REVIEW` không được sửa.
- `REJECT` sau khi sửa thành công trở về `DRAFT`.
- `PUBLISH` sau khi sửa thành công chuyển sang `PENDING_REVIEW`.
- `PATCH {}` hoặc multipart không có field/file trả `400`.
- Khi nội dung database đã cập nhật thành công, review metadata được reset trước các thao tác media phía sau để trạng thái không còn `PUBLISH`/`REJECT` sai lệch.

### B07 — DELETE /api/v1/blog-owner/posts/:id

**Soft-delete bài viết của chính Blog Owner**

| Xác thực / phân quyền                          | HTTP thành công | Content-Type request |
| ---------------------------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài | 200             | Không có body        |

#### Frontend phải gửi

| Vị trí | Field | Kiểu    | Bắt buộc | Backend xử lý / validation                                                         |
| ------ | ----- | ------- | -------- | ---------------------------------------------------------------------------------- |
| Path   | `id`  | integer | Có       | ID bài viết; phải tồn tại, chưa bị soft-delete và thuộc Blog Owner đang đăng nhập. |

Không gửi body.

#### Request hoàn chỉnh

```http
DELETE /api/v1/blog-owner/posts/601
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đã xóa bài viết có ID 601."
  },
  "timestamp": "2026-08-01T07:15:00.000Z"
}
```

#### Điểm cần chú ý

- Đây là soft-delete: backend gán `deletedAt`, không xóa vật lý ngay.
- Service không giới hạn trạng thái khi xóa; owner có thể xóa bài của mình ở bất kỳ trạng thái nào nếu bài chưa bị xóa.
- Gọi lại với bài đã soft-delete trả `404`.

### B08 — POST /api/v1/blog-owner/posts/:id/submit

**Gửi bài `DRAFT` sang Moderator để duyệt**

| Xác thực / phân quyền                          | HTTP thành công | Content-Type request |
| ---------------------------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài | 200             | Không có body        |

#### Frontend phải gửi

| Vị trí | Field | Kiểu    | Bắt buộc | Backend xử lý / validation                                      |
| ------ | ----- | ------- | -------- | --------------------------------------------------------------- |
| Path   | `id`  | integer | Có       | ID bài viết; bài phải thuộc owner và đang ở trạng thái `DRAFT`. |

Không gửi body.

#### Request hoàn chỉnh

```http
POST /api/v1/blog-owner/posts/601/submit
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 601,
    "title": "NestJS Guards và Interceptors",
    "status": "PENDING_REVIEW",
    "reviewedAt": null,
    "rejectionReason": null,
    "translations": [
      {
        "id": 601,
        "title": "NestJS Guards và Interceptors",
        "thumbnailUrl": null,
        "status": "PENDING_REVIEW",
        "parentPostId": null,
        "languageId": 26,
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      }
    ]
  },
  "timestamp": "2026-08-01T07:20:00.000Z"
}
```

> Response thực tế là đầy đủ `BlogownerPostEntity`; ví dụ trên chỉ rút gọn các field không thay đổi để nhấn mạnh trạng thái.

#### Điểm cần chú ý

- Chỉ `DRAFT` được submit.
- `REJECT` trả lỗi yêu cầu chỉnh sửa trước.
- `PENDING_REVIEW` trả lỗi đang chờ Moderator.
- `PUBLISH` trả lỗi đã xuất bản; chỉ khi chỉnh sửa bài mới được gửi duyệt lại.

### B09 — POST /api/v1/blog-owner/posts/:id/translate-preview

**Dịch tự động title và content để xem trước; không ghi database**

| Xác thực / phân quyền                                | HTTP thành công | Content-Type request |
| ---------------------------------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài nguồn | 200             | `application/json`   |

#### Frontend phải gửi

| Vị trí | Field              | Kiểu    | Bắt buộc | Validation                                    |
| ------ | ------------------ | ------- | -------- | --------------------------------------------- |
| Path   | `id`               | integer | Có       | ID bài nguồn hoặc một bản dịch trong nhóm.    |
| Body   | `targetLanguageId` | integer | Có       | Ngôn ngữ đích phải tồn tại và đang hoạt động. |

#### Request hoàn chỉnh

```http
POST /api/v1/blog-owner/posts/601/translate-preview
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "targetLanguageId": 27
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "sourcePost": {
      "id": 601,
      "rootPostId": 601,
      "title": "NestJS Guards và Interceptors",
      "content": "<p>Nội dung tiếng Việt...</p>",
      "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
      "language": {
        "id": 26,
        "code": "vi",
        "name": "Tiếng Việt",
        "flag": "🇻🇳"
      }
    },
    "translation": {
      "language": {
        "id": 27,
        "code": "en",
        "name": "English",
        "flag": "🇬🇧"
      },
      "title": "NestJS Guards and Interceptors",
      "content": "<p>English content...</p>"
    }
  },
  "timestamp": "2026-08-01T07:25:00.000Z"
}
```

#### Điểm cần chú ý

- API chỉ trả preview; không tạo Post, không update Post, không đổi status.
- Backend kiểm tra quyền sở hữu, ngôn ngữ đích, bản dịch trùng và category mapping trước khi gọi LibreTranslate.
- Nếu nhóm bài đã có phiên bản active của ngôn ngữ đích, trả `409 Conflict`.
- Nếu một Category Group của bài nguồn chưa có category ở ngôn ngữ đích, trả `400`.
- `title` và `content` được gửi trong cùng một batch với `format=html`.

### B10 — POST /api/v1/blog-owner/posts/:id/translations

**Lưu bản dịch mới hoặc restore bản dịch đã soft-delete**

| Xác thực / phân quyền                                | HTTP thành công | Content-Type request |
| ---------------------------------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài nguồn | 201             | `application/json`   |

#### Frontend phải gửi

| Vị trí | Field              | Kiểu       | Bắt buộc | Validation                                         |
| ------ | ------------------ | ---------- | -------- | -------------------------------------------------- |
| Path   | `id`               | integer    | Có       | ID bài nguồn hoặc bản dịch trong nhóm.             |
| Body   | `targetLanguageId` | integer    | Có       | Ngôn ngữ đích active.                              |
| Body   | `title`            | string     | Có       | Không rỗng; tối đa 255; kiểm tra từ cấm.           |
| Body   | `content`          | string     | Có       | Không rỗng; kiểm tra từ cấm.                       |
| Body   | `thumbnailUrl`     | URL string | Không    | Nếu không gửi, kế thừa thumbnail bài nguồn khi có. |

Không gửi `categoryIds`, `tagIds`, `parentPostId`, `status`. Backend tự ánh xạ/copy.

#### Request hoàn chỉnh

```http
POST /api/v1/blog-owner/posts/601/translations
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "targetLanguageId": 27,
  "title": "NestJS Guards and Interceptors",
  "content": "<p>English content reviewed by the owner...</p>"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 602,
    "title": "NestJS Guards and Interceptors",
    "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
    "content": "<p>English content reviewed by the owner...</p>",
    "status": "DRAFT",
    "viewCount": 0,
    "publishedAt": null,
    "parentPostId": 601,
    "authorId": 102,
    "languageId": 27,
    "reviewedAt": null,
    "rejectionReason": null,
    "categories": [
      {
        "id": 74,
        "name": "Backend",
        "categoryGroupId": 33,
        "languageId": 27
      }
    ],
    "tags": [
      {
        "id": 46,
        "name": "NestJS"
      }
    ],
    "media": [],
    "translations": [
      {
        "id": 602,
        "title": "NestJS Guards and Interceptors",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
        "status": "DRAFT",
        "parentPostId": 601,
        "languageId": 27,
        "language": {
          "id": 27,
          "code": "en",
          "name": "English",
          "flag": "🇬🇧"
        }
      },
      {
        "id": 601,
        "title": "NestJS Guards và Interceptors",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/thumbnail/cover.png",
        "status": "PUBLISH",
        "parentPostId": null,
        "languageId": 26,
        "language": {
          "id": 26,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳"
        }
      }
    ]
  },
  "timestamp": "2026-08-01T07:30:00.000Z"
}
```

#### Điểm cần chú ý

- Endpoint này không gọi dịch tự động; frontend có thể lấy nội dung từ B09, cho owner chỉnh sửa rồi gửi B10.
- Bản dịch mới luôn `DRAFT` và phải submit riêng bằng B08.
- Nếu bản dịch active đã tồn tại, trả `409`.
- Nếu bản dịch từng bị soft-delete, backend restore đúng record cũ, cập nhật nội dung/category/tag, xóa `deletedAt`, reset review và `publishedAt`.
- Chỉ sao chép tag chưa bị soft-delete.

### B11 — POST /api/v1/blog-owner/posts/:postId/media

**Upload một ảnh hoặc video cho bài viết**

| Xác thực / phân quyền                          | HTTP thành công | Content-Type request  |
| ---------------------------------------------- | --------------- | --------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài | 201             | `multipart/form-data` |

#### Frontend phải gửi

| Vị trí | Field    | Kiểu        | Bắt buộc | Validation                                                   |
| ------ | -------- | ----------- | -------- | ------------------------------------------------------------ |
| Path   | `postId` | integer     | Có       | `ParseIntPipe`.                                              |
| File   | `file`   | image/video | Có       | Tối đa 10 MB; MIME phải bắt đầu bằng `image/` hoặc `video/`. |

#### Request hoàn chỉnh

```http
POST /api/v1/blog-owner/posts/601/media
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: multipart/form-data

file = <architecture-diagram.png>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 901,
    "postId": 601,
    "mediaType": "IMAGE",
    "mediaUrl": "https://res.cloudinary.com/demo/image/upload/posts/601/architecture-diagram.png",
    "publicId": "nestjs_blog/posts/601/architecture-diagram",
    "createdAt": "2026-08-01T07:35:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-08-01T07:35:00.000Z"
}
```

#### Điểm cần chú ý

- `PENDING_REVIEW` không được upload media.
- Với bài `PUBLISH`, backend chuyển bài sang `PENDING_REVIEW` trước khi upload.
- Với bài `REJECT`, chỉ sau khi upload thành công mới chuyển bài về `DRAFT`.
- MIME quyết định `mediaType`; client không gửi `mediaType` hoặc URL.

### B12 — DELETE /api/v1/blog-owner/posts/:postId/media/:mediaId

**Soft-delete media thuộc bài viết**

| Xác thực / phân quyền                          | HTTP thành công | Content-Type request |
| ---------------------------------------------- | --------------- | -------------------- |
| Bearer JWT; role `BLOG_OWNER`; phải sở hữu bài | 200             | Không có body        |

#### Frontend phải gửi

| Vị trí | Field     | Kiểu    | Bắt buộc | Validation                                |
| ------ | --------- | ------- | -------- | ----------------------------------------- |
| Path   | `postId`  | integer | Có       | `ParseIntPipe`.                           |
| Path   | `mediaId` | integer | Có       | Media phải còn active và thuộc đúng post. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/blog-owner/posts/601/media/901
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đã xóa media thành công"
  },
  "timestamp": "2026-08-01T07:40:00.000Z"
}
```

#### Điểm cần chú ý

- Media phải thuộc chính bài trong path; nếu không, trả `404` với message media không tồn tại trong bài này.
- `PENDING_REVIEW` không được xóa media.
- `PUBLISH` chuyển `PENDING_REVIEW` trước khi xóa.
- `REJECT` chỉ chuyển `DRAFT` sau khi xóa thành công.
- Database soft-delete media trước; lỗi cleanup Cloudinary không rollback soft-delete.

## Bảng lỗi thường gặp

| HTTP | Trường hợp điển hình                                  | Ví dụ message                                                                                       |
| ---- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 400  | DTO sai hoặc có field thừa                            | `property status should not exist`                                                                  |
| 400  | Language không hợp lệ/inactive                        | `Ngôn ngữ không tồn tại, đã bị xóa hoặc đang bị vô hiệu hóa.`                                       |
| 400  | Category không hợp lệ                                 | `Có danh mục không tồn tại, đã bị xóa, thuộc nhóm đã bị xóa hoặc không cùng ngôn ngữ với bài viết.` |
| 400  | Quá 5 tag                                             | `Mỗi bài viết chỉ được gắn tối đa 5 thẻ (tags)...`                                                  |
| 400  | Tag đã bị xóa                                         | `Có thẻ không tồn tại hoặc đã bị xóa.`                                                              |
| 400  | PATCH rỗng                                            | `Không có dữ liệu nào để cập nhật.`                                                                 |
| 400  | Sửa bài đang chờ duyệt                                | `Bài viết đang chờ Moderator duyệt nên không thể chỉnh sửa.`                                        |
| 400  | Submit sai trạng thái                                 | Message phụ thuộc `PENDING_REVIEW`, `PUBLISH` hoặc `REJECT`.                                        |
| 400  | File sai MIME                                         | `Chỉ hỗ trợ tải lên file ảnh hoặc video`                                                            |
| 400  | LibreTranslate không hỗ trợ request/cặp ngôn ngữ      | `Không thể dịch bài viết: ...` hoặc message fallback.                                               |
| 401  | Thiếu/sai access token                                | Lỗi xác thực JWT.                                                                                   |
| 403  | Sai role hoặc không sở hữu bài                        | `Bạn không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác.`                                  |
| 404  | Bài không tồn tại/đã xóa                              | `Không tìm thấy bài viết với định danh: ...`                                                        |
| 404  | Media không thuộc bài/đã xóa                          | `Media không tồn tại trong bài viết này`                                                            |
| 409  | Phiên bản ngôn ngữ đã tồn tại                         | `Bài viết đã có phiên bản cho ngôn ngữ được chọn.`                                                  |
| 413  | File vượt giới hạn Multer                             | Payload/file quá lớn.                                                                               |
| 502  | LibreTranslate offline, lỗi nội bộ hoặc response hỏng | Message dịch vụ dịch tự động tương ứng.                                                             |
| 503  | Chưa cấu hình `TRANSLATE_API_URL`                     | `Dịch tự động chưa được cấu hình.`                                                                  |

## Checklist tích hợp frontend

- Dùng access token của `BLOG_OWNER` cho toàn bộ route.
- Lấy `languages`, `categories`, `tags` từ B02 thay vì hard-code.
- Chỉ hiển thị category có `languageId` bằng ngôn ngữ bài đang chọn.
- Không gửi `status`, `authorId`, `parentPostId` khi tạo/sửa bài.
- Với multipart, gửi boolean dưới dạng `true`/`false` và mảng dưới dạng JSON string.
- Sau khi sửa bài `PUBLISH`, cập nhật UI sang `PENDING_REVIEW` ngay theo response.
- Sau khi sửa bài `REJECT`, cập nhật UI sang `DRAFT` và yêu cầu user submit lại.
- Preview dịch bằng B09, cho phép user chỉnh sửa, lưu bằng B10, rồi submit bản dịch bằng B08.
- Luôn đọc message từ error envelope; không dựa vào message mặc định của NestJS.
