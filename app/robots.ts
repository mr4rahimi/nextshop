import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// force-dynamic: same reason as sitemap.ts — SITE_URL differs per deployment.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/user/",
          "/cart",
          "/checkout",
          "/search",
          "/auth/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin/", "/api/", "/user/", "/cart", "/checkout", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host:    SITE_URL,
  };
}
