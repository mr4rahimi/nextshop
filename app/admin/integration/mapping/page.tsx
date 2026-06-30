import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { serialize } from "@/lib/serialize";
import MappingPageClient from "./MappingPageClient";

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const [mappingCount, suggestionCount, recentMappings] = await Promise.all([
    prisma.integProductMapping.count({ where: { isActive: true } }),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING" } }),
    prisma.integProductMapping.findMany({
      where:   { isActive: true },
      orderBy: { createdAt: "desc" },
      take:    50,
      include: {
        shopProduct: {
          select: { id: true, title: true, price: true, stock: true, mainImage: true },
        },
        platform: { select: { name: true } },
      },
    }),
  ]);

  const mappings = JSON.parse(JSON.stringify(serialize(recentMappings)));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">نگاشت محصولات</h1>
          <p className="text-sm text-gray-500 mt-1">ارتباط محصولات فروشگاه با سیستم‌های خارجی</p>
        </div>
        {suggestionCount > 0 && (
          <Link href="/admin/integration/mapping/suggestions"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-bold hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
              {suggestionCount > 9 ? "9+" : suggestionCount}
            </span>
            پیشنهاد در انتظار
          </Link>
        )}
      </div>

      {/* آمار */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5">
          <p className="text-3xl font-black text-gray-900 dark:text-white">{mappingCount}</p>
          <p className="text-sm text-gray-500 mt-1">نگاشت فعال</p>
        </div>
        <Link href="/admin/integration/mapping/suggestions"
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-amber-200 dark:border-amber-500/20 p-5 hover:border-amber-400 dark:hover:border-amber-500/40 transition-colors">
          <p className="text-3xl font-black text-amber-500">{suggestionCount}</p>
          <p className="text-sm text-gray-500 mt-1">پیشنهاد در انتظار تأیید</p>
          {suggestionCount > 0 && (
            <p className="text-xs text-amber-500 mt-2 font-bold">← بررسی کنید</p>
          )}
        </Link>
      </div>

      <MappingPageClient
        initialMappings={mappings}
        total={mappingCount}
        platform="hesaban"
      />
    </div>
  );
}
