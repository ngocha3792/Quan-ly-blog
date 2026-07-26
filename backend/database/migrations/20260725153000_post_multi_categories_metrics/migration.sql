BEGIN;

-- ======================================================
-- 1. Thêm thời điểm xuất bản lần đầu
-- ======================================================
ALTER TABLE "posts"
ADD COLUMN "published_at" TIMESTAMP(3);

-- Bài đã xuất bản từ trước:
-- ưu tiên thời điểm Moderator duyệt; nếu chưa có thì dùng thời điểm tạo.
UPDATE "posts"
SET "published_at" = COALESCE("reviewed_at", "created_at")
WHERE "status" = 'PUBLISH'
  AND "published_at" IS NULL;

-- ======================================================
-- 2. Tạo bảng nhiều-nhiều Post - Category
-- ======================================================
CREATE TABLE "post_categories" (
    "post_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "post_categories_pkey"
        PRIMARY KEY ("post_id", "category_id")
);

-- QUAN TRỌNG:
-- Chuyển danh mục cũ của từng bài sang bảng trung gian
-- trước khi xóa posts.category_id.
INSERT INTO "post_categories" ("post_id", "category_id")
SELECT "id", "category_id"
FROM "posts"
ON CONFLICT ("post_id", "category_id") DO NOTHING;

-- Dừng migration nếu có bài nào không chuyển được category.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "posts" p
        LEFT JOIN "post_categories" pc
          ON pc."post_id" = p."id"
         AND pc."category_id" = p."category_id"
        WHERE pc."post_id" IS NULL
    ) THEN
        RAISE EXCEPTION
          'Không thể chuyển toàn bộ posts.category_id sang post_categories';
    END IF;
END
$$;

CREATE INDEX "post_categories_category_id_idx"
ON "post_categories"("category_id");

ALTER TABLE "post_categories"
ADD CONSTRAINT "post_categories_post_id_fkey"
FOREIGN KEY ("post_id")
REFERENCES "posts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "post_categories"
ADD CONSTRAINT "post_categories_category_id_fkey"
FOREIGN KEY ("category_id")
REFERENCES "categories"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Sau khi dữ liệu đã được chuyển thành công mới xóa quan hệ cũ.
ALTER TABLE "posts"
DROP CONSTRAINT "posts_category_id_fkey";

DROP INDEX "posts_category_id_idx";

ALTER TABLE "posts"
DROP COLUMN "category_id";

-- ======================================================
-- 3. Thống kê tương tác theo ngày
-- ======================================================
CREATE TABLE "post_daily_metrics" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "metric_date" DATE NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_daily_metrics_pkey"
        PRIMARY KEY ("id")
);

CREATE INDEX "post_daily_metrics_metric_date_idx"
ON "post_daily_metrics"("metric_date");

CREATE UNIQUE INDEX "post_daily_metrics_post_id_metric_date_key"
ON "post_daily_metrics"("post_id", "metric_date");

ALTER TABLE "post_daily_metrics"
ADD CONSTRAINT "post_daily_metrics_post_id_fkey"
FOREIGN KEY ("post_id")
REFERENCES "posts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ======================================================
-- 4. Log lượt xem để giới hạn 1 view / 30 phút
-- ======================================================
CREATE TABLE "post_view_logs" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "viewer_key" VARCHAR(128) NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_view_logs_pkey"
        PRIMARY KEY ("id")
);

CREATE INDEX "post_view_logs_post_id_viewer_key_viewed_at_idx"
ON "post_view_logs"("post_id", "viewer_key", "viewed_at");

CREATE INDEX "post_view_logs_viewed_at_idx"
ON "post_view_logs"("viewed_at");

ALTER TABLE "post_view_logs"
ADD CONSTRAINT "post_view_logs_post_id_fkey"
FOREIGN KEY ("post_id")
REFERENCES "posts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ======================================================
-- 5. Index phục vụ public và dashboard
-- ======================================================
CREATE INDEX "posts_published_at_idx"
ON "posts"("published_at");

CREATE INDEX "posts_status_published_at_idx"
ON "posts"("status", "published_at");

COMMIT;