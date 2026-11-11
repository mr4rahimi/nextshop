import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie, readOtpProof, clearOtpProof } from "@/lib/auth";
import { ensureClubProfile } from "@/lib/club/profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const { phone, password } = body;

  if (!phone || !password) {
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
  }

  // ⚠️ فقط شماره‌ای که همین الان با کد پیامکی تأیید شده (کوکی `verify-otp`)
  if ((await readOtpProof()) !== phone) {
    return NextResponse.json({ error: "اول شماره موبایل را با کد پیامکی تأیید کنید" }, { status: 403 });
  }

  // ⚠️ حساب موجود هرگز از این مسیر وارد نمی‌شود (ورود با کد پیامکی یا رمز است)
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return NextResponse.json({ error: "این شماره قبلاً ثبت شده است؛ با کد پیامکی وارد شوید" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { phone, passwordHash },
  });

  await ensureClubProfile(user.id, { source: "ONLINE" }).catch((e) =>
    console.error("[club] ساخت پروفایل باشگاه ناموفق:", e)
  );

  await clearOtpProof();
  const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
  await setAuthCookie(token);

  return NextResponse.json({ success: true });
}
