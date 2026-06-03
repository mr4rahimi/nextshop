import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — لیست علاقه‌مندی‌ها
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    include: {
      product: {
        select: {
          id: true, title: true, slug: true,
          price: true, salePrice: true, mainImage: true,
          isActive: true, ratingAvg: true, ratingCount: true,
          brand: { select: { title: true, slug: true } },
          category: { select: { title: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items.map(item => ({
    id: item.id,
    productId: item.productId,
    createdAt: item.createdAt,
    product: {
      ...item.product,
      price: item.product.price.toString(),
      salePrice: item.product.salePrice?.toString() ?? null,
    },
  })));
}

// POST — اضافه کردن به علاقه‌مندی
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const item = await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    create: { userId: user.id, productId },
    update: {},
  });

  return NextResponse.json({ ok: true, id: item.id });
}

// DELETE — حذف از علاقه‌مندی
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await prisma.wishlistItem.deleteMany({
    where: { userId: user.id, productId },
  });

  return NextResponse.json({ ok: true });
}