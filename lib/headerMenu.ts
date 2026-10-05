import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export interface HeaderMenuSub { id: string; title: string; slug: string; imageUrl: string | null; }
export interface HeaderMegaCat {
  id: string; isActive: boolean;
  category: { id: string; title: string; slug: string; imageUrl: string | null; children: HeaderMenuSub[]; };
}
export interface HeaderMenuItem { id: string; title: string; url: string | null; openInNewTab: boolean; }
export interface HeaderMenuData { menuItems: HeaderMenuItem[]; megaMenuCats: HeaderMegaCat[]; }

export const EMPTY_HEADER_MENU: HeaderMenuData = { menuItems: [], megaMenuCats: [] };

/**
 * داده‌ی منوی هدر — هم در `Header` (سرور) و هم در `/api/store/header-menu`.
 *
 * منو قبلاً فقط در مرورگر fetch می‌شد، پس HTML هیچ صفحه‌ای به دسته‌ها لینک
 * نمی‌داد و گوگل دسته‌ها را فقط از سایت‌مپ پیدا می‌کرد (ممیزی مهام، مهر ۱۴۰۵).
 * حالا در سرور خوانده و به منوها پاس داده می‌شود.
 */
export async function getHeaderMenu(): Promise<HeaderMenuData> {
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
  return serialize({ menuItems, megaMenuCats }) as HeaderMenuData;
}
