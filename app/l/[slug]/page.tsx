/**
 * لندینگ عمومی `/l/<slug>` — docs/features/tools.md بخش ۳.
 *
 * - `force-dynamic`: انتشار تازه باید فوراً دیده شود و قیمت محصولات زنده است.
 * - `noindex` پیش‌فرض روشن است (قابل خاموش‌کردن در تنظیمات همان لندینگ) —
 *   لندینگ تبلیغاتی نباید با صفحات اصلی فروشگاه رقابت کند.
 * - زیر `app/layout.tsx` است، پس `<html>`/`<body>` ندارد؛ هدر و فوتر فروشگاه
 *   (`app/(shop)`) هم ندارد — صفحه‌ی تک‌ستونه‌ی موبایل‌اول است.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import LandingPageView from "@/components/tools/LandingPageView";
import { canonicalUrl } from "@/lib/seo";
import { countLandingView, getPublishedLanding } from "@/lib/tools/landings";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await getPublishedLanding(decodeURIComponent(slug)).catch(() => null);
  if (!l) return { title: "پیدا نشد", robots: { index: false, follow: false } };
  const title = l.metaTitle || l.title;
  const url = canonicalUrl(`/l/${l.slug}`);
  return {
    title: { absolute: title },
    description: l.metaDescription ?? undefined,
    alternates: { canonical: url },
    robots: l.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: l.metaDescription ?? undefined,
      url,
      type: "website",
      ...(l.ogImage ? { images: [{ url: l.ogImage }] } : {}),
    },
  };
}

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params;
  const l = await getPublishedLanding(decodeURIComponent(slug));
  if (!l) notFound();

  // شمارش بی‌سروصدا با همان فیلتر ربات لینک کوتاه
  const h = await headers();
  void countLandingView(l.id, new Request(canonicalUrl(`/l/${l.slug}`), { headers: h }));

  return (
    <div className="min-h-screen" style={{ background: l.theme.background }}>
      <LandingPageView
        slug={l.slug}
        blocks={l.blocks}
        theme={l.theme}
        products={l.products}
        reviewPlatforms={l.reviewPlatforms}
      />
    </div>
  );
}
