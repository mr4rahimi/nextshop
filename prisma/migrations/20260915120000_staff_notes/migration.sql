-- یادداشت‌های شخصی کارتابل

CREATE TABLE "StaffNote" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "title"     TEXT NOT NULL DEFAULT '',
  "body"      TEXT NOT NULL DEFAULT '',
  "color"     TEXT NOT NULL DEFAULT 'default',
  "pinned"    BOOLEAN NOT NULL DEFAULT false,
  "archived"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffNote_userId_archived_pinned_updatedAt_idx"
  ON "StaffNote" ("userId", "archived", "pinned", "updatedAt");

ALTER TABLE "StaffNote"
  ADD CONSTRAINT "StaffNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
