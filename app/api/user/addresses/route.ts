import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(addresses);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { title, receiver, phone, province, city, addressLine, postalCode, isDefault } = await req.json();

  if (!receiver || !phone || !province || !city || !addressLine)
    return NextResponse.json({ error: "فیلدهای اجباری را پر کنید" }, { status: 400 });

  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  const address = await prisma.address.create({
    data: { userId: user.id, title: title || null, receiver, phone, province, city, addressLine, postalCode: postalCode || null, isDefault: isDefault ?? false },
  });
  return NextResponse.json(address);
}
