import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { getAllAdapters } from "@/lib/integration/core/adapter-registry";
import CreateProductsClient from "./CreateProductsClient";

export const dynamic = "force-dynamic";

// ساخت محصول سایت روی بازارگاه — docs/integrations/create-products.md
export default async function CreateProductsPage({ searchParams }: { searchParams: Promise<{ platform?: string }> }) {
  const { platform: wanted } = await searchParams;
  const supported = getAllAdapters().filter((a) => !!a.createProduct).map((a) => ({ code: a.platformCode, name: a.platformName }));
  const connections = await prisma.integConnection.findMany({
    where: { platformCode: { in: supported.map((s) => s.code) } },
    select: { platformCode: true, status: true },
  });
  const platforms = supported.map((s) => ({
    ...s,
    connected: connections.some((c) => c.platformCode === s.code && (c.status === "CONNECTED" || c.status === "SYNCING")),
  }));
  const platform = platforms.find((p) => p.code === wanted) ?? platforms[0] ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/integration" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← یکپارچه‌سازی
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">ساخت محصول در بازارگاه</h1>
        <HelpButton topic="integrationCreateProducts" />
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        محصولات سایت را با عکس، توضیح، قیمت، موجودی و تنوع‌ها (رنگ، سایز…) یک‌جا در بازارگاه بسازید؛ نگاشت هر محصول و هر تنوع خودکار ثبت می‌شود.
      </p>

      {platform ? (
        <CreateProductsClient platforms={platforms} platform={platform} />
      ) : (
        <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/[0.06] text-sm text-gray-500">
          هیچ بازارگاهی با امکان ساخت خودکار محصول در دسترس نیست.
        </div>
      )}
    </div>
  );
}
