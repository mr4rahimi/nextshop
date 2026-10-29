import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCredentials, encryptCredentials } from "@/lib/integration/core/crypto";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import {
  clientCodeOf,
  decryptAuthorizationCode,
  exchangeAuthorizationCode,
  generateDigikalaKeyPair,
} from "@/lib/integration/adapters/marketplace/digikala.adapter";

export const dynamic = "force-dynamic";

const PLATFORM = "digikala";

// اتصال دیجی‌کالا فرم «توکن بچسبان» ندارد — مراحلش این‌جاست:
//   generate-key → کلید عمومی برای ثبت در «سرویس‌هاب ← توکن اختصاصی»
//   activate     → کد اعتبارسنجی پنل دیجی‌کالا → رمزگشایی → توکن‌ها
//   test         → تست با توکن ذخیره‌شده (نه اعتبارنامه‌ی فرم)
// کلید خصوصی و توکن‌ها فقط رمزشده در credentials می‌مانند و هرگز برنمی‌گردند.
// docs/integrations/vendors/digikala.md

async function load() {
  const conn = await prisma.integConnection.findFirst({ where: { platformCode: PLATFORM, siteId: null } });
  let creds: Record<string, string> = {};
  if (conn?.credentials) {
    try { creds = decryptCredentials(conn.credentials); } catch { creds = {}; }
  }
  return { conn, creds };
}

async function save(
  connId: string | undefined,
  creds: Record<string, string>,
  status?: { ok: boolean; message?: string },
) {
  const statusData = status
    ? {
        status:      status.ok ? "CONNECTED" as const : "ERROR" as const,
        lastError:   status.ok ? null : (status.message ?? null),
        lastErrorAt: status.ok ? null : new Date(),
      }
    : {};
  if (connId) {
    await prisma.integConnection.update({
      where: { id: connId },
      data:  { credentials: encryptCredentials(creds), ...statusData, updatedAt: new Date() },
    });
  } else {
    await prisma.integConnection.create({
      data: { platformCode: PLATFORM, credentials: encryptCredentials(creds), status: "DISCONNECTED", ...statusData },
    });
  }
}

// GET — وضعیت بدون هیچ راز: کلید عمومی، فعال بودن توکن، انقضا، دسترسی‌ها
export async function GET() {
  const { creds } = await load();
  return NextResponse.json({
    publicKey:       creds.publicKey ?? null,
    hasToken:        !!creds.accessToken,
    accessExpiresAt: creds.accessExpiresAt ? Number(creds.accessExpiresAt) : null,
    activatedAt:     creds.activatedAt ? Number(creds.activatedAt) : null,
    scopes:          creds.scopes ? creds.scopes.split(",") : [],
    // شناسه‌ی برنامه است، نه راز — نمایش داده می‌شود تا با پنل دیجی‌کالا مقایسه شود
    clientCode:      clientCodeOf(creds) ?? null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { action?: string; code?: string; clientCode?: string; force?: boolean };
  const { conn, creds } = await load();

  if (body.action === "generate-key") {
    // کلید تازه، توکن فعلی را بی‌اعتبار نمی‌کند ولی دیجی‌کالا کلید قبلی را نگه
    // می‌دارد تا پشتیبانی عوضش کند — ساخت دوباره فقط با تأیید صریح
    if (creds.publicKey && !body.force) {
      return NextResponse.json({ error: "کلید قبلاً ساخته شده است" }, { status: 409 });
    }
    const { publicKey, privateKey } = generateDigikalaKeyPair();
    await save(conn?.id, { ...creds, publicKey, privateKey });
    return NextResponse.json({ publicKey });
  }

  if (body.action === "activate") {
    if (!creds.privateKey) {
      return NextResponse.json({ error: "اول کلید عمومی را بسازید و در پنل دیجی‌کالا ثبت کنید" }, { status: 400 });
    }
    if (!body.code?.trim()) {
      return NextResponse.json({ error: "کد اعتبارسنجی را از پنل دیجی‌کالا کپی کنید" }, { status: 400 });
    }

    let tokens: Record<string, string>;
    try {
      const authCode = decryptAuthorizationCode(creds.privateKey, body.code);
      tokens = await exchangeAuthorizationCode(authCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فعال‌سازی ناموفق بود";
      // کد اعتبارسنجی یک‌بارمصرف است و پنل دیجی‌کالا هم فقط یک‌بار نشانش می‌دهد
      const reused = /token\.not\.found|code\.invalid/i.test(msg);
      return NextResponse.json({
        error: reused
          ? "این کد اعتبارسنجی قبلاً مصرف شده یا باطل است. اگر بالای صفحه «متصل» است کاری لازم نیست؛ وگرنه در پنل دیجی‌کالا توکن را حذف و دوباره فعال کنید و کد تازه را این‌جا بزنید."
          : msg,
      }, { status: 400 });
    }

    const next = {
      ...creds,
      ...tokens,
      ...(body.clientCode?.trim() ? { clientCode: body.clientCode.trim() } : {}),
      activatedAt: String(Date.now()),
    };
    const result = await getAdapter(PLATFORM)!.testConnection(next);
    await save(conn?.id, next, { ok: result.success, message: result.message });
    return NextResponse.json(result);
  }

  if (body.action === "client-code") {
    // خالی یعنی برگشت به claim `client_code` خود توکن
    const next: Record<string, string> = { ...creds, clientCode: body.clientCode?.trim() ?? "" };
    if (!next.accessToken) {
      await save(conn?.id, next);
      return NextResponse.json({ success: true, message: "کد کلاینت ذخیره شد" });
    }
    const result = await getAdapter(PLATFORM)!.testConnection(next);
    await save(conn?.id, next, { ok: result.success, message: result.message });
    return NextResponse.json(result);
  }

  if (body.action === "test") {
    if (!creds.accessToken) {
      return NextResponse.json({ success: false, message: "توکن هنوز فعال نشده است" });
    }
    const result = await getAdapter(PLATFORM)!.testConnection(creds);
    // ممکن است وسط تست توکن تازه شده باشد — آداپتور خودش آن را ذخیره کرده؛
    // این‌جا فقط وضعیت عوض می‌شود تا بلوب تازه بازنویسی نشود
    await prisma.integConnection.updateMany({
      where: { platformCode: PLATFORM, siteId: null },
      data: {
        status:      result.success ? "CONNECTED" : "ERROR",
        lastError:   result.success ? null : (result.message ?? null),
        lastErrorAt: result.success ? null : new Date(),
        updatedAt:   new Date(),
      },
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "action نامعتبر" }, { status: 400 });
}
