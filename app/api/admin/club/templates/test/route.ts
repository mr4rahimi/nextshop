import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/club/phone";
import { getProvider, loadSmsConfig, pickLine } from "@/lib/club/sms";
import { previewTemplate, appendOptOut } from "@/lib/club/sms/render";

export const runtime = "nodejs";

/**
 * ارسال آزمایشی یک قالب به شماره دلخواه ادمین
 *
 * نگهبان‌ها عمداً اعمال نمی‌شوند — ادمین آگاهانه به شماره خودش می‌فرستد.
 * این ارسال در SmsMessage ثبت می‌شود تا در گزارش هزینه دیده شود.
 */
export async function POST(req: Request) {
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: { templateId?: string; phone?: string; vars?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
  }

  const template = await prisma.smsTemplate.findUnique({
    where: { id: body.templateId ?? "" },
  });
  if (!template) {
    return NextResponse.json({ error: "قالب یافت نشد" }, { status: 404 });
  }

  const config = await loadSmsConfig();
  const line = pickLine(config, template.kind);

  if (!line) {
    return NextResponse.json(
      {
        error:
          template.kind === "MARKETING"
            ? "خط تبلیغاتی در تنظیمات باشگاه ثبت نشده است"
            : "خط خدماتی تنظیم نشده است",
      },
      { status: 400 }
    );
  }

  const provider = getProvider();

  try {
    // ── حالت پترن ────────────────────────────────────────────────
    if (template.mode === "PATTERN") {
      if (!template.patternCode) {
        return NextResponse.json({ error: "کد پترن این قالب خالی است" }, { status: 400 });
      }

      const vars = {
        name: "دوست",
        store: config.storeName,
        ...(body.vars ?? {}),
      };

      const res = await provider.sendPattern(template.patternCode, phone, vars, line);

      await logMessage(template, phone, line, JSON.stringify(vars), res.requestId, res.ok, res.error);

      return res.ok
        ? NextResponse.json({
            success: true,
            requestId: res.requestId,
            mode: "PATTERN",
            note: "پیام پترن معمولاً بلافاصله ارسال می‌شود",
          })
        : NextResponse.json({ error: res.error ?? "ارسال ناموفق" }, { status: 502 });
    }

    // ── حالت متن آزاد ────────────────────────────────────────────
    if (!template.body) {
      return NextResponse.json({ error: "متن این قالب خالی است" }, { status: 400 });
    }

    const rendered = appendOptOut(
      previewTemplate(template.body, config.storeName),
      template.kind === "MARKETING" ? config.optOutText : null
    );

    const res = await provider.sendSimple(line, rendered, [phone]);

    await logMessage(template, phone, line, rendered, res.requestId, res.ok, res.error);

    return res.ok
      ? NextResponse.json({
          success: true,
          requestId: res.requestId,
          requestStatus: res.requestStatus,
          mode: "TEXT",
          note:
            res.requestStatus === "pending-approval"
              ? "متن آزاد نیاز به تأیید اپراتور دارد و با تأخیر ارسال می‌شود"
              : undefined,
        })
      : NextResponse.json({ error: res.error ?? "ارسال ناموفق" }, { status: 502 });
  } catch (err) {
    console.error("[club/templates/test]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطای سرور" },
      { status: 500 }
    );
  }
}

async function logMessage(
  template: { key: string; kind: "TRANSACTIONAL" | "MARKETING" },
  phone: string,
  line: string,
  body: string,
  requestId: number | undefined,
  ok: boolean,
  error?: string
) {
  await prisma.smsMessage
    .create({
      data: {
        phone,
        templateKey: template.key,
        kind: template.kind,
        lineNumber: line,
        body,
        providerRequestId: requestId ?? null,
        status: ok ? "SENT" : "FAILED",
        errorMessage: ok ? null : error ?? null,
        sentAt: ok ? new Date() : null,
      },
    })
    .catch(() => {});
}