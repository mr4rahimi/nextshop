import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const [menuItems, megaMenuCats] = await Promise.all([
    prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.megaMenuCategory.findMany({
      where: { isActive: true },
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
