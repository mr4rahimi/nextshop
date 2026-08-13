#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import readline from "node:readline";

const CFG = "./scripts/deploy/targets.json";
if (!existsSync(CFG)) { console.error(`❌ ${CFG} یافت نشد`); process.exit(1); }
const { targets } = JSON.parse(readFileSync(CFG, "utf8"));

// ── آرگومان‌ها ──
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const YES = argv.includes("--yes");
const tierIdx = argv.indexOf("--tier");
const tier = tierIdx >= 0 ? argv[tierIdx + 1] : null;
const names = argv.filter(a => !a.startsWith("--") && a !== tier);

let selected = tier
  ? targets.filter(t => t.tier === tier)
  : names.length
    ? targets.filter(t => names.includes(t.name))
    : [];

if (!selected.length) {
  console.log("استفاده:");
  console.log("  node scripts/deploy/deploy.mjs 9dm [--dry-run]");
  console.log("  node scripts/deploy/deploy.mjs --tier demo");
  console.log("  node scripts/deploy/deploy.mjs mahamprint bartarjanebi\n");
  console.log("سایت‌های موجود:", targets.map(t => `${t.name} (${t.tier})`).join(", "));
  process.exit(1);
}

// ── مسیرهایی که هرگز منتقل نمی‌شوند ──
const EXCLUDES = [
  ".git", ".env", ".env.*", "logs", ".next/cache",
  "public/uploads", "public/upload", "public/products",
  "public/banners", "public/brands", "public/categories", "public/mid-banners",
  "release-keys", "release-out", "scripts/deploy/targets.json",
  // فقط روی سرور ساخته می‌شود و مبنای تصمیم انتقال node_modules است.
  // اگر --delete پاکش کند، هر استقرار بی‌دلیل کل node_modules را دوباره
  // منتقل می‌کند (چند دقیقه) و روی سایت زنده جایگزینش می‌کند.
  ".deps-hash",
  "*.tar.gz", "*.zip", "backups", "__pycache__",
  "tsconfig.tsbuildinfo", "node_modules", ".next",
  // پیکربندی مخصوص هر سایت — نام و پورت pm2 متفاوت است
  "ecosystem.config.js", "ecosystem.config.js.bak",
  // ابزار توسعه و فایل‌های زائد
  ".claude", ".qodo", "components.backup", "dev-ui",
  "*.bak", "attr-slug-report.txt", "products-without-specs.csv",
   // مستندات و دیتاست‌های حجیم
  "list-of-cities-in-Iran-main", "iranpayamak", "hesabanweb_files",
  "hesabanweb.html", "hesabanweb.json", "Torob-Sync-main",
  "nodejs_aqayepardakht_sample", "shop-theme", "guid",
  "schema-engine.tar.gz",
  // راهنماهای توسعه — فقط لوکال
  "*.md", "!README.md",
];

const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const shq = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const ssh = (t, cmd) => `ssh -o BatchMode=yes ${t.user}@${t.host} ${JSON.stringify(cmd)}`;

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); }));
}
async function deployOne(t) {
  const tag = `[${t.name}]`;
  if (!t.port) throw new Error(`فیلد port برای «${t.name}» در targets.json تعریف نشده`);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${tag} ${DRY ? "🔍 DRY-RUN" : "🚀 استقرار"} → ${t.host}:${t.path}`);
  console.log("═".repeat(60));

  // ۱) بررسی اتصال و وجود مسیر
  console.log(`${tag} بررسی اتصال...`);
  const check = shq(ssh(t, `test -d ${t.path} && test -f ${t.path}/.env && pm2 describe ${t.pm2} >/dev/null 2>&1 && echo OK || echo FAIL`));
  if (check !== "OK") throw new Error(`مسیر، فایل .env یا پروسه pm2 «${t.pm2}» یافت نشد`);

  const rsyncArgs = [
   "-az", "--delete", "--max-delete=200",
    ...EXCLUDES.map(e => `--exclude='${e}'`),
    DRY ? "--dry-run --itemize-changes" : "",
    "./", `${t.user}@${t.host}:${t.path}/`,
  ].filter(Boolean).join(" ");

  if (DRY) {
    console.log(`${tag} فایل‌هایی که منتقل می‌شوند:\n`);
    sh(`rsync ${rsyncArgs}`);
    console.log(`\n${tag} ⚠️  بررسی کن که public/uploads و .env در لیست بالا نباشند.`);
    return;
  }

 // ۲) بکاپ دیتابیس
  console.log(`${tag} بکاپ دیتابیس...`);
  const rawEnv = shq(ssh(t, `cat ${t.path}/.env`));
  const m = rawEnv.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (!m) throw new Error("DATABASE_URL در .env سرور یافت نشد");
  const dbUrl = m[1].trim().replace(/^["']|["']$/g, "");
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) throw new Error("فرمت DATABASE_URL نامعتبر است");

  const dumpPath = `/var/backups/mymonta/${t.name}-db-${ts}.sql.gz`;
  sh(ssh(t, `mkdir -p /var/backups/mymonta`));

  // پارس اجزای اتصال در Node — نه در shell
  let u;
  try { u = new URL(dbUrl); } catch { throw new Error("DATABASE_URL قابل پارس نیست"); }
 

  // پسورد از طریق stdin به bash داده می‌شود تا در لاگ خطا ظاهر نشود
   const dbUser = safeDecode(u.username);
  const dbPass = safeDecode(u.password);
  const dbName = u.pathname.replace(/^\//, "");

  const remoteScript = [
    `set -o pipefail`,
    `export PGHOST='${u.hostname}' PGPORT='${u.port || 5432}'`,
    `export PGUSER='${dbUser}'`,
    `export PGDATABASE='${dbName}'`,
    `export PGPASSWORD="$1"`,
    `pg_dump | gzip > ${dumpPath}`,
  ].join("\n");

  const r = spawnSync("ssh", [
    "-o", "BatchMode=yes", `${t.user}@${t.host}`,
    "bash", "-s", "--", dbPass,
  ], { input: remoteScript, stdio: ["pipe", "inherit", "inherit"] });

  if (r.status !== 0) throw new Error("pg_dump شکست خورد");

  const size = parseInt(shq(ssh(t, `stat -c %s ${dumpPath}`)));
  if (!Number.isFinite(size) || size < 10240) {
    throw new Error(`بکاپ ناموفق — حجم فایل فقط ${size} بایت است. استقرار متوقف شد.`);
  }
  console.log(`${tag} ✓ بکاپ گرفته شد (${(size / 1024 / 1024).toFixed(1)} مگابایت)`);

  // ── دروازه ایمنی ──
  const products = parseInt(shq(ssh(t, `export PGPASSWORD='${dbPass}' && ` +
    `psql -h ${u.hostname} -p ${u.port || 5432} -U ${dbUser} -d ${dbName} -tAc ` +
    `"SELECT COALESCE((SELECT COUNT(*) FROM \\"Product\\"),0)"`)).trim()) || 0;

  console.log(`${tag} دیتابیس: ${products} محصول | بکاپ: ${(size / 1024).toFixed(0)} کیلوبایت`);

  if (products > 100 && size < 51200) {
    throw new Error(`بکاپ مشکوک: ${products} محصول ولی بکاپ فقط ${(size/1024).toFixed(0)} کیلوبایت. متوقف شد.`);
  }

  if (t.tier === "production" && !YES) {
    console.log(`\n${tag} ⚠️  سایت پروداکشن — ${products} محصول، بکاپ ${(size/1024/1024).toFixed(1)} مگابایت`);
    const a = await ask(`${tag} بکاپ دستی گرفته و روی لپ‌تاپ آورده‌ای؟ تایپ کن «backup-ok»: `);
    if (a !== "backup-ok") throw new Error("لغو شد");
  }
  // ۳) بکاپ کد
  console.log(`${tag} بکاپ کد فعلی...`);
  sh(ssh(t, `cd ${t.path} && tar -czf /var/backups/mymonta/${t.name}-code-${ts}.tar.gz ` +
    `--exclude=node_modules --exclude=public --exclude=.next --exclude=logs . 2>/dev/null || true`));

  // ۴) انتقال فایل‌ها
  console.log(`${tag} انتقال فایل‌ها...`);
  sh(`rsync ${rsyncArgs}`);

  // ۴.۵) وابستگی‌ها — فقط اگر lockfile تغییر کرده
  const localHash = shq(`sha256sum pnpm-lock.yaml | cut -c1-16`);
  const remoteHash = shq(ssh(t, `cat ${t.path}/.deps-hash 2>/dev/null || echo none`));

  /** decodeURIComponent امن — اگر رشته encode نشده باشد خطا نمی‌دهد */

  if (localHash !== remoteHash) {
    console.log(`${tag} وابستگی‌ها تغییر کرده — انتقال node_modules (چند دقیقه طول می‌کشد)...`);
    sh(ssh(t, `rm -rf ${t.path}/node_modules.new`));
    sh(`tar -czf - node_modules | ssh -o BatchMode=yes ${t.user}@${t.host} ` +
       `"mkdir -p ${t.path}/node_modules.new && tar -xzf - -C ${t.path}/node_modules.new"`);
    sh(ssh(t, `cd ${t.path} && rm -rf node_modules.old && ` +
       `mv node_modules node_modules.old 2>/dev/null; ` +
       `mv node_modules.new/node_modules node_modules && rmdir node_modules.new && ` +
       `echo ${localHash} > .deps-hash && rm -rf node_modules.old`));
  } else {
    console.log(`${tag} وابستگی‌ها بدون تغییر — رد شد`);
  }

  // ۵) migrate + build + restart
  console.log(`${tag} migrate و build...`);
  try {
    sh(ssh(t, `cd ${t.path} && npx prisma generate && npx prisma migrate deploy && ` +
      `NODE_OPTIONS="--max-old-space-size=2048" npx next build`));
  } catch {
    console.error(`${tag} ❌ build شکست خورد — سایت هنوز با نسخه قبلی بالاست`);
    console.error(`${tag} بکاپ: /var/backups/mymonta/${t.name}-code-${ts}.tar.gz`);
    throw new Error("build failed");
  }

  console.log(`${tag} ری‌استارت...`);
  sh(ssh(t, `pm2 restart ${t.pm2} --update-env`));

  // ۶) health check
  console.log(`${tag} بررسی سلامت (از داخل سرور، پورت ${t.port})...`);
  await new Promise(r => setTimeout(r, 12000));
  let ok = false;
  for (let i = 1; i <= 6; i++) {
    let code = "000";
    try {
      code = shq(ssh(t, `curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:${t.port}/`)).trim();
    } catch { code = "000"; }
    console.log(`${tag}   تلاش ${i}: HTTP ${code}`);
    if (/^[23]/.test(code)) { ok = true; break; }
    await new Promise(r => setTimeout(r, 6000));
  }

  if (!ok) {
    console.error(`\n${tag} ❌ سایت پاسخ نمی‌دهد — بازگردانی...`);
    sh(ssh(t, `cd ${t.path} && tar -xzf /var/backups/mymonta/${t.name}-code-${ts}.tar.gz && ` +
      `npx next build && pm2 restart ${t.pm2} --update-env`));
    throw new Error("health check failed — بازگردانی انجام شد");
  }

  console.log(`${tag} ✅ موفق — ${t.url}`);
}

// ── اجرا ──
(async () => {
  console.log(`\nسایت‌های هدف: ${selected.map(t => t.name).join("، ")}`);

  const prod = selected.filter(t => t.tier === "production");
  if (prod.length && !DRY && !YES) {
    console.log(`\n⚠️  ${prod.length} سایت پروداکشن در لیست است: ${prod.map(t => t.name).join("، ")}`);
    const a = await ask("برای ادامه «yes» تایپ کن: ");
    if (a !== "yes") { console.log("لغو شد."); process.exit(0); }
  }

  const failed = [];
  for (const t of selected) {
    try { await deployOne(t); }
    catch (e) {
      failed.push(t.name);
      console.error(`\n[${t.name}] ❌ ${e.message}`);
      if (selected.indexOf(t) < selected.length - 1) {
        const a = await ask("ادامه با سایت بعدی؟ (yes/no): ");
        if (a !== "yes") break;
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(failed.length ? `❌ ناموفق: ${failed.join("، ")}` : "✅ همه سایت‌ها بروز شدند");
})();