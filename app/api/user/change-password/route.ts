import { NextResponse } from "next/server";
import { getAuthUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  if (newPassword.length < 6)
    return NextResponse.json({ error: "رمز جدید باید حداقل ۶ کاراکتر باشد" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!valid) return NextResponse.json({ error: "رمز عبور فعلی اشتباه است" }, { status: 400 });

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  return NextResponse.json({ success: true });
}
