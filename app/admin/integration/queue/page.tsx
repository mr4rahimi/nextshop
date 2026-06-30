import { prisma } from "@/lib/prisma";
import { getQueueStats } from "@/lib/integration/core/queue";
import QueueClient from "./QueueClient";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [stats, jobs, platforms] = await Promise.all([
    getQueueStats(),
    prisma.integJob.findMany({
      orderBy: { createdAt: "desc" },
      take:    30,
      include: { platform: { select: { name: true } } },
    }),
    prisma.integPlatform.findMany({
      where:  { isActive: true },
      select: { code: true, name: true },
    }),
  ]);

  const serialized = jobs.map(j => ({
    id:           j.id,
    type:         j.type,
    platformCode: j.platformCode,
    status:       j.status,
    priority:     j.priority,
    attempts:     j.attempts,
    maxAttempts:  j.maxAttempts,
    lastError:    j.lastError,
    scheduledAt:  j.scheduledAt.toISOString(),
    startedAt:    j.startedAt?.toISOString() ?? null,
    completedAt:  j.completedAt?.toISOString() ?? null,
    createdAt:    j.createdAt.toISOString(),
    payload:      j.payload,
    platform:     j.platform,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">صف عملیات</h1>
        <p className="text-sm text-gray-500 mt-1">مدیریت job‌های یکپارچه‌سازی — retry، لغو، و مانیتورینگ</p>
      </div>

      <QueueClient
        initialJobs={serialized}
        initialTotal={jobs.length}
        initialStats={stats}
        platforms={platforms}
      />
    </div>
  );
}
