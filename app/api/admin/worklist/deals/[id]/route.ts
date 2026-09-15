import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { assignDealOwner, setDealCost, DEAL_SELECT } from "@/lib/worklist/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  return prisma.staffDeal.findUnique({ where: { id }, select: DEAL_SELECT });
}

/** معامله‌ی دیگری ۴۰۴ می‌گیرد، نه ۴۰۳ */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["DEAL_LOG", "DEAL_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const deal = await load(id);
  if (!deal || (deal.ownerId !== guard.access.userId && !can(guard.access, "DEAL_VIEW_ALL"))) {
    return NextResponse.json({ error: "معامله پیدا نشد" }, { status: 404 });
  }
  return NextResponse.json(serialize({ deal }));
}

/**
 * ثبت قیمت خرید (`cost` یا `itemCosts`، به‌علاوه‌ی `supplierId`، `note`)
 * یا تعیین صاحب (`ownerId`).
 *
 * - قیمت خرید معامله‌ی خودم: `DEAL_LOG`
 * - قیمت خرید معامله‌ی دیگری و تعیین صاحب: `COMMISSION_MANAGE`
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission(["DEAL_LOG", "COMMISSION_MANAGE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { access } = guard;

  const { id } = await params;
  const existing = await prisma.staffDeal.findUnique({ where: { id }, select: { ownerId: true, title: true } });
  const manage = can(access, "COMMISSION_MANAGE");
  if (!existing || (existing.ownerId !== access.userId && !manage && !can(access, "DEAL_VIEW_ALL"))) {
    return NextResponse.json({ error: "معامله پیدا نشد" }, { status: 404 });
  }

  try {
    const body = await req.json();
    let deal = null;

    if (body.ownerId !== undefined) {
      if (!manage) return NextResponse.json({ error: "اجازه‌ی تعیین صاحب معامله را ندارید" }, { status: 403 });
      deal = await assignDealOwner(id, body.ownerId || null);
      logActivityAsync({
        action: "UPDATE",
        entity: "OTHER",
        entityId: id,
        entityTitle: existing.title,
        summary: `تعیین صاحب معامله «${existing.title}»: ${deal.ownerName ?? "بی‌صاحب"}`,
      });
    }

    if (body.cost !== undefined || body.itemCosts !== undefined) {
      const mine = existing.ownerId === access.userId && can(access, "DEAL_LOG");
      if (!mine && !manage) {
        return NextResponse.json({ error: "قیمت خرید فقط روی معامله‌ی خودتان ثبت می‌شود" }, { status: 403 });
      }
      deal = await setDealCost(id, body, access);
      logActivityAsync({
        action: "UPDATE",
        entity: "OTHER",
        entityId: id,
        entityTitle: existing.title,
        summary: `ثبت قیمت خرید معامله «${existing.title}»`,
      });
    }

    if (!deal) return NextResponse.json({ error: "چیزی برای تغییر نیست" }, { status: 400 });
    return NextResponse.json(serialize({ deal }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطای سرور" }, { status: 400 });
  }
}
