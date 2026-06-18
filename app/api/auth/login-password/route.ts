import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { phone, password } = await req.json();

  if (!phone || !password) {
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "شماره موبایل یا رمز عبور اشتباه است" }, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "حساب کاربری شما غیرفعال است" }, { status: 403 });
  }

  const valid = await verifyPassword(password, user.passwordHash, user.id);
  if (!valid) {
    return NextResponse.json({ error: "شماره موبایل یا رمز عبور اشتباه است" }, { status: 401 });
  }

  const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
  await setAuthCookie(token);

  return NextResponse.json({ success: true });
}