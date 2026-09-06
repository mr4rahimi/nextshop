-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "faq" JSONB;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "descriptionTop" TEXT,
ADD COLUMN     "faq" JSONB;
