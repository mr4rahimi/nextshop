import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import ClubQrClient from "@/components/admin/club/ClubQrClient";

export const dynamic = "force-dynamic";

/**
 * QR عضویت باشگاه — برای پیشخوان فروش حضوری
 *
 * ⚠️ QR سمت سرور ساخته می‌شود و به‌صورت SVG می‌آید، نه تصویر: چاپ‌شده روی
 *    استند پیشخوان باید در هر اندازه‌ای واضح بماند.
 *
 * ⚠️ آدرس با `?via=qr` می‌آید تا در گزارش، عضوهای حضوری از عضوهای سایت جدا
 *    شوند (`ClubSource.IN_STORE`). بدون این پارامتر همه «سایت» ثبت می‌شوند و
 *    گزارش «جذب از هر پلتفرم» بی‌معنی می‌شود.
 */
export default async function AdminClubQrPage() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { clubEnabled: true, clubName: true, storeName: true },
  });

  const url = `${SITE_URL}/club/join?via=qr`;

  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
  });

  return (
    <ClubQrClient
      url={url}
      svg={svg}
      enabled={settings?.clubEnabled ?? false}
      title={settings?.clubName || `باشگاه مشتریان${settings?.storeName ? ` ${settings.storeName}` : ""}`}
    />
  );
}
