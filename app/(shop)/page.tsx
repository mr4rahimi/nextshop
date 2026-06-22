import StoreHomePageClient from "@/components/store/StoreHomePageClient";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { buildOrganizationSchema, buildWebSiteSchema, SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    return {
      title:       s?.storeName       ?? "فروشگاه",
      description: s?.siteDescription ?? undefined,
      keywords:    s?.siteKeywords    ?? undefined,
      alternates:  { canonical: SITE_URL },
      openGraph:   { title: s?.storeName ?? "فروشگاه", description: s?.siteDescription ?? undefined, url: SITE_URL, siteName: s?.storeName ?? "فروشگاه", locale: "fa_IR", type: "website", images: s?.storeLogo ? [{ url: s.storeLogo, width: 1200, height: 630 }] : [] },
    };
  } catch { return { title: "فروشگاه" }; }
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
      phone:           s?.sitePhone       ?? null,
      address:         s?.siteAddress     ?? null,
      socialInstagram: s?.socialInstagram ?? null,
      socialTelegram:  s?.socialTelegram  ?? null,
    });

    wsSchema = buildWebSiteSchema({ name: s?.storeName ?? "فروشگاه", url: SITE_URL });

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(wsSchema) }} />
        <StoreHomePageClient widgets={serialize(widgets)} />
      </>
    );
  } catch {
    return <StoreHomePageClient widgets={[]} />;
  }
}