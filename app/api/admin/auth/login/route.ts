import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, verifyPassword } from "@/lib/auth";
import { logActivityAsync } from "@/lib/activity";
import { startWorkSession, sessionContextFrom } from "@/lib/worklist/attendance";

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
    const valid = await verifyPassword(password, user.passwordHash, user.id);
    if (!valid) {
      return NextResponse.json({ error: "رمز عبور اشتباه است" }, { status: 401 });
    }
    const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
    await setAuthCookie(token);

    // کوکی تازه ست شده و هنوز در همین درخواست خوانده نمی‌شود — actor دستی می‌رود
    logActivityAsync({
      action: "LOGIN",
      entity: "USER",
      entityId: user.id,
      entityTitle: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone,
      summary: "ورود به پنل مدیریت",
      actor: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone,
        phone: user.phone,
      },
    });

    // حضور — نشستِ کاری از همین لحظه باز می‌شود.
    // ⚠️ خودش خطا نمی‌دهد و گیتِ `worklistEnabled` را داخل خودش چک می‌کند؛
    // ورود به پنل هیچ‌وقت نباید به این وابسته باشد.
    await startWorkSession(user.id, sessionContextFrom(req));

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
