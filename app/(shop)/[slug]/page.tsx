import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import PageView from "@/components/store/pages/PageView";
import { normalizePageBlocks } from "@/lib/pages";
import {
  SITE_URL, canonicalUrl, buildBaseMetadata, noIndexMetadata,
  buildBreadcrumbSchema, buildFAQSchema,
} from "@/lib/seo";

/**
 * برگه‌های ثابت سایت روی ریشه: `/{slug}`.
 *
 * این مسیر داینامیک است و آخرین گزینه‌ی تطبیق در ریشه به حساب می‌آید؛ مسیرهای
 * ثابت (`/products`، `/mag`، ...) همچنان اولویت دارند. برای همین اسلاگ‌های
 * هم‌نام در `RESERVED_PAGE_SLUGS` هنگام ساخت برگه رد می‌شوند.
 */

interface Props { params: Promise<{ slug: string }> }

async function getPage(slug: string) {
  try {
    return await prisma.page.findFirst({ where: { slug, isActive: true } });
  } catch {
    return null;
  }
}

/** اولین پاراگراف متن برگه به‌عنوان توضیحات متای پیش‌فرض */
function firstText(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "برگه یافت نشد" };

  const title = page.seoTitle ?? page.title;
  if (!page.isIndexable) return noIndexMetadata(title);

  return buildBaseMetadata({
    title,
    description: page.seoDescription ?? page.subtitle ?? firstText(page.contentHtml),
    image:       page.coverImage,
    path:        `/${slug}`,
  });
}

export default async function StaticPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const breadcrumb = buildBreadcrumbSchema([
    { name: "خانه", url: SITE_URL },
    { name: page.title, url: canonicalUrl(`/${slug}`) },
  ]);

  // فقط برگه‌ی سوالات متداول اسکیمای FAQPage می‌گیرد
  const faq = page.template === "FAQ" ? normalizePageBlocks(page.blocks).faq : [];
  const faqSchema = faq.length > 0
    ? buildFAQSchema(faq.map(f => ({ question: f.q, answer: f.a })))
    : null;

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {faqSchema && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <PageView page={page} />
    </>
  );
}
