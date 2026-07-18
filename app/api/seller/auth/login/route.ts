import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/club/phone";

export const runtime = "nodejs";

/**
 * ورود فروشنده — نقش SELLER یا ADMIN
 * ادمین هم می‌تواند وارد شود تا برای تست حساب جداگانه لازم نباشد.
 */
export async function POST(req: Request) {
  try {
    const { phone: rawPhone, password } = await req.json();

    const phone = normalizePhone(rawPhone);
    if (!phone || !password) {
      return NextResponse.json(
        { error: "شماره موبایل و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    // پیام یکسان برای «کاربر نیست» و «رمز غلط» — جلوگیری از شناسایی شماره‌ها
    const invalid = NextResponse.json(
      { error: "شماره موبایل یا رمز عبور اشتباه است" },
      { status: 401 }
    );

    if (!user) return invalid;
    if (!user.isActive) {
      return NextResponse.json(
        { error: "حساب کاربری غیرفعال است" },
        { status: 403 }
      );
    }
    if (user.role !== "SELLER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const ok = await verifyPassword(password, user.passwordHash, user.id);
    if (!ok) return invalid;

    const token = await signToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });
    await setAuthCookie(token);

    return NextResponse.json({ success: true, role: user.role });
  } catch {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}