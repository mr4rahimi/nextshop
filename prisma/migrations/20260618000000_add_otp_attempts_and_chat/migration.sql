-- OtpCode: add attempts field
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

-- StoreSettings: add chatSettings field
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "chatSettings" JSONB;

-- ChatConversation table
CREATE TABLE IF NOT EXISTS "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatConversation_userId_idx" ON "ChatConversation"("userId");
CREATE INDEX IF NOT EXISTS "ChatConversation_sessionId_idx" ON "ChatConversation"("sessionId");
CREATE INDEX IF NOT EXISTS "ChatConversation_lastMessageAt_idx" ON "ChatConversation"("lastMessageAt");

-- ChatMessage table
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ChatMessage_conversationId_fkey'
    ) THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;