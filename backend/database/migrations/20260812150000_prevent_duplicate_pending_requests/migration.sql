-- Create partial unique index to prevent duplicate PENDING blog owner requests per user
CREATE UNIQUE INDEX "blog_owner_requests_one_pending_per_user"
ON "blog_owner_requests" ("user_id")
WHERE "status" = 'PENDING';

-- Create partial unique index to prevent duplicate PENDING post reports per reporter
CREATE UNIQUE INDEX "reports_one_pending_post_per_reporter"
ON "reports" ("reporter_id", "post_id")
WHERE "status" = 'PENDING'
  AND "target_type" = 'POST'
  AND "post_id" IS NOT NULL;

-- Create partial unique index to prevent duplicate PENDING comment reports per reporter
CREATE UNIQUE INDEX "reports_one_pending_comment_per_reporter"
ON "reports" ("reporter_id", "comment_id")
WHERE "status" = 'PENDING'
  AND "target_type" = 'COMMENT'
  AND "comment_id" IS NOT NULL;
