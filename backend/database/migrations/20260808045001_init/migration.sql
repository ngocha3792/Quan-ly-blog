/*
  Warnings:

  - A unique constraint covering the columns `[category_group_id,language_id]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[parent_post_id,language_id]` on the table `posts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category_group_id` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "category_group_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "languages" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "public_id" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- DropEnum
DROP TYPE "ModerationAction";

-- CreateTable
CREATE TABLE "category_groups" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "category_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_groups_code_key" ON "category_groups"("code");

-- CreateIndex
CREATE INDEX "categories_category_group_id_idx" ON "categories"("category_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_category_group_id_language_id_key" ON "categories"("category_group_id", "language_id");

-- CreateIndex
CREATE UNIQUE INDEX "posts_parent_post_id_language_id_key" ON "posts"("parent_post_id", "language_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_category_group_id_fkey" FOREIGN KEY ("category_group_id") REFERENCES "category_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
