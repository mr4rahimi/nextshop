import { prisma } from "@/lib/prisma";
import LogsClient from "./LogsClient";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const [logs, total, platforms] = await Promise.all([
    prisma.integLog.findMany({
      orderBy: { createdAt: "desc" },
      take:    40,
      include: { platform: { select: { name: true } } },
    }),
    prisma.integLog.count(),
    prisma.integPlatform.findMany({
      where:  { isActive: true },
      select: { code: true, name: true },
    }),
  ]);

  const serialized = logs.map(l => ({
    id:            l.id,
    platformCode:  l.platformCode,
    operationType: l.operationType,
    direction:     l.direction,
    entityType:    l.entityType,
    entityId:      l.entityId,
    status:        l.status,
    errorMessage:  l.errorMessage,
    durationMs:    l.durationMs,
    responseData:  l.responseData,
    createdAt:     l.createdAt.toISOString(),
    platform:      l.platform,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">گزارش لاگ‌ها</h1>
        <p className="text-sm text-gray-500 mt-1">تاریخچه کامل عملیات یکپارچه‌سازی با فیلتر و صفحه‌بندی</p>
      </div>

      <LogsClient
        initialLogs={serialized}
        initialTotal={total}
        platforms={platforms}
      />
    </div>
  );
}
