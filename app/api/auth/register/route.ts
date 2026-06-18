import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const { phone, password } = body;

  console.log("[Register] phone:", phone, "| password length:", password?.length);

  if (!phone || !password) {
    console.log("[Register] Missing fields - phone:", !!phone, "password:", !!password);
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    const token = await signToken({ userId: existing.id, phone: existing.phone, role: existing.role });
    await setAuthCookie(token);
    return NextResponse.json({ success: true });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { phone, passwordHash },
  });

  const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
  await setAuthCookie(token);

  return NextResponse.json({ success: true });
}
