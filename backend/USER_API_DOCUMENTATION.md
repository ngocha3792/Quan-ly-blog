# 📘 TÀI LIỆU API & ĐẶC TẢ HỆ THỐNG MODULE USER (NESTJS BLOG)

Tài liệu này mô tả chi tiết kiến trúc, các Entity phân quyền dữ liệu, danh sách các API Endpoint dành cho người dùng (User API) cùng với các mẫu dữ liệu kiểm thử (Test Data & cURL/Postman) cho hệ thống Quản lý Blog NestJS.

---

## 🏛️ 1. TỔNG QUAN VỀ KIẾN TRÚC & ENTITY BẢO MẬT DỮ LIỆU

Hệ thống tuân thủ nghiêm ngặt nguyên tắc **Data Masking & Privilege Separation** (Phân quyền và che giấu dữ liệu) thông qua thư viện `class-transformer`. Các Entity trong module User được thiết kế để kế thừa từ các Core Entity nhưng tự động lọc bỏ các trường nhạy cảm trước khi trả về cho Client.

| Entity | Kế thừa từ | Mục đích & Các trường bị ẩn/xử lý đặc biệt |
| :--- | :--- | :--- |
| **`UserProfileEntity`** | `UserEntity` (Core) | • **Ẩn**: `deletedAt`, `lockedById`, `lockedAt`, `lockReason`, `passwordHash`, quan hệ thô `following`.<br>• **Hiển thị**: Thông tin cá nhân cơ bản và danh sách người theo dõi mình (`followers` với các trường rút gọn `id`, `username`, `avatarUrl`, `bio`). |
| **`UserPostEntity`** | `PublicPostEntity` | • **Ẩn**: `reviewedById`, `reviewedAt`, `rejectionReason`, `deletedAt`, `publicId` của media.<br>• **Hiển thị**: Bài viết đã lưu/thích với danh mục (`categories`) và thẻ (`tags`) đã được làm phẳng (flatten), tự động tính `likeCount`. |
| **`UserReportEntity`** | `ReportEntity` (Core) | • **Ẩn**: `reviewedById`, `reviewedAt`, `deletedAt`, thông tin nội bộ của moderator.<br>• **Hiển thị**: Trạng thái báo cáo, lý do, kèm theo chi tiết bài viết (`post`) hoặc bình luận (`comment`) bị báo cáo. |
| **`UserBlogOwnerRequestEntity`** | `BlogOwnerRequestEntity` (Core) | • **Ẩn**: `reviewedById` (ID của Admin/Moderator đã duyệt yêu cầu).<br>• **Hiển thị**: Trạng thái (`status`), lý do xin duyệt (`reason`), chủ đề (`topics`), ngày duyệt (`reviewedAt`) và lý do từ chối (`rejectionReason` nếu bị từ chối). |

---

## 🚀 2. CHI TIẾT CÁC API ENDPOINT & DỮ LIỆU KIỂM THỬ (TEST DATA)

> **Lưu ý chung:** Tất cả các API bên dưới đều yêu cầu Header xác thực JWT (trừ khi có ghi chú khác):  
> `Authorization: Bearer <YOUR_ACCESS_TOKEN>`  
> **Global Prefix**: `/api/v1`

---

### 👤 A. QUẢN LÝ THÔNG TIN CÁ NHÂN & AVATAR (`/api/v1/user/profile`)

#### 1. Xem thông tin cá nhân (Profile & Followers)
- **Method:** `GET`
- **Path:** `/api/v1/user/profile`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Mô tả:** Trả về thông tin chi tiết của người dùng đang đăng nhập cùng danh sách những người đang theo dõi mình (`followers`).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn..."
```

**Response mẫu (200 OK):**
```json
{
  "id": 15,
  "email": "nguyenvanf@example.com",
  "username": "nguyenvanf",
  "bio": "Lập trình viên Fullstack NestJS & React",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1711234567/nestjs_blog/users/15/avatar/profile.png",
  "role": "NORMAL",
  "status": "ACTIVE",
  "createdAt": "2026-07-28T01:00:00.000Z",
  "updatedAt": "2026-07-28T02:30:00.000Z",
  "followers": [
    {
      "id": 2,
      "username": "tranb",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/avatar2.jpg",
      "bio": "Yêu thích công nghệ"
    },
    {
      "id": 5,
      "username": "lethi_c",
      "avatarUrl": null,
      "bio": null
    }
  ]
}
```

---

#### 2. Cập nhật thông tin cá nhân (bao gồm cả xử lý ảnh Avatar)
- **Method:** `PATCH`
- **Path:** `/api/v1/user/profile`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json` hoặc `multipart/form-data`
- **Quy tắc (UpdateProfileDto):** Kế thừa từ `UpdateUserDto` nhưng **CẤM** gửi các trường `role` và `status`. Hỗ trợ gửi kèm file ảnh (trường `file`) trong cùng request để vừa cập nhật thông tin cá nhân vừa xử lý tải ảnh Avatar lên Cloudinary (tự động xóa ảnh cũ nếu có).

**Request Body mẫu (application/json):**
```json
{
  "username": "nguyenvanf_official",
  "bio": "Đam mê NestJS, Microservices và Cloud Architecture 🚀",
  "phoneNumber": "0987654321"
}
```

**Ví dụ cURL (multipart/form-data kèm file avatar):**
```bash
curl -X PATCH "http://localhost:8080/api/v1/user/profile" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "username=nguyenvanf_official" \
  -F "bio=Đam mê NestJS 🚀" \
  -F "file=@/path/to/new_avatar.jpg"
```

---

#### 3. Tải lên (Upload) ảnh đại diện Avatar qua Cloudinary
- **Method:** `POST`
- **Path:** `/api/v1/user/profile/avatar`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: multipart/form-data`
- **Quy tắc:** Chỉ chấp nhận định dạng `image/*`, dung lượng tối đa **5MB**. Tự động dọn dẹp ảnh cũ trên Cloudinary trước khi tải ảnh mới.

**Ví dụ cURL:**
```bash
curl -X POST "http://localhost:8080/api/v1/user/profile/avatar" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/your/avatar.jpg"
```

**Response mẫu (201 Created):**
```json
{
  "id": 15,
  "username": "nguyenvanf_official",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1722139800/nestjs_blog/users/15/avatar/avatar.jpg",
  "bio": "Đam mê NestJS 🚀"
}
```

---

#### 4. Xóa tài khoản cá nhân (Soft Delete)
- **Method:** `DELETE`
- **Path:** `/api/v1/user/profile`
- **Headers:** `Authorization: Bearer <TOKEN>`

**Ví dụ cURL:**
```bash
curl -X DELETE "http://localhost:8080/api/v1/user/profile" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 🤝 B. HỆ THỐNG THEO DÕI (FOLLOW / UNFOLLOW) (`/api/v1/user/follow`)

#### 1. Xem danh sách những người đang theo dõi mình (My Followers)
- **Method:** `GET`
- **Path:** `/api/v1/user/follow/followers?page=1&limit=10`
- **Query Params:** `page` (default: 1), `take` (default: 10)
- **Mô tả:** Lấy danh sách những người theo dõi user hiện tại. Tự động lọc bỏ các user đã bị xóa mềm (`deletedAt: null`).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/follow/followers?page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response mẫu (200 OK):**
```json
{
  "items": [
    {
      "id": 102,
      "username": "backend_dev",
      "bio": "Senior Node.js Developer",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/avatar_dev.jpg"
    },
    {
      "id": 88,
      "username": "frontend_master",
      "bio": "React & Angular enthusiast",
      "avatarUrl": null
    }
  ],
  "meta": {
    "totalItems": 25,
    "itemCount": 2,
    "itemsPerPage": 10,
    "totalPages": 3,
    "currentPage": 1
  }
}
```

---

#### 2. Xem danh sách những người mình đang theo dõi (My Following)
- **Method:** `GET`
- **Path:** `/api/v1/user/follow/following?page=1&limit=10`

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/follow/following?page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

---

#### 3. Xem danh sách theo dõi của một tác giả / người dùng bất kỳ
- **Method:** `GET`
- **Path:** 
  - `/api/v1/user/follow/:id/followers` (Người theo dõi của user ID `:id`)
  - `/api/v1/user/follow/:id/following` (Người mà user ID `:id` đang theo dõi)

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/follow/10/followers?page=1&limit=5" \
  -H "Authorization: Bearer <TOKEN>"
```

---

#### 4. Thực hiện theo dõi (Follow) người dùng
- **Method:** `POST`
- **Path:** `/api/v1/user/follow/:id`
- **Param:** `id` - ID của người dùng muốn theo dõi.
- **Quy tắc:** Không thể tự theo dõi chính mình (`SelfActionNotAllowedException`). Không thể theo dõi người đã theo dõi rồi (`ExistActionNotAllowedException`).

**Ví dụ cURL:**
```bash
curl -X POST "http://localhost:8080/api/v1/user/follow/102" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response mẫu (201 Created):**
```json
{
  "followerId": 15,
  "followingId": 102,
  "createdAt": "2026-07-28T10:30:00.000Z"
}
```

---

#### 5. Hủy theo dõi (Unfollow) người dùng
- **Method:** `DELETE`
- **Path:** `/api/v1/user/follow/:id`

**Ví dụ cURL:**
```bash
curl -X DELETE "http://localhost:8080/api/v1/user/follow/102" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response mẫu (200 OK):**
```json
{
  "success": true,
  "message": "Đã bỏ follow thành công"
}
```

---

### 🔖 C. BÀI VIẾT ĐÃ LƯU & ĐÃ THÍCH (BOOKMARKS & LIKES) (`/api/v1/user/posts`)

#### 1. Xem danh sách bài viết đã Bookmark (Lưu)
- **Method:** `GET`
- **Path:** `/api/v1/user/posts/bookmarks?page=1&limit=10`
- **Mô tả:** Lấy danh sách các bài viết mà người dùng đã bấm lưu. Chỉ trả về các bài viết đang được xuất bản (`status: 'PUBLISH'`) và chưa bị xóa. Dữ liệu trả về qua `UserPostEntity` được làm phẳng danh mục, thẻ, lượt like và media.

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/posts/bookmarks?page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response mẫu (200 OK):**
```json
{
  "items": [
    {
      "id": 501,
      "title": "Hướng dẫn tối ưu NestJS với Prisma & PostgreSQL",
      "slug": "huong-dan-toi-uu-nestjs-voi-prisma-postgresql",
      "excerpt": "Bài viết chia sẻ các bí kíp tối ưu hóa câu lệnh truy vấn Prisma trong dự án lớn...",
      "content": "Nội dung chi tiết bài viết...",
      "status": "PUBLISH",
      "viewCount": 1420,
      "likeCount": 85,
      "createdAt": "2026-07-25T09:00:00.000Z",
      "author": {
        "id": 102,
        "username": "backend_dev",
        "bio": "Senior Node.js Developer",
        "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/avatar_dev.jpg"
      },
      "language": {
        "id": 1,
        "code": "vi",
        "name": "Tiếng Việt"
      },
      "categories": [
        {
          "id": 5,
          "name": "NestJS",
          "slug": "nestjs"
        }
      ],
      "tags": [
        { "id": 1, "name": "NodeJS" },
        { "id": 2, "name": "Prisma" },
        { "id": 3, "name": "Performance" }
      ],
      "media": [
        {
          "id": 10,
          "postId": 501,
          "mediaType": "image",
          "mediaUrl": "https://res.cloudinary.com/demo/image/upload/v170000/nestjs_cover.png",
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
}
```

---

#### 2. Xem danh sách bài viết đã Thích (Liked Posts)
- **Method:** `GET`
- **Path:** `/api/v1/user/posts/likes?page=1&limit=10`

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/posts/likes?page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

---

#### 3. Thực hiện Lưu / Bỏ lưu bài viết (Bookmark / Unbookmark)
- **Lưu bài viết:** `POST /api/v1/user/posts/:id/bookmark`
- **Bỏ lưu bài viết:** `DELETE /api/v1/user/posts/:id/bookmark`

**Ví dụ cURL (Bookmark):**
```bash
curl -X POST "http://localhost:8080/api/v1/user/posts/501/bookmark" \
  -H "Authorization: Bearer <TOKEN>"
```
**Response mẫu:**
```json
{
  "postId": 501,
  "userId": 15,
  "createdAt": "2026-07-28T10:45:00.000Z"
}
```

---

#### 4. Thực hiện Thích / Bỏ thích bài viết (Like / Unlike)
- **Thích bài viết:** `POST /api/v1/user/posts/:id/like`
- **Bỏ thích bài viết:** `DELETE /api/v1/user/posts/:id/like`

**Ví dụ cURL (Like):**
```bash
curl -X POST "http://localhost:8080/api/v1/user/posts/501/like" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 💬 D. BÌNH LUẬN BÀI VIẾT (`/api/v1/user`)

#### 1. Viết bình luận (hoặc trả lời bình luận)
- **Method:** `POST`
- **Path:** `/api/v1/user/posts/:postId/comments`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`

**Request Body (Bình luận gốc):**
```json
{
  "content": "Bài viết viết rất chi tiết và dễ hiểu. Cảm ơn tác giả!"
}
```

**Request Body (Trả lời/Reply bình luận khác với parentId):**
```json
{
  "content": "Mình đồng ý với quan điểm này của bạn!",
  "parentId": 42
}
```

**Ví dụ cURL:**
```bash
curl -X POST "http://localhost:8080/api/v1/user/posts/501/comments" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Bài viết rất chất lượng!", "parentId": null}'
```

**Response mẫu (201 Created):**
```json
{
  "id": 105,
  "postId": 501,
  "userId": 15,
  "parentId": null,
  "content": "Bài viết rất chất lượng!",
  "createdAt": "2026-07-28T10:50:00.000Z",
  "updatedAt": "2026-07-28T10:50:00.000Z"
}
```

---

#### 2. Sửa nội dung bình luận của chính mình
- **Method:** `PATCH`
- **Path:** `/api/v1/user/comments/:commentId`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`

**Request Body:**
```json
{
  "content": "Nội dung sau khi đã chỉnh sửa bổ sung ý rõ ràng hơn."
}
```

---

#### 3. Xóa bình luận của chính mình
- **Method:** `DELETE`
- **Path:** `/api/v1/user/comments/:commentId`

**Ví dụ cURL:**
```bash
curl -X DELETE "http://localhost:8080/api/v1/user/comments/105" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 🚨 E. BÁO CÁO VI PHẠM (`/api/v1/user/reports`)

#### 1. Gửi báo cáo bài viết hoặc bình luận vi phạm
- **Method:** `POST`
- **Path:** `/api/v1/user/reports`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Quy tắc:** Chỉ được chọn báo cáo 1 trong 2: gửi `postId` (báo cáo bài viết) HOẶC gửi `commentId` (báo cáo bình luận).

**Request Body mẫu (Báo cáo bài viết):**
```json
{
  "reason": "Bài viết chứa thông tin sai sự thật hoặc quảng cáo trái phép.",
  "postId": 501
}
```

**Request Body mẫu (Báo cáo bình luận):**
```json
{
  "reason": "Bình luận sử dụng ngôn từ xúc phạm người khác.",
  "commentId": 105
}
```

**Ví dụ cURL:**
```bash
curl -X POST "http://localhost:8080/api/v1/user/reports" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Ngôn từ xúc phạm", "commentId": 105}'
```

**Response mẫu (201 Created - Trả về qua `UserReportEntity`):**
```json
{
  "id": 12,
  "userId": 15,
  "postId": null,
  "commentId": 105,
  "reason": "Ngôn từ xúc phạm",
  "status": "PENDING",
  "createdAt": "2026-07-28T10:55:00.000Z",
  "comment": {
    "id": 105,
    "content": "Bình luận vi phạm bị báo cáo...",
    "createdAt": "2026-07-28T10:50:00.000Z"
  }
}
```
*(Notice: Các thông tin nhạy cảm như ai là moderator duyệt (`reviewedById`), ngày duyệt (`reviewedAt`) đều bị loại bỏ hoàn toàn).*

---

#### 2. Xem danh sách các báo cáo do mình đã gửi
- **Method:** `GET`
- **Path:** `/api/v1/user/reports?page=1&limit=10&status=PENDING`
- **Query Params:** `page`, `take`, `status` (tùy chọn: `PENDING`, `APPROVED`, `REJECTED`).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/reports?page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### ✍️ F. QUẢN LÝ YÊU CẦU TRỞ THÀNH TÁC GIẢ BLOG (`/api/v1/user/blog-owner-requests`)

#### 1. Gửi yêu cầu xin trở thành tác giả (Blog Owner)
- **Method:** `POST`
- **Path:** `/api/v1/user/blog-owner-requests`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Quy tắc:** Chỉ áp dụng cho người dùng đang có vai trò `NORMAL`. Nếu người dùng đã là tác giả (`BLOG_OWNER`) hoặc đang có 1 yêu cầu ở trạng thái `PENDING`, hệ thống sẽ trả về lỗi `ExistActionNotAllowedException`.

**Request Body mẫu:**
```json
{
  "reason": "Tôi là kỹ sư phần mềm có 5 năm kinh nghiệm, muốn đăng các bài viết chia sẻ về kiến trúc Microservices với NestJS và Kafka.",
  "topics": "NestJS, Microservices, TypeScript, DevOps"
}
```

**Ví dụ cURL:**
```bash
curl -X POST "http://localhost:8080/api/v1/user/blog-owner-requests" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Muốn chia sẻ bài viết kỹ thuật", "topics": "NestJS, TypeScript"}'
```

**Response mẫu (201 Created - Trả về qua `UserBlogOwnerRequestEntity`):**
```json
{
  "id": 3,
  "userId": 15,
  "reason": "Muốn chia sẻ bài viết kỹ thuật",
  "topics": "NestJS, TypeScript",
  "status": "PENDING",
  "reviewedAt": null,
  "rejectionReason": null,
  "createdAt": "2026-07-28T14:00:00.000Z",
  "updatedAt": "2026-07-28T14:00:00.000Z"
}
```
*(Notice: Trường thông tin nhạy cảm `reviewedById` đã tự động được loại bỏ nhờ `UserBlogOwnerRequestEntity`).*

---

#### 2. Xem danh sách các yêu cầu của chính mình
- **Method:** `GET`
- **Path:** `/api/v1/user/blog-owner-requests?page=1&limit=10&status=PENDING`
- **Query Params:** `page`, `take` (hoặc `limit`), `status` (`PENDING`, `APPROVED`, `REJECTED`).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/blog-owner-requests?page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response mẫu (200 OK):**
```json
{
  "items": [
    {
      "id": 3,
      "userId": 15,
      "reason": "Muốn chia sẻ bài viết kỹ thuật",
      "topics": "NestJS, TypeScript",
      "status": "PENDING",
      "reviewedAt": null,
      "rejectionReason": null,
      "createdAt": "2026-07-28T14:00:00.000Z",
      "updatedAt": "2026-07-28T14:00:00.000Z"
    }
  ],
  "meta": {
    "totalItems": 1,
    "itemCount": 1,
    "itemsPerPage": 10,
    "totalPages": 1,
    "currentPage": 1
  }
}
```

---

#### 3. Xem chi tiết một yêu cầu
- **Method:** `GET`
- **Path:** `/api/v1/user/blog-owner-requests/:id`

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/user/blog-owner-requests/3" \
  -H "Authorization: Bearer <TOKEN>"
```

---

#### 4. Hủy / Xóa yêu cầu xin làm tác giả
- **Method:** `DELETE`
- **Path:** `/api/v1/user/blog-owner-requests/:id`
- **Quy tắc:** Người dùng chỉ có thể hủy bỏ yêu cầu của chính mình và yêu cầu đó phải đang ở trạng thái chờ duyệt (`PENDING`). Nếu yêu cầu đã được duyệt hoặc bị từ chối, hệ thống sẽ trả về lỗi `ExistActionNotAllowedException`.

**Ví dụ cURL:**
```bash
curl -X DELETE "http://localhost:8080/api/v1/user/blog-owner-requests/3" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 🧪 3. HƯỚNG DẪN KIỂM THỬ NHANH VỚI POSTMAN / CLIENT

Để kiểm thử nhanh chuỗi luồng làm việc của User API, bạn có thể thực hiện tuần tự theo 5 bước sau:

1. **Đăng nhập** lấy JWT Token từ `/api/v1/login`, lưu token vào biến môi trường `TOKEN`.
2. **Kiểm tra thông tin Profile:**  
   Gọi `GET /api/v1/user/profile` để đảm bảo nhận được thông tin cá nhân và mảng `followers`.
3. **Cập nhật Bio & Avatar:**  
   Gọi `PATCH /api/v1/user/profile` với body `{"bio": "Hello NestJS"}` và `POST /api/v1/user/profile/avatar` để tải lên ảnh đại diện mới.
4. **Tương tác với Tác giả và Bài viết:**  
   - Gọi `POST /api/v1/user/follow/102` để follow tác giả ID 102.
   - Gọi `POST /api/v1/user/posts/501/bookmark` và `POST /api/v1/user/posts/501/like` để lưu và thích bài viết ID 501.
   - Gọi `GET /api/v1/user/posts/bookmarks` để xác nhận bài viết 501 xuất hiện trong danh sách bookmark.
5. **Gửi bình luận và Báo cáo vi phạm:**  
   - Gọi `POST /api/v1/user/posts/501/comments` để gửi bình luận.
   - Gọi `POST /api/v1/user/reports` với body `{"postId": 501, "reason": "Test report"}` để tạo báo cáo vi phạm và xác nhận dữ liệu trả về đã được ẩn thông tin nội bộ.
