import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { createLoan, listLoans, type LoanBody } from "@/lib/accounting/loans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json(serialize({ ...(await listLoans(prisma)), can: { manage: can(guard.access, "ACC_TREASURY") } }));
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<LoanBody>(req);
    const loan = await prisma.$transaction((tx) => createLoan(tx, b, actorOf(guard.access)));
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: loan.id, entityTitle: `وام ${loan.number}`, summary: `وام «${loan.title}» ثبت شد` });
    return NextResponse.json(serialize({ ok: true, loan }));
  } catch (e) {
    return accErrorResponse(e, "[acc-loans]");
  }
}
