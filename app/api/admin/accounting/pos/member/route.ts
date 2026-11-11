import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { posIssueCard, posMemberForParty } from "@/lib/accounting/pos/club";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

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

/** POST — صدور یا تعویض کارت در صندوق: { number, mobile, name?, partyId?, tierId?, terminalId? } */
export async function POST(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const b = (await req.json().catch(() => ({}))) as { number?: string; mobile?: string; name?: string; partyId?: string; tierId?: string; terminalId?: string };
    const terminal = b.terminalId ? await prisma.accPosTerminal.findUnique({ where: { id: b.terminalId }, select: { name: true } }) : null;
    const m = await posIssueCard(
      { number: b.number ?? "", mobile: b.mobile ?? "", name: b.name, partyId: b.partyId || null, tierId: b.tierId || null },
      { name: g.access.name, manage: g.manage, terminal: terminal?.name ?? null },
    );
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: m.card?.id ?? m.profileId,
      entityTitle: `کارت اشتراک ${m.card?.number ?? ""}`,
      summary: `${m.replaced ? "تعویض" : "صدور"} کارت اشتراک ${m.card?.number ?? ""} برای ${m.mobile} در صندوق${terminal ? ` ${terminal.name}` : ""}`,
    });
    return NextResponse.json(serialize({ member: m }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-member]");
  }
}
