/**
 * امضای لایسنس آزمایشی — فقط برای توسعه و آزمون قفل‌ها. docs/plans/licensing.md
 * لایسنس واقعی را پنل گردانوس صادر می‌کند.
 *
 *   GARDANOS_LICENSE_KEY_FILE=/path/private.pem npx tsx scripts/plan/sign-license.ts \
 *     --domain 9dm.ir --plan start --features club,marketing --seats 2 --days 30
 *
 * --features '*' یعنی همه؛ --days 0 یعنی بی‌انقضا؛ عدد منفی برای آزمون انقضا.
 */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const keyFile = process.env.GARDANOS_LICENSE_KEY_FILE;
if (!keyFile) {
  console.error("GARDANOS_LICENSE_KEY_FILE را بدهید");
  process.exit(1);
}

const days = Number(arg("days", "30"));
const features = arg("features", "*");
const payload = {
  sub: arg("sub", "dev"),
  domain: arg("domain", "localhost"),
  business: arg("business", "آزمایشی"),
  plan: arg("plan", "start"),
  planName: arg("plan-name", arg("plan", "start")),
  features: features === "*" ? "*" : features.split(",").filter(Boolean),
  seats: Number(arg("seats", "0")),
  issuedAt: new Date().toISOString(),
  expiresAt: days === 0 ? null : new Date(Date.now() + days * 86_400_000).toISOString(),
  graceDays: Number(arg("grace", "14")),
};

const body = `GL1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
const sig = sign(null, Buffer.from(body), createPrivateKey(readFileSync(keyFile))).toString("base64url");
console.log(`${body}.${sig}`);
