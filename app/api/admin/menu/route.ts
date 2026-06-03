import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// GET — همه تنظیمات منو
export async function GET() {
  const [menuItems, megaMenuCats] = await Promise.all([
    prisma.menuItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.megaMenuCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        category: {
          select: {
            id: true, title: true, slug: true, imageUrl: true,
            children: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: { id: true, title: true, slug: true, imageUrl: true },
            },
          },
        },
      },
    }),
  ]);
  return NextResponse.json(serialize({ menuItems, megaMenuCats }));
}

// POST — افزودن لینک منو
export async function POST(req: Request) {
  const data = await req.json();

  if (data.type === "megaMenu") {
    // افزودن دسته به مگامنو
    const existing = await prisma.megaMenuCategory.findUnique({ where: { categoryId: data.categoryId } });
    if (existing) return NextResponse.json({ error: "این دسته قبلاً اضافه شده" }, { status: 400 });
    const maxSort = await prisma.megaMenuCategory.aggregate({ _max: { sortOrder: true } });
    const item = await prisma.megaMenuCategory.create({
      data: { categoryId: data.categoryId, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
      include: { category: { select: { id: true, title: true, slug: true, imageUrl: true, children: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true, slug: true, imageUrl: true } } } } },
    });
    return NextResponse.json(serialize(item));
  }

  // افزودن لینک ساده
  const maxSort = await prisma.menuItem.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.menuItem.create({
    data: {
      title:       data.title,
      url:         data.url ?? null,
      sortOrder:   (maxSort._max.sortOrder ?? 0) + 1,
      isActive:    data.isActive ?? true,
      openInNewTab: data.openInNewTab ?? false,
    },
  });
  return NextResponse.json(item);
}

// PUT — بروزرسانی ترتیب یا اطلاعات
export async function PUT(req: Request) {
  const data = await req.json();

  if (data.type === "reorderMega") {
    // reorder مگامنو
    await Promise.all(data.items.map((item: { id: string; sortOrder: number }) =>
      prisma.megaMenuCategory.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
    ));
    return NextResponse.json({ success: true });
  }

  if (data.type === "reorderMenu") {
    await Promise.all(data.items.map((item: { id: string; sortOrder: number }) =>
      prisma.menuItem.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
    ));
    return NextResponse.json({ success: true });
  }

  if (data.type === "updateMenuItem") {
    const item = await prisma.menuItem.update({
      where: { id: data.id },
      data: { title: data.title, url: data.url ?? null, isActive: data.isActive, openInNewTab: data.openInNewTab },
    });
    return NextResponse.json(item);
  }

  if (data.type === "toggleMega") {
    const item = await prisma.megaMenuCategory.update({
      where: { id: data.id },
      data: { isActive: data.isActive },
    });
    return NextResponse.json(serialize(item));
  }

  return NextResponse.json({ error: "نوع عملیات نامشخص" }, { status: 400 });
}

// DELETE
export async function DELETE(req: Request) {
  const { id, type } = await req.json();
  if (type === "megaMenu") {
    await prisma.megaMenuCategory.delete({ where: { id } });
  } else {
    await prisma.menuItem.delete({ where: { id } });
  }
  return NextResponse.json({ success: true });
}
