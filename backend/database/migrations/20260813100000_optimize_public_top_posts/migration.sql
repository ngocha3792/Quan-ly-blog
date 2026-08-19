-- =====================================================
-- Public Top Posts Ranking
-- =====================================================

-- Query không filter language:
--
-- WHERE status = 'PUBLISH'
--   AND deleted_at IS NULL
--   AND COALESCE(published_at, created_at) >= ...
--
CREATE INDEX
  "posts_public_ranking_recent_idx"
ON "posts" (
  (
    COALESCE(
      "published_at",
      "created_at"
    )
  ) DESC,
  "id" DESC
)
WHERE
  "status" = 'PUBLISH'
  AND "deleted_at" IS NULL;


-- Query có filter language:
--
-- WHERE language_id = ?
--   AND status = 'PUBLISH'
--   AND deleted_at IS NULL
--   AND COALESCE(...) >= ...
--
CREATE INDEX
  "posts_public_ranking_recent_language_idx"
ON "posts" (
  "language_id",
  (
    COALESCE(
      "published_at",
      "created_at"
    )
  ) DESC,
  "id" DESC
)
WHERE
  "status" = 'PUBLISH'
  AND "deleted_at" IS NULL;
