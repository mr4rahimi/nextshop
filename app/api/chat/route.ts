/**
 * چت فروشگاه (مشتری) — docs/plans/storefront-chat.md
 *
 * جریان SSE با رویدادهای `{status}`، `{text}`، `{final, products}`، `{error}` و `[DONE]`.
 * `{text}` همان قالب قدیمی است؛ `{final}` متن پاک‌شده را جایگزین می‌کند و کارت محصول می‌دهد.
 *
 * ⚠️ مسیر عمومی است و هر پیام هزینه‌ی مدل دارد: سقف طول پیام، سقف تاریخچه و محدودیت
 *    نرخ برای هر نشست و هر IP. خطای قابل‌نمایش با ۲۰۰ و رویداد `error` می‌رود چون CDN
 *    بدنه‌ی ۴xx را عوض می‌کند.
 */
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateConversation, saveMessage } from "@/lib/chat-history";
import { getAuthUser } from "@/lib/auth";
import { runShopChatTurn, type ShopChatEvent } from "@/lib/shop-chat/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Message = { role: "user" | "assistant"; content: string };

type FlowContext =
  | { kind: "category"; slug: string }
  | { kind: "topic"; topic: string }
  | { kind: "free" }
  | null;

const HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_CHARS = 2000;
const KEEPALIVE_MS = 15_000;

// ─── محدودیت نرخ (حافظه‌ی همین پروسه؛ برای جلوگیری از سوءمصرف کافی است) ────────
const WINDOW_MS = 10 * 60_000;
const LIMITS = { session: 30, ip: 120 };
const hits = new Map<string, number[]>();

function limited(key: string, max: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

const TOPIC_HINTS: Record<string, string> = {
  warranty: "مشتری از دکمه‌ی «گارانتی» آمده؛ اگر کالای مشخصی در گفتگو هست گارانتی همان کالا را بگو (get_product)، وگرنه بپرس کدام کالا.",
  shipping: "مشتری از دکمه‌ی «ارسال» آمده؛ روش‌ها و هزینه‌ی ارسال را از store_info بگو.",
  contact: "مشتری راه تماس می‌خواهد؛ از store_info بگو.",
  address: "مشتری آدرس و ساعت کاری می‌خواهد؛ از store_info بگو.",
  about: "مشتری درباره‌ی فروشگاه می‌پرسد.",
};

function flowHint(ctx: FlowContext): { hint: string | null; label: string } {
  if (ctx?.kind === "category") {
    return { hint: `مشتری دسته‌ی «${ctx.slug}» را از منوی چت انتخاب کرده؛ جستجو را با همین دسته شروع کن ولی اگر چیز دیگری خواست محدودش نکن.`, label: `category:${ctx.slug}` };
  }
  if (ctx?.kind === "topic") return { hint: TOPIC_HINTS[ctx.topic] ?? null, label: `topic:${ctx.topic}` };
  return { hint: null, label: ctx?.kind === "free" ? "free" : "menu" };
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("ar-real-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const sseHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function oneShot(payload: Record<string, unknown>, extra: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`));
      c.close();
    },
  });
  return new NextResponse(stream, { headers: { ...sseHeaders, ...extra } });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? (body.messages as Message[]) : [];
  const all = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));
  const last = all[all.length - 1];
  if (!last || last.role !== "user") {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }
  const message = last.content.trim().slice(0, MAX_MESSAGE_CHARS);
  const history = all.slice(0, -1).slice(-HISTORY_MESSAGES);

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 80) : null;
  const incomingConvId = typeof body.conversationId === "string" ? body.conversationId : null;
  const siteId = typeof body.siteId === "string" ? body.siteId.slice(0, 120) : null;
  const pagePath = typeof body.pagePath === "string" ? body.pagePath.slice(0, 300) : null;
  const { hint, label } = flowHint((body.context as FlowContext) ?? null);

  const ip = clientIp(req);
  if (limited(`ip:${ip}`, LIMITS.ip) || limited(`s:${sessionId ?? incomingConvId ?? ip}`, LIMITS.session)) {
    return oneShot({ error: "تعداد پیام‌ها زیاد شد؛ چند دقیقه‌ی دیگر دوباره بپرسید یا از «درخواست تماس کارشناس» استفاده کنید." });
  }

  const user = await getAuthUser();
  const conversationId = await getOrCreateConversation({
    conversationId: incomingConvId,
    userId: user?.id ?? null,
    sessionId,
    siteId,
  });
  await saveMessage({ conversationId, role: "user", content: message, context: label });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false; // مرورگر رفت؛ نوبت ادامه می‌یابد و پاسخ ذخیره می‌شود
        }
      };
      const keepalive = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);
      const emit = (e: ShopChatEvent) => {
        const payload =
          e.type === "delta" ? { text: e.text } :
          e.type === "status" ? { status: e.label } :
          e.type === "final" ? { final: e.text, products: e.products } :
          { error: e.message };
        send(`data: ${JSON.stringify(payload)}\n\n`);
      };

      try {
        const answer = await runShopChatTurn({ history, message, pagePath, hint }, emit);
        if (answer) await saveMessage({ conversationId, role: "assistant", content: answer, context: label }).catch(() => {});
      } finally {
        clearInterval(keepalive);
        send("data: [DONE]\n\n");
        if (open) controller.close();
      }
    },
  });

  return new NextResponse(stream, { headers: { ...sseHeaders, "X-Conversation-Id": conversationId } });
}
