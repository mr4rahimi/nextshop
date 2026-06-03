import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await req.json();
  const method = await prisma.shippingMethod.update({
    where: { id },
    data: {
      title:       data.title,
      type:        data.type,
      isActive:    data.isActive,
      cities:      data.cities ?? [],
      fee:         BigInt(data.fee ?? 0),
      description: data.description ?? null,
      sortOrder:   data.sortOrder ?? 0,
    },
  });
  return NextResponse.json(serialize(method));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.shippingMethod.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
