-- کاتالوگ محصولات در ربات بله — docs/features/bale-catalog.md
ALTER TABLE "StoreSettings" ADD COLUMN "baleCatalog" JSONB NOT NULL DEFAULT '{}';
