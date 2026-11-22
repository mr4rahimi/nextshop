import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import MagHomeClient from "@/components/blog/MagHomeClient";
import { buildBaseMetadata } from "@/lib/seo";
import { magListWhere, magListOrder, MAG_LIST_SELECT, MAG_PAGE_SIZE } from "@/lib/mag-list";

// قبلاً فقط `title` بود: صفحه در sitemap هست و ایندکس می‌شود ولی canonical
// نداشت، پس هر واریانت آدرس می‌توانست جداگانه ایندکس شود.
interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pageOf = (v: string | string[] | undefined) => Math.max(1, Math.min(1000, Math.floor(Number(one(v))) || 1));

/**
 * صفحه‌بندی قابل‌خزش: `/mag?page=N` مطالب همان صفحه را سمت سرور رندر می‌کند و دکمه‌ی
 * «مطالب بیشتر» لینک واقعی به صفحه‌ی بعد است — بدون آن خزنده فقط ۱۲ مطلب اول را می‌دید.
 * صفحه‌ی بیش از ۱ بدون فیلتر canonical خودش را دارد؛ فیلترها canonical به /mag.
 */
export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const filtered = !!(one(sp.cat) || one(sp.tag) || one(sp.q) || one(sp.sort));
  const paged = page > 1 && !filtered;
  return buildBaseMetadata({
    title: paged ? `مجله — صفحه ${page}` : "مجله",
    description: "آخرین مقالات، راهنمای خرید و اخبار فروشگاه" + (paged ? ` — صفحه ${page}` : ""),
    path: paged ? `/mag?page=${page}` : "/mag",
  });
}

export default async function MagPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = { cat: one(sp.cat), tag: one(sp.tag), q: one(sp.q), sort: one(sp.sort) || "newest" };
  const page = pageOf(sp.page);

  const [posts, total, featured, categories, tag] = await Promise.all([
    prisma.blogPost.findMany({
      where: magListWhere(filters),
      orderBy: magListOrder(filters.sort),
      skip: (page - 1) * MAG_PAGE_SIZE,
      take: MAG_PAGE_SIZE,
      select: MAG_LIST_SELECT,
    }),
    prisma.blogPost.count({ where: magListWhere(filters) }),
    // اسلایدر «داغ‌ترین‌ها»: پربازدیدترین مطالب، مستقل از فیلتر
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }],
      take: 5,
      select: MAG_LIST_SELECT,
    }),
    prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    }),
    filters.tag
      ? prisma.blogTag.findUnique({ where: { slug: filters.tag }, select: { title: true, slug: true } })
      : Promise.resolve(null),
  ]).catch(() => [[], 0, [], [], null] as const);
  // صفحه‌ای فراتر از آخرین صفحه محتوا ندارد — ۴۰۴، نه یک لیست خالی ایندکس‌پذیر
  if (page > 1 && (posts as unknown[]).length === 0) notFound();

  return (
    <MagHomeClient
      initialPosts={serialize(posts)}
      initialTotal={total as number}
      featured={serialize(featured)}
      categories={serialize(categories)}
      initialFilters={filters}
      initialPage={page}
      tagTitle={tag?.title ?? null}
    />
  );
}
