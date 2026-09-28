import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { planRows } from "@/lib/accounting/installments";
import { accErrorResponse } from "@/lib/accounting/errors";
import { todayKey } from "@/lib/accounting/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/**
 * GET ?side=sales|purchase&view=overdue|week|month|open|all&partyId&q
 * قسط‌ها با وضعیت پوشش — «اقساط» و تقویم سررسید
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const url = new URL(req.url);
    const side = url.searchParams.get("side") === "purchase" ? "purchase" : "sales";
    const view = url.searchParams.get("view") ?? "open";
    const partyId = url.searchParams.get("partyId");
    const q = url.searchParams.get("q")?.trim();
    const type = side === "sales" ? "SALES" : "PURCHASE";
    const where: Prisma.AccInstallmentPlanWhereInput = {
      invoice: { type, status: "ISSUED" },
      ...(partyId ? { partyId } : {}),
      ...(q ? { party: { OR: [{ name: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] } } : {}),
    };
    const all = await planRows(prisma, where);
    const today = todayKey().getTime();
    const counts = {
      overdue: all.filter((r) => r.state === "OVERDUE").length,
      week: all.filter((r) => r.left > 0n && r.dueDate.getTime() >= today && r.dueDate.getTime() <= today + 7 * DAY).length,
      month: all.filter((r) => r.left > 0n && r.dueDate.getTime() >= today && r.dueDate.getTime() <= today + 31 * DAY).length,
      open: all.filter((r) => r.left > 0n).length,
      all: all.length,
    };
    const rows = all
      .filter((r) => {
        const t = r.dueDate.getTime();
        switch (view) {
          case "overdue":
            return r.state === "OVERDUE";
          case "week":
            return r.left > 0n && t >= today && t <= today + 7 * DAY;
          case "month":
            return r.left > 0n && t >= today && t <= today + 31 * DAY;
          case "all":
            return true;
          default:
            return r.left > 0n;
        }
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.seq - b.seq);
    const sum = (xs: typeof all, f: (r: (typeof all)[number]) => bigint) => xs.reduce((s, r) => s + f(r), 0n);
    const plans = new Set(all.map((r) => r.planId)).size;
    return NextResponse.json(
      serialize({
        rows: rows.slice(0, 500),
        truncated: rows.length > 500,
        counts,
        totals: {
          plans,
          overdue: sum(all.filter((r) => r.state === "OVERDUE"), (r) => r.left),
          open: sum(all, (r) => r.left),
          paid: sum(all, (r) => r.paid),
          view: sum(rows, (r) => r.left),
        },
        can: { pay: can(guard.access, "ACC_TREASURY") },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-installments]");
  }
}
