import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVariant } from "@/lib/variants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const { items } = await req.json() as { items: { productId: string; qty: number; variantId?: string | null }[] };
  if (!items?.length) return NextResponse.json({ success: true });

  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: user.id } });

  for (const item of items) {
    // ردیف تنوعِ نامعتبر (تنوع حذف شده) بی‌صدا کنار می‌رود
    const variantKey = await checkVariant(item.productId, item.variantId);
    if (variantKey === null) continue;
    await prisma.cartItem.upsert({
      where: { cartId_productId_variantKey: { cartId: cart.id, productId: item.productId, variantKey } },
      update: { qty: item.qty },
      create: { cartId: cart.id, productId: item.productId, qty: item.qty, variantKey },
    });
  }

  return NextResponse.json({ success: true });
}
