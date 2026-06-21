import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const rootIds = url.searchParams.get("rootIds"); // comma-separated, for initial load

  // --- Initial load: return root categories ---
  if (!categoryId) {
    const ids = rootIds ? rootIds.split(",").filter(Boolean) : null;
    const rootCats = await prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: { id: true, title: true, slug: true, imageUrl: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ rootCategories: rootCats });
  }

  // --- Category selected: return subcategories, brands, spec values ---

  // Get all product IDs in this category (incl. subcats)
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      slug: true,
      children: { select: { id: true, title: true, slug: true, imageUrl: true }, where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!cat) return NextResponse.json({ subcategories: [], brands: [], specGroups: [] });

  const catIds = [cat.id, ...cat.children.map((c) => c.id)];

  // Brands available in this category
  const brandsRaw = await prisma.product.findMany({
    where: { categoryId: { in: catIds }, isActive: true, brandId: { not: null } },
    select: { brand: { select: { id: true, title: true, slug: true, logoUrl: true } } },
    distinct: ["brandId"],
  });
  const brands = brandsRaw
    .map((p) => p.brand)
    .filter(Boolean)
    .filter((b, i, arr) => arr.findIndex((x) => x!.id === b!.id) === i) as {
    id: string; title: string; slug: string; logoUrl: string | null;
  }[];

  // Spec values used in products of this category
  const specValues = await prisma.productSpecValue.findMany({
    where: { product: { categoryId: { in: catIds }, isActive: true } },
    select: {
      value: true,
      specItem: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
          group: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { specItem: { sortOrder: "asc" } },
  });

  // Group spec values: groupId → { title, items: { specItemId, specItemTitle, values: string[] } }
  type SpecEntry = { specItemId: string; specItemTitle: string; values: string[] };
  const groupMap = new Map<string, { groupId: string; groupTitle: string; items: Map<string, SpecEntry> }>();

  for (const sv of specValues) {
    const g = sv.specItem.group;
    if (!groupMap.has(g.id)) {
      groupMap.set(g.id, { groupId: g.id, groupTitle: g.title, items: new Map() });
    }
    const group = groupMap.get(g.id)!;
    if (!group.items.has(sv.specItem.id)) {
      group.items.set(sv.specItem.id, { specItemId: sv.specItem.id, specItemTitle: sv.specItem.title, values: [] });
    }
    const item = group.items.get(sv.specItem.id)!;
    if (!item.values.includes(sv.value)) item.values.push(sv.value);
  }

  const specGroups = Array.from(groupMap.values()).map((g) => ({
    groupId: g.groupId,
    groupTitle: g.groupTitle,
    items: Array.from(g.items.values()).map((it) => ({
      ...it,
      values: it.values.sort(),
    })),
  }));

  return NextResponse.json({
    subcategories: cat.children,
    brands,
    specGroups,
  });
}
