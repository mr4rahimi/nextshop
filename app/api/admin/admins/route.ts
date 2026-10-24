import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { seatError } from "@/lib/plan/license";

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

    // سقف کاربر پنل در بسته‌ی گردانوس؛ ادمینِ فعالِ موجود (عوض کردن رمز) صندلی تازه نمی‌گیرد
    const existing = await prisma.user.findUnique({ where: { phone }, select: { role: true, isActive: true } });
    if (!(existing?.role === "ADMIN" && existing.isActive)) {
      const err = await seatError();
      if (err) return NextResponse.json({ error: err }, { status: 403 });
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
