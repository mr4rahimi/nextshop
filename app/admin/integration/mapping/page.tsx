import { prisma } from "@/lib/prisma";
import MappingPageClient from "./MappingPageClient";

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const [platforms, mappingCount, suggestionCount] = await Promise.all([
    prisma.integPlatform.findMany({
      where: { isActive: true },
      select: { code: true, name: true, type: true },
    }),
    prisma.integProductMapping.count({ where: { isActive: true } }),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <MappingPageClient
      platforms={platforms}
      initialMappingCount={mappingCount}
      initialSuggestionCount={suggestionCount}
    />
  );
}
