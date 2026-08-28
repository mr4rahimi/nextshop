import { prisma } from "@/lib/prisma";
import HeaderSwitcher from "./HeaderSwitcher";
import AnnouncementBar from "./AnnouncementBar";
import { normalizeGlassConfig, type GlassHeaderConfig } from "./headers/registry";
import {
  isAnnouncementVisible,
  normalizeAnnouncementBar,
  type AnnouncementBarConfig,
} from "@/lib/announcementBar";

export default async function Header() {
  let logoUrl: string | null = null;
  let siteName: string | null = null;
  let homeHeaderVariant = "DEFAULT";
  let mobileMenuGlass = false;
  let glassConfig: GlassHeaderConfig | null = null;
  let announcement: AnnouncementBarConfig = normalizeAnnouncementBar(null);

  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    logoUrl = s?.storeLogo || null;
    siteName = s?.storeName || null;
    homeHeaderVariant = s?.homeHeaderVariant || "DEFAULT";
    mobileMenuGlass = s?.mobileMenuGlass ?? false;
    glassConfig = normalizeGlassConfig(s?.headerGlassConfig);
    announcement = normalizeAnnouncementBar(s?.announcementBar);
  } catch {}

  const switcher = (
    <HeaderSwitcher
      logoUrl={logoUrl}
      siteName={siteName}
      homeVariant={homeHeaderVariant}
      menuGlass={mobileMenuGlass}
      glassConfig={glassConfig}
    />
  );

  if (!isAnnouncementVisible(announcement)) return switcher;

  const bar = <AnnouncementBar config={announcement} />;

  // حالت چسبان: نوار و هدر داخل یک ظرف sticky می‌نشینند.
  // هدرها خودشان `sticky top-0` دارند؛ اگر نوار را جدا sticky می‌کردیم، هدر زیر آن
  // می‌رفت و ردیف اولش پنهان می‌شد. با این ظرف، هدر داخل جعبه‌ی والد و دقیقاً زیر
  // نوار می‌ماند و هیچ‌کدام از هدرها لازم نیست تغییر کنند.
  if (announcement.sticky) {
    return (
      <div className="sticky top-0 z-50">
        {bar}
        {switcher}
      </div>
    );
  }

  return (
    <>
      {bar}
      {switcher}
    </>
  );
}
