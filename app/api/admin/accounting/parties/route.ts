import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createParty, partyWhere, type PartyInput, type PartyRole } from "@/lib/accounting/parties";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: PartyRole[] = ["customer", "supplier", "employee", "marketplace"];

/**
 * GET ?q&role&balance=debtor|creditor&inactive=1&take — فهرست اشخاص با مانده.
 * `picker=1`: فقط شناسه، نام، کد و مانده — برای انتخابگر فرم‌ها.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_PARTY_MANAGE", "ACC_VOUCHER", "ACC_SALES", "ACC_PURCHASE", "ACC_TREASURY", "ACC_CHEQUE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const roleParam = url.searchParams.get("role") as PartyRole | null;
  const role = roleParam && ROLES.includes(roleParam) ? roleParam : null;
  const take = Math.min(Number(url.searchParams.get("take")) || 100, 300);
  const balanceFilter = url.searchParams.get("balance");
  const where = partyWhere(url.searchParams.get("q"), role, url.searchParams.get("inactive") === "1");

  const [parties, total, bal] = await Promise.all([
    prisma.accParty.findMany({ where, orderBy: [{ name: "asc" }], take: balanceFilter ? 2000 : take }),
    prisma.accParty.count({ where }),
    balancesBy(prisma, "partyId"),
  ]);

  let rows = parties.map((p) => ({ ...p, balance: bal.get(p.id)?.balance ?? 0n }));
  if (balanceFilter === "debtor") rows = rows.filter((r) => r.balance > 0n).sort((a, b) => (b.balance > a.balance ? 1 : -1));
  if (balanceFilter === "creditor") rows = rows.filter((r) => r.balance < 0n).sort((a, b) => (a.balance > b.balance ? 1 : -1));
  rows = rows.slice(0, take);

  // جمع طلب و بدهی کل — بالای صفحه
  let receivable = 0n;
  let payable = 0n;
  for (const b of bal.values()) {
    if (b.balance > 0n) receivable += b.balance;
    else payable -= b.balance;
  }

  return NextResponse.json(
    serialize({
      parties: rows,
      total,
      summary: { receivable, payable },
      can: { manage: can(guard.access, "ACC_PARTY_MANAGE") },
    }),
  );
}

export async function POST(req: Request) {
  const guard = await requirePermission(["ACC_PARTY_MANAGE", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await readJson<PartyInput>(req);
    const party = await prisma.$transaction((tx) => createParty(tx, body));
    return NextResponse.json(serialize({ ok: true, party }));
  } catch (e) {
    return accErrorResponse(e, "[acc-parties]");
  }
}
