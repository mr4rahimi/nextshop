-- CreateTable
CREATE TABLE "DemoLead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "visits" INTEGER NOT NULL DEFAULT 1,
    "ip" TEXT,
    "userAgent" TEXT,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoLead_phone_key" ON "DemoLead"("phone");

-- CreateIndex
CREATE INDEX "DemoLead_lastAt_idx" ON "DemoLead"("lastAt");
