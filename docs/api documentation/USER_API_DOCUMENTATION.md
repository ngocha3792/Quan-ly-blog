# USER_API_DOCUMENTATION

> Tài liệu API **User** cho dự án Quản lý Blog (NestJS + Prisma). Nội dung mô tả payload frontend/backend thực sự chấp nhận và JSON response theo source code đã rà soát.

- **Phạm vi:** 28 endpoint User
- **Base URL:** `/api/v1`
- **Ngày rà soát:** 30/07/2026
- **Lưu ý dữ liệu mẫu:** ID, token, URL, số liệu và timestamp chỉ mang tính minh họa; tên field, vị trí payload, kiểu dữ liệu, status code và cấu trúc JSON bám theo tài liệu nguồn.

## Mục lục

- [Quy tắc chung frontend phải tuân theo](#quy-tắc-chung-frontend-phải-tuân-theo)
- [Danh mục API User](#danh-mục-api-user)
- [API User — request và response chính xác](#api-user--request-và-response-chính-xác)

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

## Danh mục API User

| Mã | Method | Endpoint | JWT / Role | HTTP |
| --- | --- | --- | --- | --- |
| U01 | POST | /api/v1/auth/refresh-token | Không cần access token; cần refreshToken trong body | 200 |
| U02 | POST | /api/v1/auth/logout | Không cần access token; cần refreshToken trong body | 200 |
| U03 | POST | /api/v1/auth/logout-all | Bắt buộc JWT access token | 200 |
| U04 | POST | /api/v1/user/blog-owner-requests | JWT; role NORMAL hoặc BLOG_OWNER | 201 |
| U05 | GET | /api/v1/user/blog-owner-requests | JWT; role NORMAL hoặc BLOG_OWNER | 200 |
| U06 | GET | /api/v1/user/blog-owner-requests/:id | JWT; role NORMAL hoặc BLOG_OWNER | 200 |
| U07 | DELETE | /api/v1/user/blog-owner-requests/:id | JWT; role NORMAL hoặc BLOG_OWNER | 200 |
| U08 | POST | /api/v1/user/posts/:postId/comments | JWT; role NORMAL hoặc BLOG_OWNER | 201 |
| U09 | PATCH | /api/v1/user/comments/:commentId | JWT; role NORMAL hoặc BLOG_OWNER | 200 |
| U10 | DELETE | /api/v1/user/comments/:commentId | JWT; role NORMAL hoặc BLOG_OWNER | 200 |
| U11 | GET | /api/v1/user/follow/followers | Bắt buộc JWT access token | 200 |
| U12 | GET | /api/v1/user/follow/following | Bắt buộc JWT access token | 200 |
| U13 | GET | /api/v1/user/follow/:id/followers | Bắt buộc JWT access token | 200 |
| U14 | GET | /api/v1/user/follow/:id/following | Bắt buộc JWT access token | 200 |
| U15 | POST | /api/v1/user/follow/:id | Bắt buộc JWT access token | 201 |
| U16 | DELETE | /api/v1/user/follow/:id | Bắt buộc JWT access token | 200 |
| U17 | GET | /api/v1/user/posts/bookmarks | Bắt buộc JWT access token | 200 |
| U18 | GET | /api/v1/user/posts/likes | Bắt buộc JWT access token | 200 |
| U19 | POST | /api/v1/user/posts/:id/bookmark | Bắt buộc JWT access token | 201 |
| U20 | DELETE | /api/v1/user/posts/:id/bookmark | Bắt buộc JWT access token | 200 |
| U21 | POST | /api/v1/user/posts/:id/like | Bắt buộc JWT access token | 201 |
| U22 | DELETE | /api/v1/user/posts/:id/like | Bắt buộc JWT access token | 200 |
| U23 | GET | /api/v1/user/profile | Bắt buộc JWT access token | 200 |
| U24 | PATCH | /api/v1/user/profile | Bắt buộc JWT access token | 200 |
| U25 | DELETE | /api/v1/user/profile | Bắt buộc JWT access token | 200 |
| U26 | POST | /api/v1/user/profile/avatar | Bắt buộc JWT access token | 201 |
| U27 | POST | /api/v1/user/posts/:postId/reports | JWT; role NORMAL hoặc BLOG_OWNER | 201 |
| U28 | POST | /api/v1/user/comments/:commentId/reports | JWT; role NORMAL hoặc BLOG_OWNER | 201 |

## API User — request và response chính xác

### U01 — POST /api/v1/auth/refresh-token

**Cấp lại access token**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không cần access token; cần refreshToken trong body | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | refreshToken | string | Có | Refresh token hợp lệ, chưa hết hạn và khớp một session chưa revoke. |
| Header | User-Agent | string | Không | Nếu khác deviceInfo lúc login, backend revoke session và trả lỗi. |
| Network | IP address | string | Tự động | Controller nhận nhưng service hiện không dùng để đối chiếu. |

#### Request hoàn chỉnh

```http
POST /api/v1/auth/refresh-token
User-Agent: Mozilla/5.0
Content-Type: application/json

{
  "refreshToken": "<JWT_REFRESH_TOKEN>"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "accessToken": "<NEW_JWT_ACCESS_TOKEN>"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### U02 — POST /api/v1/auth/logout

**Đăng xuất thiết bị hiện tại**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Không cần access token; cần refreshToken trong body | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | refreshToken | string | Có | Refresh token của session muốn revoke. |

#### Request hoàn chỉnh

```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refreshToken": "<JWT_REFRESH_TOKEN>"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đăng xuất thiết bị hiện tại thành công"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### U03 — POST /api/v1/auth/logout-all

**Đăng xuất tất cả thiết bị**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Header | Authorization | Bearer token | Có | JwtAuthGuard đọc user ID từ access token. |

#### Request hoàn chỉnh

```http
POST /api/v1/auth/logout-all
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đăng xuất khỏi tất cả các thiết bị thành công"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Bản source mới đã bổ sung @UseGuards(JwtAuthGuard) cho route này.

### U04 — POST /api/v1/user/blog-owner-requests

**Tạo yêu cầu trở thành Blog Owner**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body | reason | string | Có | Không rỗng, tối đa 1000 ký tự. |
| Body | topics | string | Không | Tối đa 500 ký tự. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/blog-owner-requests
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "reason": "Tôi muốn chia sẻ kiến thức lập trình backend.",
  "topics": "NestJS, Prisma, PostgreSQL"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 21,
    "userId": 15,
    "reason": "Tôi muốn chia sẻ kiến thức lập trình backend.",
    "topics": "NestJS, Prisma, PostgreSQL",
    "status": "PENDING",
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-07-30T08:20:00.000Z",
    "updatedAt": "2026-07-30T08:20:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- User đã là BLOG_OWNER bị từ chối; user đang có request PENDING cũng bị từ chối.

### U05 — GET /api/v1/user/blog-owner-requests

**Lấy yêu cầu Blog Owner của chính mình**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | status | BlogOwnerRequestStatus | Không | PENDING, APPROVED hoặc REJECTED. |
| Query | userId | number | Không | DTO chấp nhận nhưng service luôn ghi đè bằng ID từ JWT. |
| Query | page/limit | number | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/blog-owner-requests?status=PENDING&page=1&limit=10
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
        "updatedAt": "2026-07-30T08:20:00.000Z"
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

- reviewedById bị ẩn trong UserBlogOwnerRequestEntity.

### U06 — GET /api/v1/user/blog-owner-requests/:id

**Xem một yêu cầu Blog Owner của chính mình**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | Request phải thuộc user đang đăng nhập. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/blog-owner-requests/21
Authorization: Bearer <ACCESS_TOKEN>
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
    "status": "PENDING",
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-07-30T08:20:00.000Z",
    "updatedAt": "2026-07-30T08:20:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### U07 — DELETE /api/v1/user/blog-owner-requests/:id

**Hủy yêu cầu Blog Owner**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | Chỉ hủy được request của chính mình đang PENDING. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/user/blog-owner-requests/21
Authorization: Bearer <ACCESS_TOKEN>
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
    "status": "PENDING",
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-07-30T08:20:00.000Z",
    "updatedAt": "2026-07-30T08:20:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Core service xóa cứng bản ghi và trả lại dữ liệu bản ghi vừa xóa.

### U08 — POST /api/v1/user/posts/:postId/comments

**Tạo comment hoặc reply**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | postId | integer | Có | ID bài PUBLISH chưa xóa. |
| Body | content | string | Có | Không rỗng; tối đa 1000 ký tự; kiểm tra từ cấm. |
| Body | parentId | number | Không | ID comment cha cùng bài; reply vào reply sẽ được đưa về comment gốc. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/posts/501/comments
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "content": "Bài viết rất hữu ích!",
  "parentId": null
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 105,
    "postId": 501,
    "userId": 15,
    "parentId": null,
    "content": "Bài viết rất hữu ích!",
    "createdAt": "2026-07-30T08:47:00.000Z",
    "updatedAt": "2026-07-30T08:47:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Client không được gửi postId trong body vì CreateUserCommentDto đã Omit field này.
- Giới hạn chống spam: tối đa 5 comment trong 1 phút; nội dung trùng trên cùng bài trong 1 phút bị từ chối.

### U09 — PATCH /api/v1/user/comments/:commentId

**Sửa comment của chính mình**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | commentId | integer | Có | Comment phải thuộc user đang đăng nhập. |
| Body | content | string | Có | Không rỗng; tối đa 1000 ký tự; kiểm tra từ cấm. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/user/comments/105
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "content": "Bài viết rất hữu ích, cảm ơn tác giả!"
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 105,
    "postId": 501,
    "userId": 15,
    "parentId": null,
    "content": "Bài viết rất hữu ích, cảm ơn tác giả!",
    "createdAt": "2026-07-30T08:47:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Nội dung sau trim giống nội dung hiện tại bị trả 400.

### U10 — DELETE /api/v1/user/comments/:commentId

**Xóa mềm comment của chính mình**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | commentId | integer | Có | Comment phải thuộc user đang đăng nhập. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/user/comments/105
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 105,
    "postId": 501,
    "userId": 15,
    "parentId": null,
    "content": "Bài viết rất hữu ích, cảm ơn tác giả!",
    "createdAt": "2026-07-30T08:47:00.000Z",
    "updatedAt": "2026-07-30T08:50:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- deletedAt được cập nhật trong database nhưng CommentEntity dùng @Exclude nên không xuất hiện trong response.

### U11 — GET /api/v1/user/follow/followers

**Lấy follower của chính mình**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/follow/followers?page=1&limit=10
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
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
        "bio": "Senior Node.js Developer"
      },
      {
        "id": 88,
        "username": "frontend_master",
        "avatarUrl": null,
        "bio": "React & Angular enthusiast"
      }
    ],
    "meta": {
      "totalItems": 25,
      "itemCount": 2,
      "itemsPerPage": 10,
      "totalPages": 3,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ trả id, username, avatarUrl, bio; user đã soft-delete bị lọc.

### U12 — GET /api/v1/user/follow/following

**Lấy người mình đang follow**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/follow/following?page=1&limit=10
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
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
        "bio": "Senior Node.js Developer"
      },
      {
        "id": 88,
        "username": "frontend_master",
        "avatarUrl": null,
        "bio": "React & Angular enthusiast"
      }
    ],
    "meta": {
      "totalItems": 25,
      "itemCount": 2,
      "itemsPerPage": 10,
      "totalPages": 3,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ trả id, username, avatarUrl, bio; user đã soft-delete bị lọc.

### U13 — GET /api/v1/user/follow/:id/followers

**Lấy follower của một user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user cần xem danh sách follow. |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/follow/102/followers?page=1&limit=10
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
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
        "bio": "Senior Node.js Developer"
      },
      {
        "id": 88,
        "username": "frontend_master",
        "avatarUrl": null,
        "bio": "React & Angular enthusiast"
      }
    ],
    "meta": {
      "totalItems": 25,
      "itemCount": 2,
      "itemsPerPage": 10,
      "totalPages": 3,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ trả id, username, avatarUrl, bio; user đã soft-delete bị lọc.

### U14 — GET /api/v1/user/follow/:id/following

**Lấy danh sách user mà một user đang follow**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user cần xem danh sách follow. |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/follow/102/following?page=1&limit=10
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
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/102/avatar.jpg",
        "bio": "Senior Node.js Developer"
      },
      {
        "id": 88,
        "username": "frontend_master",
        "avatarUrl": null,
        "bio": "React & Angular enthusiast"
      }
    ],
    "meta": {
      "totalItems": 25,
      "itemCount": 2,
      "itemsPerPage": 10,
      "totalPages": 3,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ trả id, username, avatarUrl, bio; user đã soft-delete bị lọc.

### U15 — POST /api/v1/user/follow/:id

**Follow một user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user muốn follow; không được bằng ID của chính mình. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/follow/102
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "followerId": 15,
    "followingId": 102,
    "createdAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Body rỗng; follow trùng bị từ chối.

### U16 — DELETE /api/v1/user/follow/:id

**Unfollow một user**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID user muốn bỏ follow. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/user/follow/102
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đã bỏ follow thành công"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Body rỗng; chưa follow mà gọi unfollow bị từ chối.

### U17 — GET /api/v1/user/posts/bookmarks

**Lấy bài đã bookmark**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/posts/bookmarks?page=1&limit=10
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
      }
    ],
    "meta": {
      "totalItems": 12,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 2,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ bài PUBLISH, deletedAt=null; shape item giống PublicPostEntity.

### U18 — GET /api/v1/user/posts/likes

**Lấy bài đã like**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Query | page/limit | integer | Không | Mặc định 1/10; limit tối đa 50. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/posts/likes?page=1&limit=10
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
      }
    ],
    "meta": {
      "totalItems": 12,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 2,
      "currentPage": 1
    }
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Chỉ bài PUBLISH, deletedAt=null; shape item giống PublicPostEntity.

### U19 — POST /api/v1/user/posts/:id/bookmark

**Bookmark bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID bài PUBLISH chưa xóa. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/posts/501/bookmark
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "postId": 501,
    "userId": 15,
    "createdAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Body rỗng; bookmark trùng bị từ chối.

### U20 — DELETE /api/v1/user/posts/:id/bookmark

**Bỏ bookmark bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID bài PUBLISH chưa xóa. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/user/posts/501/bookmark
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đã bỏ lưu bài viết thành công"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### U21 — POST /api/v1/user/posts/:id/like

**Like bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID bài PUBLISH chưa xóa. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/posts/501/like
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "postId": 501,
    "userId": 15,
    "createdAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Body rỗng; like trùng bị từ chối.

### U22 — DELETE /api/v1/user/posts/:id/like

**Bỏ like bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | id | integer | Có | ID bài PUBLISH chưa xóa. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/user/posts/501/like
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "message": "Đã bỏ thích bài viết thành công"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

### U23 — GET /api/v1/user/profile

**Lấy profile của user hiện tại**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Header | Authorization | Bearer token | Có | ID user được lấy từ access token. |

#### Request hoàn chỉnh

```http
GET /api/v1/user/profile
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 15,
    "username": "nguyenvanf",
    "email": "nguyenvanf@example.com",
    "role": "NORMAL",
    "status": "ACTIVE",
    "bio": "Lập trình viên Fullstack",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/15/avatar.jpg",
    "createdAt": "2026-07-20T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:45:00.000Z",
    "followers": [
      {
        "id": 2,
        "username": "tranb",
        "avatarUrl": null,
        "bio": "Yêu thích công nghệ"
      },
      {
        "id": 5,
        "username": "lethi_c",
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/5/avatar.jpg",
        "bio": null
      }
    ]
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- followers được dựng từ quan hệ Prisma following -> follower và chỉ chứa id, username, avatarUrl, bio.
- passwordHash, deletedAt, lockedById, lockedAt và lockReason bị ẩn.

### U24 — PATCH /api/v1/user/profile

**Cập nhật profile và/hoặc avatar**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Body/Form | password | string | Không | Mật khẩu mới, tối thiểu 6 ký tự; backend băm trước khi lưu. |
| Body/Form | bio | string | Không | Chuỗi; DTO hiện không đặt MaxLength. |
| Body/Form | avatarUrl | string (URL) | Không | Phải là URL hợp lệ; nếu có file, URL này bị ghi đè bằng URL Cloudinary. |
| Multipart | file | image/* | Không | Tối đa 5MB; backend kiểm tra mimetype bắt đầu bằng image/. |

#### Request hoàn chỉnh

```http
PATCH /api/v1/user/profile
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: multipart/form-data

bio = "Đam mê NestJS và PostgreSQL"
file = <avatar.jpg>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 15,
    "username": "nguyenvanf",
    "email": "nguyenvanf@example.com",
    "role": "NORMAL",
    "status": "ACTIVE",
    "bio": "Đam mê NestJS và PostgreSQL",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/15/new-avatar.jpg",
    "createdAt": "2026-07-20T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:49:30.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- username, email, role và status không thuộc UpdateProfileDto; gửi các field này sẽ bị 400.
- Có thể gửi application/json nếu không upload file.

### U25 — DELETE /api/v1/user/profile

**Xóa mềm tài khoản của chính mình**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 200 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Header | Authorization | Bearer token | Có | ID user được lấy từ access token. |

#### Request hoàn chỉnh

```http
DELETE /api/v1/user/profile
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 15,
    "username": "nguyenvanf",
    "email": "nguyenvanf@example.com",
    "role": "NORMAL",
    "status": "LOCKED",
    "bio": "Lập trình viên Fullstack",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/15/avatar.jpg",
    "createdAt": "2026-07-20T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:50:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Database đặt deletedAt và status=LOCKED; UserProfileEntity ẩn deletedAt nên response chỉ thể hiện status đã thành LOCKED.

### U26 — POST /api/v1/user/profile/avatar

**Upload avatar riêng**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| Bắt buộc JWT access token | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Multipart | file | image/* | Có | Tối đa 5MB; thiếu file trả 400; mimetype phải bắt đầu bằng image/. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/profile/avatar
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: multipart/form-data

file = <avatar.jpg>
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
    "bio": "Đam mê NestJS và PostgreSQL",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/users/15/new-avatar.jpg",
    "createdAt": "2026-07-20T01:00:00.000Z",
    "updatedAt": "2026-07-30T08:49:30.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Backend cố gắng xóa ảnh Cloudinary cũ rồi upload ảnh mới.

### U27 — POST /api/v1/user/posts/:postId/reports

**Report bài viết**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | postId | integer | Có | Bài phải PUBLISH, chưa xóa và không phải bài của chính reporter. |
| Body | reason | ReportReason | Có | SPAM, HARASSMENT, INAPPROPRIATE, COPYRIGHT, MISINFORMATION hoặc OTHER. |
| Body | description | string | Không | Tối đa 1000 ký tự. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/posts/501/reports
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "reason": "MISINFORMATION",
  "description": "Một số số liệu trong bài chưa có nguồn kiểm chứng."
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 301,
    "reporterId": 15,
    "targetType": "POST",
    "postId": 501,
    "commentId": null,
    "reason": "MISINFORMATION",
    "description": "Một số số liệu trong bài chưa có nguồn kiểm chứng.",
    "status": "PENDING",
    "reviewedAt": null,
    "createdAt": "2026-07-30T08:49:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Client không gửi targetType hoặc postId trong body; backend lấy từ route.
- Response tạo mới không có object post vì ReportsService.create không include quan hệ.

### U28 — POST /api/v1/user/comments/:commentId/reports

**Report bình luận**

| Xác thực / phân quyền | HTTP thành công | Content-Type request |
| --- | --- | --- |
| JWT; role NORMAL hoặc BLOG_OWNER | 201 | application/json; riêng upload dùng multipart/form-data |

#### Frontend phải gửi

| Vị trí | Field | Kiểu | Bắt buộc | Backend xử lý / validation |
| --- | --- | --- | --- | --- |
| Path | commentId | integer | Có | Comment phải tồn tại trong bài PUBLISH, chưa xóa và không phải comment của reporter. |
| Body | reason | ReportReason | Có | SPAM, HARASSMENT, INAPPROPRIATE, COPYRIGHT, MISINFORMATION hoặc OTHER. |
| Body | description | string | Không | Tối đa 1000 ký tự. |

#### Request hoàn chỉnh

```http
POST /api/v1/user/comments/105/reports
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "reason": "HARASSMENT",
  "description": "Bình luận có nội dung công kích cá nhân."
}
```

#### JSON backend trả về khi thành công

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 302,
    "reporterId": 15,
    "targetType": "COMMENT",
    "postId": null,
    "commentId": 105,
    "reason": "HARASSMENT",
    "description": "Bình luận có nội dung công kích cá nhân.",
    "status": "PENDING",
    "reviewedAt": null,
    "createdAt": "2026-07-30T08:49:00.000Z",
    "updatedAt": "2026-07-30T08:49:00.000Z"
  },
  "timestamp": "2026-07-30T08:50:00.000Z"
}
```

#### Điểm cần chú ý

- Client không gửi targetType hoặc commentId trong body; backend lấy từ route.
- Response tạo mới không có object comment vì ReportsService.create không include quan hệ.
