#!/usr/bin/env node
/**
 * کپی آیکن‌های سه‌بعدی Fluent Emoji (MIT) برای پیشخوان دسکتاپی.
 *
 * نام‌ها را از `fx("...")` در components/admin/desktop/registry.ts می‌خواند،
 * PNG سه‌بعدی هر کدام را از مخزن fluentui-emoji برمی‌دارد و به WebP ۱۲۸ پیکسلی
 * در public/panel-icons/fluent تبدیل می‌کند. فایل‌های موجود دوباره ساخته نمی‌شوند.
 *
 *   node scripts/desktop-icons.mjs ~/Downloads/fluentui-emoji-main
 *
 * مستندات: docs/features/admin-desktop.md
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/desktop-icons.mjs <fluentui-emoji repo>");
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const registry = fs.readFileSync(path.join(root, "components/admin/desktop/registry.ts"), "utf8");
const out = path.join(root, "public/panel-icons/fluent");
fs.mkdirSync(out, { recursive: true });

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const names = [...new Set([...registry.matchAll(/fx\("([^"]+)"\)/g)].map((m) => m[1]))].filter((n) => /[a-z]/i.test(n));

/** پوشه‌ی 3D — ایموجی‌های دارای رنگ پوست زیر Default/3D هستند */
function findPng(name) {
  const base = path.join(src, "assets", name);
  for (const dir of [path.join(base, "3D"), path.join(base, "Default", "3D")]) {
    if (!fs.existsSync(dir)) continue;
    const f = fs.readdirSync(dir).find((x) => x.endsWith(".png"));
    if (f) return path.join(dir, f);
  }
  return null;
}

let made = 0;
const missing = [];
for (const name of names) {
  const dest = path.join(out, `${slug(name)}.webp`);
  if (fs.existsSync(dest)) continue;
  const png = findPng(name);
  if (!png) {
    missing.push(name);
    continue;
  }
  await sharp(png).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88 }).toFile(dest);
  made++;
}

console.log(`${names.length} icons, ${made} written, ${missing.length} missing`);
if (missing.length) {
  console.log("missing:", missing.join(", "));
  process.exit(1);
}
