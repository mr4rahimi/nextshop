/**
 * نگهبان routeهای صندوق فروشگاهی: مجوز + حالت حسابداری داخلی.
 */

import { NextResponse } from "next/server";
import { can, requirePermission, type StaffAccess } from "@/lib/permissions";
import { getAccMode } from "../settings";

export const POS_USE = ["ACC_POS", "ACC_POS_MANAGE"];

export type PosGuard = { ok: true; access: StaffAccess; manage: boolean } | { ok: false; res: NextResponse };

export async function posGuard(perms: string[] = POS_USE): Promise<PosGuard> {
  const g = await requirePermission(perms);
  if (!g.ok) return { ok: false, res: NextResponse.json({ error: g.error }, { status: g.status }) };
  if ((await getAccMode()) !== "INTERNAL") {
    return { ok: false, res: NextResponse.json({ error: "صندوق فروشگاهی حسابداری داخلی می‌خواهد — اول «راه‌اندازی حسابداری» را انجام دهید" }, { status: 409 }) };
  }
  return { ok: true, access: g.access, manage: can(g.access, "ACC_POS_MANAGE") };
}
