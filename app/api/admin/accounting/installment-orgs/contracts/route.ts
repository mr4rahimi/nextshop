import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { orgGuard } from "@/lib/accounting/org-api";
import { partyContracts } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?invoiceId= یا ?partyId= — قراردادهای اقساط سازمانی یک فاکتور یا یک مشتری */
export async function GET(req: Request) {
  const g = await orgGuard();
  if (!g.ok) return g.res;
  try {
    const u = new URL(req.url).searchParams;
    const invoiceId = u.get("invoiceId");
    if (invoiceId) {
      const cs = await prisma.accOrgContract.findMany({ where: { invoiceId }, orderBy: { createdAt: "desc" }, select: { partyId: true } });
      const all = cs.length ? await partyContracts(prisma, cs[0].partyId) : [];
      const ids = new Set((await prisma.accOrgContract.findMany({ where: { invoiceId }, select: { id: true } })).map((c) => c.id));
      return NextResponse.json(serialize({ contracts: all.filter((c) => ids.has(c.id)) }));
    }
    return NextResponse.json(serialize({ contracts: await partyContracts(prisma, u.get("partyId") ?? "") }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-contracts]");
  }
}
