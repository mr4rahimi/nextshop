import { prisma } from "@/lib/prisma";
import DiscountsClient from "./DiscountsClient";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  const platforms = await prisma.integPlatform.findMany({
    where:   { type: "MARKETPLACE" },
    orderBy: { code: "asc" },
    select:  { code: true, name: true },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">تخفیف بازارگاه‌ها</h1>
        <p className="text-sm text-gray-500 mt-1">
          درصد تخفیف، بازه‌ی زمانی و موجودی تخفیف‌دار هر محصول روی هر بازارگاه — از همین‌جا
        </p>
      </div>
      <DiscountsClient platforms={platforms} />
    </div>
  );
}
