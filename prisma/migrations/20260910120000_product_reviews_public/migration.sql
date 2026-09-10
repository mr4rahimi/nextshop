-- نظرات محصول: مهمان‌پذیر، نیازمند تأیید، با پاسخ فروشگاه و رأی مفید بودن

-- ۱) محدودیت یکتای قدیمی برداشته می‌شود؛ مهمان کلیدی برای یکتا شدن ندارد
DROP INDEX IF EXISTS "Review_productId_userId_key";

-- ۲) userId اختیاری می‌شود و با حذف کاربر، نظر باقی می‌ماند
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_userId_fkey";
ALTER TABLE "Review" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ۳) ستون‌های تازه
ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "guestName"  TEXT,
  ADD COLUMN IF NOT EXISTS "guestEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "pros"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cons"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "recommends" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "isBuyer"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status"     "CommentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "helpfulYes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "helpfulNo"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "replyBody"  TEXT,
  ADD COLUMN IF NOT EXISTS "replyAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replyById"  TEXT,
  ADD COLUMN IF NOT EXISTS "ip"         TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent"  TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ۴) نظرهای تأییدشده‌ی قبلی وضعیت درست بگیرند، بقیه در انتظار بمانند
UPDATE "Review" SET "status" = 'APPROVED' WHERE "isApproved" = true;

ALTER TABLE "Review" DROP COLUMN IF EXISTS "isApproved";

ALTER TABLE "Review" ADD CONSTRAINT "Review_replyById_fkey"
  FOREIGN KEY ("replyById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Review_isApproved_idx";
CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review"("status");
CREATE INDEX IF NOT EXISTS "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

-- ۵) رأی «مفید بود»
CREATE TABLE IF NOT EXISTS "ReviewVote" (
    "id"        TEXT NOT NULL,
    "reviewId"  TEXT NOT NULL,
    "voterKey"  TEXT NOT NULL,
    "helpful"   BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewVote_reviewId_voterKey_key" ON "ReviewVote"("reviewId", "voterKey");
CREATE INDEX IF NOT EXISTS "ReviewVote_reviewId_idx" ON "ReviewVote"("reviewId");

ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
