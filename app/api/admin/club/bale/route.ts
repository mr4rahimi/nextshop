import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/seo";
import {
  loadBaleConfig,
  apiConfigFor,
  getBaleBotInfo,
  sendBaleMessage,
} from "@/lib/club/channels/bale";
import { sendViaSafir } from "@/lib/club/channels/safir";
import { handleBaleUpdate } from "@/lib/club/channels/bale-webhook";
import { callBotApi, BotApiError, type BotUpdate } from "@/lib/club/channels/botapi";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * مدیریت ربات بله
 *
 * ⚠️ توکن هرگز به کلاینت برنمی‌گردد — فقط «ثبت شده / نشده». همان قاعده‌ای که
 *    برای `smsApiKey` رعایت می‌شود.
 *
 * ⚠️ مسیر اختصاصی است، نه passthrough عمومی. هیچ‌وقت نباید بشود از ادمین هر
 *    متد دلخواهی را به API ربات فرستاد.
 */

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

function errorResponse(err: unknown) {
  if (err instanceof BotApiError) {
    const status =
      err.code === "NO_TOKEN" || err.code === "VALIDATION"
        ? 400
        : err.code === "UNAUTHORIZED"
          ? 403
          : err.code === "UNREACHABLE"
            ? 504
            : 502;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  console.error("[admin:bale]", err);
  return NextResponse.json({ error: "خطای غیرمنتظره" }, { status: 500 });
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      baleBotToken: true,
      baleBotUsername: true,
      baleWebhookSecret: true,
      baleBusinessApi: true,
      baleSafirKey: true,
      baleSafirEnabled: true,
      channelPriority: true,
    },
  });

  const cfg = await loadBaleConfig();

  const [members, active] = await Promise.all([
    prisma.clubChannelIdentity.count({ where: { channel: "BALE" } }),
    prisma.clubChannelIdentity.count({ where: { channel: "BALE", isActive: true } }),
  ]);

  let bot: { id: number; username?: string; first_name: string } | null = null;
  let botError: string | null = null;
  let webhook: unknown = null;

  if (cfg) {
    try {
      bot = await getBaleBotInfo(cfg);
      webhook = await callBotApi(apiConfigFor(cfg), "getWebhookInfo").catch(() => null);
    } catch (err) {
      botError = err instanceof Error ? err.message : "اتصال ناموفق";
    }
  }

  return NextResponse.json({
    // ⚠️ خودِ توکن هرگز برنمی‌گردد
    hasToken: Boolean(settings?.baleBotToken?.trim()),
    username: settings?.baleBotUsername ?? null,
    businessApi: settings?.baleBusinessApi ?? false,
    hasSafirKey: Boolean(settings?.baleSafirKey?.trim()),
    safirEnabled: settings?.baleSafirEnabled ?? false,
    webhookUrl: settings?.baleWebhookSecret
      ? `${SITE_URL}/api/club/bale/webhook/${settings.baleWebhookSecret}`
      : null,
    startLink: settings?.baleBotUsername
      ? `https://ble.ir/${settings.baleBotUsername}`
      : null,
    bot,
    botError,
    webhook,
    members,
    active,
    channelPriority: Array.isArray(settings?.channelPriority)
      ? settings.channelPriority
      : ["SMS"],
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "save");

  try {
    switch (action) {
      case "save":
        return await save(body);
      case "test":
        return await test();
      case "set-webhook":
        return await setWebhook();
      case "delete-webhook":
        return await deleteWebhook();
      case "poll":
        return await poll();
      case "send-test":
        return await sendTest(body);
      case "send-test-phone":
        return await sendTestPhone(body);
      default:
        return NextResponse.json({ error: "عملیات ناشناخته" }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}

// ─── عملیات ────────────────────────────────────────────────────────

async function save(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};

  // ⚠️ رشته‌ی خالی یعنی «پاک کن»، نه «دست نزن» — ادمین باید بتواند توکن را
  //    بردارد. ولی فیلد غایب در بدنه نباید چیزی را صفر کند.
  if (typeof body.token === "string") {
    data.baleBotToken = body.token.trim() || null;
  }

  if (typeof body.username === "string") {
    data.baleBotUsername = body.username.trim().replace(/^@/, "") || null;
  }

  if (typeof body.businessApi === "boolean") {
    data.baleBusinessApi = body.businessApi;
  }

  if (typeof body.safirKey === "string") {
    data.baleSafirKey = body.safirKey.trim() || null;
  }

  if (typeof body.safirEnabled === "boolean") {
    data.baleSafirEnabled = body.safirEnabled;
  }

  // رمز وب‌هوک فقط یک بار ساخته می‌شود؛ عوض کردنش آدرس ثبت‌شده در بله را
  // می‌شکند، پس فقط با درخواست صریح
  if (body.rotateSecret === true || (data.baleBotToken && !(await hasSecret()))) {
    data.baleWebhookSecret = randomBytes(24).toString("hex");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "چیزی برای ذخیره نبود" }, { status: 400 });
  }

  await prisma.storeSettings.update({ where: { id: "singleton" }, data });

  const LABELS: Record<string, string> = {
    baleBotToken: "توکن ربات",
    baleBotUsername: "نام کاربری ربات",
    baleBusinessApi: "API کسب‌وکاری",
    baleSafirKey: "کلید سفیر",
    baleSafirEnabled: "ارسال با شماره تلفن (سفیر)",
    baleWebhookSecret: "رمز وب‌هوک",
  };

  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "singleton",
    entityTitle: "تنظیمات ربات بله",
    // ⚠️ توکن و رمز وب‌هوک هرگز در گزارش فعالیت ثبت نمی‌شوند
    changes: Object.keys(data).map((k) => ({
      field: k,
      label: LABELS[k] ?? k,
      before: null,
      after:
        k === "baleBotToken" || k === "baleWebhookSecret"
          ? data[k]
            ? "***"
            : "(پاک شد)"
          : String(data[k]),
    })),
  });

  return NextResponse.json({ success: true });
}

async function hasSecret() {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { baleWebhookSecret: true },
  });
  return Boolean(s?.baleWebhookSecret);
}

async function test() {
  const cfg = await loadBaleConfig();
  if (!cfg) return NextResponse.json({ error: "توکن ثبت نشده است" }, { status: 400 });

  const bot = await getBaleBotInfo(cfg);
  return NextResponse.json({ bot });
}

async function setWebhook() {
  const cfg = await loadBaleConfig();
  if (!cfg) return NextResponse.json({ error: "توکن ثبت نشده است" }, { status: 400 });
  if (!cfg.webhookSecret) {
    return NextResponse.json({ error: "رمز وب‌هوک ساخته نشده است" }, { status: 400 });
  }

  const url = `${SITE_URL}/api/club/bale/webhook/${cfg.webhookSecret}`;

  // ⚠️ بله فقط پورت ۴۴۳ و ۸۸ را می‌پذیرد و آدرس باید HTTPS باشد. روی لوکال
  //    این کار نمی‌کند — آنجا باید از «دریافت دستی» استفاده شود.
  if (!url.startsWith("https://")) {
    return NextResponse.json(
      { error: "آدرس سایت HTTPS نیست؛ بله فقط وب‌هوک HTTPS می‌پذیرد" },
      { status: 400 }
    );
  }

  await callBotApi(apiConfigFor(cfg), "setWebhook", { url });
  return NextResponse.json({ success: true, url });
}

async function deleteWebhook() {
  const cfg = await loadBaleConfig();
  if (!cfg) return NextResponse.json({ error: "توکن ثبت نشده است" }, { status: 400 });

  await callBotApi(apiConfigFor(cfg), "deleteWebhook");
  return NextResponse.json({ success: true });
}

/**
 * دریافت دستی آپدیت‌ها
 *
 * ⚠️ فقط برای توسعه‌ی لوکال و عیب‌یابی — با **کلیک صریح ادمین**، نه polling
 *    خودکار. روی سرور، وب‌هوک مسیر درست است.
 */
async function poll() {
  const cfg = await loadBaleConfig();
  if (!cfg) return NextResponse.json({ error: "توکن ثبت نشده است" }, { status: 400 });

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { baleUpdateOffset: true },
  });

  const offset = settings?.baleUpdateOffset ?? 0;

  const updates = await callBotApi<BotUpdate[]>(apiConfigFor(cfg), "getUpdates", {
    ...(offset > 0 ? { offset } : {}),
    limit: 50,
  });

  for (const u of updates) {
    await handleBaleUpdate(u);
  }

  const highest = updates.reduce((m, u) => Math.max(m, u.update_id), 0);
  if (highest > 0) {
    await prisma.storeSettings.update({
      where: { id: "singleton" },
      // ⚠️ `+1` لازم است؛ بدون آن همان آپدیت دفعه‌ی بعد دوباره پردازش می‌شود
      data: { baleUpdateOffset: highest + 1 },
    });
  }

  return NextResponse.json({ processed: updates.length });
}

/**
 * تست سفیر — ارسال به شماره، بدون نیاز به `/start`
 *
 * ⚠️ این ارسال **هزینه دارد** و از اعتبار حساب کسب‌وکاری کم می‌کند. برخلاف
 *    تست ربات که رایگان است.
 */
async function sendTestPhone(body: Record<string, unknown>) {
  const cfg = await loadBaleConfig();
  if (!cfg) return NextResponse.json({ error: "توکن ثبت نشده است" }, { status: 400 });
  if (!cfg.safirKey) {
    return NextResponse.json({ error: "کلید سفیر ثبت نشده است" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  const text = String(body.text ?? "").trim();

  if (!phone) return NextResponse.json({ error: "شماره لازم است" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "متن پیام لازم است" }, { status: 400 });

  const result = await sendViaSafir({
    apiKey: cfg.safirKey,
    botId: cfg.botId,
    phone,
    text,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "ارسال ناموفق", code: result.errorCode },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}

async function sendTest(body: Record<string, unknown>) {
  const cfg = await loadBaleConfig();
  if (!cfg) return NextResponse.json({ error: "توکن ثبت نشده است" }, { status: 400 });

  const chatId = String(body.chatId ?? "").trim();
  const text = String(body.text ?? "").trim();

  if (!chatId) return NextResponse.json({ error: "شناسه چت لازم است" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "متن پیام لازم است" }, { status: 400 });

  await sendBaleMessage(cfg, chatId, text);
  return NextResponse.json({ success: true });
}
