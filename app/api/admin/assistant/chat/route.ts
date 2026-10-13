import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { runAssistantTurn, type AssistantEvent } from "@/lib/assistant/chat";
import { KEEPALIVE_MS, MAX_MESSAGE_CHARS } from "@/lib/assistant/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * یک نوبت گفتگو، جریانی (SSE) — docs/plans/admin-assistant.md
 *
 * هر کارمند پنل می‌تواند بپرسد (تصمیم ۱)؛ مرز داده در ابزارهاست و روشن/خاموش هر نفر سهمیه‌ی اوست.
 *
 * ⚠️ خطای پیش از جریان با ۲۰۰ و `ok:false` برمی‌گردد: CDN بدنه‌ی ۴xx را عوض می‌کند.
 * ⚠️ `X-Accel-Buffering: no` و `: keepalive` هر ۱۵ ثانیه، وگرنه nginx پاسخ را یکجا می‌دهد یا
 * فکر کردن طولانی مدل به سقف ۶۰ ثانیه می‌خورد. بستن پنل جریان را قطع می‌کند ولی نوبت روی
 * سرور تمام و ذخیره می‌شود.
 */
export async function POST(req: Request) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ ok: false, error: "وارد نشده‌اید" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { message?: unknown; conversationId?: unknown; pagePath?: unknown }
    | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false, error: "پیام خالی است" });
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ ok: false, error: `پیام حداکثر ${MAX_MESSAGE_CHARS.toLocaleString("fa-IR")} نویسه است` });
  }
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;
  const pagePath =
    typeof body?.pagePath === "string" && body.pagePath.startsWith("/admin") ? body.pagePath.slice(0, 300) : undefined;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // کاربر پنل را بست — نوبت ادامه پیدا می‌کند و ذخیره می‌شود
          closed = true;
        }
      };
      const emit = (event: AssistantEvent) => write(`data: ${JSON.stringify(event)}\n\n`);
      const keepalive = setInterval(() => write(": keepalive\n\n"), KEEPALIVE_MS);
      try {
        await runAssistantTurn({ access, message, conversationId, pagePath }, emit);
      } catch (error) {
        console.error("[assistant] خطای پیش‌بینی‌نشده", error);
        emit({ type: "error", message: "خطای داخلی؛ دوباره بپرسید" });
      } finally {
        clearInterval(keepalive);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // بسته بود
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
