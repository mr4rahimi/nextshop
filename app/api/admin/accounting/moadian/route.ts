import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import { readSheetFile } from "@/lib/accounting/import/sheet";
import { exportMoadian, importMoadianResult, jalaliKey, moadianPreview, resetMoadian, setTaxId, type PreviewFilter } from "@/lib/accounting/moadian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** دیدن: حسابداری یا فروش. ساخت فایل، بارگذاری نتیجه و ثبت دستی: فروش یا تنظیمات — webhesab-parity.md بخش ۳۰ */
const VIEW = ["ACC_VIEW", "ACC_SALES"];
const MANAGE = ["ACC_SALES", "ACC_SETTINGS"];
const SCOPES = ["pending", "exported", "sent", "all"] as const;

function filterOf(from: unknown, to: unknown, type2: unknown, scope?: unknown): PreviewFilter {
  const t = todayKey();
  const f = parseDay(typeof from === "string" ? from : null) ?? new Date(t.getTime() - 30 * 86_400_000);
  const e = parseDay(typeof to === "string" ? to : null) ?? t;
  if (e < f) throw new AccError("پایان بازه پیش از شروع است");
  return { from: f, to: e, allType2: type2 === true || type2 === "1", scope: SCOPES.includes(scope as never) ? (scope as PreviewFilter["scope"]) : "pending" };
}

/** GET ?from&to&scope=pending|exported|sent|all&type2=1 — پیش‌نمایش با همه‌ی عددهای فایل */
export async function GET(req: Request) {
  const guard = await requirePermission(VIEW);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const f = filterOf(sp.get("from"), sp.get("to"), sp.get("type2"), sp.get("scope"));
    const [pv, counts] = await Promise.all([
      moadianPreview(prisma, f),
      prisma.accInvoice.groupBy({ by: ["taxStatus"], where: { type: { in: ["SALES", "SALES_RETURN"] }, taxStatus: { not: null } }, _count: true }),
    ]);
    return NextResponse.json(
      serialize({
        ...pv,
        from: f.from,
        to: f.to,
        counts: Object.fromEntries(counts.map((c) => [c.taxStatus, c._count])),
        can: { manage: MANAGE.some((p) => can(guard.access, p)) },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-moadian]");
  }
}

/**
 * POST json { action: "export", from, to, type2, ids } → فایل xlsx
 *      json { action: "reset", ids } | { action: "taxid", id, taxId }
 *      multipart file → بارگذاری فایل نتیجه‌ی واسط
 */
export async function POST(req: Request) {
  const guard = await requirePermission(MANAGE);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const actor = actorOf(guard.access);
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new AccError("فایل نتیجه را انتخاب کنید");
      const sheets = readSheetFile(file.name, Buffer.from(await file.arrayBuffer()));
      const r = await prisma.$transaction((tx) => importMoadianResult(tx, sheets), { timeout: 120_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "مودیان", summary: `نتیجه‌ی مودیان: ${faNum(r.sent)} ثبت، ${faNum(r.failed)} رد` });
      return NextResponse.json(serialize({ ok: true, ...r }));
    }
    const b = await readJson<{ action?: string; from?: string; to?: string; type2?: boolean; ids?: unknown; id?: string; taxId?: string }>(req);
    const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 3000) : [];
    if (b.action === "export") {
      const today = todayKey();
      const f = filterOf(b.from, b.to, b.type2);
      const r = await prisma.$transaction((tx) => exportMoadian(tx, { ...f, ids }, actor, today), { timeout: 120_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "مودیان", summary: `خروجی مودیان: ${faNum(r.count)} صورتحساب` });
      const name = `moadian-${jalaliKey(today).replace(/\//g, "")}.xlsx`;
      return new NextResponse(new Uint8Array(r.buffer), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${name}"`,
          "x-count": String(r.count),
        },
      });
    }
    if (b.action === "reset") {
      const n = await prisma.$transaction((tx) => resetMoadian(tx, ids));
      return NextResponse.json({ ok: true, count: n });
    }
    if (b.action === "taxid") {
      await prisma.$transaction((tx) => setTaxId(tx, String(b.id ?? ""), String(b.taxId ?? "")));
      return NextResponse.json({ ok: true });
    }
    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-moadian]");
  }
}
