/** نگهبان routeهای اقساط سازمانی — docs/plans/org-installments.md */
import { NextResponse } from "next/server";
import { can, requirePermission, type StaffAccess } from "@/lib/permissions";
import { getAccMode } from "./settings";

export const ORG_VIEW = ["ACC_VIEW", "ACC_SALES", "ACC_POS", "ACC_POS_MANAGE", "ACC_TREASURY", "ACC_SETTINGS"];

export type OrgGuard =
  | { ok: true; access: StaffAccess; can: { manage: boolean; settle: boolean; sell: boolean } }
  | { ok: false; res: NextResponse };

export async function orgGuard(perms: string[] = ORG_VIEW): Promise<OrgGuard> {
  const g = await requirePermission(perms);
  if (!g.ok) return { ok: false, res: NextResponse.json({ error: g.error }, { status: g.status }) };
  if ((await getAccMode()) !== "INTERNAL") {
    return { ok: false, res: NextResponse.json({ error: "اقساط سازمانی حسابداری داخلی می‌خواهد — اول «راه‌اندازی حسابداری» را انجام دهید" }, { status: 409 }) };
  }
  return {
    ok: true,
    access: g.access,
    can: {
      manage: can(g.access, "ACC_SETTINGS") || can(g.access, "ACC_POS_MANAGE"),
      settle: can(g.access, "ACC_TREASURY"),
      sell: can(g.access, "ACC_SALES") || can(g.access, "ACC_POS") || can(g.access, "ACC_POS_MANAGE"),
    },
  };
}

export const MANAGE_ORG = ["ACC_SETTINGS", "ACC_POS_MANAGE"];
export const SETTLE_ORG = ["ACC_TREASURY"];
