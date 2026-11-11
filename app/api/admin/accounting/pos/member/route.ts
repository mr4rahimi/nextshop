import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { posMemberForParty } from "@/lib/accounting/pos/club";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?partyId — کارت اشتراک و اعتبار مشتری انتخاب‌شده در صندوق (بخش ۲۳ هم‌ترازی). `member: null` = کارت ندارد */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const partyId = new URL(req.url).searchParams.get("partyId") ?? "";
    return NextResponse.json(serialize({ member: partyId ? await posMemberForParty(partyId) : null }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-member]");
  }
}
