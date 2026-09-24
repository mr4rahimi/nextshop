import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { saveChequeBook } from "@/lib/accounting/cash/cheques";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — دسته‌چک‌ها با تعداد برگ مصرف‌شده */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_CHEQUE", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [books, banks] = await Promise.all([
    prisma.accChequeBook.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
    prisma.accTreasury.findMany({ where: { kind: "BANK" }, select: { id: true, name: true, isActive: true } }),
  ]);
  const items = await Promise.all(
    books.map(async (b) => {
      const issued = await prisma.accCheque.findMany({ where: { direction: "ISSUED", treasuryId: b.treasuryId }, select: { serialNo: true } });
      const from = BigInt(b.fromSerial);
      const to = BigInt(b.toSerial);
      const used = issued.filter((c) => /^\d+$/.test(c.serialNo) && BigInt(c.serialNo) >= from && BigInt(c.serialNo) <= to).length;
      return { ...b, leaves: Number(to - from + 1n), used };
    }),
  );
  return NextResponse.json(serialize({ items, banks, can: { manage: can(guard.access, "ACC_CHEQUE") } }));
}

/** POST { treasuryId, fromSerial, toSerial } | PATCH { id, isActive } */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_CHEQUE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ treasuryId?: string; fromSerial?: string; toSerial?: string }>(req);
    const book = await prisma.$transaction((tx) => saveChequeBook(tx, { treasuryId: String(b.treasuryId ?? ""), fromSerial: String(b.fromSerial ?? ""), toSerial: String(b.toSerial ?? "") }));
    return NextResponse.json(serialize({ ok: true, item: book }));
  } catch (e) {
    return accErrorResponse(e, "[acc-chequebook]");
  }
}

export async function PATCH(req: Request) {
  const guard = await requirePermission("ACC_CHEQUE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ id?: string; isActive?: boolean }>(req);
    if (!b.id) throw new AccError("دسته‌چک پیدا نشد", 404);
    await prisma.accChequeBook.update({ where: { id: b.id }, data: { isActive: !!b.isActive } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-chequebook]");
  }
}
