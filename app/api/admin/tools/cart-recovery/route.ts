import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { getSmsReadiness, sendPatternSms } from "@/lib/sms";
import { ToolError, displayUrl } from "@/lib/tools/common";
import {
  cartRecoveryStats, fixedCartUrl, getCartRecoverySettings, listOpenCarts, saveCartRecoverySettings,
} from "@/lib/tools/cart-recovery";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** تنظیمات، گزارش و سبدهای باز — docs/plans/store-tools-2.md بخش ۱ */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const [settings, stats, openCarts, sms] = await Promise.all([
    getCartRecoverySettings(), cartRecoveryStats(30), listOpenCarts(30), getSmsReadiness(),
  ]);
  return NextResponse.json(
    { settings, stats, openCarts, sms, cartUrl: fixedCartUrl(), canManage: g.access.isUnrestricted || g.access.permissions.includes("TOOLS_MANAGE") },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const settings = await saveCartRecoverySettings(await readJson(req));
    logActivityAsync({
      action: "UPDATE", entity: "SETTINGS", entityId: "cart-recovery", entityTitle: "یادآوری سبد رهاشده",
      summary: `تنظیمات یادآوری سبد رهاشده ذخیره شد (${settings.isEnabled ? "روشن" : "خاموش"})`,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    return toolsError(e);
  }
}

/**
 * پیامک آزمایشی با پترن ذخیره‌شده — لینک سبد عمومی و کد نمونه‌ی «CRTEST». کدی
 * ساخته و یادآوری‌ای ثبت نمی‌شود.
 */
export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const body = await readJson(req);
    const phone = String(body.phone ?? "").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[^\d]/g, "");
    if (!/^09\d{9}$/.test(phone)) throw new ToolError("شماره موبایل معتبر نیست");
    const s = await getCartRecoverySettings();
    if (!s.patternCode) throw new ToolError("اول کد پترن را ذخیره کنید");
    const sms = await getSmsReadiness();
    if (!sms.ready) throw new ToolError(sms.reason ?? "پیامک آماده نیست");
    const attributes: Record<string, string> = { name: "مشتری آزمایشی" };
    if (s.linkMode === "VARIABLE") attributes.link = displayUrl(fixedCartUrl());
    if (s.couponEnabled) attributes.code = "CRTEST";
    try {
      await sendPatternSms(phone, s.patternCode, attributes);
    } catch {
      throw new ToolError(
        `سامانه‌ی پیامک ارسال را نپذیرفت — کد پترن و متغیرهای ${Object.keys(attributes).join("، ")} را بررسی کنید`,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toolsError(e);
  }
}
