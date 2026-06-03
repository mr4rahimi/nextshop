import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const data = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, firstName: true, lastName: true, email: true, nationalCode: true, avatarUrl: true, phone: true },
  });
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { firstName, lastName, email, nationalCode, avatarUrl } = await req.json();

  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, id: { not: user.id } } });
    if (existing) return NextResponse.json({ error: "این ایمیل قبلاً استفاده شده است" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { firstName: firstName || null, lastName: lastName || null, email: email || null, nationalCode: nationalCode || null, avatarUrl: avatarUrl || null },
    select: { id: true, firstName: true, lastName: true, email: true, nationalCode: true, avatarUrl: true, phone: true },
  });
  return NextResponse.json(updated);
}
