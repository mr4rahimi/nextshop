import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BasalamForm from "./BasalamForm";

export const dynamic = "force-dynamic";

export default async function BasalamConnectionPage() {
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: "basalam" },
  });

  const conn = connection
    ? {
        id:               connection.id,
        status:           connection.status,
        lastSyncAt:       connection.lastSyncAt?.toISOString() ?? null,
        lastError:        connection.lastError,
        syncStockEnabled: connection.syncStockEnabled,
        syncPriceEnabled: connection.syncPriceEnabled,
        syncIntervalMin:  connection.syncIntervalMin,
      }
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      {/* هدر */}
      <div className="flex items-center gap-3">
        <Link href="/admin/integration"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← یکپارچه‌سازی
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-sm font-black text-orange-600 dark:text-orange-400">
            ب
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">باسلام</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        اتصال به مارکت‌پلیس باسلام — موجودی و قیمت از فروشگاه به باسلام ارسال می‌شود
      </p>

      <BasalamForm existingConnection={conn} />
    </div>
  );
}
