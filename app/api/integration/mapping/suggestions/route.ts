import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  // اضافه کردن اطلاعات محصول فروشگاه برای نمایش
  const withShop = await Promise.all(
    suggestions.map(async (s) => {
      const shopProduct = await prisma.product.findUnique({
        where:  { id: s.shopProductId },
        select: { id: true, title: true, mainImage: true },
      });
      return { ...s, shopProduct };
    }),
  );

  return NextResponse.json({ total, page, perPage, suggestions: withShop });
}

// PATCH /api/integration/mapping/suggestions
// body: { id, action: "approve" | "reject" }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string; action: "approve" | "reject" };

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
