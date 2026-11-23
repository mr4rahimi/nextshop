import { gunzipSync } from "zlib";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { orgGuard } from "@/lib/accounting/org-api";
import { readSheetFile } from "@/lib/accounting/import/sheet";
import { legacyApply, legacyPreview, parseLegacySheet, type LegacyOptions } from "@/lib/accounting/org-legacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * POST (multipart: file، mode = preview | apply، options = JSON {mapping, commission}) — انتقال اقساط وب حساب.
 * پیش‌نمایش چیزی ثبت نمی‌کند. docs/plans/org-installments.md بخش ۷.
 */
export async function POST(req: Request) {
  const g = await orgGuard(["ACC_SETTINGS"]);
  if (!g.ok) return g.res;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "preview");
    if (!(file instanceof File)) throw new AccError("فایل خروجی اقساط وب حساب را انتخاب کنید");
    if (file.size > 20_000_000) throw new AccError("فایل بیشتر از ۲۰ مگابایت است");
    let options: LegacyOptions = {};
    try {
      options = JSON.parse(String(form.get("options") ?? "{}")) as LegacyOptions;
    } catch {
      throw new AccError("تنظیمات نامعتبر است");
    }
    // صفحه فایل را در مرورگر gzip می‌کند (۱٫۹ ← ۰٫۳ مگابایت) — آپلود بزرگ پشت CDN گاهی وسط راه قطع می‌شد
    let buf = Buffer.from(await file.arrayBuffer());
    let name = file.name;
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      buf = gunzipSync(buf, { maxOutputLength: 50_000_000 });
      name = name.replace(/\.gz$/i, "");
    }
    const sheets = readSheetFile(name, buf);
    const sheet = sheets.find((s) => s.rows.length > 1) ?? sheets[0];
    if (!sheet) throw new AccError("فایل خالی است");
    const contracts = parseLegacySheet(sheet.rows);
    if (mode !== "apply") return NextResponse.json(serialize({ fileName: name, ...(await legacyPreview(prisma, contracts, options)) }));
    const r = await prisma.$transaction((tx) => legacyApply(tx, contracts, options, actorOf(g.access)), { timeout: 600_000, maxWait: 20_000 });
    const amount = r.vouchers.reduce((s, v) => s + v.amount, 0n);
    await logActivity({
      action: "BULK_UPDATE",
      entity: "OTHER",
      entityTitle: "انتقال اقساط وب حساب",
      summary: `${faNum(r.created)} قرارداد تازه، ${faNum(r.updated)} به‌روز، ${faNum(r.locked)} قفل؛ انتقال ${formatAmount(amount)} تومان به ${faNum(r.vouchers.length)} سازمان`,
    });
    return NextResponse.json(serialize({ ok: true, ...r }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-legacy]");
  }
}
