import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBigInt } from "@/lib/api/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ message: "userId required" }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return NextResponse.json(jsonBigInt({ orders }));
}
