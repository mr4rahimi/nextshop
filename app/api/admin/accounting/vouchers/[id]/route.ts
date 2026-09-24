import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { reverseVoucher, voidVoucher } from "@/lib/accounting/ledger/post";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VOUCHER", "ACC_VIEW"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const v = await prisma.accVoucher.findUnique({
    where: { id },
    include: {
      year: { select: { title: true } },
      lines: {
        orderBy: { seq: "asc" },
        include: {
          account: { select: { id: true, code: true, name: true } },
          party: { select: { id: true, code: true, name: true } },
          treasury: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
  if (!v) return NextResponse.json({ error: "سند پیدا نشد" }, { status: 404 });
  const [reversedBy, reversalOf] = await Promise.all([
    prisma.accVoucher.findFirst({ where: { reversalOfId: id }, select: { id: true, number: true } }),
    v.reversalOfId ? prisma.accVoucher.findUnique({ where: { id: v.reversalOfId }, select: { id: true, number: true } }) : null,
  ]);
  return NextResponse.json(serialize({ voucher: v, reversedBy, reversalOf, can: { manage: can(guard.access, "ACC_VOUCHER") } }));
}

/** POST { action: "void", reason } | { action: "reverse", date } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string; date?: string }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "void") {
      const v = await prisma.$transaction((tx) => voidVoucher(tx, id, String(b.reason ?? ""), actor));
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: `سند حسابداری ${v.number}`, summary: `ابطال سند ${v.number}: ${b.reason}` });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "reverse") {
      const rev = await prisma.$transaction((tx) => reverseVoucher(tx, id, requireDay(b.date), actor));
      await logActivity({ action: "CREATE", entity: "OTHER", entityId: rev.id, entityTitle: `سند حسابداری ${rev.number}`, summary: rev.description });
      return NextResponse.json({ ok: true, id: rev.id });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-voucher]");
  }
}
