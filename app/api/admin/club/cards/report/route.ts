import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { expiring, movements } from "@/lib/club/cards";
import { cardsError, cardsGuard } from "@/lib/club/cards-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?view=movements&from&to&kind — گردش اعتبار (شارژ، پرداخت، مرجوعی، سوخت، …) با جمع هر نوع
 * GET ?view=expiring&days — شارژهای نزدیک به انقضا
 */
export async function GET(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const sp = new URL(req.url).searchParams;
    if (sp.get("view") === "expiring") return NextResponse.json(serialize(await expiring(Math.max(1, Math.min(3650, Number(sp.get("days")) || 30)))));
    const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
    const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: "بازه‌ی تاریخ نامعتبر است" }, { status: 400 });
    return NextResponse.json(serialize(await movements(from, new Date(to.getTime() + 86_400_000), sp.get("kind"))));
  } catch (e) {
    return cardsError(e, "[club-card-report]");
  }
}
