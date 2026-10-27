import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/permissions";
import { receiveTransfer, voidTransfer, type ShortageMode } from "@/lib/accounting/inventory/docs";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { action: "void", reason } — فقط ACC_INVENTORY
 * POST { action: "receive", date, lines: [{ lineId, qty }], shortage?: LOSS|RETURN, reasonId?, note? } — ACC_INVENTORY یا ACC_STOCK_RECEIVE
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_INVENTORY", "ACC_STOCK_RECEIVE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string; date?: string; lines?: { lineId: string; qty: unknown }[]; shortage?: string; reasonId?: string; note?: string }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "void") {
      if (!can(guard.access, "ACC_INVENTORY")) throw new AccError("ابطال حواله مجوز «انبار» می‌خواهد", 403);
      await prisma.$transaction((tx) => voidTransfer(tx, id, String(b.reason ?? ""), actor), { timeout: 120_000 });
    } else if (b.action === "receive") {
      const lines = (b.lines ?? []).map((l) => ({ lineId: String(l.lineId), qty: Number(l.qty) }));
      await prisma.$transaction(
        (tx) =>
          receiveTransfer(
            tx,
            id,
            { date: requireDay(b.date, "تاریخ دریافت"), lines, shortage: b.shortage as ShortageMode | undefined, reasonId: b.reasonId || null, note: b.note },
            actor,
          ),
        { timeout: 120_000 },
      );
    } else throw new AccError("اقدام نامعتبر است");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-transfer]");
  }
}
