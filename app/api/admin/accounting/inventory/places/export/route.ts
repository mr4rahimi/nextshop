import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { filterOf, listPlaces } from "@/lib/accounting/inventory/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET (همان فیلترهای فهرست) — گزارش مکان به CSV؛ همین فایل با «ورود از اکسل» برمی‌گردد */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_STOCK_COUNT"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const f = filterOf(new URL(req.url).searchParams);
    const w = await prisma.accWarehouse.findUnique({ where: { id: f.warehouseId }, select: { code: true } });
    const { rows } = await listPlaces(prisma, f);
    const head = ["کد", "کالا", "موجودی", "منطقه", "ردیف", "قفسه", "طبقه"];
    const lines = rows.map((r) => [r.code, r.title, r.qty, r.zone, r.aisle, r.shelf, r.level].map(cell).join(","));
    return new NextResponse("﻿" + [head.join(","), ...lines].join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="places-${w?.code ?? "w"}.csv"` },
    });
  } catch (e) {
    return accErrorResponse(e, "[acc-places-export]");
  }
}
