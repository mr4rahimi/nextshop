import { prisma } from "@/lib/prisma";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import { writeLog } from "./log";

// گفت‌وگوهای بازارگاه — کشیدن دوره‌ای و ارسال پاسخ.
// نقشه راه: docs/plans/basalam-chat.md

/** بار اول فقط این‌قدر از تاریخچه کشیده می‌شود. */
const INITIAL_WINDOW_MS = 30 * 24 * 60 * 60_000;

/** سقف پیام در هر گفت‌وگو در یک دور — جلوی کشیدن تاریخچه چندهزارتایی را می‌گیرد. */
const MAX_MESSAGES_PER_CHAT = 200;

/** سقف گفت‌وگوهایی که در یک دور پیام‌هایشان کشیده می‌شود. */
const MAX_CHATS_PER_CYCLE = 50;

/**
 * شناسه پیام‌های باسلام عددی و صعودی است ولی به‌صورت رشته ذخیره می‌شود.
 * مقایسه رشته‌ای «۹» را از «۱۰» بزرگ‌تر می‌داند، پس عددی مقایسه می‌کنیم.
 */
function maxMessageId(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na >= nb ? a : b;
  return a >= b ? a : b;
}

export interface FetchChatsSummary {
  chats:       number;
  newMessages: number;
}

export async function fetchAndStoreChats(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
): Promise<FetchChatsSummary> {
  if (!adapter.fetchChats || !adapter.fetchMessages) {
    throw new Error(`${platformCode} از گفت‌وگو پشتیبانی نمی‌کند`);
  }

  const selfId = adapter.resolveSelfId ? await adapter.resolveSelfId(credentials) : null;

  // مکان‌نما: تازه‌ترین updated_at که تا الان دیده‌ایم. اگر هیچ‌چیز نداریم،
  // پنجره اولیه اعمال می‌شود تا اولین اجرا کل تاریخچه غرفه را نکشد.
  const cursorRow = await prisma.integChat.aggregate({
    where: { platformCode },
    _max:  { externalUpdatedAt: true },
  });
  const updatedFrom = cursorRow._max.externalUpdatedAt
    ?? new Date(Date.now() - INITIAL_WINDOW_MS);

  const { chats } = await adapter.fetchChats(credentials, { updatedFrom, limit: 100 });

  let newMessages = 0;
  let touchedChats = 0;

  for (const info of chats.slice(0, MAX_CHATS_PER_CYCLE)) {
    const existing = await prisma.integChat.findUnique({
      where:  { platformCode_externalId: { platformCode, externalId: info.externalId } },
      select: { id: true, lastFetchedMsgId: true },
    });

    const chat = await prisma.integChat.upsert({
      where:  { platformCode_externalId: { platformCode, externalId: info.externalId } },
      create: {
        platformCode,
        externalId:        info.externalId,
        chatType:          info.chatType,
        contactId:         info.contactId ?? null,
        contactName:       info.contactName ?? null,
        contactAvatar:     info.contactAvatar ?? null,
        unseenCount:       info.unseenCount,
        lastMessageAt:     info.lastMessageAt ?? null,
        lastMessageText:   info.lastMessageText ?? null,
        externalUpdatedAt: info.updatedAt ?? null,
        raw:               info.raw as never,
      },
      update: {
        chatType:          info.chatType,
        contactId:         info.contactId ?? null,
        contactName:       info.contactName ?? null,
        contactAvatar:     info.contactAvatar ?? null,
        unseenCount:       info.unseenCount,
        lastMessageAt:     info.lastMessageAt ?? null,
        lastMessageText:   info.lastMessageText ?? null,
        externalUpdatedAt: info.updatedAt ?? null,
        raw:               info.raw as never,
      },
      select: { id: true },
    });

    touchedChats++;

    const { messages } = await adapter.fetchMessages(credentials, {
      chatId:         info.externalId,
      sinceMessageId: existing?.lastFetchedMsgId ?? null,
      limit:          MAX_MESSAGES_PER_CHAT,
    });

    let highest = existing?.lastFetchedMsgId ?? null;

    for (const msg of messages) {
      highest = maxMessageId(highest, msg.externalId);

      // پیام خروجی‌ای که خودمان از پنل فرستادیم، وقتی از باسلام برمی‌گردد
      // نباید ردیف دوم بسازد — کلید یکتای (chatId, externalId) همین را تضمین می‌کند.
      await prisma.integChatMessage.upsert({
        where:  { chatId_externalId: { chatId: chat.id, externalId: msg.externalId } },
        create: {
          chatId:      chat.id,
          externalId:  msg.externalId,
          direction:   selfId && msg.senderId === selfId ? "OUT" : "IN",
          senderId:    msg.senderId ?? null,
          senderName:  msg.senderName ?? null,
          messageType: msg.messageType,
          text:        msg.text ?? null,
          files:       msg.files as never,
          seenAt:      msg.seenAt ?? null,
          sentAt:      msg.sentAt,
          sendStatus:  "SYNCED",
          raw:         msg.raw as never,
        },
        update: {
          seenAt: msg.seenAt ?? null,
          text:   msg.text ?? null,
          files:  msg.files as never,
        },
        select: { id: true },
      });

      // شمارش از روی چیزی که پلتفرم برگرداند: sinceMessageId تکراری‌ها را
      // از قبل کنار گذاشته، پس هر پیام این حلقه یک پیام تازه است.
      newMessages++;
    }

    if (highest && highest !== existing?.lastFetchedMsgId) {
      await prisma.integChat.update({
        where: { id: chat.id },
        data:  { lastFetchedMsgId: highest },
      });
    }
  }

  await writeLog({
    jobId,
    platformCode,
    operationType: "FETCH_CHATS",
    direction:     "INBOUND",
    entityType:    "CHAT",
    status:        "SUCCESS",
    responseData:  { chats: touchedChats, newMessages },
  }).catch(() => {});

  return { chats: touchedChats, newMessages };
}

/**
 * ارسال یک پیام خروجیِ در انتظار. ردیف پیام از قبل با sendStatus = PENDING
 * ساخته شده تا ادمین بلافاصله آن را در رشته گفت‌وگو ببیند.
 */
export async function sendPendingMessage(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
  messageId: string,
): Promise<void> {
  if (!adapter.sendMessage) {
    throw new Error(`${platformCode} از ارسال پیام پشتیبانی نمی‌کند`);
  }

  const row = await prisma.integChatMessage.findUnique({
    where:   { id: messageId },
    include: { chat: { select: { externalId: true, platformCode: true } } },
  });
  if (!row) throw new Error("پیام پیدا نشد");
  if (row.sendStatus === "SENT" || row.sendStatus === "SYNCED") return;

  try {
    const result = await adapter.sendMessage(credentials, {
      chatId: row.chat.externalId,
      text:   row.text ?? "",
    });

    await prisma.integChatMessage.update({
      where: { id: row.id },
      data:  {
        externalId: result.externalId,
        sentAt:     result.sentAt,
        sendStatus: "SENT",
        sendError:  null,
      },
    });

    await prisma.integChat.update({
      where: { id: row.chatId },
      data:  { lastMessageAt: result.sentAt, lastMessageText: row.text },
    });

    await writeLog({
      jobId,
      platformCode,
      operationType: "SEND_MESSAGE",
      direction:     "OUTBOUND",
      entityType:    "CHAT",
      entityId:      row.chatId,
      status:        "SUCCESS",
    }).catch(() => {});
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.integChatMessage.update({
      where: { id: row.id },
      data:  { sendStatus: "FAILED", sendError: error },
    });
    throw err;
  }
}
