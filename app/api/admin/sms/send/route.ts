import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getProvider, getPanel, SmsApiError, loadSmsConfig } from "@/lib/club/sms";
import { errorResponse, readJson, normalizeMobile } from "@/lib/club/sms/route-helpers";
import { toProviderSyntax } from "@/lib/club/sms/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سقف گیرنده در یک ارسال دستی — بالاتر از این باید کمپین باشگاه ساخته شود */
const MAX_RECIPIENTS = 1000;

type Mode = "simple" | "keywords" | "pattern" | "sample" | "phonebook";

/**
 * ارسال دستی از ادمین
 *
 * ⚠️ این مسیر عمداً **نگهبان‌های باشگاه را رد نمی‌کند** ولی از آن‌ها هم عبور
 *    نمی‌دهد: ارسال دستی ادمین یک عمل آگاهانه است، نه کمپین خودکار. برای ارسال
 *    انبوه هدفمند از کمپین باشگاه استفاده کنید که لغو-عضویت و سقف ماهانه را
 *    رعایت می‌کند.
 *
 * ⚠️ روی خط خدماتی، متن آزاد وضعیت `pending-approval` می‌گیرد. UI این را
 *    هشدار می‌دهد؛ اینجا جلویش گرفته نمی‌شود چون گاهی همان مطلوب است.
 */
export async function POST(req: Request) {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await readJson(req);
    const mode = String(body.mode ?? "simple") as Mode;

    const config = await loadSmsConfig();
    const line =
      typeof body.lineNumber === "string" && body.lineNumber.trim()
        ? body.lineNumber.trim()
        : config.serviceLine;

    const provider = await getProvider();

    // ── پترن ────────────────────────────────────────────────────────
    if (mode === "pattern") {
      const code = str(body.patternCode);
      if (!code) throw new SmsApiError("VALIDATION", "کد پترن الزامی است");

      const mobile = normalizeMobile(str(body.mobile));
      if (!mobile) throw new SmsApiError("VALIDATION", "شماره گیرنده معتبر نیست");

      const vars: Record<string, string> = {};
      if (body.vars && typeof body.vars === "object") {
        for (const [k, v] of Object.entries(body.vars as Record<string, unknown>)) {
          vars[k] = String(v ?? "");
        }
      }

      const result = await provider.sendPattern(code, mobile, vars, line || undefined);
      return respond(result);
    }

    const text = str(body.text);
    if (!text) throw new SmsApiError("VALIDATION", "متن پیامک الزامی است");
    if (!line) throw new SmsApiError("VALIDATION", "خط ارسال انتخاب نشده است");

    // ── ارسال آزمایشی به شماره‌ی مالک حساب ──────────────────────────
    if (mode === "sample") {
      return respond(await provider.sendSample(line, text));
    }

    // ── ارسال به دفترچه‌های پنل ─────────────────────────────────────
    if (mode === "phonebook") {
      const books = Array.isArray(body.phonebooks) ? body.phonebooks : [];
      const targets = books.flatMap((b) => {
        const r = b as Record<string, unknown>;
        const id = Number(r?.id);
        if (!Number.isFinite(id) || id <= 0) return [];
        return [
          {
            id,
            offset: Number(r.offset) || 0,
            limit: Number(r.limit) || 1000,
          },
        ];
      });

      if (targets.length === 0) {
        throw new SmsApiError("VALIDATION", "هیچ دفترچه‌ای انتخاب نشده است");
      }

      const panel = await getPanel();
      const res = await panel.sendFromPhonebooks(line, text, targets);
      return NextResponse.json({ success: true, requestId: res.requestId ?? null });
    }

    // ── ارسال به فهرست شماره ────────────────────────────────────────
    const { recipients, rejected } = parseRecipients(body.recipients);

    if (recipients.length === 0) {
      throw new SmsApiError("VALIDATION", "هیچ شماره‌ی معتبری در فهرست گیرندگان نبود");
    }
    if (recipients.length > MAX_RECIPIENTS) {
      throw new SmsApiError(
        "VALIDATION",
        `حداکثر ${MAX_RECIPIENTS} گیرنده در ارسال دستی — برای بیشتر، کمپین باشگاه بسازید`
      );
    }

    if (mode === "keywords") {
      // هر گیرنده متغیرهای خودش را دارد: [{ mobile, vars: {...} }]
      const withVars = recipients.map((r) => ({ mobile: r.mobile, vars: r.vars }));
      const result = await provider.sendKeywords(line, toProviderSyntax(text), withVars);
      return respond(result, rejected);
    }

    const result = await provider.sendSimple(line, text, recipients.map((r) => r.mobile));
    return respond(result, rejected);
  } catch (err) {
    return errorResponse(err);
  }
}

function respond(
  result: { ok: boolean; requestId?: number; requestStatus?: string; error?: string },
  rejected: string[] = []
) {
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "ارسال ناموفق بود", code: "BAD_RESPONSE" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    requestId: result.requestId ?? null,
    requestStatus: result.requestStatus ?? null,
    rejected,
    // روی خط خدماتی متن آزاد تا تأیید دستی ارسال نمی‌شود
    needsApproval: result.requestStatus === "pending-approval",
  });
}

function parseRecipients(raw: unknown): {
  recipients: { mobile: string; vars?: Record<string, string> }[];
  rejected: string[];
} {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,;،\n]+/)
      : [];

  const seen = new Set<string>();
  const recipients: { mobile: string; vars?: Record<string, string> }[] = [];
  const rejected: string[] = [];

  for (const item of list) {
    const isObj = item && typeof item === "object";
    const r = isObj ? (item as Record<string, unknown>) : null;
    const rawMobile = String((r ? r.mobile : item) ?? "").trim();
    if (!rawMobile) continue;

    const mobile = normalizeMobile(rawMobile);
    if (!mobile) {
      rejected.push(rawMobile);
      continue;
    }
    // شماره‌ی تکراری یعنی دو بار هزینه برای یک نفر
    if (seen.has(mobile)) continue;
    seen.add(mobile);

    const vars: Record<string, string> = {};
    if (r?.vars && typeof r.vars === "object") {
      for (const [k, v] of Object.entries(r.vars as Record<string, unknown>)) {
        vars[k] = String(v ?? "");
      }
    }

    recipients.push({ mobile, ...(Object.keys(vars).length > 0 ? { vars } : {}) });
  }

  return { recipients, rejected };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
