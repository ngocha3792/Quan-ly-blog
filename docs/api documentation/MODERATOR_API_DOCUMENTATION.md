# MODERATOR_API_DOCUMENTATION

> Tài liệu API **Content Moderator** cho dự án Quản lý Blog (NestJS + Prisma). Cấu trúc tài liệu được xây dựng cùng kiểu với `ADMIN_API_DOCUMENTATION.md`: mô tả request backend thực sự chấp nhận, JSON response, HTTP status và quy tắc nghiệp vụ theo source cuối sau clean code.

- **Phạm vi:** 18 endpoint Content Moderator
- **Base URL:** `/api/v1`
- **Controller prefix:** `/moderator`
- **JWT / Role bắt buộc:** `CONTENT_MODERATOR`
- **Ngày rà soát:** 18/09/2026
- **Nhóm chức năng:** Dashboard, kiểm duyệt Post Group, Category Group đa ngôn ngữ, xử lý Reports
- **Lưu ý dữ liệu mẫu:** ID, token, URL, số liệu và timestamp chỉ mang tính minh họa; tên field, vị trí payload, kiểu dữ liệu, HTTP status và luồng nghiệp vụ bám theo source cuối.

## Mục lục

- [Quy tắc chung backend áp dụng](#quy-tắc-chung-backend-áp-dụng)
- [Workflow kiểm duyệt Post Group](#workflow-kiểm-duyệt-post-group)
- [Category Group đa ngôn ngữ](#category-group-đa-ngôn-ngữ)
- [Workflow xử lý Reports](#workflow-xử-lý-reports)
- [Danh mục API Moderator](#danh-mục-api-moderator)
- [API Moderator — request và response](#api-moderator--request-và-response)
- [Bảng lỗi thường gặp](#bảng-lỗi-thường-gặp)

## Quy tắc chung backend áp dụng

### Success envelope

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

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Nội dung lỗi",
  "path": "/api/v1/moderator/posts/1766/reject",
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

### JWT và role

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Tất cả endpoint trong tài liệu này yêu cầu role `CONTENT_MODERATOR`.

### Validation, trim và pagination

- `ValidationPipe` bật transform/whitelist và cấm field thừa.
- Body string được trim theo pipeline chung.
- Path ID dùng `ParseIntPipe`.
- Các API danh sách dùng pagination chuẩn `page`, `limit`; limit tối đa thực tế 50.
- Moderator không nhận `DRAFT` trong workflow kiểm duyệt bài.
- Review metadata lấy Moderator hiện tại từ JWT.

### Enum chính

| Enum               | Giá trị hợp lệ                                                                          |
| ------------------ | --------------------------------------------------------------------------------------- |
| `PostStatus`       | `DRAFT` \| `PENDING_REVIEW` \| `PUBLISH` \| `REJECT`                                    |
| `ReportTargetType` | `POST` \| `COMMENT`                                                                     |
| `ReportStatus`     | `PENDING` \| `RESOLVED` \| `REJECTED`                                                   |
| `ReportReason`     | `SPAM` \| `HARASSMENT` \| `INAPPROPRIATE` \| `COPYRIGHT` \| `MISINFORMATION` \| `OTHER` |

## Workflow kiểm duyệt Post Group

```text
PENDING_REVIEW
   ├─ approve → PUBLISH
   └─ reject  → REJECT
```

Quy tắc:

- Danh sách Moderator phân trang theo root group.
- Translation không xuất hiện thành row độc lập ở list.
- Detail có thể đọc một version cụ thể và nhận summary các version cùng group.
- Moderator không được xem `DRAFT`.
- Approve/reject chỉ thực hiện bằng root ID.
- Toàn group phải ở trạng thái phù hợp.
- Review metadata áp dụng đồng bộ theo group.
- Service sử dụng transaction/conditional update để giảm race condition khi nhiều Moderator xử lý cùng lúc.

## Category Group đa ngôn ngữ

```text
CategoryGroup(code = "technology")
├─ VI: Công nghệ
├─ EN: Technology
└─ JA: テクノロジー
```

Moderator quản lý Category Group để bảo đảm category giữa các post translation có cùng semantic.

Chức năng:

- list/detail group;
- preview dịch tên category;
- tạo group + nhiều translations;
- update code và upsert translations;
- **xóa mềm một translation riêng lẻ**;
- **xóa cứng cả Category Group** khi không còn bất kỳ `PostCategory` nào tham chiếu category thuộc group.

Quy tắc delete được tách rõ:

- DELETE một translation: vẫn soft-delete để có thể thêm lại bằng `PATCH`/upsert; không cho xóa translation active cuối cùng và không cho xóa nếu translation đang được bài viết sử dụng.
- DELETE cả group: kiểm tra usage toàn group trong transaction; nếu `usageCount > 0` thì trả lỗi và không xóa gì; nếu không có usage thì xóa cứng tất cả Category con trước, sau đó xóa cứng CategoryGroup.
- Hard-delete giải phóng unique key của `CategoryGroup.code`, `(Category.name, languageId)` và `(categoryGroupId, languageId)`, vì vậy Moderator có thể tạo lại cùng code/tên sau khi xóa.

Khi Blog Owner tạo translation post, backend map category qua Category Group thay vì dịch lại tên category.

## Workflow xử lý Reports

```text
PENDING
  ├─ resolve → RESOLVED
  └─ reject  → REJECTED
```

### Resolve

- Report phải còn `PENDING`.
- Backend claim report bằng conditional update trong transaction.
- Target `POST`: xử lý theo Post Group.
- Target `COMMENT`: soft-delete comment và xử lý các report liên quan theo service.
- Lưu `reviewedById`, `reviewedAt`, `resolutionNote`.

### Reject

- Report → `REJECTED`.
- Target không bị thay đổi.
- Lưu Moderator, thời gian và ghi chú xử lý.

## Danh mục API Moderator

| Mã  | Nhóm            | Method | Endpoint                                                              | HTTP |
| --- | --------------- | ------ | --------------------------------------------------------------------- | ---: |
| M01 | Dashboard       | GET    | `/api/v1/moderator/dashboard/overview`                                |  200 |
| M02 | Dashboard       | GET    | `/api/v1/moderator/dashboard/report-stats`                            |  200 |
| M03 | Dashboard       | GET    | `/api/v1/moderator/dashboard/report-trend`                            |  200 |
| M04 | Post Moderation | GET    | `/api/v1/moderator/posts`                                             |  200 |
| M05 | Post Moderation | GET    | `/api/v1/moderator/posts/:postId`                                     |  200 |
| M06 | Post Moderation | POST   | `/api/v1/moderator/posts/:postId/approve`                             |  201 |
| M07 | Post Moderation | POST   | `/api/v1/moderator/posts/:postId/reject`                              |  201 |
| M08 | Category Group  | GET    | `/api/v1/moderator/category-groups`                                   |  200 |
| M09 | Category Group  | GET    | `/api/v1/moderator/category-groups/:groupId`                          |  200 |
| M10 | Category Group  | POST   | `/api/v1/moderator/category-groups/translate-preview`                 |  200 |
| M11 | Category Group  | POST   | `/api/v1/moderator/category-groups`                                   |  201 |
| M12 | Category Group  | PATCH  | `/api/v1/moderator/category-groups/:groupId`                          |  200 |
| M13 | Category Group  | DELETE | `/api/v1/moderator/category-groups/:groupId/translations/:languageId` |  200 |
| M14 | Category Group  | DELETE | `/api/v1/moderator/category-groups/:groupId`                          |  200 |
| M15 | Reports         | GET    | `/api/v1/moderator/reports`                                           |  200 |
| M16 | Reports         | GET    | `/api/v1/moderator/reports/:reportId`                                 |  200 |
| M17 | Reports         | POST   | `/api/v1/moderator/reports/:reportId/resolve`                         |  200 |
| M18 | Reports         | POST   | `/api/v1/moderator/reports/:reportId/reject`                          |  200 |

## API Moderator — request và response

### M01 — GET /api/v1/moderator/dashboard/overview

**Lấy KPI tổng quan**

```http
GET /api/v1/moderator/dashboard/overview
Authorization: Bearer <ACCESS_TOKEN>
```

#### JSON backend trả về

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "pendingPosts": 6,
    "pendingReports": 17,
    "pendingPostReports": 3,
    "pendingCommentReports": 14,
    "activeCategoryGroups": 8,
    "processedToday": 5,
    "processedPostsToday": 2,
    "processedReportsToday": 3
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

#### Điểm cần chú ý

- `pendingPosts` đếm root post `PENDING_REVIEW`.
- `processedToday` dùng ranh giới ngày theo timezone Việt Nam.
- `pendingReports = pendingPostReports + pendingCommentReports`.

### M02 — GET /api/v1/moderator/dashboard/report-stats

**Thống kê report theo status và reason**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "reportStatusCounts": {
      "pending": 17,
      "resolved": 20,
      "rejected": 5
    },
    "reportReasonCounts": {
      "spam": 10,
      "harassment": 8,
      "inappropriate": 7,
      "copyright": 2,
      "misinformation": 4,
      "other": 1
    }
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

Nhóm không có dữ liệu vẫn được map thành `0`.

### M03 — GET /api/v1/moderator/dashboard/report-trend

**Xu hướng report 7 ngày gần nhất**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "last7Days": [
      {
        "date": "2026-09-18",
        "postReports": 2,
        "commentReports": 1,
        "totalReports": 3
      }
    ]
  },
  "timestamp": "2026-09-18T08:00:00.000Z"
}
```

Backend luôn trả đủ 7 ngày theo lịch Việt Nam.

### M04 — GET /api/v1/moderator/posts

**Lấy danh sách Post Group được phép kiểm duyệt**

#### Request backend chấp nhận

Query:

| Field                 | Kiểu           | Ghi chú                                                                     |
| --------------------- | -------------- | --------------------------------------------------------------------------- |
| `status`              | enum           | chỉ `PENDING_REVIEW`, `PUBLISH`, `REJECT`; mặc định service ưu tiên pending |
| `search`              | string         | search theo Core                                                            |
| `categoryId`          | integer        | filter category                                                             |
| `languageId`          | integer        | filter language ID                                                          |
| `lang`                | string         | filter language code                                                        |
| `authorId`            | integer        | filter tác giả                                                              |
| `tagId`               | integer        | filter tag                                                                  |
| `tagName`             | string         | filter tag name                                                             |
| `page`                | integer        | pagination                                                                  |
| `limit`               | integer        | pagination                                                                  |
| `sortBy`              | string         | sort                                                                        |
| `sortOrder` / `order` | `asc` / `desc` | hướng sort                                                                  |

`parentPostId` và `bookmarkedByUserId` không được nhận từ DTO Moderator.

```http
GET /api/v1/moderator/posts?status=PENDING_REVIEW&page=1&limit=10
Authorization: Bearer <ACCESS_TOKEN>
```

#### Điểm cần chú ý

- List trả root group.
- `DRAFT` bị loại khỏi phạm vi Moderator.
- Bài pending được ưu tiên theo workflow service.

### M05 — GET /api/v1/moderator/posts/:postId

**Xem full content của một version và context group**

```http
GET /api/v1/moderator/posts/1766
Authorization: Bearer <ACCESS_TOKEN>
```

Response gồm nội dung post, author/language/category/tag/media, reviewer nếu có và `translations` summary của group.

#### Điểm cần chú ý

- Không làm tăng `viewCount`.
- Không cho đọc `DRAFT`.
- Có thể dùng ID của version hợp lệ để xem ngôn ngữ cụ thể.

### M06 — POST /api/v1/moderator/posts/:postId/approve

**Duyệt toàn Post Group**

```http
POST /api/v1/moderator/posts/1766/approve
Authorization: Bearer <ACCESS_TOKEN>
```

Không body.

Kết quả:

```text
PENDING_REVIEW (toàn group)
        ↓
PUBLISH (toàn group)
```

Backend ghi reviewer/time; xóa rejection reason và quản lý `publishedAt` theo lịch sử bài.

### M07 — POST /api/v1/moderator/posts/:postId/reject

**Từ chối toàn Post Group**

#### Request backend chấp nhận

```json
{
  "rejectionReason": "Cần bổ sung nguồn tham khảo."
}
```

- string;
- trim;
- bắt buộc;
- tối đa 2000 ký tự.

Kết quả toàn group → `REJECT` và lưu review metadata.

### M08 — GET /api/v1/moderator/category-groups

**Danh sách Category Group**

Query dùng `GetCategoryGroupsDto` + pagination. Response mỗi group có `translationCount` và `translations`.

```http
GET /api/v1/moderator/category-groups?page=1&limit=10
Authorization: Bearer <ACCESS_TOKEN>
```

### M09 — GET /api/v1/moderator/category-groups/:groupId

**Chi tiết Category Group**

```http
GET /api/v1/moderator/category-groups/67
Authorization: Bearer <ACCESS_TOKEN>
```

Response trả group cùng translations active và language của từng translation.

### M10 — POST /api/v1/moderator/category-groups/translate-preview

**Preview dịch category, không ghi database**

#### Request backend chấp nhận

```json
{
  "sourceLanguageId": 18,
  "sourceName": "Công nghệ",
  "targetLanguageIds": [19, 20]
}
```

Validation:

- `sourceLanguageId`: integer >= 1.
- `sourceName`: string, không rỗng, max 100, profanity check.
- `targetLanguageIds`: mảng, ít nhất 1, unique, mỗi ID integer >= 1.

#### Response mẫu

```json
{
  "source": {
    "languageId": 18,
    "languageCode": "vi",
    "languageName": "Tiếng Việt",
    "name": "Công nghệ"
  },
  "translations": [
    {
      "languageId": 19,
      "languageCode": "en",
      "languageName": "English",
      "name": "Technology"
    }
  ]
}
```

### M11 — POST /api/v1/moderator/category-groups

**Tạo Category Group cùng nhiều translations**

#### Request

```json
{
  "code": "technology",
  "translations": [
    {
      "languageId": 18,
      "name": "Công nghệ"
    },
    {
      "languageId": 19,
      "name": "Technology"
    }
  ]
}
```

Validation:

- `code`: trim + lowercase, không rỗng, max 50.
- Regex: `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`.
- `translations`: ít nhất 1.
- Mỗi language chỉ xuất hiện một lần.
- Name max 100 và profanity check.
- Language phải hợp lệ theo service.

### M12 — PATCH /api/v1/moderator/category-groups/:groupId

**Cập nhật code hoặc upsert translations**

Có thể gửi:

```json
{
  "code": "backend-development",
  "translations": [
    {
      "languageId": 19,
      "name": "Backend Development"
    }
  ]
}
```

- Field là partial của create DTO.
- Translation không xuất hiện trong request được giữ nguyên.
- Translation có trong request được thêm/cập nhật theo service.

### M13 — DELETE /api/v1/moderator/category-groups/:groupId/translations/:languageId

**Soft-delete một translation trong Category Group**

```http
DELETE /api/v1/moderator/category-groups/67/translations/19
Authorization: Bearer <ACCESS_TOKEN>
```

Backend áp dụng các rule:

- group phải đang active;
- translation phải tồn tại và chưa bị xóa;
- không được xóa translation active cuối cùng của group;
- không được xóa nếu `PostCategory` đang tham chiếu translation đó;
- khi hợp lệ, chỉ set `deletedAt` cho translation;
- `PATCH` group có thể upsert lại translation và đưa `deletedAt` về `null`.

### M14 — DELETE /api/v1/moderator/category-groups/:groupId

**Hard-delete toàn bộ Category Group**

```http
DELETE /api/v1/moderator/category-groups/67
Authorization: Bearer <ACCESS_TOKEN>
```

Luồng backend chạy trong transaction:

```text
ensure active group
       ↓
COUNT PostCategory sử dụng bất kỳ Category nào trong group
       ├─ > 0  → 400, không xóa
       └─ = 0
             ↓
      DELETE tất cả Category con
             ↓
      DELETE CategoryGroup
```

Do quan hệ `Category -> CategoryGroup` dùng `onDelete: Restrict`, backend xóa Category con trước rồi mới xóa group. Sau hard-delete, cùng `code` và tên category theo language có thể được tạo lại.

### M15 — GET /api/v1/moderator/reports

**Danh sách report**

#### Request backend chấp nhận

| Field        | Kiểu                                |
| ------------ | ----------------------------------- |
| `targetType` | `POST` / `COMMENT`                  |
| `status`     | `PENDING` / `RESOLVED` / `REJECTED` |
| `reason`     | `ReportReason`                      |
| `reporterId` | integer >= 1                        |
| `postId`     | integer >= 1                        |
| `commentId`  | integer >= 1                        |
| `page`       | integer >= 1                        |
| `limit`      | integer >= 1                        |

Nếu không gửi status, workflow Moderator mặc định tập trung report `PENDING`.

### M16 — GET /api/v1/moderator/reports/:reportId

**Xem chi tiết report và context**

Response dùng `ModeratorReportEntity`:

- reporter public summary;
- reviewedBy public summary;
- với target POST: post context;
- với target COMMENT: comment, user, post chứa comment và parent/replies liên quan để hiểu hội thoại;
- các field nhạy cảm/nội bộ bị ẩn.

### M17 — POST /api/v1/moderator/reports/:reportId/resolve

**Xác nhận report đúng và xử lý target**

#### Request

```json
{
  "resolutionNote": "Đã xác nhận nội dung vi phạm."
}
```

Validation: string, trim, bắt buộc, max 1000.

Luồng:

1. claim report `PENDING` trong transaction;
2. target `POST`: xử lý Post Group;
3. target `COMMENT`: soft-delete comment và xử lý report liên quan;
4. report → `RESOLVED`;
5. lưu `reviewedById`, `reviewedAt`, `resolutionNote`.

### M18 — POST /api/v1/moderator/reports/:reportId/reject

**Bác bỏ report**

```json
{
  "resolutionNote": "Không đủ căn cứ xác định vi phạm."
}
```

- string, trim, bắt buộc, max 1000.
- Report → `REJECTED`.
- Target không bị thay đổi.

## Bảng lỗi thường gặp

| Trường hợp                                                                                             |                      HTTP |
| ------------------------------------------------------------------------------------------------------ | ------------------------: |
| DTO/body/query không hợp lệ                                                                            |                       400 |
| Moderator cố lọc/xem `DRAFT`                                                                           | 400/404 tùy route/service |
| Approve/reject bằng translation ID hoặc sai state                                                      |                       400 |
| Category Group/language/translation không hợp lệ; xóa group/translation đang được PostCategory sử dụng |                       400 |
| Thiếu/sai JWT                                                                                          |                       401 |
| Sai role                                                                                               |                       403 |
| Không tìm thấy post/group/category/report/target                                                       |                       404 |
| Moderator khác đã claim/xử lý dữ liệu                                                                  |                       409 |
| LibreTranslate upstream lỗi khi preview category                                                       |                       502 |
| Dịch vụ/cấu hình dịch chưa sẵn sàng                                                                    |                       503 |
