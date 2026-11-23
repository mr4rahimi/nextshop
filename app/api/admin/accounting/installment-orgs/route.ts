import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { MANAGE_ORG, orgGuard } from "@/lib/accounting/org-api";
import { orgSummaries, saveOrg, type OrgInput } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — سازمان‌ها با بدهی کل، قسط این ماه، معوق و مشتری فعال. `?active=1` فقط فعال‌ها (انتخابگر صندوق) */
export async function GET(req: Request) {
  const g = await orgGuard();
  if (!g.ok) return g.res;
  try {
    let orgs = await orgSummaries(prisma);
    if (new URL(req.url).searchParams.get("active") === "1") orgs = orgs.filter((o) => o.isActive && !o.selfPay);
    const treasuries = g.can.settle ? await prisma.accTreasury.findMany({ where: { isActive: true, kind: { in: ["BANK", "CASH"] } }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true } }) : [];
    return NextResponse.json(serialize({ orgs, treasuries, can: g.can }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-inst]");
  }
}

/** POST — سازمان تازه */
export async function POST(req: Request) {
  const g = await orgGuard(MANAGE_ORG);
  if (!g.ok) return g.res;
  try {
    const body = await readJson<OrgInput>(req);
    const org = await prisma.$transaction((tx) => saveOrg(tx, null, body, actorOf(g.access)));
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: org.id, entityTitle: org.name, summary: `سازمان اقساط «${org.name}» تعریف شد — ${org.months} قسط، پورسانت ${org.commissionBp / 100}٪` });
    return NextResponse.json(serialize({ ok: true, org }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-inst]");
  }
}
