import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import MagHomeClient from "@/components/blog/MagHomeClient";
import { buildBaseMetadata } from "@/lib/seo";
import { magListWhere, magListOrder, MAG_LIST_SELECT, MAG_PAGE_SIZE } from "@/lib/mag-list";

// قبلاً فقط `title` بود: صفحه در sitemap هست و ایندکس می‌شود ولی canonical
// نداشت، پس هر واریانت آدرس می‌توانست جداگانه ایندکس شود.
export const metadata = buildBaseMetadata({
  title: "مجله",
  description: "آخرین مقالات، راهنمای خرید و اخبار فروشگاه",
  path: "/mag",
});

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function MagPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = { cat: one(sp.cat), tag: one(sp.tag), q: one(sp.q), sort: one(sp.sort) || "newest" };

  const [posts, total, featured, categories, tag] = await Promise.all([
    prisma.blogPost.findMany({
      where: magListWhere(filters),
      orderBy: magListOrder(filters.sort),
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

  return (
    <MagHomeClient
      initialPosts={serialize(posts)}
      initialTotal={total as number}
      featured={serialize(featured)}
      categories={serialize(categories)}
      initialFilters={filters}
      tagTitle={tag?.title ?? null}
    />
  );
}
