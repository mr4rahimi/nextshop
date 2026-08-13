import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// force-dynamic: same reason as sitemap.ts — SITE_URL differs per deployment.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      /**
       * فقط یک گروه. گروه جداگانه‌ی Googlebot که قبلاً اینجا بود `/search` را
       * disallow نمی‌کرد و چون در robots.txt گروه اختصاصی‌تر برنده است،
       * عملاً قانون گروه `*` برای گوگل بی‌اثر می‌شد.
       *
       * `/cart`، `/checkout` و `/search` عمداً disallow نشده‌اند: این صفحات
       * از هدر به هر صفحه‌ای لینک دارند و اگر خزیدنشان را ببندیم گوگل تگ
       * `noindex` را نمی‌بیند و ممکن است URL خالی را ایندکس کند. اجازه‌ی خزیدن
       * + noindex تنها راهی است که حذف قطعی را تضمین می‌کند.
       */
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/user/",
          "/seller/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host:    SITE_URL,
  };
}
