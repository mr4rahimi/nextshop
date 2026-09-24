import { NextResponse } from "next/server";
import type { AccDetailKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { updateAccount } from "@/lib/accounting/ledger/accounts";
import { statement } from "@/lib/accounting/ledger/balances";
import { accErrorResponse } from "@/lib/accounting/errors";
import { rangeFrom, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?from&to — دفتر معین/کل یک حساب (کل و گروه: جمع زیرمجموعه‌ها) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_VOUCHER"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const acc = await prisma.accAccount.findUnique({ where: { id } });
  if (!acc) return NextResponse.json({ error: "حساب پیدا نشد" }, { status: 404 });

  // حساب‌های زیرمجموعه با پیشوند کد — درخت سه‌سطحی است و کد فرزند با کد پدر شروع می‌شود
  const ids = acc.level === "SUBLEDGER"
    ? [id]
    : (await prisma.accAccount.findMany({ where: { code: { startsWith: acc.code }, level: "SUBLEDGER" }, select: { id: true } })).map((a) => a.id);
  const st = await statement(prisma, { accountId: { in: ids } }, rangeFrom(new URL(req.url)));
  return NextResponse.json(serialize({ account: acc, ...st }));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ name?: string; detailKind?: AccDetailKind; isActive?: boolean }>(req);
    const acc = await updateAccount(prisma, id, b);
    return NextResponse.json(serialize({ ok: true, account: acc }));
  } catch (e) {
    return accErrorResponse(e, "[acc-account]");
  }
}
