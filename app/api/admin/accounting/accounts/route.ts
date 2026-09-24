import { NextResponse } from "next/server";
import type { AccDetailKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createAccount } from "@/lib/accounting/ledger/accounts";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?leaf=1&q=… — سرفصل. `leaf=1` فقط معین‌های فعال (برای انتخابگر سند).
 * بدون leaf: کل درخت با مانده‌ی هر حساب (همه‌ی سال‌ها، بدون باطل).
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_VOUCHER", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const leaf = url.searchParams.get("leaf") === "1";
  const q = url.searchParams.get("q")?.trim();

  const accounts = await prisma.accAccount.findMany({
    where: {
      ...(leaf ? { level: "SUBLEDGER", isActive: true } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { startsWith: q } }] } : {}),
    },
    orderBy: { code: "asc" },
  });
  if (leaf) return NextResponse.json(serialize({ accounts }));

  const bal = await balancesBy(prisma, "accountId");
  return NextResponse.json(
    serialize({
      accounts: accounts.map((a) => ({ ...a, balance: bal.get(a.id)?.balance ?? 0n })),
      can: { manage: can(guard.access, "ACC_SETTINGS") },
    }),
  );
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ parentId?: string; name?: string; code?: string; detailKind?: AccDetailKind }>(req);
    const acc = await createAccount(prisma, { parentId: String(b.parentId ?? ""), name: String(b.name ?? ""), code: b.code, detailKind: b.detailKind });
    return NextResponse.json(serialize({ ok: true, account: acc }));
  } catch (e) {
    return accErrorResponse(e, "[acc-accounts]");
  }
}
