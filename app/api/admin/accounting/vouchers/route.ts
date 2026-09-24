import { NextResponse } from "next/server";
import type { AccSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { postVoucher } from "@/lib/accounting/ledger/post";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, rangeFrom, readJson, requireDay } from "@/lib/accounting/api";
import { faNum, toLatinDigits } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q&source&status&from&to&take — فهرست اسناد (نمای حسابدار) */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VOUCHER", "ACC_VIEW"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const source = url.searchParams.get("source") as AccSource | null;
  const status = url.searchParams.get("status");
  const { from, to } = rangeFrom(url);
  const take = Math.min(Number(url.searchParams.get("take")) || 100, 300);

  const where: Prisma.AccVoucherWhereInput = {};
  if (source) where.source = source;
  if (status === "POSTED" || status === "VOID") where.status = status;
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (q) {
    const n = toLatinDigits(q);
    where.OR = [{ description: { contains: q, mode: "insensitive" } }, ...(/^\d+$/.test(n) ? [{ number: Number(n) }] : [])];
  }

  const vouchers = await prisma.accVoucher.findMany({
    where,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take,
    include: { _count: { select: { lines: true } } },
  });
  return NextResponse.json(serialize({ vouchers, can: { manage: can(guard.access, "ACC_VOUCHER") } }));
}

interface LineBody {
  accountId?: string;
  partyId?: string | null;
  treasuryId?: string | null;
  debit?: unknown;
  credit?: unknown;
  description?: string | null;
}

/** POST — سند دستی */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ date?: string; description?: string; lines?: LineBody[] }>(req);
    if (!Array.isArray(b.lines)) throw new AccError("ردیف‌های سند نیامده");
    const lines = b.lines
      .filter((l) => l.accountId || toAmount(l.debit) || toAmount(l.credit))
      .map((l, i) => ({
        accountId: l.accountId || undefined,
        partyId: l.partyId || null,
        treasuryId: l.treasuryId || null,
        debit: toAmount(l.debit, `بدهکار ردیف ${faNum(i + 1)}`),
        credit: toAmount(l.credit, `بستانکار ردیف ${faNum(i + 1)}`),
        description: l.description ?? null,
      }));
    const actor = actorOf(guard.access);
    const v = await prisma.$transaction((tx) =>
      postVoucher(tx, { date: requireDay(b.date), description: String(b.description ?? ""), source: "MANUAL", lines, actor }),
    );
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: v.id,
      entityTitle: `سند حسابداری ${v.number}`,
      summary: `سند دستی ${v.number}: ${v.description}`,
    });
    return NextResponse.json(serialize({ ok: true, voucher: v }));
  } catch (e) {
    return accErrorResponse(e, "[acc-vouchers]");
  }
}
