import { prisma } from "@/lib/prisma";
import HeaderTop from "./HeaderTop";
import HeaderMenu from "./HeaderMenu";
import MobileMenuPortal from "./MobileMenuPortal";

export default async function Header() {
  let logoUrl = "/assets/images/logo.png";
  let siteName = "مانا شاپ";
  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    if (s?.storeLogo) logoUrl = s.storeLogo;
    if (s?.storeName) siteName = s.storeName;
  } catch {}

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl transition-all duration-300">
        <HeaderTop logoUrl={logoUrl} siteName={siteName} />
        <HeaderMenu />
      </header>
      <MobileMenuPortal logoUrl={logoUrl} siteName={siteName} />
    </>
  );
}
