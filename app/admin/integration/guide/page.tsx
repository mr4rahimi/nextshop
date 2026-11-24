import { prisma } from "@/lib/prisma";
import { getStockSource } from "@/lib/integration/core/config";
import GuideClient from "./GuideClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "راهنمای نگاشت" };

export default async function IntegrationGuidePage() {
  const [source, hesaban] = await Promise.all([
    getStockSource(),
    prisma.integPlatform.findUnique({ where: { code: "hesaban" }, select: { isActive: true } }),
  ]);
  return <GuideClient current={source} hesabanOn={!!hesaban?.isActive} />;
}
