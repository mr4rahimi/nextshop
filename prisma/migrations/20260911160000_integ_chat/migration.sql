-- گفت‌وگوهای بازارگاه (فاز اول: باسلام) — docs/plans/basalam-chat.md

ALTER TYPE "IntegJobType" ADD VALUE IF NOT EXISTS 'FETCH_CHATS';
ALTER TYPE "IntegJobType" ADD VALUE IF NOT EXISTS 'SEND_MESSAGE';
ALTER TYPE "IntegEntityType" ADD VALUE IF NOT EXISTS 'CHAT';

CREATE TABLE "IntegChat" (
  "id"                TEXT NOT NULL,
  "platformCode"      TEXT NOT NULL,
  "externalId"        TEXT NOT NULL,
  "chatType"          TEXT NOT NULL DEFAULT 'private',
  "contactId"         TEXT,
  "contactName"       TEXT,
  "contactAvatar"     TEXT,
  "unseenCount"       INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt"     TIMESTAMP(3),
  "lastMessageText"   TEXT,
  "externalUpdatedAt" TIMESTAMP(3),
  "lastFetchedMsgId"  TEXT,
  "raw"               JSONB NOT NULL DEFAULT '{}',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegChat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegChat_platformCode_externalId_key" ON "IntegChat" ("platformCode", "externalId");
CREATE INDEX "IntegChat_platformCode_lastMessageAt_idx" ON "IntegChat" ("platformCode", "lastMessageAt");
CREATE INDEX "IntegChat_chatType_idx" ON "IntegChat" ("chatType");

ALTER TABLE "IntegChat"
  ADD CONSTRAINT "IntegChat_platformCode_fkey"
  FOREIGN KEY ("platformCode") REFERENCES "IntegPlatform"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "IntegChatMessage" (
  "id"          TEXT NOT NULL,
  "chatId"      TEXT NOT NULL,
  "externalId"  TEXT,
  "direction"   TEXT NOT NULL,
  "senderId"    TEXT,
  "senderName"  TEXT,
  "messageType" TEXT NOT NULL DEFAULT 'text',
  "text"        TEXT,
  "files"       JSONB NOT NULL DEFAULT '[]',
  "seenAt"      TIMESTAMP(3),
  "sentAt"      TIMESTAMP(3) NOT NULL,
  "sendStatus"  TEXT NOT NULL DEFAULT 'SYNCED',
  "sendError"   TEXT,
  "raw"         JSONB NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegChatMessage_chatId_externalId_key" ON "IntegChatMessage" ("chatId", "externalId");
CREATE INDEX "IntegChatMessage_chatId_sentAt_idx" ON "IntegChatMessage" ("chatId", "sentAt");
CREATE INDEX "IntegChatMessage_sendStatus_idx" ON "IntegChatMessage" ("sendStatus");

ALTER TABLE "IntegChatMessage"
  ADD CONSTRAINT "IntegChatMessage_chatId_fkey"
  FOREIGN KEY ("chatId") REFERENCES "IntegChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
