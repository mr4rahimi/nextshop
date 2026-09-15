import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { createManualDeal, dealTabWhere, DEAL_SELECT, type DealTab } from "@/lib/worklist/deals";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const TABS: DealTab[] = ["pending", "open", "paid", "unowned", "void", "all"];

/**
 * فهرست معامله‌ها با صفحه‌بندی cursor (تله‌ی ۱۴).
 *
 * ⚠️ بدون `DEAL_VIEW_ALL` فقط معامله‌های خودِ کاربر — قیمت خرید و حاشیه‌ی
 * بقیه دیده نمی‌شود (بخش ۲۲.۹). تب «بی‌صاحب» فقط برای کسی که همه را می‌بیند.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["DEAL_LOG", "DEAL_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { access } = guard;
  const viewAll = can(access, "DEAL_VIEW_ALL");

  const sp = new URL(req.url).searchParams;
  const tab = (TABS.includes(sp.get("tab") as DealTab) ? sp.get("tab") : "pending") as DealTab;
  if (tab === "unowned" && !viewAll) {
    return NextResponse.json({ error: "به معامله‌های بی‌صاحب دسترسی ندارید" }, { status: 403 });
  }

  const and: Prisma.StaffDealWhereInput[] = [dealTabWhere(tab)];
  if (!viewAll) and.push({ ownerId: access.userId });
  else if (sp.get("owner") === "me") and.push({ ownerId: access.userId });
  else if (sp.get("owner")) and.push({ ownerId: sp.get("owner") });

  const month = sp.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) and.push({ monthKey: month });

  const q = sp.get("q")?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.StaffDealWhereInput = { AND: and };
  const cursor = sp.get("cursor");

  const [rows, counts] = await Promise.all([
    prisma.staffDeal.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: DEAL_SELECT,
    }),
    // شمارنده‌ی تب‌ها — «ثبت‌نشده» باید همیشه دیده شود
    Promise.all(
      (["pending", "open", "unowned"] as DealTab[]).map((t) =>
        t === "unowned" && !viewAll
          ? Promise.resolve(0)
          : prisma.staffDeal.count({
              where: { AND: [dealTabWhere(t), ...(viewAll ? [] : [{ ownerId: access.userId }])] },
            }),
      ),
    ),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json(
    serialize({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      counts: { pending: counts[0], open: counts[1], unowned: counts[2] },
      me: { id: access.userId, name: access.name },
      can: {
        viewAll,
        log: can(access, "DEAL_LOG"),
        manage: can(access, "COMMISSION_MANAGE"),
      },
    }),
  );
}

/** معامله‌ی بدون سفارش — درآمد و هزینه را کارمند وارد می‌کند */
export async function POST(req: Request) {
  const guard = await requirePermission("DEAL_LOG");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const deal = await createManualDeal(body ?? {}, guard.access);
    logActivityAsync({
      action: "CREATE",
      entity: "OTHER",
      entityId: deal.id,
      entityTitle: deal.title,
      summary: `ثبت معامله‌ی دستی «${deal.title}»`,
    });
    return NextResponse.json(serialize({ deal }), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطای سرور" }, { status: 400 });
  }
}
