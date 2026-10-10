import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const { productId, variantId } = await req.json();
  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) return NextResponse.json({ success: true });

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId, variantKey: typeof variantId === "string" ? variantId : "" } });
  return NextResponse.json({ success: true });
}
