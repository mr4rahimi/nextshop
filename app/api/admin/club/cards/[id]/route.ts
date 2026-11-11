import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { setCardActive } from "@/lib/club/cards";
import { cardsError, cardsGuard } from "@/lib/club/cards-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH — فعال/غیرفعال کردن کارت: { isActive } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const b = (await req.json().catch(() => ({}))) as { isActive?: boolean };
    const card = await setCardActive(id, b.isActive !== false);
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: card.id, entityTitle: `کارت اشتراک ${card.number}`, summary: `کارت اشتراک ${card.number} ${card.isActive ? "فعال" : "غیرفعال"} شد` });
    return NextResponse.json(serialize({ ok: true, card }));
  } catch (e) {
    return cardsError(e, "[club-card]");
  }
}
