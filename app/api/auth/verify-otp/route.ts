import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { signToken, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { phone, code } = await req.json();

  if (!phone || !code) {
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  }

  const valid = await verifyOtp(phone, code);
  if (!valid) {
    return NextResponse.json({ error: "کد وارد شده اشتباه یا منقضی است" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    return NextResponse.json({ success: true, isNewUser: true });
  }

  const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
  await setAuthCookie(token);

  return NextResponse.json({ success: true, isNewUser: false });
}
