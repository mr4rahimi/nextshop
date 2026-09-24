import { NextResponse } from "next/server";
import type { AccEventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { dispatchAccEvents, retryAccEvents } from "@/lib/accounting/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: AccEventStatus[] = ["PENDING", "DONE", "BLOCKED", "FAILED", "SKIPPED"];

/** GET /api/admin/accounting/events?status=FAILED&q=… — صف رویداد مالی */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as AccEventStatus | null;
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.AccEventWhereInput = {};
  if (status && STATUSES.includes(status)) where.status = status;
  if (q) {
    where.OR = [
      { aggregateId: { contains: q } },
      { dedupeKey: { contains: q } },
      { type: { contains: q.toUpperCase() } },
    ];
  }

  const [items, counts] = await Promise.all([
    prisma.accEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.accEvent.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return NextResponse.json(
    serialize({
      items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      can: { manage: can(guard.access, "ACC_SETTINGS") },
    }),
  );
}

/**
 * POST { action: "retry", ids }  → ناموفق/مسدود دوباره به صف
 * POST { action: "run", ids? }   → یک دور پردازش همین الان
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as { action?: string; ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];

  if (body?.action === "retry") {
    if (!ids.length) return NextResponse.json({ error: "رویدادی انتخاب نشده" }, { status: 400 });
    const count = await retryAccEvents(ids);
    const summary = await dispatchAccEvents(ids);
    return NextResponse.json({ count, summary, message: `${count} رویداد دوباره در صف قرار گرفت` });
  }

  if (body?.action === "run") {
    const summary = await dispatchAccEvents(ids.length ? ids : undefined);
    return NextResponse.json({
      summary,
      message: summary.claimed ? `${summary.claimed} رویداد بررسی شد` : "رویداد آماده‌ای در صف نبود",
    });
  }

  return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
}
