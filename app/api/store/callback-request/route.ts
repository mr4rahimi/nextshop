import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

function isValidPhone(phone: string): boolean {
  return /^(09|\+989|00989)\d{9}$|^09\d{9}$/.test(phone.trim());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone: string = (body.phone ?? "").trim();
  const siteId: string = (body.siteId ?? "").trim();
  const conversationId: string | null = body.conversationId ?? null;

  if (!phone || !isValidPhone(phone)) {
    return NextResponse.json({ error: "شماره تماس معتبر نیست" }, { status: 400 });
  }

  const user = await getAuthUser();

  // درخواست از کادر «تماس بگیرید» محصول بی‌قیمت — نام محصول از دیتابیس خوانده
  // می‌شود تا متن یادداشت دست کاربر نباشد
  const productId: string = typeof body.productId === "string" ? body.productId.slice(0, 40) : "";
  const product = productId
    ? await prisma.product.findUnique({ where: { id: productId }, select: { title: true, slug: true } })
    : null;

  await prisma.callbackRequest.create({
    data: {
      phone,
      siteId: siteId || null,
      conversationId: conversationId || null,
      userId: user?.id ?? null,
      status: "pending",
      note: product ? `استعلام قیمت: ${product.title} — /products/${product.slug}` : null,
    },
  });

  return NextResponse.json({ success: true });
}
