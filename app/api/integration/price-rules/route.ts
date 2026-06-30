import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/price-rules — لیست همه قوانین
export async function GET() {
  const rules = await prisma.integPriceRule.findMany({
    orderBy: { priority: "asc" },
  });
  return NextResponse.json(rules);
}

// POST /api/integration/price-rules — ایجاد قانون جدید
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name:            string;
    description?:    string;
    priority?:       number;
    isActive?:       boolean;
    targetPlatforms?: string[];
    scopeCategoryIds?: string[];
    scopeBrandIds?:  string[];
    formula:         unknown;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "نام قانون الزامی است" }, { status: 400 });
  }
  if (!body.formula) {
    return NextResponse.json({ error: "فرمول الزامی است" }, { status: 400 });
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
      formula:          body.formula,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
