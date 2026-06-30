import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SuggestionsClient from "./SuggestionsClient";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const suggestions = await prisma.integMappingSuggestion.findMany({
    where:   { status: "PENDING" },
    orderBy: { confidence: "desc" },
    take:    100,
    include: { platform: { select: { name: true } } },
  });

  const total = await prisma.integMappingSuggestion.count({ where: { status: "PENDING" } });

  // اضافه کردن اطلاعات محصول فروشگاه
  const withShop = await Promise.all(
    suggestions.map(async (s) => {
      const shopProduct = await prisma.product.findUnique({
        where:  { id: s.shopProductId },
        select: { id: true, title: true, mainImage: true },
      });
      return { ...s, shopProduct };
    }),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Link href="/admin/integration/mapping"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← نگاشت
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">پیشنهادهای اتصال</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        سیستم auto-match این جفت‌های محصول را پیشنهاد داده — تأیید یا رد کنید
      </p>

      {/* راهنما */}
      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          اطمینان بالای ۸۰٪ — احتمالاً صحیح
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          اطمینان ۷۰–۸۰٪ — نیاز به بررسی دقیق‌تر
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          اطمینان زیر ۷۰٪ — احتمال خطا
        </span>
      </div>

      <SuggestionsClient
        initialSuggestions={withShop}
        total={total}
      />
    </div>
  );
}
