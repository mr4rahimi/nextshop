import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { shippingWriteData } from "@/lib/shipping-methods";

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
    data: { ...shippingWriteData(data), isActive: data.isActive ?? true },
  });
  return NextResponse.json(serialize(method));
}
