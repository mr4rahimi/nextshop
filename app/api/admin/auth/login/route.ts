import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json({ error: "شماره موبایل و رمز عبور الزامی است" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "رمز عبور اشتباه است" }, { status: 401 });
    }
    const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
    await setAuthCookie(token);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
