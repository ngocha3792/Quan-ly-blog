-- CreateTable
CREATE TABLE "search_documents" (
    "post_id" INTEGER NOT NULL,
    "language_id" INTEGER NOT NULL,
    "status" "PostStatus" NOT NULL,
    "title_text" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,
    "source_updated_at" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("post_id")
);

-- CreateIndex
CREATE INDEX "search_documents_language_id_status_idx" ON "search_documents"("language_id", "status");

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Search 2.0 (Giai đoạn 0 + 1) — cột tsvector GENERATED ALWAYS ... STORED.
--
-- Title được weight 'A' (cao hơn), content weight 'B'.
-- Dùng config 'simple' (không stemming) vì corpus đa ngôn ngữ vi/en/zh/ja —
-- stemmer tiếng Anh sẽ phá từ tiếng Việt. Hạn chế đã biết: 'simple' tokenize
-- theo whitespace nên tiếng Trung/Nhật (không có khoảng trắng) sẽ có chất
-- lượng tách từ yếu hơn vi/en; đây là giới hạn của chính PostgreSQL FTS,
-- sẽ được cải thiện ở giai đoạn tokenizer theo ngôn ngữ sau (roadmap mục 7.2).
ALTER TABLE "search_documents"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title_text", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("content_text", '')), 'B')
  ) STORED;

-- GIN index cho truy vấn full-text search (sd.search_vector @@ query).
CREATE INDEX "search_documents_search_vector_idx" ON "search_documents" USING GIN ("search_vector");

-- Index phục vụ reconciliation job quét bài PUBLISH gần nhất theo ngôn ngữ.
CREATE INDEX "search_documents_public_indexed_idx" ON "search_documents" ("language_id", "indexed_at" DESC) WHERE "status" = 'PUBLISH';
