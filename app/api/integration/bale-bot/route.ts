import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { loadBaleConfig, apiConfigFor, getBaleBotInfo } from "@/lib/club/channels/bale";
import { callBotApi, BotApiError } from "@/lib/club/channels/botapi";
import { loadCatalogConfig, normalizeCatalogConfig, saveCatalogConfig } from "@/lib/bale-bot/config";
import { listCategories } from "@/lib/bale-bot/catalog";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تنظیمات ربات بله — اتصال (توکن، وب‌هوک) و کاتالوگ محصولات
 *
 * احراز هویت از دروازه‌ی `/api/integration/` در `proxy.ts` می‌آید.
 * توکن همان `StoreSettings.baleBotToken` باشگاه است؛ هر دو صفحه یک ربات را
 * تنظیم می‌کنند. مستندات: docs/features/bale-catalog.md
 *
 * ⚠️ توکن هرگز به کلاینت برنمی‌گردد — فقط «ثبت شده / نشده».
 * ⚠️ خطاهای قابل نمایش با ۲۰۰ و `ok:false` برمی‌گردند؛ CDN بدنه‌ی ۴xx را عوض می‌کند.
 */

function fail(error: string) {
  return NextResponse.json({ ok: false, error });
}

function webhookUrlFor(secret: string | null | undefined) {
  return secret ? `${SITE_URL}/api/club/bale/webhook/${secret}` : null;
}

export async function GET() {
  const [settings, catalog, cfg, categories] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { baleBotToken: true, baleBotUsername: true, baleWebhookSecret: true },
    }),
    loadCatalogConfig(),
    loadBaleConfig(),
    listCategories().catch(() => []),
  ]);

  let bot: { id: number; username?: string; first_name: string } | null = null;
  let botError: string | null = null;
  let webhookActual: string | null = null;

  if (cfg) {
    try {
      bot = await getBaleBotInfo(cfg);
      const info = await callBotApi<{ url?: string }>(apiConfigFor(cfg), "getWebhookInfo").catch(
        () => null,
      );
      webhookActual = info?.url || null;
    } catch (err) {
      botError = err instanceof Error ? err.message : "اتصال ناموفق";
    }
  }

  const webhookUrl = webhookUrlFor(settings?.baleWebhookSecret);
  const username = settings?.baleBotUsername || bot?.username || null;

  return NextResponse.json({
    ok: true,
    hasToken: Boolean(settings?.baleBotToken?.trim()),
    username: settings?.baleBotUsername ?? null,
    botLink: username ? `https://ble.ir/${username}` : null,
    bot,
    botError,
    webhookSet: Boolean(webhookUrl && webhookActual === webhookUrl),
    webhookActual,
    catalog,
    stats: {
      categories: categories.length,
      products: categories.reduce((s, c) => s + c.count, 0),
    },
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "save-connection":
        return await saveConnection(body);
      case "test": {
        const cfg = await loadBaleConfig();
        if (!cfg) return fail("توکن ربات ثبت نشده است");
        const bot = await getBaleBotInfo(cfg);
        return NextResponse.json({ ok: true, bot });
      }
      case "set-webhook":
        return await setWebhook();
      case "save-catalog":
        return await saveCatalog(body);
      default:
        return fail("عملیات ناشناخته");
    }
  } catch (err) {
    if (err instanceof BotApiError) return fail(err.message);
    console.error("[integration:bale-bot]", err);
    return fail("خطای غیرمنتظره");
  }
}

async function saveConnection(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};

  // رشته‌ی خالی برای توکن یعنی «دست نزن» — پاک کردن توکن از صفحه‌ی باشگاه است،
  // تا یک ذخیره‌ی بی‌دقت ربات را خاموش نکند.
  if (typeof body.token === "string" && body.token.trim()) {
    const token = body.token.trim();
    if (!/^\d+:[\w-]+$/.test(token)) return fail("شکل توکن درست نیست؛ باید مثل 123456:ABC... باشد");
    data.baleBotToken = token;
  }
  if (typeof body.username === "string") {
    data.baleBotUsername = body.username.trim().replace(/^@/, "") || null;
  }
  if (!Object.keys(data).length) return fail("چیزی برای ذخیره نبود");

  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { baleWebhookSecret: true },
  });
  // رمز وب‌هوک فقط یک بار ساخته می‌شود؛ عوض کردنش آدرس ثبت‌شده در بله را می‌شکند
  if (data.baleBotToken && !s?.baleWebhookSecret) {
    data.baleWebhookSecret = randomBytes(24).toString("hex");
  }

  await prisma.storeSettings.update({ where: { id: "singleton" }, data });

  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "singleton",
    entityTitle: "تنظیمات ربات بله",
    // ⚠️ توکن و رمز وب‌هوک هرگز در گزارش فعالیت ثبت نمی‌شوند
    changes: Object.keys(data).map((k) => ({
      field: k,
      label: k === "baleBotToken" ? "توکن ربات" : k === "baleBotUsername" ? "نام کاربری ربات" : "رمز وب‌هوک",
      before: null,
      after: k === "baleBotUsername" ? String(data[k] ?? "") : "***",
    })),
  });

  // بعد از توکن تازه، اگر نام کاربری خالی است از خود ربات بخوان
  if (data.baleBotToken && !data.baleBotUsername) {
    const cfg = await loadBaleConfig();
    const bot = cfg ? await getBaleBotInfo(cfg).catch(() => null) : null;
    if (bot?.username) {
      await prisma.storeSettings.update({
        where: { id: "singleton" },
        data: { baleBotUsername: bot.username },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function setWebhook() {
  const cfg = await loadBaleConfig();
  if (!cfg) return fail("توکن ربات ثبت نشده است");

  let secret = cfg.webhookSecret;
  if (!secret) {
    secret = randomBytes(24).toString("hex");
    await prisma.storeSettings.update({
      where: { id: "singleton" },
      data: { baleWebhookSecret: secret },
    });
  }

  const url = webhookUrlFor(secret)!;
  // ⚠️ بله فقط وب‌هوک HTTPS می‌پذیرد؛ روی لوکال کار نمی‌کند
  if (!url.startsWith("https://")) return fail("آدرس سایت HTTPS نیست؛ بله فقط وب‌هوک HTTPS می‌پذیرد");

  await callBotApi(apiConfigFor(cfg), "setWebhook", { url });
  return NextResponse.json({ ok: true, url });
}

async function saveCatalog(body: Record<string, unknown>) {
  const before = await loadCatalogConfig();
  const next = normalizeCatalogConfig(body.catalog);

  for (const [code, p] of Object.entries(next.platforms)) {
    if (p.urlTemplate && !/^https?:\/\//i.test(p.urlTemplate)) {
      return fail(`الگوی لینک «${p.label}» باید با https:// شروع شود`);
    }
    if (code === "shop") p.urlTemplate = "";
  }

  await saveCatalogConfig(next);

  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "singleton",
    entityTitle: "کاتالوگ ربات بله",
    changes:
      before.enabled !== next.enabled
        ? [{ field: "enabled", label: "نمایش محصولات در ربات", before: String(before.enabled), after: String(next.enabled) }]
        : [{ field: "baleCatalog", label: "تنظیمات کاتالوگ", before: null, after: "به‌روز شد" }],
  });

  return NextResponse.json({ ok: true, catalog: next });
}
