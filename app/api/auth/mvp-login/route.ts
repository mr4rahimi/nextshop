import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { phone } = await req.json();

  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ message: "phone required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: {
      phone,
      passwordHash: "MVP",
      role: "CUSTOMER",
    },
  });

  return NextResponse.json({ userId: user.id });
}
