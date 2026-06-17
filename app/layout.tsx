import "@/app/globals.css";
import { myFont } from "@/app/fonts";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";

// ── تبدیل themeConfig به CSS variables ────────────────────────────────────────
function buildCssVars(theme: Record<string, string>): string {
  if (!theme || Object.keys(theme).length === 0) return "";
  const vars = Object.entries(theme)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return `:root {\n${vars}\n}`;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    return {
      metadataBase: new URL(SITE_URL),
      title:       s?.storeName       ? `${s.storeName}` : "مانا شاپ",
      description: s?.siteDescription ?? "فروشگاه اینترنتی",
      keywords:    s?.siteKeywords    ?? undefined,
      icons: s?.siteFavicon
        ? { icon: s.siteFavicon, shortcut: s.siteFavicon }
        : { icon: "/favicon.ico" },
      openGraph: {
        title:       s?.storeName       ?? "مانا شاپ",
        description: s?.siteDescription ?? "",
        siteName:    s?.storeName       ?? "مانا شاپ",
      },
    };
  } catch {
    return { metadataBase: new URL(SITE_URL), title: "مانا شاپ", description: "فروشگاه اینترنتی" };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // لود تم از دیتابیس
  let cssVars = "";
  try {
    const s = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { themeConfig: true },
    });
    if (s?.themeConfig && typeof s.themeConfig === "object") {
      cssVars = buildCssVars(s.themeConfig as Record<string, string>);
    }
  } catch {}

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {cssVars && (
          <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        )}
        <link rel="stylesheet" href="/assets/js/plugin/swiper/swiper-bundle.min.css" />
        <script src="/assets/js/plugin/swiper/swiper-bundle.min.js" defer></script>
      </head>
      <body className={`${myFont.className} bg-white dark:bg-[#050505] text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}