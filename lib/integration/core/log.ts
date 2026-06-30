import { prisma } from "@/lib/prisma";
import type {
  IntegJobType,
  IntegLogDirection,
  IntegEntityType,
  IntegLogStatus,
} from "@prisma/client";

export interface LogEntry {
  jobId?:        string;
  platformCode:  string;
  operationType: IntegJobType;
  direction:     IntegLogDirection;
  entityType:    IntegEntityType;
  entityId?:     string;
  requestData?:  unknown;
  responseData?: unknown;
  status:        IntegLogStatus;
  errorMessage?: string;
  durationMs?:   number;
}

export async function writeLog(entry: LogEntry): Promise<void> {
  await prisma.integLog.create({
    data: {
      jobId:        entry.jobId,
      platformCode: entry.platformCode,
      operationType: entry.operationType,
      direction:    entry.direction,
      entityType:   entry.entityType,
      entityId:     entry.entityId,
      requestData:  entry.requestData as any,
      responseData: entry.responseData as any,
      status:       entry.status,
      errorMessage: entry.errorMessage,
      durationMs:   entry.durationMs,
    },
  });
}

// helper: زمان اجرا را اندازه می‌گیرد و نتیجه را log می‌کند
export async function withLog<T>(
  base: Omit<LogEntry, "status" | "durationMs" | "responseData" | "errorMessage">,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await writeLog({
      ...base,
      status:      "SUCCESS",
      responseData: result as unknown,
      durationMs:  Date.now() - start,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeLog({
      ...base,
      status:       "ERROR",
      errorMessage: message,
      durationMs:   Date.now() - start,
    }).catch(() => {});
    throw err;
  }
}

// پاکسازی لاگ‌های قدیمی (بر اساس IntegSettings.logRetentionDays)
export async function cleanOldLogs(): Promise<number> {
  const settings = await prisma.integSettings.findUnique({ where: { id: "singleton" } });
  const days = settings?.logRetentionDays ?? 30;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { count } = await prisma.integLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
