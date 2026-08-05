import IORedis from "ioredis";

/**
 * اتصال اختیاری Redis
 *
 * اگر REDIS_URL تنظیم نشده باشد، هیچ اتصالی برقرار نمی‌شود و redis برابر null است.
 * مصرف‌کنندگان باید null را مدیریت کنند.
 *
 * نکته: BullMQ الزاماً به `maxRetriesPerRequest: null` نیاز دارد.
 */
const REDIS_URL = process.env.REDIS_URL?.trim() || null;

const globalForRedis = globalThis as unknown as { __redis?: IORedis | null };

function createRedis(): IORedis | null {
  if (!REDIS_URL) return null;

  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,          // فقط هنگام اولین استفاده وصل شود
    enableOfflineQueue: false,  // اگر قطع بود، دستور را در صف نگه ندار
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 5000)),
  });

  let logged = false;
  client.on("error", (err) => {
    if (!logged) {                       // فقط یک بار لاگ کن، نه بی‌نهایت
      console.error("[redis] خطای اتصال:", err.message);
      logged = true;
    }
  });
  client.on("ready", () => { logged = false; });

  return client;
}

export const redis: IORedis | null =
  globalForRedis.__redis !== undefined ? globalForRedis.__redis : createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis;
}

/** آیا Redis پیکربندی شده است؟ */
export const isRedisEnabled = redis !== null;

/** بررسی سلامت اتصال */
export async function pingRedis(): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}