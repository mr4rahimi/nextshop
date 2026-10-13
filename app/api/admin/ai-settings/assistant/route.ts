import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { getAiSettings, GAPGPT_BASE_URL } from "@/lib/ai/settings";
import { logActivityAsync } from "@/lib/activity";
import {
  assistantUsageByStaff, getAssistantSetting, saveAssistantSetting, saveUserLimits,
} from "@/lib/assistant/store";
import { AiRequestError, streamChatCompletion } from "@/lib/assistant/ai-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تنظیمات راهنمای هوشمند — docs/plans/admin-assistant.md بخش ۷
 *
 * قفل همان «تنظیمات فروشگاه» است (`PANEL_SETTINGS`، تصمیم ۲). مدیر فقط شمارش و هزینه‌ی
 * هر کارمند را می‌بیند، نه متن گفتگو (تصمیم ۴).
 */
async function guard() {
  return requirePermission("PANEL_SETTINGS");
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status === 401 ? 401 : 200 });
  const [setting, usage] = await Promise.all([getAssistantSetting(), assistantUsageByStaff()]);
  return NextResponse.json({ ok: true, setting, ...usage });
}

export async function PUT(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status === 401 ? 401 : 200 });
  const body = (await req.json().catch(() => null)) as {
    setting?: { enabled?: unknown; model?: unknown; maxTokens?: unknown; dailyLimit?: unknown; extraGuide?: unknown };
    users?: { userId?: unknown; dailyLimit?: unknown }[];
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "درخواست نامعتبر" });

  if (body.setting) {
    const s = body.setting;
    await saveAssistantSetting(
      {
        enabled: s.enabled === true,
        model: typeof s.model === "string" ? s.model : "",
        maxTokens: Number(s.maxTokens) || 3000,
        dailyLimit: Number.isFinite(Number(s.dailyLimit)) ? Number(s.dailyLimit) : 30,
        extraGuide: typeof s.extraGuide === "string" ? s.extraGuide : "",
      },
      g.access.name,
    );
  }
  if (Array.isArray(body.users)) {
    const rows = body.users
      .filter((u) => typeof u?.userId === "string")
      .map((u) => ({
        userId: u.userId as string,
        dailyLimit: u.dailyLimit === null || u.dailyLimit === "" || u.dailyLimit === undefined ? null : Number(u.dailyLimit),
      }))
      .filter((u) => u.dailyLimit === null || Number.isFinite(u.dailyLimit));
    await saveUserLimits(rows);
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "assistant",
    entityTitle: "راهنمای هوشمند",
    summary: body.setting
      ? `راهنمای هوشمند ${body.setting.enabled === true ? "روشن" : "خاموش"}، مدل ${String(body.setting.model ?? "")}`
      : "تغییر سقف پرسش کارمندان",
  });

  const [setting, usage] = await Promise.all([getAssistantSetting(), assistantUsageByStaff()]);
  return NextResponse.json({ ok: true, setting, ...usage });
}

/**
 * تست: یک فراخوانی ابزار واقعی با مدل انتخاب‌شده. مدلی که پیام ساده را جواب می‌دهد ولی
 * `tool_calls` را خراب می‌فرستد فقط همین‌جا پیدا می‌شود (بخش ۱۲ سند).
 */
export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status === 401 ? 401 : 200 });
  const body = (await req.json().catch(() => null)) as { model?: unknown } | null;
  const [ai, setting] = await Promise.all([getAiSettings(), getAssistantSetting()]);
  if (!ai.apiKey) return NextResponse.json({ ok: false, error: "کلید هوش مصنوعی ثبت نشده است" });
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : setting.model;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const result = await streamChatCompletion({
      baseUrl: GAPGPT_BASE_URL,
      apiKey: ai.apiKey,
      model,
      messages: [
        { role: "system", content: "برای دانستن تعداد سفارش‌ها فقط از ابزار استفاده کن." },
        { role: "user", content: "امروز چند سفارش داریم؟" },
      ],
      tools: [{
        type: "function",
        function: {
          name: "count_orders",
          description: "تعداد سفارش‌های یک روز",
          parameters: { type: "object", properties: { day: { type: "string", enum: ["today", "yesterday"] } }, required: ["day"] },
        },
      }],
      maxTokens: 300,
      signal: controller.signal,
      onDelta: () => undefined,
    });
    const call = result.toolCalls.find((c) => c.function.name === "count_orders");
    let argsOk = false;
    try {
      argsOk = !!call && JSON.parse(call.function.arguments || "{}").day === "today";
    } catch {
      argsOk = false;
    }
    return NextResponse.json({
      ok: true,
      model,
      toolCallOk: !!call && argsOk,
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({
      ok: false,
      error: aborted ? "مدل در ۶۰ ثانیه جواب نداد" : error instanceof AiRequestError ? error.message : "اتصال برقرار نشد",
    });
  } finally {
    clearTimeout(timer);
  }
}
