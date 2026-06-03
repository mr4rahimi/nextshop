import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const methods = await prisma.shippingMethod.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(serialize(methods));
}

export async function POST(req: Request) {
  const data = await req.json();
  const method = await prisma.shippingMethod.create({
    data: {
      title:       data.title,
      type:        data.type,
      isActive:    data.isActive ?? true,
      cities:      data.cities ?? [],
      fee:         BigInt(data.fee ?? 0),
      description: data.description ?? null,
      sortOrder:   data.sortOrder ?? 0,
    },
  });
  return NextResponse.json(serialize(method));
}
