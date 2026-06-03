import "@/app/globals.css";
import { myFont } from "@/app/fonts";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";

// metadata داینامیک از DB
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
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