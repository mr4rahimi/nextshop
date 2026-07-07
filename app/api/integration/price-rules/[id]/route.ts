import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = await prisma.integPriceRule.findUnique({
    where: { id },
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
  });
  if (!rule) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

interface TierInput {
  minStock?: number | null;
  maxStock?: number | null;
  marginPercent: number;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as Record<string, unknown> & { tiers?: TierInput[] };

  try {
    const { tiers, ...rest } = body;

    const rule = await prisma.integPriceRule.update({
      where: { id },
      data: {
        ...(rest.name             !== undefined && { name: (rest.name as string).trim() }),
        ...(rest.description      !== undefined && { description: (rest.description as string)?.trim() ?? null }),
        ...(rest.priority         !== undefined && { priority: rest.priority as number }),
        ...(rest.isActive         !== undefined && { isActive: rest.isActive as boolean }),
        ...(rest.targetPlatforms  !== undefined && { targetPlatforms: rest.targetPlatforms as string[] }),
        ...(rest.scopeCategoryIds !== undefined && { scopeCategoryIds: rest.scopeCategoryIds as string[] }),
        ...(rest.scopeBrandIds    !== undefined && { scopeBrandIds: rest.scopeBrandIds as string[] }),
        ...(rest.feePercent       !== undefined && { feePercent: rest.feePercent as number }),
        ...(rest.shippingType     !== undefined && { shippingType: rest.shippingType as "FIXED" | "PERCENT" }),
        ...(rest.shippingValue    !== undefined && { shippingValue: rest.shippingValue as number }),
        ...(rest.packagingType    !== undefined && { packagingType: rest.packagingType as "FIXED" | "PERCENT" }),
        ...(rest.packagingValue   !== undefined && { packagingValue: rest.packagingValue as number }),
        ...(rest.miscType         !== undefined && { miscType: rest.miscType as "FIXED" | "PERCENT" }),
        ...(rest.miscValue        !== undefined && { miscValue: rest.miscValue as number }),
        ...(rest.marginPercent    !== undefined && { marginPercent: rest.marginPercent as number }),
        ...(rest.roundTo          !== undefined && { roundTo: rest.roundTo as number | null }),
        ...(tiers !== undefined && {
          tiers: {
            deleteMany: {},
            create: tiers.map((t, i) => ({
              minStock:      t.minStock ?? null,
              maxStock:      t.maxStock ?? null,
              marginPercent: t.marginPercent,
              sortOrder:     i,
            })),
          },
        }),
      },
      include: { tiers: true },
    });

    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "قانون یافت نشد" }, { status: 404 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.integPriceRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "قانون یافت نشد" }, { status: 404 });
  }
}