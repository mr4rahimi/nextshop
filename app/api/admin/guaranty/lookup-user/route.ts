import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone")?.trim();
  if (!phone) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  return NextResponse.json({ user });
}