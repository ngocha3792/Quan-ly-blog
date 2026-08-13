-- =====================================================
-- Normalize legacy data
-- =====================================================

-- Language đã soft-delete không được giữ default.
UPDATE "languages"
SET "is_default" = false
WHERE "deleted_at" IS NOT NULL
  AND "is_default" = true;


-- Default language phải active.
UPDATE "languages"
SET "is_active" = true
WHERE "deleted_at" IS NULL
  AND "is_default" = true;


-- =====================================================
-- Fix trường hợp DB cũ có > 1 default
-- =====================================================

-- Giữ language default có id nhỏ nhất.
WITH ranked_defaults AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      ORDER BY "id" ASC
    ) AS rn
  FROM "languages"
  WHERE "deleted_at" IS NULL
    AND "is_default" = true
)

UPDATE "languages" AS l
SET "is_default" = false
FROM ranked_defaults AS r
WHERE l."id" = r."id"
  AND r.rn > 1;


-- =====================================================
-- Fix trường hợp có language nhưng không có default
-- =====================================================

-- Ưu tiên:
-- 1. language đang active
-- 2. id nhỏ nhất
--
-- Nếu tất cả đang inactive thì language được chọn
-- sẽ được activate.

WITH candidate AS (
  SELECT "id"
  FROM "languages"
  WHERE "deleted_at" IS NULL
  ORDER BY
    "is_active" DESC,
    "id" ASC
  LIMIT 1
),

missing_default AS (
  SELECT NOT EXISTS (
    SELECT 1
    FROM "languages"
    WHERE "deleted_at" IS NULL
      AND "is_default" = true
  ) AS missing
)

UPDATE "languages" AS l
SET
  "is_default" = true,
  "is_active" = true
FROM candidate, missing_default
WHERE l."id" = candidate."id"
  AND missing_default.missing = true;


-- =====================================================
-- DB invariant #1
-- Tối đa một non-deleted language được default
-- =====================================================

CREATE UNIQUE INDEX "languages_one_default"
ON "languages" ("is_default")
WHERE "is_default" = true
  AND "deleted_at" IS NULL;


-- =====================================================
-- DB invariant #2
-- Default language:
-- - phải active
-- - không được soft-delete
-- =====================================================

ALTER TABLE "languages"
ADD CONSTRAINT
  "languages_default_must_be_active_and_not_deleted"
CHECK (
  "is_default" = false
  OR (
    "is_active" = true
    AND "deleted_at" IS NULL
  )
);
