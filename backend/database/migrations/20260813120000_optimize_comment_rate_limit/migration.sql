CREATE INDEX
  "comments_user_created_at_idx"
ON "comments" (
  "user_id",
  "created_at"
);
