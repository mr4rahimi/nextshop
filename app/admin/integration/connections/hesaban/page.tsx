import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HesabanForm from "./HesabanForm";

export const dynamic = "force-dynamic";

export default async function HesabanConnectionPage() {
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: "hesaban" },
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
        <Link href="/admin/integration/connections"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← اتصالات
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-sm font-black text-blue-600 dark:text-blue-400">
            ح
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">وب‌حسابان</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        اتصال به نرم‌افزار حسابداری وب‌حسابان برای همگام‌سازی موجودی و قیمت
      </p>

      <HesabanForm existingConnection={conn} />
    </div>
  );
}
