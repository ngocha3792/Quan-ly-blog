-- =====================================================
-- Moderator CategoryGroup hard-delete cleanup
-- =====================================================
--
-- Before this change, deleting a CategoryGroup used soft-delete.
-- Legacy rows with deleted_at IS NOT NULL still kept unique code/name
-- values and prevented Moderator from recreating deleted categories.
--
-- Only purge legacy soft-deleted groups that are NOT referenced by
-- any PostCategory through any Category belonging to the group.

DELETE FROM "categories" AS category
USING "category_groups" AS category_group
WHERE
  category."category_group_id" = category_group."id"
  AND category_group."deleted_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "post_categories" AS post_category
    INNER JOIN "categories" AS used_category
      ON used_category."id" = post_category."category_id"
    WHERE used_category."category_group_id" = category_group."id"
  );

DELETE FROM "category_groups" AS category_group
WHERE
  category_group."deleted_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "categories" AS category
    WHERE category."category_group_id" = category_group."id"
  );
