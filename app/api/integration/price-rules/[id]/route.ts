import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/price-rules/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = await prisma.integPriceRule.findUnique({ where: { id } });
  if (!rule) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json(rule);
}

// PUT /api/integration/price-rules/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as {
    name?:            string;
    description?:     string;
    priority?:        number;
    isActive?:        boolean;
    targetPlatforms?: string[];
    scopeCategoryIds?: string[];
    scopeBrandIds?:   string[];
    formula?:         unknown;
  };

  try {
    const rule = await prisma.integPriceRule.update({
      where: { id },
      data: {
        ...(body.name            !== undefined && { name: body.name.trim() }),
        ...(body.description     !== undefined && { description: body.description?.trim() ?? null }),
        ...(body.priority        !== undefined && { priority: body.priority }),
        ...(body.isActive        !== undefined && { isActive: body.isActive }),
        ...(body.targetPlatforms !== undefined && { targetPlatforms: body.targetPlatforms }),
        ...(body.scopeCategoryIds !== undefined && { scopeCategoryIds: body.scopeCategoryIds }),
        ...(body.scopeBrandIds   !== undefined && { scopeBrandIds: body.scopeBrandIds }),
        ...(body.formula         !== undefined && { formula: body.formula as object }),
      },
    });
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "قانون یافت نشد" }, { status: 404 });
  }
}

// DELETE /api/integration/price-rules/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.integPriceRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "قانون یافت نشد" }, { status: 404 });
  }
}
