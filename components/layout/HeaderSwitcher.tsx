"use client";

import { usePathname } from "next/navigation";
import HeaderTop from "./HeaderTop";
import HeaderMenu from "./HeaderMenu";
import MobileMenuPortal from "./MobileMenuPortal";
import UniqueStarHeader from "./headers/UniqueStarHeader";
import GlassHeader from "./headers/GlassHeader";
import { normalizeVariant, type GlassHeaderConfig } from "./headers/registry";

export default function HeaderSwitcher({
  logoUrl,
  siteName,
  homeVariant,
  menuGlass = false,
  glassConfig = null,
}: {
  logoUrl: string | null;
  siteName: string | null;
  homeVariant: string;
  menuGlass?: boolean;
  glassConfig?: GlassHeaderConfig | null;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const variant = normalizeVariant(homeVariant);

  // هدر یونیک استار — فقط صفحه اصلی (scope: "home")
  if (isHome && variant === "UNIQUE_STAR") {
    return (
      <>
        <UniqueStarHeader logoUrl={logoUrl} siteName={siteName} />
        <MobileMenuPortal
          logoUrl={logoUrl}
          siteName={siteName}
          allowDesktop
          glass={menuGlass}
        />
      </>
    );
  }

  // هدر شیشه‌ای — روی کل سایت (scope: "site")
  if (variant === "GLASS") {
    return (
      <>
        <GlassHeader logoUrl={logoUrl} siteName={siteName} config={glassConfig} />
        <MobileMenuPortal logoUrl={logoUrl} siteName={siteName} glass={menuGlass} />
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl transition-all duration-300">
        <HeaderTop logoUrl={logoUrl} siteName={siteName} />
        <HeaderMenu />
      </header>
      <MobileMenuPortal logoUrl={logoUrl} siteName={siteName} glass={menuGlass} />
    </>
  );
}
