/** نگهبان و پاسخ خطای routeهای کارت اشتراک (`/api/admin/club/cards`) */
import { NextResponse } from "next/server";
import { requirePermission, type StaffAccess } from "@/lib/permissions";
import { CardError } from "./cards";

export async function cardsGuard(): Promise<{ ok: true; access: StaffAccess } | { ok: false; res: NextResponse }> {
  const g = await requirePermission("PANEL_CLUB");
  if (!g.ok) return { ok: false, res: NextResponse.json({ error: g.error }, { status: g.status }) };
  return { ok: true, access: g.access };
}

export function cardsError(e: unknown, tag: string) {
  if (e instanceof CardError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && e.message === "INVALID_PHONE") return NextResponse.json({ error: "شماره موبایل درست نیست" }, { status: 400 });
  console.error(tag, e);
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

export const toBig = (v: unknown) => {
  const t = String(v ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[,،٬\s]/g, "");
  if (!/^-?\d+$/.test(t)) throw new Error("NaN");
  return BigInt(t);
};
