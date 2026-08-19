import { prisma } from "@/lib/prisma";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function IntegrationOrdersPage() {
  const platforms = await prisma.integPlatform.findMany({
    where:   { isActive: true },
    select:  { code: true, name: true },
    orderBy: { code: "asc" },
  });

  return <OrdersClient platforms={platforms} />;
}
