import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { MANAGE_ORG, orgGuard } from "@/lib/accounting/org-api";
import { orgDetail, saveOrg, type OrgInput } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

/** GET — جزئیات: شاخص‌ها، ماه‌به‌ماه، مشتری‌ها، قراردادها، دریافت‌ها */
export async function GET(_req: Request, { params }: P) {
  const g = await orgGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const d = await orgDetail(prisma, id);
    const treasuries = g.can.settle ? await prisma.accTreasury.findMany({ where: { isActive: true, kind: { in: ["BANK", "CASH"] } }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true } }) : [];
    return NextResponse.json(serialize({ ...d, treasuries, can: g.can }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-inst]");
  }
}

/** PATCH — ویرایش شرایط (قراردادهای قبلی شرایط خودشان را نگه می‌دارند) */
export async function PATCH(req: Request, { params }: P) {
  const g = await orgGuard(MANAGE_ORG);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const body = await readJson<OrgInput>(req);
    const org = await prisma.$transaction((tx) => saveOrg(tx, id, body, actorOf(g.access)));
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: org.id, entityTitle: org.name, summary: `ویرایش شرایط اقساط «${org.name}»` });
    return NextResponse.json(serialize({ ok: true, org }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-inst]");
  }
}
