# 🌍 TÀI LIỆU API & ĐẶC TẢ HỆ THỐNG MODULE PUBLIC (NESTJS BLOG)

Tài liệu này mô tả chi tiết các API Endpoint công khai (Public API) dành cho khách vãng lai và người dùng hệ thống. Các API này **KHÔNG** yêu cầu xác thực (No JWT Required) nhưng hỗ trợ các Header tùy chọn (như `Accept-Language`) để lấy nội dung đa ngôn ngữ.

> **Global Prefix**: `/api/v1`
> **Global Header (Tùy chọn)**: `Accept-Language: vi` (hoặc `en`, `fr`...) để lấy nội dung theo ngôn ngữ.

---

## 📝 1. BÀI VIẾT (POSTS) (`/api/v1/posts`)

#### 1. Lấy danh sách bài viết mới nhất
- **Method:** `GET`
- **Path:** `/api/v1/posts?page=1&limit=10&categoryId=5`
- **Query Params:** `page`, `take`, `categoryId` (tùy chọn), `tagId` (tùy chọn), `keyword` (tùy chọn).
- **Mô tả:** Lấy danh sách bài viết đang xuất bản (`PUBLISH`). Dữ liệu trả về qua `PublicPostEntity` ẩn hoàn toàn các thông tin kiểm duyệt nội bộ.

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/posts?page=1&limit=10" \
  -H "Accept-Language: vi"
```

**Response mẫu (200 OK):**
```json
{
  "total": 50,
  "page": 1,
  "take": 10,
  "data": [
    {
      "id": 501,
      "title": "Hướng dẫn NestJS cho người mới bắt đầu",
      "slug": "huong-dan-nestjs",
      "excerpt": "Bài viết hướng dẫn từ A-Z...",
      "status": "PUBLISH",
      "viewCount": 120,
      "likeCount": 15,
      "createdAt": "2026-07-28T09:00:00.000Z",
      "author": {
        "id": 102,
        "username": "backend_dev",
        "avatarUrl": "https://res.cloudinary.com/..."
      },
      "categories": [{ "id": 5, "name": "NestJS", "slug": "nestjs" }],
      "tags": [{ "id": 1, "name": "NodeJS" }]
    }
  ]
}
```

#### 2. Lấy danh sách bài viết nổi bật (Top Posts)
- **Method:** `GET`
- **Path:** `/api/v1/posts/top?limit=5`
- **Query Params:** `limit` (Mặc định: 10).
- **Mô tả:** Lấy các bài viết có `viewCount` hoặc `likeCount` cao nhất.

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/posts/top?limit=5" \
  -H "Accept-Language: vi"
```

#### 3. Xem chi tiết bài viết
- **Method:** `GET`
- **Path:** `/api/v1/posts/:id`
- **Mô tả:** Lấy chi tiết bài viết. **Hệ thống tự động tăng `viewCount` thêm 1** nếu truy cập hợp lệ (Dựa vào IP người dùng).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/posts/501" \
  -H "Accept-Language: vi"
```

---

## ✍️ 2. TÁC GIẢ (AUTHORS) (`/api/v1/authors`)

#### 1. Lấy danh sách tác giả nổi bật (Top Authors)
- **Method:** `GET`
- **Path:** `/api/v1/authors/top?limit=5`
- **Mô tả:** Lấy danh sách các tác giả có tổng lượt xem (`totalViews`) hoặc tổng số bài viết cao nhất.

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/authors/top?limit=5"
```

**Response mẫu (200 OK):**
```json
[
  {
    "id": 102,
    "username": "backend_dev",
    "avatarUrl": "https://res.cloudinary.com/...",
    "bio": "Senior Developer",
    "totalPosts": 25,
    "totalViews": 45000
  }
]
```

#### 2. Xem chi tiết tác giả và danh sách bài viết
- **Method:** `GET`
- **Path:** `/api/v1/authors/:id?page=1&limit=10`
- **Mô tả:** Trả về thông tin của tác giả kèm danh sách các bài viết đã xuất bản của họ (có phân trang).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/authors/102?page=1&limit=10" \
  -H "Accept-Language: vi"
```

---

## 🗂️ 3. DANH MỤC & THẺ (CATEGORIES & TAGS)

#### 1. Lấy danh sách Danh mục (Categories)
- **Method:** `GET`
- **Path:** `/api/v1/categories?page=1&limit=50`
- **Mô tả:** Trả về danh sách danh mục đang hoạt động (`isActive: true`).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/categories" \
  -H "Accept-Language: vi"
```

#### 2. Lấy danh sách Thẻ (Tags)
- **Method:** `GET`
- **Path:** `/api/v1/tags?page=1&limit=50`

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/tags" \
  -H "Accept-Language: vi"
```

---

## 💬 4. BÌNH LUẬN (COMMENTS) (`/api/v1/comments`)

#### 1. Lấy danh sách bình luận của bài viết
- **Method:** `GET`
- **Path:** `/api/v1/comments/post/:postId?page=1&limit=20`
- **Mô tả:** Lấy danh sách bình luận công khai của một bài viết cụ thể, hỗ trợ phân cấp cha-con (`parentId`).

**Ví dụ cURL:**
```bash
curl -X GET "http://localhost:8080/api/v1/comments/post/501?page=1&limit=20"
```

**Response mẫu (200 OK):**
```json
{
  "total": 5,
  "page": 1,
  "take": 20,
  "data": [
    {
      "id": 105,
      "content": "Bài viết rất chất lượng!",
      "createdAt": "2026-07-28T10:50:00.000Z",
      "author": {
        "id": 15,
        "username": "nguyenvanf_official",
        "avatarUrl": "https://res.cloudinary.com/..."
      },
      "replies": [
        {
          "id": 106,
          "content": "Mình đồng ý với bạn!",
          "createdAt": "2026-07-28T10:55:00.000Z",
          "author": {
            "id": 20,
            "username": "tran_c"
          }
        }
      ]
    }
  ]
}
```

---

## 🧪 HƯỚNG DẪN KIỂM THỬ NHANH

Luồng kiểm thử đề xuất cho Public API (không cần JWT Token):
1. Gọi `GET /api/v1/posts` để xem danh sách toàn bộ bài viết mới.
2. Lấy 1 `id` bài viết từ kết quả trên, sau đó gọi `GET /api/v1/posts/:id` để xem chi tiết bài viết (quan sát số lượng `viewCount` tăng lên sau mỗi lần reload tùy theo logic chặn IP).
3. Sử dụng `id` của tác giả trong bài viết để gọi `GET /api/v1/authors/:id` xem hồ sơ tác giả và tất cả bài viết của họ.
4. Gọi `GET /api/v1/categories` và lọc bài viết theo `categoryId`.
5. Gọi `GET /api/v1/comments/post/:id` để đọc các bình luận của bài viết.
