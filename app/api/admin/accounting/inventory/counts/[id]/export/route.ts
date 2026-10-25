import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/permissions";
import { reviewCount } from "@/lib/accounting/inventory/counts";
import { accErrorResponse } from "@/lib/accounting/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET ?only=diff|uncounted — برگه‌ی انبارگردانی به CSV (اکسل فارسی را با BOM درست باز می‌کند) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const costs = can(guard.access, "ACC_INVENTORY") && can(guard.access, "ACC_COST_VIEW");
    const c = await prisma.accStockCount.findUnique({ where: { id }, select: { number: true } });
    const { rows } = await reviewCount(prisma, id, { blind: false, costs });
    const only = new URL(req.url).searchParams.get("only");
    const picked = rows.filter((r) => (only === "diff" ? (r.diff ?? 0) !== 0 : only === "uncounted" ? r.uncounted : true));
    const head = ["کد", "کالا", "بخش", "شمارش", "شمارش دوم", "نهایی", "دفتری", "اختلاف", ...(costs ? ["ارزش اختلاف (تومان)"] : []), "وضعیت"];
    const lines = picked.map((r) =>
      [r.code, r.title, r.zone, r.counted, r.recount, r.final, r.book, r.diff, ...(costs ? [r.value] : []), r.uncounted ? "شمرده‌نشده" : ""].map(cell).join(","),
    );
    const body = "﻿" + [head.join(","), ...lines].join("\r\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="count-${c?.number ?? id}${only ? `-${only}` : ""}.csv"`,
      },
    });
  } catch (e) {
    return accErrorResponse(e, "[acc-count-export]");
  }
}
