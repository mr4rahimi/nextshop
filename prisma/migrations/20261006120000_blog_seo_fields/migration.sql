-- کلمه‌ی کلیدی اصلی، canonical دلخواه و noindex برای مقاله‌ها (۲.۷۱.۰)
ALTER TABLE "BlogPost" ADD COLUMN "focusKeyword" TEXT,
ADD COLUMN "canonicalUrl" TEXT,
ADD COLUMN "noIndex" BOOLEAN NOT NULL DEFAULT false;
