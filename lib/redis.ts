import IORedis from "ioredis";

/**
 * اتصال مشترک Redis
 *
 * نکته مهم: BullMQ الزاماً به `maxRetriesPerRequest: null` نیاز دارد.
 * اگر این مقدار تنظیم نشود، Worker با خطای
 * "BullMQ: Your redis options maxRetriesPerRequest must be null" بالا نمی‌آید.
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:63791";

const globalForRedis = globalThis as unknown as { __redis?: IORedis };

function createRedis(): IORedis {
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });

  client.on("error", (err) => {
    console.error("[redis] خطای اتصال:", err.message);
  });

  return client;
}

export const redis: IORedis = globalForRedis.__redis ?? createRedis();

// در حالت توسعه، hot-reload نکست نباید هر بار یک اتصال جدید بسازد
if (process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis;
}

/** بررسی سلامت اتصال — در health-check و اسکریپت تست استفاده می‌شود */
export async function pingRedis(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === "PONG";
  } catch {
    return false;
  }
}
