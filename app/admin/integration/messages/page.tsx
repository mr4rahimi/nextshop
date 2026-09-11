import { prisma } from "@/lib/prisma";
import MessagesClient from "./MessagesClient";

export const dynamic = "force-dynamic";

export default async function IntegrationMessagesPage() {
  // فقط بازارگاه‌هایی که واقعاً گفت‌وگو دارند در فیلتر می‌آیند.
  const platforms = await prisma.integPlatform.findMany({
    where:   { isActive: true, type: "MARKETPLACE" },
    select:  { code: true, name: true },
    orderBy: { code: "asc" },
  });

  return <MessagesClient platforms={platforms} />;
}
