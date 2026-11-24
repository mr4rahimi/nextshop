import Link from "next/link";
import { Compass } from "lucide-react";
import { prisma } from "@/lib/prisma";
import MappingPageClient from "./MappingPageClient";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { getStockSource } from "@/lib/integration/core/config";
import { linkCandidates } from "@/lib/accounting/inventory/link-product";
import { PageHeader, btn } from "@/components/admin/accounting/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "نگاشت محصولات" };

/** نگاشت محصولات — docs/integrations/mapping-page.md */
export default async function MappingPage({ searchParams }: { searchParams: Promise<{ platform?: string; tab?: string }> }) {
  const { platform, tab } = await searchParams;
  const [all, mappingCount, suggestionCount, source] = await Promise.all([
    prisma.integPlatform.findMany({
      where: { isActive: true },
      select: { code: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.integMapping.count({ where: { isActive: true } }),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING" } }),
    getStockSource(),
  ]);
  // سرویس بی‌آداپتور، و حسابان در حالت حسابداری داخلی (کالا خودش پشت محصول سایت است)
  const platforms = all.filter((p) => getAdapter(p.code) && !(source === "internal" && p.code === "hesaban"));
  const codes = platforms.map((p) => p.code);

  const unmapped = codes.length
    ? await prisma.$queryRaw<{ code: string; n: bigint }[]>`
        SELECT pp."platformCode" AS code, count(*)::bigint AS n FROM "IntegPlatformProduct" pp
        WHERE pp."platformCode" = ANY(${codes})
          AND NOT EXISTS (
            SELECT 1 FROM "IntegMappingLink" l JOIN "IntegMapping" m ON m.id = l."mappingId"
            WHERE l."platformCode" = pp."platformCode" AND l."externalId" = pp."platformProductId" AND l."isActive" AND m."isActive")
        GROUP BY pp."platformCode"`
    : [];
  const unmappedBy = Object.fromEntries(unmapped.map((r) => [r.code, Number(r.n)]));

  const items = source === "internal" ? (await linkCandidates(prisma, { perPage: 10 })).total : null;
  const itemsMatched = source === "internal" && items ? (await linkCandidates(prisma, { perPage: 10, onlyMatched: true })).total : 0;

  const tabs = ["suggestions", "all", "items", ...codes];
  const initialTab =
    (tab && tabs.includes(tab) && (tab !== "items" || items !== null) ? tab : null) ??
    (platform && codes.includes(platform) ? platform : null) ??
    (suggestionCount > 0 ? "suggestions" : codes[0] ?? "all");

  return (
    <div className="space-y-2">
      <PageHeader
        title="نگاشت محصولات"
        help="integrationMapping"
        desc="هر محصول سایت را به همان محصول در هر بازارگاه وصل کنید تا موجودی، قیمت و سفارش‌ها یکی بمانند."
        actions={
          <Link href="/admin/integration/guide" className={btn.soft}>
            <Compass className="h-4 w-4" aria-hidden />
            راهنمای نگاشت
          </Link>
        }
      />
      <MappingPageClient
        platforms={platforms}
        source={source}
        initialTab={initialTab}
        stats={{
          mappings: mappingCount,
          suggestions: suggestionCount,
          unmappedBy,
          items,
          itemsMatched,
        }}
      />
    </div>
  );
}
