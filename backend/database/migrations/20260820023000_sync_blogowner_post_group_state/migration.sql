-- =====================================================
-- BlogOwner group state cleanup
-- One logical article = root post + active translations
-- =====================================================

-- 1. Root cũ đã soft-delete thì translation còn active
-- cũng phải soft-delete theo.
UPDATE "posts" AS translation
SET
  "deleted_at" = root."deleted_at",
  "updated_at" = CURRENT_TIMESTAMP
FROM "posts" AS root
WHERE
  translation."parent_post_id" = root."id"
  AND root."parent_post_id" IS NULL
  AND root."deleted_at" IS NOT NULL
  AND translation."deleted_at" IS NULL;


-- 2. Đồng bộ trạng thái/review của translation theo root.
UPDATE "posts" AS translation
SET
  "status" = root."status",

  "reviewed_by" =
    root."reviewed_by",

  "reviewed_at" =
    root."reviewed_at",

  "rejection_reason" =
    root."rejection_reason",

  "published_at" =
    CASE
      WHEN
        root."status" =
        'PUBLISH'::"PostStatus"
      THEN
        COALESCE(
          translation."published_at",
          root."published_at",
          root."created_at"
        )

      ELSE
        translation."published_at"
    END,

  "updated_at" =
    CURRENT_TIMESTAMP

FROM "posts" AS root

WHERE
  translation."parent_post_id" =
    root."id"

  AND root."parent_post_id"
    IS NULL

  AND root."deleted_at"
    IS NULL

  AND translation."deleted_at"
    IS NULL

  AND (
    translation."status"
      IS DISTINCT FROM
      root."status"

    OR

    translation."reviewed_by"
      IS DISTINCT FROM
      root."reviewed_by"

    OR

    translation."reviewed_at"
      IS DISTINCT FROM
      root."reviewed_at"

    OR

    translation."rejection_reason"
      IS DISTINCT FROM
      root."rejection_reason"

    OR (
      root."status" =
        'PUBLISH'::"PostStatus"

      AND
        translation."published_at"
        IS NULL
    )
  );