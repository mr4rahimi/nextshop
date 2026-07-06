import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/price-rules
export async function GET() {
  const rules = await prisma.integPriceRule.findMany({
    orderBy: { priority: "asc" },
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(rules);
}

interface TierInput {
  minStock?: number | null;
  maxStock?: number | null;
  marginPercent: number;
}

interface RuleBody {
  name:             string;
  description?:     string;
  priority?:        number;
  isActive?:        boolean;
  targetPlatforms?: string[];
  scopeCategoryIds?: string[];
  scopeBrandIds?:   string[];
  feePercent?:      number;
  shippingType?:    "FIXED" | "PERCENT";
  shippingValue?:   number;
  packagingType?:   "FIXED" | "PERCENT";
  packagingValue?:  number;
  miscType?:        "FIXED" | "PERCENT";
  miscValue?:       number;
  marginPercent?:   number;
  roundTo?:         number | null;
  tiers?:           TierInput[];
}

// POST /api/integration/price-rules
export async function POST(req: NextRequest) {
  const body = await req.json() as RuleBody;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "نام قانون الزامی است" }, { status: 400 });
  }

  const rule = await prisma.integPriceRule.create({
    data: {
      name:             body.name.trim(),
      description:      body.description?.trim() ?? null,
      priority:         body.priority ?? 100,
      isActive:         body.isActive ?? true,
      targetPlatforms:  body.targetPlatforms ?? [],
      scopeCategoryIds: body.scopeCategoryIds ?? [],
      scopeBrandIds:    body.scopeBrandIds ?? [],
      feePercent:       body.feePercent ?? 0,
      shippingType:     body.shippingType ?? "FIXED",
      shippingValue:    body.shippingValue ?? 0,
      packagingType:    body.packagingType ?? "FIXED",
      packagingValue:   body.packagingValue ?? 0,
      miscType:         body.miscType ?? "FIXED",
      miscValue:        body.miscValue ?? 0,
      marginPercent:    body.marginPercent ?? 0,
      roundTo:          body.roundTo ?? null,
      tiers: {
        create: (body.tiers ?? []).map((t, i) => ({
          minStock:      t.minStock ?? null,
          maxStock:      t.maxStock ?? null,
          marginPercent: t.marginPercent,
          sortOrder:     i,
        })),
      },
    },
    include: { tiers: true },
  });

  return NextResponse.json(rule, { status: 201 });
}