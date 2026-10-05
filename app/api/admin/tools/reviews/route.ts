import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { getSmsReadiness, sendPatternSms } from "@/lib/sms";
import { ToolError, displayUrl } from "@/lib/tools/common";
import { PUBLIC_REVIEW_TOKEN, getReviewSettings, reviewStats, reviewUrl, saveReviewSettings } from "@/lib/tools/reviews";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** تنظیمات و گزارش درخواست ثبت نظر — docs/features/tools.md بخش ۴ */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const [settings, stats, sms] = await Promise.all([getReviewSettings(), reviewStats(30), getSmsReadiness()]);
  return NextResponse.json(
    { settings, stats, sms, publicUrl: reviewUrl(PUBLIC_REVIEW_TOKEN), canManage: g.access.isUnrestricted || g.access.permissions.includes("TOOLS_MANAGE") },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const settings = await saveReviewSettings(await readJson(req));
    logActivityAsync({
      action: "UPDATE", entity: "SETTINGS", entityId: "review-requests", entityTitle: "درخواست ثبت نظر",
      summary: `تنظیمات درخواست ثبت نظر ذخیره شد (${settings.isEnabled ? "روشن" : "خاموش"})`,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    return toolsError(e);
  }
}

/**
 * پیامک آزمایشی به یک شماره — با همان پترن و لینک عمومی. درخواستی ثبت نمی‌شود.
 * پترنی که متغیر `link` ندارد ولی حالتش «متغیر» است اینجا خطا می‌دهد؛ بهتر از
 * اینکه اولین مشتری واقعی آن را کشف کند.
 */
export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const body = await readJson(req);
    const phone = String(body.phone ?? "").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[^\d]/g, "");
    if (!/^09\d{9}$/.test(phone)) throw new ToolError("شماره موبایل معتبر نیست");
    const s = await getReviewSettings();
    if (!s.patternCode) throw new ToolError("اول کد پترن را ذخیره کنید");
    const sms = await getSmsReadiness();
    if (!sms.ready) throw new ToolError(sms.reason ?? "پیامک آماده نیست");
    const attributes: Record<string, string> = { name: "مشتری آزمایشی" };
    if (s.linkMode === "VARIABLE") attributes.link = displayUrl(reviewUrl(PUBLIC_REVIEW_TOKEN));
    try {
      await sendPatternSms(phone, s.patternCode, attributes);
    } catch {
      throw new ToolError("سامانه‌ی پیامک ارسال را نپذیرفت — کد پترن و متغیرهای name و link را بررسی کنید");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toolsError(e);
  }
}
