-- Root comments của một bài.
CREATE INDEX
  "comments_public_roots_idx"
ON "comments" (
  "post_id",
  "created_at" DESC,
  "id" DESC
)
WHERE
  "parent_id" IS NULL
  AND "deleted_at" IS NULL;


-- Cursor pagination cho replies.
CREATE INDEX
  "comments_public_replies_idx"
ON "comments" (
  "parent_id",
  "id" ASC
)
WHERE
  "deleted_at" IS NULL;
