import { prisma } from "@/lib/prisma";
import MappingPageClient from "./MappingPageClient";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { getStockSource } from "@/lib/integration/core/config";

export const dynamic = "force-dynamic";

export default async function MappingPage({ searchParams }: { searchParams: Promise<{ platform?: string }> }) {
  const { platform } = await searchParams;
  const [all, mappingCount, suggestionCount, source] = await Promise.all([
    prisma.integPlatform.findMany({
      where: { isActive: true },
      select: { code: true, name: true, type: true },
    }),
    prisma.integMapping.count({ where: { isActive: true } }),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING" } }),
    getStockSource(),
  ]);
  // سرویس بی‌آداپتور، و حسابان در حالت حسابداری داخلی (کالا خودش پشت محصول سایت است)
  const platforms = all.filter((p) => getAdapter(p.code) && !(source === "internal" && p.code === "hesaban"));

  return (
    <MappingPageClient
      platforms={platforms}
      initialMappingCount={mappingCount}
      initialSuggestionCount={suggestionCount}
      source={source}
      initialTab={platform && platforms.some((p) => p.code === platform) ? platform : undefined}
    />
  );
}
