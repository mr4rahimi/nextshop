import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const guaranties = await prisma.guaranty.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { requests: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json(serialize(guaranties));
}