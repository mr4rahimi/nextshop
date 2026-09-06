-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "channel" "ClubChannel" NOT NULL DEFAULT 'SMS',
ADD COLUMN     "destination" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "channelPriority" JSONB NOT NULL DEFAULT '["SMS"]',
ADD COLUMN     "pointOnBirthday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointOnReferee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointOnReferrer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointOnReview" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointOnSignup" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointRedeemEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointRedeemMaxPct" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "pointRedeemMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointRedeemRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ClubChannelIdentity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "channel" "ClubChannel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "meta" JSONB,

    CONSTRAINT "ClubChannelIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateChannelBody" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "channel" "ClubChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "extra" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateChannelBody_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubChannelIdentity_profileId_channel_idx" ON "ClubChannelIdentity"("profileId", "channel");

-- CreateIndex
CREATE INDEX "ClubChannelIdentity_channel_isActive_idx" ON "ClubChannelIdentity"("channel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClubChannelIdentity_channel_externalId_key" ON "ClubChannelIdentity"("channel", "externalId");

-- CreateIndex
CREATE INDEX "TemplateChannelBody_channel_idx" ON "TemplateChannelBody"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateChannelBody_templateId_channel_key" ON "TemplateChannelBody"("templateId", "channel");

-- CreateIndex
CREATE INDEX "SmsMessage_channel_status_idx" ON "SmsMessage"("channel", "status");

-- AddForeignKey
ALTER TABLE "ClubChannelIdentity" ADD CONSTRAINT "ClubChannelIdentity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateChannelBody" ADD CONSTRAINT "TemplateChannelBody_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SmsTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
