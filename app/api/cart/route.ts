import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { checkVariant, effectivePrice, resolveVariants } from "@/lib/variants";

export const runtime = "nodejs";

/**
 * ردیف سبدِ تنوع (فاز ۴، docs/plans/inventory-items.md): `product` با عنوان، قیمت و
 * عکسِ همان تنوع برمی‌گردد تا سبد و تسویه بی‌تغییر نمایشش دهند.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ items: [] });

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, title: true, slug: true,
              price: true, salePrice: true,
              mainImage: true, isActive: true,
              images: { take: 1, select: { url: true } },
            },
          },
        },
      },
    },
  });

  const items = cart?.items ?? [];
  const variants = await resolveVariants(prisma, items.map((i) => ({ productId: i.productId, variantId: i.variantKey || null })));
  const out = items
    .filter((i) => !i.variantKey || variants.has(i.variantKey))
    .map((i) => {
      const v = i.variantKey ? variants.get(i.variantKey)! : null;
      if (!v) return { ...i, variantId: null };
      const p = effectivePrice(i.product, v);
      return {
        ...i,
        variantId: v.id,
        product: { ...i.product, title: `${i.product.title} — ${v.title}`, price: p.price, salePrice: p.salePrice, mainImage: v.image ?? i.product.mainImage },
      };
    });
  return NextResponse.json(serialize(out));
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const { productId, qty, variantId } = await req.json();
  if (!productId || qty < 1) return NextResponse.json({ error: "اطلاعات نامعتبر" }, { status: 400 });
  const variantKey = await checkVariant(productId, variantId);
  if (variantKey === null) return NextResponse.json({ error: "رنگ/سایز را انتخاب کنید" }, { status: 400 });

  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: user.id } });

  await prisma.cartItem.upsert({
    where: { cartId_productId_variantKey: { cartId: cart.id, productId, variantKey } },
    update: { qty },
    create: { cartId: cart.id, productId, qty, variantKey },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return NextResponse.json({ success: true });
}
