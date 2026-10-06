import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { getSmsReadiness, sendPatternSms } from "@/lib/sms";
import { SITE_URL } from "@/lib/seo";
import { ToolError, displayUrl } from "@/lib/tools/common";
import { cancelStockAlert, getStockAlertSettings, saveStockAlertSettings, stockAlertStats } from "@/lib/tools/stock-alerts";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** تنظیمات و گزارش «موجود شد خبرم کن» — docs/features/tools.md بخش ۷ */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const [settings, stats, sms] = await Promise.all([getStockAlertSettings(), stockAlertStats(30), getSmsReadiness()]);
  return NextResponse.json(
    { settings, stats, sms, canManage: g.access.isUnrestricted || g.access.permissions.includes("TOOLS_MANAGE") },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const settings = await saveStockAlertSettings(await readJson(req));
    logActivityAsync({
      action: "UPDATE", entity: "SETTINGS", entityId: "stock-alerts", entityTitle: "موجود شد خبرم کن",
      summary: `تنظیمات «موجود شد خبرم کن» ذخیره شد (${settings.isEnabled ? "روشن" : "خاموش"})`,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    return toolsError(e);
  }
}

/**
 * `{ phone }` پیامک آزمایشی با نام کالای نمونه و لینک صفحه‌ی اصلی ·
 * `{ cancelId }` لغو یک درخواست منتظر.
 */
export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const body = await readJson(req);
    if (typeof body.cancelId === "string") {
      await cancelStockAlert(body.cancelId);
      return NextResponse.json({ ok: true });
    }
    const phone = String(body.phone ?? "").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[^\d]/g, "");
    if (!/^09\d{9}$/.test(phone)) throw new ToolError("شماره موبایل معتبر نیست");
    const s = await getStockAlertSettings();
    if (!s.patternCode) throw new ToolError("اول کد پترن را ذخیره کنید");
    const sms = await getSmsReadiness();
    if (!sms.ready) throw new ToolError(sms.reason ?? "پیامک آماده نیست");
    const attributes: Record<string, string> = { product: "کالای آزمایشی" };
    if (s.linkMode === "VARIABLE") attributes.link = displayUrl(SITE_URL);
    try {
      await sendPatternSms(phone, s.patternCode, attributes);
    } catch {
      throw new ToolError(`سامانه‌ی پیامک ارسال را نپذیرفت — کد پترن و متغیرهای ${Object.keys(attributes).join("، ")} را بررسی کنید`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toolsError(e);
  }
}
