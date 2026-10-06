/**
 * درصد تکراری بودن متن در محتوای خود فروشگاه — محصولات، مقاله‌های مجله،
 * دسته‌ها، برندها، برگه‌ها، صفحات فرود و لندینگ‌های ابزارها.
 *
 * منبع‌ها دسته‌دسته (۳۰۰ تایی) خوانده و از روی اثر انگشت متن ورودی رد
 * می‌شوند؛ چیزی کش نمی‌شود و حافظه به اندازه‌ی متن ورودی است.
 * پیش‌نویس‌ها و محصولات غیرفعال هم بررسی می‌شوند: متن تکراری در پیش‌نویس
 * هم بعداً منتشر می‌شود.
 *
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 */

import { prisma } from "@/lib/prisma";
import { createDuplicateScanner, jsonText, stripHtml, type DupResult, type DupSource } from "./text-similarity";

const BATCH = 300;

const join = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).map((p) => stripHtml(p!)).join("\n");

/** خواندن دسته‌ای با cursor روی id */
async function each<T extends { id: string }>(
  load: (args: { take: number; skip: number; cursor?: { id: string }; orderBy: { id: "asc" } }) => Promise<T[]>,
  fn: (row: T) => DupSource,
  add: (s: DupSource) => void,
) {
  let cursor: string | undefined;
  for (;;) {
    const rows = await load({
      take: BATCH,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    for (const r of rows) add(fn(r));
    if (rows.length < BATCH) break;
    cursor = rows[rows.length - 1].id;
  }
}

export async function findSiteDuplicates(text: string): Promise<DupResult> {
  const scan = createDuplicateScanner(text);
  const add = (s: DupSource) => scan.add(s);

  await each(
    (a) => prisma.product.findMany({
      ...a,
      select: { id: true, title: true, slug: true, shortDescription: true, summaryDescription: true, expertDescription: true, faq: true },
    }),
    (p) => ({
      id: `product:${p.id}`, kind: "محصول", title: p.title, url: `/products/${p.slug}`,
      text: join(p.shortDescription, p.summaryDescription, p.expertDescription, jsonText(p.faq).join("\n")),
    }),
    add,
  );
  await each(
    (a) => prisma.blogPost.findMany({ ...a, select: { id: true, title: true, slug: true, excerpt: true, content: true, faq: true, status: true } }),
    (p) => ({
      id: `post:${p.id}`, kind: p.status === "PUBLISHED" ? "مقاله" : "مقاله (پیش‌نویس)", title: p.title,
      url: p.status === "PUBLISHED" ? `/mag/${p.slug}` : null,
      text: join(p.excerpt, p.content, jsonText(p.faq).join("\n")),
    }),
    add,
  );
  await each(
    (a) => prisma.category.findMany({ ...a, select: { id: true, title: true, slug: true, description: true, descriptionTop: true } }),
    (c) => ({ id: `category:${c.id}`, kind: "دسته", title: c.title, url: `/categories/${c.slug}`, text: join(c.descriptionTop, c.description) }),
    add,
  );
  await each(
    (a) => prisma.brand.findMany({ ...a, select: { id: true, title: true, slug: true, description: true } }),
    (b) => ({ id: `brand:${b.id}`, kind: "برند", title: b.title, url: `/brands/${b.slug}`, text: join(b.description) }),
    add,
  );
  await each(
    (a) => prisma.page.findMany({ ...a, select: { id: true, title: true, slug: true, subtitle: true, contentHtml: true, blocks: true } }),
    (p) => ({ id: `page:${p.id}`, kind: "برگه", title: p.title, url: `/${p.slug}`, text: join(p.subtitle, p.contentHtml, jsonText(p.blocks).join("\n")) }),
    add,
  );
  await each(
    (a) => prisma.landingPage.findMany({ ...a, select: { id: true, title: true, slug: true, description: true, intro: true, bodyHtml: true } }),
    (l) => ({ id: `collection:${l.id}`, kind: "صفحه‌ی فرود", title: l.title, url: `/collections/${l.slug}`, text: join(l.description, l.intro, l.bodyHtml) }),
    add,
  );
  await each(
    (a) => prisma.toolLanding.findMany({ ...a, where: { deletedAt: null }, select: { id: true, title: true, slug: true, status: true, draftBlocks: true, publishedBlocks: true } }),
    (l) => ({
      id: `landing:${l.id}`, kind: "لندینگ", title: l.title, url: l.status === "PUBLISHED" ? `/l/${l.slug}` : `/admin/tools/landings/${l.id}`,
      text: jsonText(l.publishedBlocks ?? l.draftBlocks).join("\n"),
    }),
    add,
  );

  return scan.result(10);
}
