import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { phone, firstName, lastName, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ error: "شماره موبایل و رمز عبور الزامی است" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { phone },
      update: { passwordHash, role: "ADMIN", isActive: true, firstName, lastName },
      create: { phone, passwordHash, role: "ADMIN", isActive: true, firstName, lastName },
    });

    return NextResponse.json({ success: true, id: user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "خطای سرور" }, { status: 500 });
  }
}
