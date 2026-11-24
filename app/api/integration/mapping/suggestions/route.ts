import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { approveSuggestion, rejectSuggestion } from "@/lib/integration/core/mapping";

export const dynamic = "force-dynamic";

// GET /api/integration/mapping/suggestions?platform=hesaban&status=PENDING
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const platform = sp.get("platform");
  const status   = (sp.get("status") ?? "PENDING") as "PENDING" | "APPROVED" | "REJECTED";
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage  = Math.min(100, Number(sp.get("perPage") ?? 50));

  const where = {
    ...(platform ? { platformCode: platform } : {}),
    status,
  };

  const [total, suggestions] = await Promise.all([
    prisma.integMappingSuggestion.count({ where }),
    prisma.integMappingSuggestion.findMany({
      where,
      orderBy: { confidence: "desc" },
      skip:    (page - 1) * perPage,
      take:    perPage,
      include: {
        platform: { select: { name: true } },
      },
    }),
  ]);

  // محصول فروشگاه و محصول بازارگاه هر پیشنهاد — یک‌جا، نه یکی‌یکی
  const [shops, remotes] = await Promise.all([
    prisma.product.findMany({
      where:  { id: { in: [...new Set(suggestions.map((s) => s.shopProductId))] } },
      select: { id: true, title: true, mainImage: true, sku: true, stock: true, price: true },
    }),
    prisma.integPlatformProduct.findMany({
      where:  { OR: suggestions.map((s) => ({ platformCode: s.platformCode, platformProductId: s.platformProductId })) },
      select: { platformCode: true, platformProductId: true, title: true, sku: true, stock: true, price: true },
    }),
  ]);
  const shopMap = new Map(shops.map((p) => [p.id, p]));
  const remoteMap = new Map(remotes.map((r) => [`${r.platformCode}|${r.platformProductId}`, r]));
  const withShop = suggestions.map((s) => ({
    ...s,
    shopProduct: shopMap.get(s.shopProductId) ?? null,
    remote: remoteMap.get(`${s.platformCode}|${s.platformProductId}`) ?? null,
  }));

  return NextResponse.json(serialize({ total, page, perPage, suggestions: withShop }));
}

// PATCH /api/integration/mapping/suggestions
// body: { id, action: "approve" | "reject" }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id?: string; ids?: string[]; action: "approve" | "reject" };

  // تأیید/رد گروهی — هر کدام جدا؛ خطای یکی بقیه را نگه نمی‌دارد
  if (Array.isArray(body.ids)) {
    let done = 0;
    const errors: string[] = [];
    for (const id of body.ids.slice(0, 200)) {
      try {
        if (body.action === "approve") await approveSuggestion(id);
        else await rejectSuggestion(id);
        done++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "خطا");
      }
    }
    return NextResponse.json({ ok: true, done, failed: errors.length, error: errors[0] ?? null });
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id و action الزامی هستند" }, { status: 400 });
  }

  try {
    if (body.action === "approve") {
      await approveSuggestion(body.id);
    } else {
      await rejectSuggestion(body.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا" },
      { status: 400 },
    );
  }
}
