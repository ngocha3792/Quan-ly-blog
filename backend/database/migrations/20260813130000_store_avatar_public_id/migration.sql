ALTER TABLE "users"
ADD COLUMN "avatar_public_id" VARCHAR(255);


-- Backfill các avatar Cloudinary cũ.
--
-- Ví dụ:
--
-- https://res.cloudinary.com/demo/image/upload/v1234/nestjs_blog/users/1/avatar/abc.jpg
--
-- =>
--
-- nestjs_blog/users/1/avatar/abc
--
-- Đây chỉ là migration legacy một lần.
-- Runtime sau migration KHÔNG parse URL nữa.
UPDATE "users"
SET "avatar_public_id" =
  regexp_replace(
    regexp_replace(
      split_part(
        "avatar_url",
        '/upload/',
        2
      ),
      '^v[0-9]+/',
      ''
    ),
    '\.[^./]+$',
    ''
  )
WHERE
  "avatar_url" IS NOT NULL
  AND "avatar_url" LIKE '%res.cloudinary.com%/upload/%';
