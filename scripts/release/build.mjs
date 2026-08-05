import { execSync } from "node:child_process";
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("استفاده: node scripts/release/build.mjs 2.11.0");
  process.exit(1);
}

const OUT = "./release-out";
const STAGE = `${OUT}/stage`;
const TARBALL = `${OUT}/mymonta-${version}.tar.gz`;

// فایل‌ها و پوشه‌هایی که وارد بسته نمی‌شوند
const EXCLUDE = [
  ".git", ".next/cache", "release-keys", "release-out",
  "node_modules/.cache", "logs", "backups",
  ".env", ".env.local", ".env.production",
  "public/uploads", "*.zip", "*.tar.gz", "__pycache__",
];

console.log(`📦 ساخت بسته نسخه ${version}\n`);

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(STAGE, { recursive: true });

console.log("→ بروزرسانی شماره نسخه...");
const keyFile = "lib/release-key.ts";
writeFileSync(keyFile,
  readFileSync(keyFile, "utf8").replace(/APP_VERSION = "[^"]*"/, `APP_VERSION = "${version}"`)
);

console.log("→ نصب وابستگی‌ها (production)...");
execSync("pnpm install --frozen-lockfile", { stdio: "inherit" });

console.log("→ تولید کلاینت Prisma...");
execSync("npx prisma generate", { stdio: "inherit" });

console.log("→ ساخت پروژه...");
execSync("pnpm build", { stdio: "inherit" });

console.log("→ کپی فایل‌ها...");
const excludeArgs = EXCLUDE.map(e => `--exclude='${e}'`).join(" ");
execSync(`rsync -a ${excludeArgs} ./ ${STAGE}/`, { stdio: "inherit" });

writeFileSync(`${STAGE}/VERSION`, version);

console.log("→ فشرده‌سازی...");
execSync(`tar -czf ${TARBALL} -C ${STAGE} .`, { stdio: "inherit" });

console.log("→ محاسبه checksum...");
const buf = readFileSync(TARBALL);
const sha256 = createHash("sha256").update(buf).digest("hex");

console.log("→ امضا...");
const priv = readFileSync("./release-keys/private.pem");
const signature = createSign(null).update(buf).sign(priv, "base64");
// ed25519 با createSign کار نمی‌کند — از sign مستقیم استفاده می‌کنیم
import { sign as edSign } from "node:crypto";
const sig = edSign(null, buf, priv).toString("base64");

const manifest = {
  version,
  releasedAt: new Date().toISOString(),
  filename: path.basename(TARBALL),
  sizeBytes: buf.length,
  sha256,
  signature: sig,
  minVersion: "2.10.0",
};

writeFileSync(`${OUT}/manifest-${version}.json`, JSON.stringify(manifest, null, 2));
rmSync(STAGE, { recursive: true });

console.log(`\n✅ آماده شد:`);
console.log(`   ${TARBALL}  (${(buf.length / 1024 / 1024).toFixed(1)} مگابایت)`);
console.log(`   ${OUT}/manifest-${version}.json`);
console.log(`\nهر دو را روی updates.9dm.ir آپلود کن.`);