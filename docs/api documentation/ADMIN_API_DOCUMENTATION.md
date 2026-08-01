# ADMIN_API_DOCUMENTATION

> Tài liệu API **Admin** cho dự án Quản lý Blog (NestJS + Prisma). Nội dung mô tả payload frontend/backend thực sự chấp nhận và JSON response theo source code đã rà soát.

- **Phạm vi:** 16 endpoint Admin
- **Base URL:** `/api/v1`
- **Ngày rà soát:** 30/07/2026
- **Lưu ý dữ liệu mẫu:** ID, token, URL, số liệu và timestamp chỉ mang tính minh họa; tên field, vị trí payload, kiểu dữ liệu, status code và cấu trúc JSON bám theo tài liệu nguồn.

## Mục lục

- [Quy tắc chung frontend phải tuân theo](#quy-tắc-chung-frontend-phải-tuân-theo)
- [Danh mục API Admin](#danh-mục-api-admin)
- [API Admin — request và response chính xác](#api-admin--request-và-response-chính-xác)

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

## Danh mục API Admin

| Mã | Method | Endpoint | JWT / Role | HTTP |
| --- | --- | --- | --- | --- |
| A01 | GET | /api/v1/admin/dashboard | JWT; SUPER_ADMIN | 200 |
| A02 | GET | /api/v1/admin/languages | JWT; SUPER_ADMIN | 200 |
| A03 | GET | /api/v1/admin/languages/:id | JWT; SUPER_ADMIN | 200 |
| A04 | POST | /api/v1/admin/languages | JWT; chỉ SUPER_ADMIN | 201 |
| A05 | PATCH | /api/v1/admin/languages/:id | JWT; chỉ SUPER_ADMIN | 200 |
| A06 | DELETE | /api/v1/admin/languages/:id | JWT; chỉ SUPER_ADMIN | 200 |
| A07 | GET | /api/v1/admin/requests/blog-owner | JWT; SUPER_ADMIN | 200 |
| A08 | PATCH | /api/v1/admin/requests/blog-owner/:id | JWT; SUPER_ADMIN | 200 |
| A09 | GET | /api/v1/admin/users | JWT; chỉ SUPER_ADMIN | 200 |
| A10 | POST | /api/v1/admin/users/moderators | JWT; chỉ SUPER_ADMIN | 201 |
| A11 | GET | /api/v1/admin/users/:id | JWT; chỉ SUPER_ADMIN | 200 |
| A12 | PATCH | /api/v1/admin/users/:id | JWT; chỉ SUPER_ADMIN | 200 |
| A13 | PATCH | /api/v1/admin/users/:id/lock | JWT; chỉ SUPER_ADMIN | 200 |
| A14 | PATCH | /api/v1/admin/users/:id/unlock | JWT; chỉ SUPER_ADMIN | 200 |
| A15 | PATCH | /api/v1/admin/users/:id/role | JWT; chỉ SUPER_ADMIN | 200 |
| A16 | DELETE | /api/v1/admin/users/:id | JWT; chỉ SUPER_ADMIN | 200 |

## API Admin — request và response chính xác

### A01 — GET /api/v1/admin/dashboard

**Lấy dữ liệu dashboard quản trị**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; SUPER_ADMIN hoặc CONTENT_MODERATOR | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Header | Authorization | Bearer token | Có | RolesGuard kiểm tra role từ JWT. |

#### Request hoàn chỉnh

```http
GET /api/v1/admin/dashboard
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "stats": {
      "totalUsers": 1280,
      "totalBlogOwners": 84,
      "totalLanguages": 4,
      "pendingRequests": 7
    },
    "userGrowth": {
      "labels": [
        "T6",
        "T7",
        "CN",
        "T2",
        "T3",
        "T4",
        "T5"
      ],
      "data": [
        12,
        9,
        7,
        15,
        18,
        11,
        14
      ],
      "details": [
        {
          "date": "2026-07-24",
          "label": "T6",
          "count": 12
        },
        {
          "date": "2026-07-25",
          "label": "T7",
          "count": 9
        },
        {
          "date": "2026-07-26",
          "label": "CN",
          "count": 7
        },
        {
          "date": "2026-07-27",
          "label": "T2",
          "count": 15
        },
        {
          "date": "2026-07-28",
          "label": "T3",
          "count": 18
        },
        {
          "date": "2026-07-29",
          "label": "T4",
          "count": 11
        },
        {
          "date": "2026-07-30",
          "label": "T5",
          "count": 14
        }
      ]
    },
    "postsByLanguage": {
      "labels": [
        "Tiếng Việt",
        "English"
      ],
      "data": [
        420,
        180
      ],
      "details": [
        {
          "id": 1,
          "name": "Tiếng Việt",
          "code": "vi",
          "flag": "🇻🇳",
          "postCount": 420,
          "percentage": 70.0
        },
        {
          "id": 2,
          "name": "English",
          "code": "en",
          "flag": "🇬🇧",
          "postCount": 180,
          "percentage": 30.0
        }
      ]
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Các ngày được tính theo múi giờ Việt Nam; dữ liệu thay đổi theo database và thời điểm gọi.

### A02 — GET /api/v1/admin/languages

**Lấy toàn bộ ngôn ngữ chưa xóa**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; SUPER_ADMIN hoặc CONTENT_MODERATOR | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Header | Authorization | Bearer token | Có | RolesGuard kiểm tra role. |

#### Request hoàn chỉnh

```http
GET /api/v1/admin/languages
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": 1,
      "code": "vi",
      "name": "Tiếng Việt",
      "flag": "🇻🇳",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-07-20T02:00:00.000Z",
      "updatedAt": "2026-07-20T02:00:00.000Z"
    },
    {
      "id": 2,
      "code": "en",
      "name": "English",
      "flag": "🇬🇧",
      "isDefault": false,
      "isActive": true,
      "createdAt": "2026-07-20T02:05:00.000Z",
      "updatedAt": "2026-07-20T02:05:00.000Z"
    }
  ],
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- AdminLanguageEntity ẩn deletedAt.

### A03 — GET /api/v1/admin/languages/:id

**Lấy chi tiết ngôn ngữ**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; SUPER_ADMIN hoặc CONTENT_MODERATOR | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID ngôn ngữ chưa soft-delete. |

#### Request hoàn chỉnh

```http
GET /api/v1/admin/languages/1
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 1,
    "code": "vi",
    "name": "Tiếng Việt",
    "flag": "🇻🇳",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-07-20T02:00:00.000Z",
    "updatedAt": "2026-07-20T02:00:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### A04 — POST /api/v1/admin/languages

**Tạo ngôn ngữ**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | code | string | Có | Không rỗng, tối đa 10 ký tự, duy nhất. |
| Body | name | string | Có | Không rỗng, tối đa 100 ký tự, kiểm tra từ cấm. |
| Body | flag | string | Không | Chuỗi biểu tượng/cờ. |
| Body | isDefault | boolean | Không | Mặc định database false; nếu true, backend hạ isDefault của ngôn ngữ khác. |
| Body | isActive | boolean | Không | Mặc định database true. |

#### Request hoàn chỉnh

```http
POST /api/v1/admin/languages
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "code": "vi",
  "name": "Tiếng Việt",
  "flag": "🇻🇳",
  "isDefault": true,
  "isActive": true
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 1,
    "code": "vi",
    "name": "Tiếng Việt",
    "flag": "🇻🇳",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-07-20T02:00:00.000Z",
    "updatedAt": "2026-07-20T02:00:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### A05 — PATCH /api/v1/admin/languages/:id

**Cập nhật ngôn ngữ**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID ngôn ngữ chưa xóa. |
| Body | code/name/flag/isDefault/isActive | theo field | Không | Tất cả optional; validation giống API tạo. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/admin/languages/1
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "name": "Vietnamese - Tiếng Việt",
  "isDefault": true
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 1,
    "code": "vi",
    "name": "Vietnamese - Tiếng Việt",
    "flag": "🇻🇳",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-07-20T02:00:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Nếu isDefault=true, backend đặt các ngôn ngữ khác thành false.

### A06 — DELETE /api/v1/admin/languages/:id

**Xóa mềm ngôn ngữ**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID ngôn ngữ chưa xóa. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/admin/languages/1
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 1,
    "code": "vi",
    "name": "Vietnamese - Tiếng Việt",
    "flag": "🇻🇳",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-07-20T02:00:00.000Z",
    "updatedAt": "2026-07-30T08:50:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Database đặt deletedAt, nhưng AdminLanguageEntity ẩn field này trong response.

### A07 — GET /api/v1/admin/requests/blog-owner

**Lấy danh sách yêu cầu Blog Owner**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; SUPER_ADMIN hoặc CONTENT_MODERATOR | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | userId | number | Không | Lọc request theo user. |
| Query | status | BlogOwnerRequestStatus | Không | PENDING, APPROVED hoặc REJECTED. |
| Query | page/limit | number | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/admin/requests/blog-owner?status=PENDING&page=1&limit=10
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
        "id": 21,
        "userId": 15,
        "reason": "Tôi muốn chia sẻ kiến thức lập trình backend.",
        "topics": "NestJS, Prisma, PostgreSQL",
        "status": "PENDING",
        "reviewedAt": null,
        "rejectionReason": null,
        "createdAt": "2026-07-30T08:20:00.000Z",
        "updatedAt": "2026-07-30T08:20:00.000Z",
        "reviewedById": null
      }
    ],
    "meta": {
      "totalItems": 7,
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

- Response hiện chỉ có các field của BlogOwnerRequest, không include thông tin user.

### A08 — PATCH /api/v1/admin/requests/blog-owner/:id

**Duyệt hoặc từ chối yêu cầu Blog Owner**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; SUPER_ADMIN hoặc CONTENT_MODERATOR | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | Request phải tồn tại và đang PENDING. |
| Body | status | BlogOwnerRequestStatus | Có | DTO chấp nhận PENDING, APPROVED, REJECTED; luồng nghiệp vụ dự kiến dùng APPROVED/REJECTED. |
| Body | rejectionReason | string | Không | Tối đa 1000 ký tự; DTO không bắt buộc khi status=REJECTED. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/admin/requests/blog-owner/21
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "status": "APPROVED"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 21,
    "userId": 15,
    "reason": "Tôi muốn chia sẻ kiến thức lập trình backend.",
    "topics": "NestJS, Prisma, PostgreSQL",
    "status": "APPROVED",
    "reviewedAt": "2026-07-30T08:49:00.000Z",
    "rejectionReason": null,
    "createdAt": "2026-07-30T08:20:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z",
    "reviewedById": 1
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Nếu APPROVED, backend đổi role của user thành BLOG_OWNER.
- reviewedById được lấy từ JWT và reviewedAt do backend tự gán.

### A09 — GET /api/v1/admin/users

**Lấy danh sách user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | search | string | Không | Tìm username hoặc email, không phân biệt hoa thường. |
| Query | role | UserRole | Không | NORMAL, BLOG_OWNER, CONTENT_MODERATOR, SUPER_ADMIN. |
| Query | status | UserStatus | Không | ACTIVE hoặc LOCKED. |
| Query | page/limit | number | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/admin/users?role=BLOG_OWNER&status=ACTIVE&page=1&limit=10
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
        "id": 102,
        "username": "backend_dev",
        "email": "backend.dev@example.com",
        "role": "BLOG_OWNER",
        "status": "ACTIVE",
        "bio": "Senior Node.js Developer",
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
        "lockedAt": null,
        "lockedById": null,
        "lockReason": null,
        "createdAt": "2026-07-10T01:00:00.000Z",
        "updatedAt": "2026-07-25T09:00:00.000Z",
        "deletedAt": null
      }
    ],
    "meta": {
      "totalItems": 84,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 9,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- passwordHash bị ẩn; các field khóa tài khoản và deletedAt vẫn được AdminUserEntity trả về.

### A10 — POST /api/v1/admin/users/moderators

**Tạo tài khoản Content Moderator**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | username | string | Có | Không rỗng; tối đa 50; chỉ chữ, số, dấu gạch dưới; duy nhất. |
| Body | email | string (email) | Có | Đúng định dạng và duy nhất. |
| Body | password | string | Có | Tối thiểu 6 ký tự. |
| Body | bio | string | Không | Tối đa 500 ký tự. |
| Body | avatarUrl | string | Không | CreateModeratorDto chỉ kiểm tra string, không kiểm tra URL. |

#### Request hoàn chỉnh

```http
POST /api/v1/admin/users/moderators
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "username": "content_mod_01",
  "email": "content.mod01@example.com",
  "password": "Secret123",
  "bio": "Kiểm duyệt nội dung tiếng Việt",
  "avatarUrl": "https://cdn.example.com/avatar/mod01.png"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 1301,
    "username": "content_mod_01",
    "email": "content.mod01@example.com",
    "role": "CONTENT_MODERATOR",
    "status": "ACTIVE",
    "bio": "Kiểm duyệt nội dung tiếng Việt",
    "avatarUrl": "https://cdn.example.com/avatar/mod01.png",
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-30T08:49:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Role luôn được backend gán CONTENT_MODERATOR, status luôn ACTIVE.

### A11 — GET /api/v1/admin/users/:id

**Xem chi tiết user và các bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user chưa soft-delete. |

#### Request hoàn chỉnh

```http
GET /api/v1/admin/users/102
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 102,
    "username": "backend_dev",
    "email": "backend.dev@example.com",
    "role": "BLOG_OWNER",
    "status": "ACTIVE",
    "bio": "Senior Node.js Developer",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-10T01:00:00.000Z",
    "updatedAt": "2026-07-25T09:00:00.000Z",
    "deletedAt": null,
    "posts": [
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
        "reviewedById": 3,
        "reviewedAt": "2026-07-25T08:58:00.000Z",
        "rejectionReason": null,
        "createdAt": "2026-07-25T08:40:00.000Z",
        "updatedAt": "2026-07-25T09:00:00.000Z",
        "deletedAt": null,
        "likeCount": 85,
        "commentCount": 14,
        "categories": [
          {
            "id": 5,
            "name": "Backend",
            "categoryGroupId": 2,
            "languageId": 1,
            "createdAt": "2026-07-20T02:20:00.000Z",
            "updatedAt": "2026-07-20T02:20:00.000Z",
            "deletedAt": null
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
        ]
      }
    ]
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- posts gồm mọi status của user miễn deletedAt=null; sắp xếp createdAt giảm dần.
- Mỗi post có viewCount, likeCount, commentCount, categories và tags; không include author, language hoặc media.

### A12 — PATCH /api/v1/admin/users/:id

**Cập nhật thông tin user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user chưa xóa. |
| Body | password | string | Không | Tối thiểu 6 ký tự; được băm và cập nhật. |
| Body | bio | string | Không | Được cập nhật. |
| Body | avatarUrl | string (URL) | Không | Phải là URL hợp lệ; được cập nhật. |
| Body | role | UserRole | Không | DTO chấp nhận nhưng UsersService.update hiện bỏ qua, không cập nhật. |
| Body | status | UserStatus | Không | DTO chấp nhận nhưng UsersService.update hiện bỏ qua, không cập nhật. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/admin/users/102
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "bio": "Backend Architect",
  "avatarUrl": "https://cdn.example.com/users/102/new-avatar.png"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 102,
    "username": "backend_dev",
    "email": "backend.dev@example.com",
    "role": "BLOG_OWNER",
    "status": "ACTIVE",
    "bio": "Backend Architect",
    "avatarUrl": "https://cdn.example.com/users/102/new-avatar.png",
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-10T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- email và username bị Omit khỏi UpdateUserDto; gửi sẽ bị 400.
- Đổi role phải dùng PATCH /admin/users/:id/role; khóa/mở khóa dùng route riêng.

### A13 — PATCH /api/v1/admin/users/:id/lock

**Khóa tài khoản user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user cần khóa. |
| Body | reason | string | Có | Không rỗng; tối đa 500 ký tự. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/admin/users/102/lock
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "reason": "Vi phạm chính sách nhiều lần"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 102,
    "username": "backend_dev",
    "email": "backend.dev@example.com",
    "role": "BLOG_OWNER",
    "status": "LOCKED",
    "bio": "Senior Node.js Developer",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
    "lockedAt": "2026-07-30T08:49:00.000Z",
    "lockedById": 1,
    "lockReason": "Vi phạm chính sách nhiều lần",
    "createdAt": "2026-07-10T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Backend đồng thời revoke toàn bộ userSession chưa bị revoke của user.

### A14 — PATCH /api/v1/admin/users/:id/unlock

**Mở khóa tài khoản user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user cần mở khóa. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/admin/users/102/unlock
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 102,
    "username": "backend_dev",
    "email": "backend.dev@example.com",
    "role": "BLOG_OWNER",
    "status": "ACTIVE",
    "bio": "Senior Node.js Developer",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-10T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:50:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Body rỗng; backend đặt status=ACTIVE và xóa lockedAt, lockedById, lockReason.

### A15 — PATCH /api/v1/admin/users/:id/role

**Đổi role user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user cần đổi role. |
| Body | role | UserRole | Có | NORMAL, BLOG_OWNER, CONTENT_MODERATOR hoặc SUPER_ADMIN. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/admin/users/102/role
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "role": "CONTENT_MODERATOR"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 102,
    "username": "backend_dev",
    "email": "backend.dev@example.com",
    "role": "CONTENT_MODERATOR",
    "status": "ACTIVE",
    "bio": "Senior Node.js Developer",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-10T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:50:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Service hiện không có kiểm tra ngăn tự đổi role hoặc cấp SUPER_ADMIN cho user khác.

### A16 — DELETE /api/v1/admin/users/:id

**Xóa mềm user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; chỉ SUPER_ADMIN | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user chưa soft-delete. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/admin/users/102
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 102,
    "username": "backend_dev",
    "email": "backend.dev@example.com",
    "role": "BLOG_OWNER",
    "status": "LOCKED",
    "bio": "Senior Node.js Developer",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
    "lockedAt": null,
    "lockedById": null,
    "lockReason": null,
    "createdAt": "2026-07-10T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:50:00.000Z",
    "deletedAt": "2026-07-30T08:50:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Route gọi trực tiếp UsersService.remove nên response là UserEntity: passwordHash bị ẩn nhưng deletedAt vẫn xuất hiện.
- Backend đặt status=LOCKED cùng lúc với deletedAt.
