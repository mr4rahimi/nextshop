import { prisma } from "@/lib/prisma";
import HeaderSwitcher from "./HeaderSwitcher";

export default async function Header() {
  let logoUrl: string | null = null;
  let siteName: string | null = null;
  let homeHeaderVariant = "DEFAULT";

  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    logoUrl = s?.storeLogo || null;
    siteName = s?.storeName || null;
    homeHeaderVariant = s?.homeHeaderVariant || "DEFAULT";
  } catch {}

  return (
    <HeaderSwitcher
      logoUrl={logoUrl}
      siteName={siteName}
      homeVariant={homeHeaderVariant}
    />
  );
}