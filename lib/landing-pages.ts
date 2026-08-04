import { prisma } from "@/lib/prisma";

export interface LandingPageData {
  id: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  filters: Record<string, string>;
  title: string;
  h1: string;
  description: string;
  intro: string | null;
  bodyHtml: string | null;
  isIndexable: boolean;
}

function shape(lp: any): LandingPageData {
  return {
    id: lp.id,
    slug: lp.slug,
    categoryId: lp.categoryId,
    categorySlug: lp.category.slug,
    filters: (lp.filters ?? {}) as Record<string, string>,
    title: lp.title,
    h1: lp.h1,
    description: lp.description,
    intro: lp.intro,
    bodyHtml: lp.bodyHtml,
    isIndexable: lp.isIndexable,
  };
}

export async function getLandingBySlug(slug: string): Promise<LandingPageData | null> {
  const lp = await prisma.landingPage.findFirst({
    where: { slug, isActive: true },
    include: { category: { select: { slug: true } } },
  });
  return lp ? shape(lp) : null;
}

/** برای ریدایرکت query→collections و برای علامت‌گذاری فیلتر فعال در سایدبار */
export async function matchLandingByFilters(
  categorySlug: string,
  activeFilters: Record<string, string>
): Promise<LandingPageData | null> {
  const keys = Object.keys(activeFilters).sort();
  if (keys.length === 0) return null;

  const candidates = await prisma.landingPage.findMany({
    where: { isActive: true, category: { slug: categorySlug } },
    include: { category: { select: { slug: true } } },
  });

  const hit = candidates.find((lp) => {
    const f = (lp.filters ?? {}) as Record<string, string>;
    const lpKeys = Object.keys(f).sort();
    if (lpKeys.length !== keys.length) return false;
    return lpKeys.every((k, i) => k === keys[i] && f[k] === activeFilters[k]);
  });

  return hit ? shape(hit) : null;
}

export async function listIndexableLandings(): Promise<LandingPageData[]> {
  const rows = await prisma.landingPage.findMany({
    where: { isActive: true, isIndexable: true },
    include: { category: { select: { slug: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(shape);
}

/** اعتبارسنجی: آیا همه فیلترها هنوز در دیتابیس resolve می‌شوند؟ */
export async function validateFilters(
  filters: Record<string, string>
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const [key, val] of Object.entries(filters)) {
    if (key === "brand") {
      const b = await prisma.brand.findFirst({ where: { slug: val, isActive: true } });
      if (!b) errors.push(`برند «${val}» یافت نشد یا غیرفعال است`);
      continue;
    }
    const attr = await prisma.attribute.findFirst({
      where: { slug: key },
      include: { values: { select: { slug: true } } },
    });
    if (!attr) { errors.push(`ویژگی «${key}» یافت نشد`); continue; }
    if (!attr.values.some(v => v.slug === val)) {
      errors.push(`مقدار «${val}» برای ویژگی «${key}» یافت نشد`);
    }
  }

  return { ok: errors.length === 0, errors };
}