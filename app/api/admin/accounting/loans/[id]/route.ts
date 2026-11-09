import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";
import { getLoan, payInstallment, unpayInstallment, voidLoan } from "@/lib/accounting/loans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    return NextResponse.json(serialize({ ...(await getLoan(prisma, id)), can: { manage: can(guard.access, "ACC_TREASURY") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-loans]");
  }
}

/** POST `{action}` — pay `{seq,date,treasuryId,penalty}`، unpay `{seq}`، void `{reason}` */
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; seq?: number; date?: string; treasuryId?: string; penalty?: unknown; reason?: string }>(req);
    const actor = actorOf(guard.access);
    await prisma.$transaction(async (tx) => {
      if (b.action === "pay") await payInstallment(tx, id, Number(b.seq), { date: requireDay(b.date), treasuryId: String(b.treasuryId ?? ""), penalty: toAmount(b.penalty, "جریمه") }, actor);
      else if (b.action === "unpay") await unpayInstallment(tx, id, Number(b.seq), actor);
      else if (b.action === "void") await voidLoan(tx, id, String(b.reason ?? ""), actor);
      else throw new AccError("عملیات نامعتبر است");
    });
    const label = b.action === "pay" ? `قسط ${b.seq} پرداخت شد` : b.action === "unpay" ? `پرداخت قسط ${b.seq} برگشت خورد` : "باطل شد";
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: "وام", summary: `وام: ${label}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-loans]");
  }
}
