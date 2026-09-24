import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createTreasury, type TreasuryInput } from "@/lib/accounting/treasury";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — صندوق‌ها و حساب‌های بانکی با موجودی */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_VOUCHER", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const all = url.searchParams.get("inactive") === "1";
  const [items, bal] = await Promise.all([
    prisma.accTreasury.findMany({ where: all ? {} : { isActive: true }, orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    balancesBy(prisma, "treasuryId"),
  ]);
  const rows = items.map((t) => ({ ...t, balance: bal.get(t.id)?.balance ?? 0n }));
  const total = rows.reduce((s, r) => s + r.balance, 0n);
  return NextResponse.json(serialize({ items: rows, total, can: { manage: can(guard.access, "ACC_SETTINGS") } }));
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await readJson<TreasuryInput>(req);
    const t = await prisma.$transaction((tx) => createTreasury(tx, body));
    return NextResponse.json(serialize({ ok: true, item: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-treasury]");
  }
}
