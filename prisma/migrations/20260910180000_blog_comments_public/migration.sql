-- نظرات مقاله: مهمان‌پذیر، پاسخ‌دار، با رأی مفید بودن

ALTER TABLE "BlogComment"
  ADD COLUMN IF NOT EXISTS "email"        TEXT,
  ADD COLUMN IF NOT EXISTS "isStaffReply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "helpfulYes"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "helpfulNo"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ip"           TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent"    TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- پاسخ‌هایی که تا امروز ثبت شده‌اند همه از سمت فروشگاه بوده‌اند؛ رابط کاربری
-- هم همه را «پاسخ ادمین» نشان می‌داد. همان معنا حفظ می‌شود.
UPDATE "BlogComment" SET "isStaffReply" = true WHERE "parentId" IS NOT NULL;

-- با حذف کاربر نظرش باقی می‌ماند، و با حذف نظرِ والد پاسخ‌هایش هم می‌روند
ALTER TABLE "BlogComment" DROP CONSTRAINT IF EXISTS "BlogComment_userId_fkey";
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BlogComment" DROP CONSTRAINT IF EXISTS "BlogComment_parentId_fkey";
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "BlogComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "BlogComment_parentId_idx" ON "BlogComment"("parentId");
CREATE INDEX IF NOT EXISTS "BlogComment_postId_status_createdAt_idx" ON "BlogComment"("postId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "BlogCommentVote" (
    "id"        TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "voterKey"  TEXT NOT NULL,
    "helpful"   BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogCommentVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BlogCommentVote_commentId_voterKey_key" ON "BlogCommentVote"("commentId", "voterKey");
CREATE INDEX IF NOT EXISTS "BlogCommentVote_commentId_idx" ON "BlogCommentVote"("commentId");

ALTER TABLE "BlogCommentVote" ADD CONSTRAINT "BlogCommentVote_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "BlogComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
