/**
 * بررسی دسترسی سرویس گفت‌وگوی باسلام با توکن ذخیره‌شده در همین نصب.
 *
 *   node scripts/basalam-chat-probe.mjs
 *
 * فقط می‌خواند: هیچ پیامی ارسال یا هیچ رکوردی تغییر نمی‌کند.
 * خروجی نشان می‌دهد اسکوپ‌های customer.chat.read و customer.chat.write
 * روی توکن فعال هستند یا نه.
 */
import { readFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPENAPI = "https://openapi.basalam.com";

function loadEnv() {
  const out = {};
  for (const name of [".env", ".env.local"]) {
    let text;
    try { text = readFileSync(path.join(ROOT, name), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function decrypt(hex, keyHex) {
  const key = Buffer.from(keyHex && keyHex.length === 64 ? keyHex : "0".repeat(64), "hex");
  const buf = Buffer.from(hex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8"));
}

async function get(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  return { status: res.status, body: (await res.text()).slice(0, 900) };
}

const env = loadEnv();
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT "credentials", "status" FROM "IntegConnection" WHERE "platformCode" = 'basalam' LIMIT 1`,
);
await client.end();

if (rows.length === 0) {
  console.log("اتصال باسلام در این نصب ثبت نشده است.");
  process.exit(1);
}

const creds = decrypt(rows[0].credentials, env.INTEGRATION_ENCRYPTION_KEY);
const token = creds.accessToken;
console.log("وضعیت اتصال:", rows[0].status);
console.log("کلیدهای ذخیره‌شده:", Object.keys(creds).join("، "));

const who = await get(token, "https://auth.basalam.com/whoami");
console.log("\n— whoami —\n", who.status, who.body);

for (const p of ["/v1/chats?limit=3", "/v1/chats/unseen-count"]) {
  const r = await get(token, OPENAPI + p);
  console.log(`\n— GET ${p} —\n`, r.status, r.body);
}

// منطقه زمانی: باسلام زمان را بدون Z می‌دهد و معلوم نیست UTC است یا تهران.
// تازه‌ترین گفت‌وگو را با ساعت همین لحظه مقایسه می‌کنیم؛ اختلاف حدود ۳:۳۰
// یعنی زمان‌ها به وقت تهران‌اند و باید offset اعمال شود.
const probe = await get(token, OPENAPI + "/v1/chats?limit=1&order_by=updated_at");
try {
  const chat = JSON.parse(probe.body).data.chats[0];
  const raw = chat.last_message?.created_at ?? chat.updated_at;
  const asUtc = new Date(raw.replace(" ", "T") + "Z");
  const diffH = (Date.now() - asUtc.getTime()) / 3_600_000;
  console.log("\n— منطقه زمانی —");
  console.log("تازه‌ترین زمان از باسلام:", raw);
  console.log("همین لحظه به UTC:", new Date().toISOString());
  console.log("اختلاف بر حسب ساعت اگر UTC فرض شود:", diffH.toFixed(2));
  console.log(
    diffH < -1
      ? "زمان‌ها جلوترند: باسلام وقت تهران می‌دهد و باید ۳:۳۰ کم شود."
      : "اختلاف منفی چشمگیری نیست: فرض UTC درست است.",
  );
} catch {
  console.log("\n— منطقه زمانی — گفت‌وگویی برای مقایسه پیدا نشد");
}

console.log(
  "\nتفسیر: کد ۲۰۰ یعنی customer.chat.read فعال است." +
  " کد ۴۰۱ یعنی توکن منقضی شده و کد ۴۰۳ یعنی اسکوپ چت روی توکن نیست.",
);
