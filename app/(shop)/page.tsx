import StoreHomePageClient from "@/components/store/StoreHomePageClient";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { buildOrganizationSchema, buildWebSiteSchema, buildLocalBusinessSchema, SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";
import { firstPhone } from "@/lib/tel";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    const title = s?.homeSeoTitle || s?.storeName || "فروشگاه";
    return {
      title:       { absolute: title },
      description: s?.siteDescription ?? undefined,
      keywords:    s?.siteKeywords    ?? undefined,
      alternates:  { canonical: SITE_URL },
      openGraph:   { title, description: s?.siteDescription ?? undefined, url: SITE_URL, siteName: s?.storeName ?? "فروشگاه", locale: "fa_IR", type: "website", images: s?.storeLogo ? [{ url: s.storeLogo, width: 1200, height: 630 }] : [] },
    };
  } catch { return { title: { absolute: "فروشگاه" } }; }
}

export default async function StorePage() {
  let orgSchema = null;
  let wsSchema  = null;

  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    const widgets = await prisma.widget.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

    orgSchema = buildOrganizationSchema({
      name:            s?.storeName       ?? "فروشگاه",
      url:             SITE_URL,
      logo:            s?.storeLogo       ?? null,
      description:     s?.siteDescription ?? null,
      email:           s?.siteEmail       ?? null,
      phone:           firstPhone(s?.sitePhone),
      address:         s?.siteAddress     ?? null,
      city:            s?.siteCity        ?? null,
      province:        s?.siteProvince    ?? null,
      postalCode:      s?.sitePostalCode  ?? null,
      socialInstagram: s?.socialInstagram ?? null,
      socialTelegram:  s?.socialTelegram  ?? null,
      socialWhatsapp:  s?.socialWhatsapp  ?? null,
      socialTwitter:   s?.socialTwitter   ?? null,
    });

    wsSchema = buildWebSiteSchema({ name: s?.storeName ?? "فروشگاه", url: SITE_URL });

    const lbSchema = buildLocalBusinessSchema({
      name:            s?.storeName       ?? "فروشگاه",
      url:             SITE_URL,
      logo:            s?.storeLogo       ?? null,
      description:     s?.siteDescription ?? null,
      phone:           firstPhone(s?.sitePhone),
      email:           s?.siteEmail       ?? null,
      address:         s?.siteAddress     ?? null,
      city:            s?.siteCity        ?? null,
      province:        s?.siteProvince    ?? null,
      postalCode:      s?.sitePostalCode  ?? null,
      openingHours:    s?.openingHours    ?? null,
      socialInstagram: s?.socialInstagram ?? null,
      socialTelegram:  s?.socialTelegram  ?? null,
      socialWhatsapp:  s?.socialWhatsapp  ?? null,
      socialTwitter:   s?.socialTwitter   ?? null,
    });

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(wsSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(lbSchema) }} />
        {/* صفحه‌ی اصلی فقط ویجت است و هیچ ویجتی H1 نمی‌سازد؛ بدون این، صفحه‌ی اصلی
            تیتر اصلی نداشت (ممیزی مهر ۱۴۰۵). متنش در تنظیمات سایت قابل ویرایش است و
            برای صفحه‌خوان‌ها هم معنا دارد، پس پنهان‌کردن بصری‌اش متن فریبنده نیست. */}
        <h1 className="sr-only">{s?.homeH1 || s?.storeName || "فروشگاه"}</h1>
        <StoreHomePageClient widgets={serialize(widgets)} />
      </>
    );
  } catch {
    return <StoreHomePageClient widgets={[]} />;
  }
}