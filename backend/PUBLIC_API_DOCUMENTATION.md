# PUBLIC_API_DOCUMENTATION

> Tài liệu API **Public** cho dự án Quản lý Blog (NestJS + Prisma). Nội dung mô tả payload frontend/backend thực sự chấp nhận và JSON response theo source code đã rà soát.

- **Phạm vi:** 13 endpoint Public
- **Base URL:** `/api/v1`
- **Ngày rà soát:** 30/07/2026
- **Lưu ý dữ liệu mẫu:** ID, token, URL, số liệu và timestamp chỉ mang tính minh họa; tên field, vị trí payload, kiểu dữ liệu, status code và cấu trúc JSON bám theo tài liệu nguồn.

## Mục lục

- [Quy tắc chung frontend phải tuân theo](#quy-tắc-chung-frontend-phải-tuân-theo)
- [Danh mục API Public](#danh-mục-api-public)
- [API Public — request và response chính xác](#api-public--request-và-response-chính-xác)

## Quy tắc chung frontend phải tuân theo

### Success envelope

Mọi giá trị controller/service trả về đều được TransformInterceptor bọc vào cấu trúc sau. Với Axios, payload nghiệp vụ nằm ở response.data.data.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "example": "payload nghiệp vụ"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### Error envelope

HttpExceptionFilter chuẩn hóa lỗi. message có thể là string hoặc mảng string nếu lỗi đến từ class-validator.

```json
{
  "success": false,
  "statusCode": 400,
  "message": [
    "property extraField should not exist"
  ],
  "path": "/api/v1/register",
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### Validation, trim và field thừa

- ValidationPipe bật transform=true, whitelist=true và forbidNonWhitelisted=true.
- Field nằm ngoài DTO không bị bỏ qua mà làm request thất bại 400.
- TrimPipe đệ quy cắt khoảng trắng ở mọi string trong request body; không trim query/path.
- Query page/limit qua Pagination decorator: page mặc định 1, limit mặc định 10, limit thực tế tối đa 50.

### JWT và role

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Refresh token không dùng trong Authorization header ở các API auth; frontend gửi đúng field refreshToken trong JSON body.

### Enum chính xác

| Enum | Giá trị hợp lệ |
| --- | --- |
| UserRole | NORMAL \| BLOG_OWNER \| CONTENT_MODERATOR \| SUPER_ADMIN |
| UserStatus | ACTIVE \| LOCKED |
| PostStatus | DRAFT \| PENDING_REVIEW \| PUBLISH \| REJECT |
| MediaType | IMAGE \| VIDEO |
| BlogOwnerRequestStatus | PENDING \| APPROVED \| REJECTED |
| ReportTargetType | POST \| COMMENT |
| ReportStatus | PENDING \| RESOLVED \| REJECTED |
| ReportReason | SPAM \| HARASSMENT \| INAPPROPRIATE \| COPYRIGHT \| MISINFORMATION \| OTHER |

## Danh mục API Public

| Mã | Method | Endpoint | JWT / Role | HTTP |
| --- | --- | --- | --- | --- |
| P01 | POST | /api/v1/register | Không yêu cầu JWT | 201 |
| P02 | POST | /api/v1/login | Không yêu cầu JWT | 200 |
| P03 | POST | /api/v1/forgot-password | Không yêu cầu JWT | 200 |
| P04 | POST | /api/v1/reset-password | Không yêu cầu JWT | 200 |
| P05 | GET | /api/v1/posts | Không yêu cầu JWT | 200 |
| P06 | GET | /api/v1/posts/top | Không yêu cầu JWT | 200 |
| P07 | GET | /api/v1/posts/:id | Không yêu cầu JWT | 200 |
| P08 | GET | /api/v1/authors/top | Không yêu cầu JWT | 200 |
| P09 | GET | /api/v1/authors/:id | Không yêu cầu JWT | 200 |
| P10 | GET | /api/v1/categories | Không yêu cầu JWT | 200 |
| P11 | GET | /api/v1/posts/:postId/comments | Không yêu cầu JWT | 200 |
| P12 | GET | /api/v1/tags/top | Không yêu cầu JWT | 200 |
| P13 | GET | /api/v1/tags | Không yêu cầu JWT | 200 |

## API Public — request và response chính xác

### P01 — POST /api/v1/register

**Đăng ký tài khoản**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | username | string | Có | Không rỗng; tối đa 50 ký tự; chỉ chữ, số và dấu gạch dưới. |
| Body | email | string (email) | Có | Phải đúng định dạng email. |
| Body | password | string | Có | Tối thiểu 6 ký tự. |

#### Request hoàn chỉnh

```http
POST /api/v1/register
Content-Type: application/json

{
  "username": "nguyenvanf",
  "email": "nguyenvanf@example.com",
  "password": "Secret123"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 15,
    "username": "nguyenvanf",
    "email": "nguyenvanf@example.com",
    "role": "NORMAL",
    "status": "ACTIVE",
    "bio": null,
    "avatarUrl": null,
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-30T08:40:00.000Z",
    "updatedAt": "2026-07-30T08:40:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Không gửi role, status, bio, avatarUrl hoặc field thừa; ValidationPipe dùng forbidNonWhitelisted=true nên field thừa trả 400.
- passwordHash có trong database nhưng bị @Exclude, vì vậy không xuất hiện trong JSON.

### P02 — POST /api/v1/login

**Đăng nhập**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | identifier | string | Có | Username hoặc email. |
| Body | password | string | Có | Mật khẩu dạng chuỗi, không rỗng. |
| Header | User-Agent | string | Không | Controller lưu làm deviceInfo; trình duyệt thường tự gửi. |
| Network | IP address | string | Tự động | Controller lấy từ request để lưu phiên đăng nhập. |

#### Request hoàn chỉnh

```http
POST /api/v1/login
User-Agent: Mozilla/5.0
Content-Type: application/json

{
  "identifier": "nguyenvanf@example.com",
  "password": "Secret123"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "id": 15,
      "username": "nguyenvanf",
      "email": "nguyenvanf@example.com",
      "role": "NORMAL",
      "status": "ACTIVE",
      "bio": null,
      "avatarUrl": null,
      "lockedAt": null,
      "lockedById": null,
      "lockReason": null,
      "createdAt": "2026-07-30T08:40:00.000Z",
      "updatedAt": "2026-07-30T08:40:00.000Z",
      "deletedAt": null
    },
    "tokens": {
      "accessToken": "<JWT_ACCESS_TOKEN>",
      "refreshToken": "<JWT_REFRESH_TOKEN>"
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Tài khoản status=LOCKED bị từ chối trước khi kiểm tra mật khẩu.
- Refresh token được băm và lưu trong user_sessions; frontend phải tự lưu chuỗi refreshToken được trả về.

### P03 — POST /api/v1/forgot-password

**Yêu cầu đặt lại mật khẩu**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | email | string (email) | Có | Không rỗng, đúng định dạng email. |

#### Request hoàn chỉnh

```http
POST /api/v1/forgot-password
Content-Type: application/json

{
  "email": "nguyenvanf@example.com"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Nếu email hợp lệ, một liên kết khôi phục đã được gửi đi."
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Backend cố ý trả cùng một message dù email tồn tại hay không để tránh dò tài khoản.

### P04 — POST /api/v1/reset-password

**Đặt lại mật khẩu**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | token | string | Có | Token reset nhận từ email, không rỗng. |
| Body | newPassword | string | Có | Tối thiểu 6 ký tự. |

#### Request hoàn chỉnh

```http
POST /api/v1/reset-password
Content-Type: application/json

{
  "token": "a1b2c3d4e5f6...",
  "newPassword": "NewSecret123"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Khi đổi thành công, backend đánh dấu token đã dùng và thu hồi toàn bộ session của user.

### P05 — GET /api/v1/posts

**Lấy danh sách bài viết đã xuất bản**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | search | string | Không | Tìm theo title, không phân biệt hoa thường; có kiểm tra từ cấm. |
| Query | categoryId | integer | Không | Lọc bài có danh mục này. |
| Query | languageId | integer | Không | Lọc theo ID ngôn ngữ; ưu tiên hơn lang/header. |
| Query | lang | string | Không | Mã ngôn ngữ, được LangCode ưu tiên hơn Accept-Language. |
| Header | Accept-Language | string | Không | Ví dụ vi hoặc en; chỉ dùng khi không có languageId và không có query lang. |
| Query | authorId | integer | Không | Lọc theo tác giả. |
| Query | parentPostId | integer | Không | Lọc bản dịch theo bài gốc. |
| Query | status | PostStatus | Không | DTO chấp nhận nhưng Public service luôn ghi đè thành PUBLISH. |
| Query | tagId | integer | Không | Lọc theo ID tag. |
| Query | tagName | string | Không | Lọc theo tên tag nếu không có tagId. |
| Query | bookmarkedByUserId | integer | Không | Lọc bài đã được user ID này bookmark; route public hiện vẫn chấp nhận. |
| Query | page | integer | Không | Mặc định 1, tối thiểu thực tế 1. |
| Query | limit | integer | Không | Mặc định 10, Pagination decorator cắt tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/posts?page=1&limit=10&categoryId=5&lang=vi
Accept-Language: vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": 501,
        "title": "Hướng dẫn NestJS với Prisma",
        "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/cover.jpg",
        "content": "Nội dung đầy đủ của bài viết...",
        "status": "PUBLISH",
        "viewCount": 1420,
        "publishedAt": "2026-07-25T09:00:00.000Z",
        "parentPostId": null,
        "authorId": 102,
        "languageId": 1,
        "createdAt": "2026-07-25T08:40:00.000Z",
        "updatedAt": "2026-07-25T09:00:00.000Z",
        "author": {
          "id": 102,
          "username": "backend_dev",
          "bio": "Senior Node.js Developer",
          "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
        },
        "language": {
          "id": 1,
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
            "id": 5,
            "name": "Backend",
            "categoryGroupId": 2,
            "languageId": 1,
            "createdAt": "2026-07-20T02:20:00.000Z",
            "updatedAt": "2026-07-20T02:20:00.000Z",
            "deletedAt": null,
            "language": {
              "id": 1,
              "code": "vi",
              "name": "Tiếng Việt",
              "flag": "🇻🇳",
              "isDefault": true,
              "isActive": true,
              "createdAt": "2026-07-20T02:00:00.000Z",
              "updatedAt": "2026-07-20T02:00:00.000Z",
              "deletedAt": null
            },
            "categoryGroup": {
              "id": 2,
              "code": "TECHNOLOGY",
              "createdAt": "2026-07-20T02:10:00.000Z",
              "updatedAt": "2026-07-20T02:10:00.000Z",
              "deletedAt": null
            }
          }
        ],
        "tags": [
          {
            "id": 1,
            "name": "NodeJS"
          },
          {
            "id": 2,
            "name": "Prisma"
          }
        ],
        "likeCount": 85,
        "media": [
          {
            "id": 10,
            "postId": 501,
            "mediaType": "IMAGE",
            "mediaUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/diagram.png",
            "createdAt": "2026-07-25T08:55:00.000Z"
          }
        ]
      },
      {
        "id": 498,
        "title": "Thiết kế REST API an toàn",
        "thumbnailUrl": null,
        "content": "Nội dung đầy đủ của bài viết...",
        "status": "PUBLISH",
        "viewCount": 980,
        "publishedAt": "2026-07-24T09:00:00.000Z",
        "parentPostId": null,
        "authorId": 102,
        "languageId": 1,
        "createdAt": "2026-07-24T08:30:00.000Z",
        "updatedAt": "2026-07-24T09:00:00.000Z",
        "author": {
          "id": 102,
          "username": "backend_dev",
          "bio": "Senior Node.js Developer",
          "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
        },
        "language": {
          "id": 1,
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
            "id": 5,
            "name": "Backend",
            "categoryGroupId": 2,
            "languageId": 1,
            "createdAt": "2026-07-20T02:20:00.000Z",
            "updatedAt": "2026-07-20T02:20:00.000Z",
            "deletedAt": null,
            "language": {
              "id": 1,
              "code": "vi",
              "name": "Tiếng Việt",
              "flag": "🇻🇳",
              "isDefault": true,
              "isActive": true,
              "createdAt": "2026-07-20T02:00:00.000Z",
              "updatedAt": "2026-07-20T02:00:00.000Z",
              "deletedAt": null
            },
            "categoryGroup": {
              "id": 2,
              "code": "TECHNOLOGY",
              "createdAt": "2026-07-20T02:10:00.000Z",
              "updatedAt": "2026-07-20T02:10:00.000Z",
              "deletedAt": null
            }
          }
        ],
        "tags": [
          {
            "id": 1,
            "name": "NodeJS"
          },
          {
            "id": 2,
            "name": "Prisma"
          }
        ],
        "likeCount": 61,
        "media": []
      }
    ],
    "meta": {
      "totalItems": 34,
      "itemCount": 2,
      "itemsPerPage": 10,
      "totalPages": 4,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Response bài viết không có slug hoặc excerpt vì model Post không khai báo hai field này.
- status do frontend gửi không thể làm Public API trả DRAFT/REJECT; backend luôn ép PUBLISH.

### P06 — GET /api/v1/posts/top

**Lấy bài viết nổi bật**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | limit | number | Không | Mặc định 10; controller chỉ Number(limit), không có DTO kiểm tra số dương/tối đa. |
| Query | lang | string | Không | Mã ngôn ngữ dùng để lọc. |
| Header | Accept-Language | string | Không | Dùng khi không có query lang. |

#### Request hoàn chỉnh

```http
GET /api/v1/posts/top?limit=5&lang=vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": 501,
      "title": "Hướng dẫn NestJS với Prisma",
      "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/cover.jpg",
      "content": "Nội dung đầy đủ của bài viết...",
      "status": "PUBLISH",
      "viewCount": 1420,
      "publishedAt": "2026-07-25T09:00:00.000Z",
      "parentPostId": null,
      "authorId": 102,
      "languageId": 1,
      "createdAt": "2026-07-25T08:40:00.000Z",
      "updatedAt": "2026-07-25T09:00:00.000Z",
      "author": {
        "id": 102,
        "username": "backend_dev",
        "bio": "Senior Node.js Developer",
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
      },
      "language": {
        "id": 1,
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
          "id": 5,
          "name": "Backend",
          "categoryGroupId": 2,
          "languageId": 1,
          "createdAt": "2026-07-20T02:20:00.000Z",
          "updatedAt": "2026-07-20T02:20:00.000Z",
          "deletedAt": null,
          "language": {
            "id": 1,
            "code": "vi",
            "name": "Tiếng Việt",
            "flag": "🇻🇳",
            "isDefault": true,
            "isActive": true,
            "createdAt": "2026-07-20T02:00:00.000Z",
            "updatedAt": "2026-07-20T02:00:00.000Z",
            "deletedAt": null
          },
          "categoryGroup": {
            "id": 2,
            "code": "TECHNOLOGY",
            "createdAt": "2026-07-20T02:10:00.000Z",
            "updatedAt": "2026-07-20T02:10:00.000Z",
            "deletedAt": null
          }
        }
      ],
      "tags": [
        {
          "id": 1,
          "name": "NodeJS"
        },
        {
          "id": 2,
          "name": "Prisma"
        }
      ],
      "likeCount": 85,
      "media": [
        {
          "id": 10,
          "postId": 501,
          "mediaType": "IMAGE",
          "mediaUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/diagram.png",
          "createdAt": "2026-07-25T08:55:00.000Z"
        }
      ]
    },
    {
      "id": 498,
      "title": "Thiết kế REST API an toàn",
      "thumbnailUrl": null,
      "content": "Nội dung đầy đủ của bài viết...",
      "status": "PUBLISH",
      "viewCount": 980,
      "publishedAt": "2026-07-24T09:00:00.000Z",
      "parentPostId": null,
      "authorId": 102,
      "languageId": 1,
      "createdAt": "2026-07-24T08:30:00.000Z",
      "updatedAt": "2026-07-24T09:00:00.000Z",
      "author": {
        "id": 102,
        "username": "backend_dev",
        "bio": "Senior Node.js Developer",
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
      },
      "language": {
        "id": 1,
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
          "id": 5,
          "name": "Backend",
          "categoryGroupId": 2,
          "languageId": 1,
          "createdAt": "2026-07-20T02:20:00.000Z",
          "updatedAt": "2026-07-20T02:20:00.000Z",
          "deletedAt": null,
          "language": {
            "id": 1,
            "code": "vi",
            "name": "Tiếng Việt",
            "flag": "🇻🇳",
            "isDefault": true,
            "isActive": true,
            "createdAt": "2026-07-20T02:00:00.000Z",
            "updatedAt": "2026-07-20T02:00:00.000Z",
            "deletedAt": null
          },
          "categoryGroup": {
            "id": 2,
            "code": "TECHNOLOGY",
            "createdAt": "2026-07-20T02:10:00.000Z",
            "updatedAt": "2026-07-20T02:10:00.000Z",
            "deletedAt": null
          }
        }
      ],
      "tags": [
        {
          "id": 1,
          "name": "NodeJS"
        },
        {
          "id": 2,
          "name": "Prisma"
        }
      ],
      "likeCount": 61,
      "media": []
    }
  ],
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- data là mảng trực tiếp, không có meta phân trang.

### P07 — GET /api/v1/posts/:id

**Xem chi tiết bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ParseIntPipe; ID bài viết. |
| Query | lang | string | Không | Nếu khác ngôn ngữ bài hiện tại, backend tìm bản dịch cùng parentPostId. |
| Header | Accept-Language | string | Không | Dùng khi không có query lang. |
| Network | IP address | string | Tự động | Dùng làm viewerKey khi ghi PostViewLog. |

#### Request hoàn chỉnh

```http
GET /api/v1/posts/501?lang=vi
Accept-Language: vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 501,
    "title": "Hướng dẫn NestJS với Prisma",
    "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/cover.jpg",
    "content": "Nội dung đầy đủ của bài viết...",
    "status": "PUBLISH",
    "viewCount": 1420,
    "publishedAt": "2026-07-25T09:00:00.000Z",
    "parentPostId": null,
    "authorId": 102,
    "languageId": 1,
    "createdAt": "2026-07-25T08:40:00.000Z",
    "updatedAt": "2026-07-25T09:00:00.000Z",
    "author": {
      "id": 102,
      "username": "backend_dev",
      "bio": "Senior Node.js Developer",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
    },
    "language": {
      "id": 1,
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
        "id": 5,
        "name": "Backend",
        "categoryGroupId": 2,
        "languageId": 1,
        "createdAt": "2026-07-20T02:20:00.000Z",
        "updatedAt": "2026-07-20T02:20:00.000Z",
        "deletedAt": null,
        "language": {
          "id": 1,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳",
          "isDefault": true,
          "isActive": true,
          "createdAt": "2026-07-20T02:00:00.000Z",
          "updatedAt": "2026-07-20T02:00:00.000Z",
          "deletedAt": null
        },
        "categoryGroup": {
          "id": 2,
          "code": "TECHNOLOGY",
          "createdAt": "2026-07-20T02:10:00.000Z",
          "updatedAt": "2026-07-20T02:10:00.000Z",
          "deletedAt": null
        }
      }
    ],
    "tags": [
      {
        "id": 1,
        "name": "NodeJS"
      },
      {
        "id": 2,
        "name": "Prisma"
      }
    ],
    "likeCount": 85,
    "media": [
      {
        "id": 10,
        "postId": 501,
        "mediaType": "IMAGE",
        "mediaUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/diagram.png",
        "createdAt": "2026-07-25T08:55:00.000Z"
      }
    ]
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Backend tăng viewCount và ghi view log theo kiểu fire-and-forget sau khi lấy dữ liệu; viewCount trong response có thể là giá trị trước lần tăng hiện tại.

### P08 — GET /api/v1/authors/top

**Lấy tác giả có nhiều follower nhất**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | limit | number | Không | Mặc định 10; không qua DTO validation. |

#### Request hoàn chỉnh

```http
GET /api/v1/authors/top?limit=5
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": 102,
      "username": "backend_dev",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
      "bio": "Senior Node.js Developer",
      "followerCount": 238
    },
    {
      "id": 77,
      "username": "data_writer",
      "avatarUrl": null,
      "bio": "Viết về dữ liệu và AI",
      "followerCount": 194
    }
  ],
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ user ACTIVE, role BLOG_OWNER và deletedAt=null mới xuất hiện.

### P09 — GET /api/v1/authors/:id

**Xem tác giả và bài viết của tác giả**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID tác giả; phải là BLOG_OWNER đang ACTIVE và chưa xóa. |
| Query | search/categoryId/languageId/lang/parentPostId/tagId/tagName/bookmarkedByUserId | tùy field | Không | Các bộ lọc bài viết giống GET /posts. |
| Query | authorId | integer | Không | DTO chấp nhận nhưng service ghi đè bằng :id trên URL. |
| Query | status | PostStatus | Không | DTO chấp nhận nhưng Public posts service luôn ép PUBLISH. |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |
| Header | Accept-Language | string | Không | Dùng khi không có query lang/languageId. |

#### Request hoàn chỉnh

```http
GET /api/v1/authors/102?page=1&limit=10&lang=vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "author": {
      "id": 102,
      "username": "backend_dev",
      "bio": "Senior Node.js Developer",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
      "createdAt": "2026-07-10T01:00:00.000Z",
      "postCount": 25
    },
    "posts": {
      "items": [
        {
          "id": 501,
          "title": "Hướng dẫn NestJS với Prisma",
          "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/cover.jpg",
          "content": "Nội dung đầy đủ của bài viết...",
          "status": "PUBLISH",
          "viewCount": 1420,
          "publishedAt": "2026-07-25T09:00:00.000Z",
          "parentPostId": null,
          "authorId": 102,
          "languageId": 1,
          "createdAt": "2026-07-25T08:40:00.000Z",
          "updatedAt": "2026-07-25T09:00:00.000Z",
          "author": {
            "id": 102,
            "username": "backend_dev",
            "bio": "Senior Node.js Developer",
            "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
          },
          "language": {
            "id": 1,
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
              "id": 5,
              "name": "Backend",
              "categoryGroupId": 2,
              "languageId": 1,
              "createdAt": "2026-07-20T02:20:00.000Z",
              "updatedAt": "2026-07-20T02:20:00.000Z",
              "deletedAt": null,
              "language": {
                "id": 1,
                "code": "vi",
                "name": "Tiếng Việt",
                "flag": "🇻🇳",
                "isDefault": true,
                "isActive": true,
                "createdAt": "2026-07-20T02:00:00.000Z",
                "updatedAt": "2026-07-20T02:00:00.000Z",
                "deletedAt": null
              },
              "categoryGroup": {
                "id": 2,
                "code": "TECHNOLOGY",
                "createdAt": "2026-07-20T02:10:00.000Z",
                "updatedAt": "2026-07-20T02:10:00.000Z",
                "deletedAt": null
              }
            }
          ],
          "tags": [
            {
              "id": 1,
              "name": "NodeJS"
            },
            {
              "id": 2,
              "name": "Prisma"
            }
          ],
          "likeCount": 85,
          "media": [
            {
              "id": 10,
              "postId": 501,
              "mediaType": "IMAGE",
              "mediaUrl": "https://res.cloudinary.com/demo/image/upload/blog/501/diagram.png",
              "createdAt": "2026-07-25T08:55:00.000Z"
            }
          ]
        },
        {
          "id": 498,
          "title": "Thiết kế REST API an toàn",
          "thumbnailUrl": null,
          "content": "Nội dung đầy đủ của bài viết...",
          "status": "PUBLISH",
          "viewCount": 980,
          "publishedAt": "2026-07-24T09:00:00.000Z",
          "parentPostId": null,
          "authorId": 102,
          "languageId": 1,
          "createdAt": "2026-07-24T08:30:00.000Z",
          "updatedAt": "2026-07-24T09:00:00.000Z",
          "author": {
            "id": 102,
            "username": "backend_dev",
            "bio": "Senior Node.js Developer",
            "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg"
          },
          "language": {
            "id": 1,
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
              "id": 5,
              "name": "Backend",
              "categoryGroupId": 2,
              "languageId": 1,
              "createdAt": "2026-07-20T02:20:00.000Z",
              "updatedAt": "2026-07-20T02:20:00.000Z",
              "deletedAt": null,
              "language": {
                "id": 1,
                "code": "vi",
                "name": "Tiếng Việt",
                "flag": "🇻🇳",
                "isDefault": true,
                "isActive": true,
                "createdAt": "2026-07-20T02:00:00.000Z",
                "updatedAt": "2026-07-20T02:00:00.000Z",
                "deletedAt": null
              },
              "categoryGroup": {
                "id": 2,
                "code": "TECHNOLOGY",
                "createdAt": "2026-07-20T02:10:00.000Z",
                "updatedAt": "2026-07-20T02:10:00.000Z",
                "deletedAt": null
              }
            }
          ],
          "tags": [
            {
              "id": 1,
              "name": "NodeJS"
            },
            {
              "id": 2,
              "name": "Prisma"
            }
          ],
          "likeCount": 61,
          "media": []
        }
      ],
      "meta": {
        "totalItems": 34,
        "itemCount": 2,
        "itemsPerPage": 10,
        "totalPages": 4,
        "currentPage": 1
      }
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- author.postCount là tổng bài PUBLISH chưa xóa, độc lập với bộ lọc/pagination của posts trong cùng response.

### P10 — GET /api/v1/categories

**Lấy danh sách danh mục**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | search | string | Không | Tìm theo name, không phân biệt hoa thường. |
| Query | languageId | number | Không | Lọc theo ID ngôn ngữ. |
| Query | lang | string | Không | Nếu không có languageId, backend đổi code sang languageId. |
| Header | Accept-Language | string | Không | Dùng khi không có query lang/languageId. |
| Query | page/limit | number | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/categories?page=1&limit=10&lang=vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": 5,
        "name": "Backend",
        "categoryGroupId": 2,
        "languageId": 1,
        "createdAt": "2026-07-20T02:20:00.000Z",
        "updatedAt": "2026-07-20T02:20:00.000Z",
        "deletedAt": null,
        "language": {
          "id": 1,
          "code": "vi",
          "name": "Tiếng Việt",
          "flag": "🇻🇳",
          "isDefault": true,
          "isActive": true,
          "createdAt": "2026-07-20T02:00:00.000Z",
          "updatedAt": "2026-07-20T02:00:00.000Z",
          "deletedAt": null
        }
      }
    ],
    "meta": {
      "totalItems": 8,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 1,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- CategoryEntity hiện vẫn xuất deletedAt (thường là null do query chỉ lấy bản ghi chưa xóa).

### P11 — GET /api/v1/posts/:postId/comments

**Lấy bình luận công khai của bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | postId | integer | Có | Bài phải PUBLISH và chưa bị xóa. |
| Query | page | integer | Không | Phân trang comment gốc, mặc định 1. |
| Query | limit | integer | Không | Mặc định 10, tối đa 50; replies không phân trang riêng. |

#### Request hoàn chỉnh

```http
GET /api/v1/posts/501/comments?page=1&limit=10
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": 105,
        "postId": 501,
        "userId": 15,
        "parentId": null,
        "content": "Bài viết rất hữu ích!",
        "createdAt": "2026-07-30T08:47:00.000Z",
        "updatedAt": "2026-07-30T08:47:00.000Z",
        "user": {
          "id": 15,
          "username": "nguyenvanf",
          "avatarUrl": null
        },
        "replies": [
          {
            "id": 106,
            "postId": 501,
            "userId": 20,
            "parentId": 105,
            "content": "Mình cũng thấy vậy.",
            "createdAt": "2026-07-30T08:48:00.000Z",
            "updatedAt": "2026-07-30T08:48:00.000Z",
            "user": {
              "id": 20,
              "username": "tranc",
              "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/20/avatar.jpg"
            }
          }
        ]
      }
    ],
    "meta": {
      "totalItems": 5,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 1,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ comment gốc được phân trang; replies cấp 2 được lồng trong từng item và sắp xếp tăng dần theo createdAt.

### P12 — GET /api/v1/tags/top

**Lấy tag nổi bật**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | limit | number | Không | Mặc định 10; không qua DTO validation. |
| Query | lang | string | Không | Lọc điểm tag theo bài của ngôn ngữ tương ứng. |
| Header | Accept-Language | string | Không | Dùng khi không có query lang. |

#### Request hoàn chỉnh

```http
GET /api/v1/tags/top?limit=5&lang=vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": 2,
      "name": "Prisma",
      "postCount": 18,
      "tagScore": 61.742
    },
    {
      "id": 1,
      "name": "NodeJS",
      "postCount": 31,
      "tagScore": 54.318
    }
  ],
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- tagScore được tính bằng AVG hot score của các bài PUBLISH chưa xóa thuộc tag.

### P13 — GET /api/v1/tags

**Lấy danh sách tag**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không yêu cầu JWT | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | search | string | Không | Tìm theo name, không phân biệt hoa thường. |
| Query | lang | string | Không | DTO chấp nhận nhưng TagsPublicService.findAll hiện không dùng để lọc. |
| Query | page/limit | number | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/tags?page=1&limit=10&search=Prisma&lang=vi
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": 2,
        "name": "Prisma",
        "createdAt": "2026-07-20T03:00:00.000Z",
        "deletedAt": null
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
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- TagEntity hiện vẫn xuất deletedAt (thường null vì query chỉ lấy tag chưa xóa).
