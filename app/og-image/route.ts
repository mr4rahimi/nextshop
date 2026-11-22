import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

/**
 * تصویر اشتراک‌گذاری پیش‌فرض (og:image صفحه‌هایی که تصویر خودشان را ندارند —
 * buildBaseMetadata در lib/seo.ts). به لوگوی تنظیمات سایت هدایت می‌کند تا تغییر لوگو
 * بدون بیلد اعمال شود؛ بدون لوگو فاوآیکن، بدون هر دو ۴۰۴.
 */
export async function GET() {
  const s = await prisma.storeSettings
    .findUnique({ where: { id: "singleton" }, select: { storeLogo: true, siteFavicon: true } })
    .catch(() => null);
  const logo = s?.storeLogo?.trim() || s?.siteFavicon?.trim();
  if (!logo) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(logo, SITE_URL).toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
