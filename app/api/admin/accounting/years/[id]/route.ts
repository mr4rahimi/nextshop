import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { closeYear, closingPreview, reopenYear } from "@/lib/accounting/ledger/closing";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — پیش‌نمایش ویزارد بستن: بررسی‌ها، سود سال، سال بعد، سندهای بستن (اگر بسته است) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const pre = await closingPreview(prisma, id);
    const vouchers = await prisma.accVoucher.findMany({
      where: { status: "POSTED", sourceId: { startsWith: `closing:${id}:` } },
      select: { id: true, number: true, date: true, description: true, totalDebit: true },
      orderBy: { number: "asc" },
    });
    const carry = await prisma.accVoucher.findMany({
      where: { status: "POSTED", sourceId: { startsWith: `carry:${id}:` } },
      select: { id: true, number: true, date: true, description: true, totalDebit: true },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(serialize({ ...pre, vouchers: [...vouchers, ...carry], can: { manage: can(guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-year]");
  }
}

/** POST { action: "close" } | { action: "reopen", reason } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "close") {
      const r = await closeYear(id, actor);
      await logActivity({
        action: "UPDATE",
        entity: "OTHER",
        entityId: id,
        entityTitle: `سال مالی ${r.year.title}`,
        summary: `بستن سال مالی ${faNum(r.year.title)} — ${r.profit >= 0n ? "سود" : "زیان"} ${formatAmount(r.profit < 0n ? -r.profit : r.profit)} تومان به سود انباشته؛ مانده‌ها به ${faNum(r.nextYear.title)} منتقل شد`,
      });
      return NextResponse.json(serialize({ ok: true, nextYearId: r.nextYear.id }));
    }
    if (b.action === "reopen") {
      const r = await reopenYear(id, String(b.reason ?? ""), actor);
      await logActivity({
        action: "UPDATE",
        entity: "OTHER",
        entityId: id,
        entityTitle: `سال مالی ${r.year.title}`,
        summary: `بازگشایی سال مالی ${faNum(r.year.title)} — ${faNum(r.voided)} سند بستن باطل شد: ${b.reason}`,
      });
      return NextResponse.json({ ok: true });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-year]");
  }
}
