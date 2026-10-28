/**
 * داده‌ی دموی عمومی — فروشگاه نمایشی لوازم جانبی موبایل (docs/plans/demo.md مرحله‌ی ۳)
 *
 *   DEMO_MODE=1 npx tsx scripts/demo/seed.ts
 *
 * روی دیتابیس **خالی** (تازه بعد از `prisma migrate deploy`) اجرا می‌شود؛ ریست شبانه
 * (`scripts/demo/reset.sh`) دیتابیس را از نو می‌سازد و همین را دوباره اجرا می‌کند، پس
 * تاریخ‌ها همیشه نسبت به امروزند: ۹۰ روز سفارش سایت و بازارگاه، فاکتور و دریافت.
 *
 * تا جای ممکن از همان توابع برنامه استفاده می‌کند (راه‌اندازی حسابداری، ماتریس کالا،
 * موجودی اول دوره، محصول از مدل، صف رویداد مالی) تا گزارش‌ها، کاردکس و اسناد
 * همان چیزی باشند که مشتری در فروشگاه خودش می‌بیند.
 *
 * ⚠️ فقط با `DEMO_MODE=1`، یا `--local` روی دیتابیس localhost. اگر محصولی در
 * دیتابیس باشد کاری نمی‌کند.
 */
import "../../lib/load-env";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { activateInternal } from "../../lib/accounting/setup";
import { createTreasury } from "../../lib/accounting/treasury";
import { runMatrix } from "../../lib/accounting/inventory/matrix";
import { saveOpeningInventory } from "../../lib/accounting/inventory/opening";
import { createFromModel } from "../../lib/accounting/inventory/to-product";
import { dispatchAccEvents } from "../../lib/accounting/dispatcher";
import { jalaliYearOf } from "../../lib/accounting/dates";
import { encryptCredentials } from "../../lib/integration/core/crypto";
import { processOrderForClub } from "../../lib/club/rewards";
import { slugify } from "../../lib/slug";
import { FIRST_NAMES, LAST_NAMES, DEMO_MARKETPLACES, fakePhone, pick } from "../../lib/demo/marketplace";
import { demoAdminPhone } from "../../lib/demo";

const ACTOR = { id: null, name: "داده‌ی نمایشی" };
const ROOT = path.resolve(__dirname, "../..");
const ASSETS = path.join(__dirname, "assets");
const UPLOAD_DIR = path.join(ROOT, "public/uploads/demo");
const img = (name: string) => `/uploads/demo/${name}.webp`;

const DAY = 86_400_000;
const rnd = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const chance = (p: number) => Math.random() < p;
const toman = (n: number) => BigInt(Math.round(n / 1000) * 1000);

/** زمانی در ساعت کاری `daysAgo` روز پیش — امروز فقط تا همین لحظه */
function at(daysAgo: number): Date {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(rnd(9, 22), rnd(0, 59), rnd(0, 59), 0);
  return d > new Date() ? new Date(Date.now() - rnd(5, 120) * 60_000) : d;
}

/** روزی در ۹۰ روز گذشته، با وزن بیشتر روی روزهای نزدیک (رشد فروش) */
const recentDay = () => Math.floor(Math.pow(Math.random(), 1.6) * 90);

function guard() {
  if (process.env.DEMO_MODE === "1") return;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
  if (process.argv.includes("--local") && local) return;
  throw new Error("فقط روی دمو (DEMO_MODE=1) یا با --local روی دیتابیس localhost");
}

// ── کاتالوگ ──────────────────────────────────────────────────────────

const CATS = [
  { key: "case", title: "قاب و کاور گوشی", slug: "phone-case" },
  { key: "glass", title: "گلس و محافظ صفحه", slug: "screen-protector" },
  { key: "charger", title: "شارژر و آداپتور", slug: "charger" },
  { key: "cable", title: "کابل شارژ و دیتا", slug: "cable" },
  { key: "powerbank", title: "پاوربانک", slug: "powerbank" },
  { key: "earbuds", title: "هندزفری و ایرباد", slug: "earbuds" },
  { key: "headphone", title: "هدفون", slug: "headphone" },
  { key: "speaker", title: "اسپیکر بلوتوثی", slug: "speaker" },
  { key: "holder", title: "هولدر و پایه", slug: "holder" },
  { key: "watchband", title: "ساعت هوشمند و بند", slug: "smartwatch" },
  { key: "memory", title: "کارت حافظه و فلش", slug: "memory" },
] as const;
type CatKey = (typeof CATS)[number]["key"];

const BRANDS = [
  ["anker", "انکر"], ["baseus", "باسئوس"], ["samsung", "سامسونگ"], ["apple", "اپل"], ["xiaomi", "شیائومی"],
  ["green-lion", "گرین لاین"], ["hoco", "هوکو"], ["jbl", "جی‌بی‌ال"], ["ugreen", "یوگرین"], ["spigen", "اسپیگن"],
  ["kingston", "کینگستون"], ["sandisk", "سن‌دیسک"],
] as const;
type BrandKey = (typeof BRANDS)[number][0];

interface Simple {
  title: string;
  cat: CatKey;
  brand: BrandKey;
  price: number;
  /** قیمت ویژه — فروش شگفت‌انگیز */
  sale?: number;
  image: string;
  features: string[];
}

const SIMPLE: Simple[] = [
  { title: "شارژر دیواری ۲۰ وات تایپ‌سی", cat: "charger", brand: "apple", price: 1_450_000, image: "charger-white", features: ["توان ۲۰ وات", "پشتیبانی از PD", "مناسب آیفون و آیپد"] },
  { title: "شارژر دیواری ۲۵ وات سوپر فست", cat: "charger", brand: "samsung", price: 980_000, sale: 840_000, image: "charger-white", features: ["شارژ سریع ۲۵ وات", "درگاه تایپ‌سی", "محافظ ولتاژ"] },
  { title: "شارژر ۶۵ وات گالیوم سه‌پورت", cat: "charger", brand: "anker", price: 2_890_000, image: "charger-black", features: ["فناوری GaN", "دو تایپ‌سی و یک USB-A", "شارژ لپ‌تاپ"] },
  { title: "شارژر ۳۰ وات دوپورت", cat: "charger", brand: "baseus", price: 1_190_000, image: "charger-black", features: ["تایپ‌سی و USB-A", "تقسیم هوشمند توان"] },
  { title: "شارژر فندکی خودرو ۴۵ وات", cat: "charger", brand: "ugreen", price: 870_000, sale: 760_000, image: "charger-black", features: ["دو خروجی", "بدنه‌ی فلزی"] },
  { title: "شارژر بی‌سیم ۱۵ وات", cat: "charger", brand: "xiaomi", price: 1_090_000, image: "charger-white", features: ["استاندارد Qi", "خنک‌کننده‌ی داخلی"] },
  { title: "کابل تایپ‌سی به تایپ‌سی ۱ متری ۶۰ وات", cat: "cable", brand: "anker", price: 490_000, image: "cable-white", features: ["۶۰ وات", "روکش کنفی", "۱ متر"] },
  { title: "کابل تایپ‌سی به لایتنینگ ۱ متری", cat: "cable", brand: "apple", price: 890_000, image: "cable-white", features: ["گواهی MFi", "شارژ سریع آیفون"] },
  { title: "کابل سه‌سر شارژ ۱.۲ متری", cat: "cable", brand: "baseus", price: 420_000, sale: 359_000, image: "cable-red", features: ["تایپ‌سی، لایتنینگ و میکرو", "روکش نایلونی"] },
  { title: "کابل تایپ‌سی ۲ متری ۱۰۰ وات", cat: "cable", brand: "ugreen", price: 690_000, image: "cable-black", features: ["۱۰۰ وات", "نمایشگر توان", "۲ متر"] },
  { title: "کابل میکرو یو‌اس‌بی ۱ متری", cat: "cable", brand: "hoco", price: 149_000, image: "cable-black", features: ["۲.۴ آمپر", "۱ متر"] },
  { title: "پاوربانک ۲۰۰۰۰ میلی‌آمپر ۲۲.۵ وات", cat: "powerbank", brand: "xiaomi", price: 1_890_000, sale: 1_690_000, image: "powerbank-black", features: ["۲۰۰۰۰ میلی‌آمپر", "شارژ سریع ۲۲.۵ وات", "سه خروجی"] },
  { title: "پاوربانک ۱۰۰۰۰ مگ‌سیف", cat: "powerbank", brand: "anker", price: 2_450_000, image: "powerbank-white", features: ["اتصال مغناطیسی", "شارژ بی‌سیم ۷.۵ وات"] },
  { title: "پاوربانک ۳۰۰۰۰ میلی‌آمپر ۶۵ وات", cat: "powerbank", brand: "baseus", price: 3_290_000, image: "powerbank-black", features: ["شارژ لپ‌تاپ", "نمایشگر دیجیتال"] },
  { title: "پاوربانک ۱۰۰۰۰ جیبی", cat: "powerbank", brand: "green-lion", price: 990_000, image: "powerbank-blue", features: ["سبک و جمع‌وجور", "دو خروجی"] },
  { title: "پاوربانک ۲۰۰۰۰ با کابل سرخود", cat: "powerbank", brand: "hoco", price: 1_190_000, sale: 1_050_000, image: "powerbank-white", features: ["کابل تایپ‌سی و لایتنینگ سرخود"] },
  { title: "ایرباد بی‌سیم نویزگیر", cat: "earbuds", brand: "samsung", price: 6_900_000, image: "earbuds-black", features: ["نویزگیر فعال", "۲۹ ساعت شارژدهی", "ضد آب IPX7"] },
  { title: "ایرباد بی‌سیم پرو", cat: "earbuds", brand: "apple", price: 12_500_000, image: "earbuds-white", features: ["نویزگیر فعال", "صدای فضایی", "کیس مگ‌سیف"] },
  { title: "ایرباد بی‌سیم اقتصادی", cat: "earbuds", brand: "xiaomi", price: 1_390_000, sale: 1_190_000, image: "earbuds-white", features: ["بلوتوث ۵.۳", "۲۰ ساعت شارژدهی"] },
  { title: "ایرباد گیمینگ کم‌تأخیر", cat: "earbuds", brand: "baseus", price: 1_690_000, image: "earbuds-blue", features: ["تأخیر ۴۵ میلی‌ثانیه", "نور RGB"] },
  { title: "هندزفری سیمی تایپ‌سی", cat: "earbuds", brand: "samsung", price: 490_000, image: "earbuds-white", features: ["میکروفون داخلی", "کنترل صدا"] },
  { title: "هدفون بی‌سیم روگوشی", cat: "headphone", brand: "jbl", price: 3_490_000, image: "headphone-black", features: ["۵۰ ساعت شارژدهی", "تاشو"] },
  { title: "هدفون نویزگیر ANC", cat: "headphone", brand: "anker", price: 4_690_000, sale: 4_190_000, image: "headphone-white", features: ["نویزگیر هیبرید", "اپلیکیشن اختصاصی"] },
  { title: "هدفون گیمینگ با میکروفون", cat: "headphone", brand: "hoco", price: 1_590_000, image: "headphone-red", features: ["میکروفون جداشدنی", "صدای ۷.۱"] },
  { title: "اسپیکر بلوتوثی ضدآب", cat: "speaker", brand: "jbl", price: 4_290_000, image: "speaker-blue", features: ["ضد آب IP67", "۱۲ ساعت پخش"] },
  { title: "اسپیکر بلوتوثی کوچک", cat: "speaker", brand: "xiaomi", price: 1_290_000, sale: 1_090_000, image: "speaker-black", features: ["۸ ساعت پخش", "اتصال دو اسپیکر"] },
  { title: "اسپیکر پارتی با نور", cat: "speaker", brand: "jbl", price: 9_800_000, image: "speaker-red", features: ["۱۰۰ وات", "نورپردازی", "ورودی میکروفون"] },
  { title: "اسپیکر بلوتوثی رادیو‌دار", cat: "speaker", brand: "green-lion", price: 1_490_000, image: "speaker-green", features: ["رادیو FM", "کارت حافظه"] },
  { title: "هولدر مغناطیسی دریچه‌ی کولر", cat: "holder", brand: "baseus", price: 590_000, image: "holder-black", features: ["آهنربای قوی", "چرخش ۳۶۰ درجه"] },
  { title: "هولدر شارژر وایرلس خودرو", cat: "holder", brand: "ugreen", price: 1_490_000, sale: 1_290_000, image: "holder-gray", features: ["شارژ بی‌سیم ۱۵ وات", "قفل خودکار"] },
  { title: "پایه‌ی رومیزی تاشو", cat: "holder", brand: "hoco", price: 290_000, image: "holder-gray", features: ["قابل تنظیم", "مناسب تبلت"] },
  { title: "مونوپاد بلوتوثی سه‌پایه", cat: "holder", brand: "xiaomi", price: 790_000, image: "holder-black", features: ["ریموت بلوتوثی", "سه‌پایه‌ی جداشدنی"] },
  { title: "ساعت هوشمند ورزشی", cat: "watchband", brand: "xiaomi", price: 3_690_000, image: "watchband-black", features: ["ضربان قلب و اکسیژن خون", "۱۴ روز شارژدهی"] },
  { title: "ساعت هوشمند با تماس بلوتوثی", cat: "watchband", brand: "samsung", price: 11_900_000, sale: 10_900_000, image: "watchband-gray", features: ["تماس از ساعت", "صفحه‌ی آمولد"] },
  { title: "کارت حافظه ۱۲۸ گیگ کلاس ۱۰", cat: "memory", brand: "sandisk", price: 690_000, image: "memory-red", features: ["سرعت ۱۲۰ مگابایت", "مناسب دوربین و گوشی"] },
  { title: "کارت حافظه ۶۴ گیگ", cat: "memory", brand: "kingston", price: 390_000, image: "memory-blue", features: ["سرعت ۱۰۰ مگابایت"] },
  { title: "فلش ۶۴ گیگ دوسر تایپ‌سی", cat: "memory", brand: "sandisk", price: 590_000, sale: 520_000, image: "memory-black", features: ["تایپ‌سی و USB-A", "USB 3.2"] },
  { title: "فلش ۱۲۸ گیگ فلزی", cat: "memory", brand: "kingston", price: 790_000, image: "memory-blue", features: ["بدنه‌ی فلزی", "USB 3.2"] },
];

const PHONES = ["آیفون ۱۵", "آیفون ۱۵ پرو", "آیفون ۱۴", "گلکسی S24", "گلکسی A55", "گلکسی A35"];

interface ModelDef {
  title: string;
  cat: CatKey;
  brand: BrandKey;
  price: number;
  axes: { name: string; values: string[] }[];
  /** تصویر هر رنگ — کلید مقدار رنگ */
  images: string[];
  features: string[];
}

const MODELS: ModelDef[] = [
  { title: "قاب سیلیکونی اصلی", cat: "case", brand: "spigen", price: 390_000, axes: [{ name: "مدل گوشی", values: PHONES }, { name: "رنگ", values: ["مشکی", "آبی", "صورتی", "سبز"] }], images: ["case-black", "case-blue", "case-pink", "case-green"], features: ["داخل مخمل", "لبه‌ی محافظ دوربین"] },
  { title: "قاب ضدضربه نظامی", cat: "case", brand: "spigen", price: 590_000, axes: [{ name: "مدل گوشی", values: PHONES.slice(0, 4) }, { name: "رنگ", values: ["مشکی", "بنفش"] }], images: ["case-black", "case-purple"], features: ["استاندارد ضربه‌ی نظامی", "گوشه‌های بادی"] },
  { title: "گلس سرامیکی تمام‌صفحه", cat: "glass", brand: "green-lion", price: 180_000, axes: [{ name: "مدل گوشی", values: PHONES }], images: ["glass-clear"], features: ["انعطاف‌پذیر", "ضد ضربه", "لبه‌ی مشکی"] },
  { title: "گلس حریم شخصی (پرایوسی)", cat: "glass", brand: "spigen", price: 290_000, axes: [{ name: "مدل گوشی", values: PHONES.slice(0, 4) }], images: ["glass-clear"], features: ["دید از کنار بسته", "سختی ۹H"] },
  { title: "بند سیلیکونی ساعت هوشمند", cat: "watchband", brand: "apple", price: 250_000, axes: [{ name: "رنگ", values: ["مشکی", "صورتی", "آبی", "سبز", "طوسی"] }, { name: "سایز", values: ["۴۱ میلی‌متر", "۴۵ میلی‌متر"] }], images: ["watchband-black", "watchband-pink", "watchband-blue", "watchband-green", "watchband-gray"], features: ["سیلیکون نرم", "قفل پینی"] },
];

const description = (title: string, features: string[]) =>
  `<p>${title} با کیفیت ساخت بالا و ضمانت اصالت کالا. این محصول در فروشگاه نمایشی گجت‌لند برای آشنایی با پنل گردانوس قرار گرفته است.</p>` +
  `<h2>ویژگی‌ها</h2><ul>${features.map((f) => `<li>${f}</li>`).join("")}</ul>` +
  `<p>ارسال به سراسر کشور، تحویل یک‌روزه در تهران و ۷ روز ضمانت بازگشت.</p>`;

// ── مراحل ────────────────────────────────────────────────────────────

function copyAssets() {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const f of readdirSync(ASSETS)) if (f.endsWith(".webp")) copyFileSync(path.join(ASSETS, f), path.join(UPLOAD_DIR, f));
}

/** اسکریپت‌های پیش‌فرض خود برنامه (نقش‌ها، انواع کار، ارسال، باشگاه…) — همه idempotent و هم‌زمان */
async function runDefaultSeeds(scripts: string[]) {
  const tsx = path.join(ROOT, "node_modules/.bin/tsx");
  const run = promisify(execFile);
  await Promise.all(
    scripts.map((s) =>
      run(tsx, [path.join(ROOT, "scripts", `${s}.ts`)], { cwd: ROOT, env: process.env }).catch((e: unknown) =>
        console.warn(`⚠️ ${s}:`, e instanceof Error ? e.message.split("\n")[0] : e),
      ),
    ),
  );
}

const DEFAULT_SEEDS = ["seed-staff-roles", "seed-task-types", "seed-shipping-methods", "seed-club-templates", "seed-recurring-rules", "seed-seo-categories", "seed-link-types", "seed-commission-plan"];

async function settings() {
  const data = {
    storeName: "گجت‌لند",
    storeLogo: img("logo"),
    siteFavicon: img("logo"),
    siteDescription: "فروشگاه نمایشی لوازم جانبی موبایل — نسخه‌ی نمایشی گردانوس",
    homeH1: "لوازم جانبی موبایل با ضمانت اصالت",
    sitePhone: "۰۲۱-۰۰۰۰۰۰۰۰",
    siteEmail: "demo@gardanos.ir",
    siteCity: "تهران",
    siteProvince: "تهران",
    siteAddress: "تهران، خیابان نمایشی، پلاک ۰ (آدرس نمایشی)",
    openingHours: "شنبه تا پنجشنبه ۹ تا ۲۱",
    footerText: "این فروشگاه نمایشی است و سفارش‌ها ارسال نمی‌شوند.",
    variantsEnabled: true,
    clubEnabled: true,
    clubName: "باشگاه گجت‌لند",
    worklistEnabled: true,
    walletEnabled: true,
    paymentGatewayActive: true,
    paymentGatewayProvider: "aqayepardakht",
    paymentGatewaySandbox: true,
    smsEnabled: true,
    announcementBar: {
      enabled: true, text: "نسخه‌ی نمایشی گردانوس — اطلاعات واقعی وارد نکنید. برای دیدن پنل مدیریت اینجا را بزنید.", linkUrl: "/admin/login",
      bgColor: "#4f46e5", textColor: "#ffffff", dismissible: false, sticky: true, startsAt: "", endsAt: "", countdown: false,
    },
  } satisfies Prisma.StoreSettingsUpdateInput;
  await prisma.storeSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  await prisma.integSettings.upsert({ where: { id: "singleton" }, update: { workerEnabled: true }, create: { id: "singleton" } });
  for (const p of [
    { code: "hesaban", name: "وب‌حسابان", type: "ACCOUNTING" as const },
    ...DEMO_MARKETPLACES.map((m) => ({ code: m.code, name: m.name, type: "MARKETPLACE" as const })),
  ]) {
    await prisma.integPlatform.upsert({ where: { code: p.code }, update: { name: p.name, type: p.type }, create: p });
  }
}

async function warehouses() {
  // انبار پیش‌فرض را راه‌اندازی حسابداری ساخته — نامش عوض می‌شود
  const main = await prisma.accWarehouse.findFirst({ where: { isDefault: true } });
  if (main) await prisma.accWarehouse.update({ where: { id: main.id }, data: { name: "انبار مرکزی" } });
  const vanak = await prisma.accWarehouse.create({ data: { code: 2, name: "شعبه ونک", receiveConfirm: true } });
  const tajrish = await prisma.accWarehouse.create({ data: { code: 3, name: "شعبه تجریش", receiveConfirm: true } });
  return { main: main!, vanak, tajrish };
}

/** بانک، درگاه سایت و کارتخوان — دریافت سفارش‌های سایت روی درگاه می‌نشیند */
async function treasuries() {
  await prisma.$transaction(async (tx) => {
    const bank = await createTreasury(tx, { kind: "BANK", name: "بانک ملت جاری (نمایشی)", bankName: "ملت", accountNo: "0000000000" });
    await createTreasury(tx, { kind: "GATEWAY", name: "درگاه پرداخت سایت", providers: ["gateway", "aqayepardakht"], settleToId: bank.id });
    await createTreasury(tx, { kind: "POS", name: "کارتخوان شعبه", settleToId: bank.id });
  });
}

async function catalog() {
  const cats = new Map<CatKey, { id: string; title: string; slug: string }>();
  for (const [i, c] of CATS.entries()) {
    const row = await prisma.category.create({
      data: { title: c.title, slug: c.slug, sortOrder: i, imageUrl: img(`cat-${c.key}`), description: `<p>خرید ${c.title} با ضمانت اصالت و ارسال سریع از گجت‌لند.</p>` },
      select: { id: true, title: true, slug: true },
    });
    cats.set(c.key, row);
  }
  const brands = new Map<BrandKey, string>();
  for (const [slug, title] of BRANDS) {
    brands.set(slug, (await prisma.brand.create({ data: { title, slug }, select: { id: true } })).id);
  }
  return { cats, brands };
}

async function simpleProducts(cats: Map<CatKey, { id: string }>, brands: Map<BrandKey, string>) {
  const out: { id: string; title: string; price: bigint; sale: bigint | null; cat: CatKey }[] = [];
  for (const s of SIMPLE) {
    const title = `${s.title} ${BRANDS.find((b) => b[0] === s.brand)![1]}`;
    const p = await prisma.product.create({
      data: {
        title,
        slug: slugify(title) || `p-${out.length}`,
        categoryId: cats.get(s.cat)!.id,
        brandId: brands.get(s.brand),
        price: toman(s.price),
        salePrice: s.sale ? toman(s.sale) : null,
        trackStock: true,
        isActive: true,
        mainImage: img(s.image),
        shortDescription: s.features.join("، "),
        summaryFeatures: s.features,
        features: s.features,
        warranty: "۱۸ ماه گارانتی نمایشی",
        expertDescription: description(title, s.features),
        images: { create: [{ url: img(s.image), alt: title, sortOrder: 0 }] },
      },
      select: { id: true, title: true, price: true, salePrice: true },
    });
    // تریگر acc_item_from_product کالای هم‌شناسه ساخته؛ قیمت فروش حضوری همان قیمت سایت
    await prisma.accItem.update({ where: { id: p.id }, data: { salePrice: p.salePrice ?? p.price } });
    out.push({ id: p.id, title: p.title, price: p.price, sale: p.salePrice, cat: s.cat });
  }
  return out;
}

async function modelItems() {
  const axes = new Map<string, string>();
  for (const name of new Set(MODELS.flatMap((m) => m.axes.map((a) => a.name)))) {
    // «رنگ» و «سایز» را مهاجرت ساخته
    axes.set(name, (await prisma.accAxis.upsert({ where: { name }, update: {}, create: { name } })).id);
  }
  const models: { def: ModelDef; modelId: string; itemIds: string[] }[] = [];
  for (const def of MODELS) {
    await prisma.$transaction(async (tx) => {
      await runMatrix(tx, { modelTitle: def.title, salePrice: toman(def.price), axes: def.axes.map((a) => ({ axisId: axes.get(a.name)!, values: a.values })) }, true);
    }, { timeout: 60_000 });
    const model = await prisma.accItemModel.findUniqueOrThrow({ where: { title: def.title }, include: { items: { select: { id: true } } } });
    models.push({ def, modelId: model.id, itemIds: model.items.map((i) => i.id) });
  }
  return models;
}

async function openingStock(
  yearId: string,
  wh: { main: { id: string }; vanak: { id: string }; tajrish: { id: string } },
  simple: { id: string; price: bigint }[],
  models: { def: ModelDef; itemIds: string[] }[],
) {
  const cost = (p: bigint) => (p * BigInt(rnd(55, 70))) / 100n / 1000n * 1000n;
  const lines: { productId: string; warehouseId: string; qty: number; unitCost: bigint }[] = [];
  for (const p of simple) {
    lines.push({ productId: p.id, warehouseId: wh.main.id, qty: rnd(45, 90), unitCost: cost(p.price) });
    lines.push({ productId: p.id, warehouseId: wh.vanak.id, qty: rnd(4, 15), unitCost: cost(p.price) });
    if (chance(0.7)) lines.push({ productId: p.id, warehouseId: wh.tajrish.id, qty: rnd(2, 10), unitCost: cost(p.price) });
  }
  for (const m of models) {
    const price = toman(m.def.price);
    for (const id of m.itemIds) {
      lines.push({ productId: id, warehouseId: wh.main.id, qty: rnd(6, 20), unitCost: cost(price) });
      if (chance(0.6)) lines.push({ productId: id, warehouseId: wh.vanak.id, qty: rnd(1, 5), unitCost: cost(price) });
      if (chance(0.4)) lines.push({ productId: id, warehouseId: wh.tajrish.id, qty: rnd(1, 4), unitCost: cost(price) });
    }
  }
  await prisma.$transaction((tx) => saveOpeningInventory(tx, yearId, lines, ACTOR), { timeout: 600_000 });
}

async function modelProducts(models: { def: ModelDef; modelId: string }[], cats: Map<CatKey, { id: string }>, brands: Map<BrandKey, string>) {
  const out: string[] = [];
  for (const m of models) {
    const res = await prisma.$transaction(
      (tx) => createFromModel(tx, { modelId: m.modelId, title: m.def.title, categoryId: cats.get(m.def.cat)!.id, brandId: brands.get(m.def.brand), price: toman(m.def.price) }),
      { timeout: 120_000 },
    );
    const id = res.product.id;
    await prisma.product.update({
      where: { id },
      data: {
        isActive: true,
        mainImage: img(m.def.images[0]),
        shortDescription: m.def.features.join("، "),
        summaryFeatures: m.def.features,
        features: m.def.features,
        warranty: "۷ روز ضمانت بازگشت",
        expertDescription: description(m.def.title, m.def.features),
        images: { create: m.def.images.map((name, i) => ({ url: img(name), alt: m.def.title, sortOrder: i })) },
      },
    });
    out.push(id);
  }
  return out;
}

async function people() {
  const customers: { id: string; phone: string; name: string; addressId: string }[] = [];
  for (let i = 0; i < 45; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const phone = fakePhone();
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone, firstName, lastName, role: "CUSTOMER", createdAt: at(rnd(20, 120)),
        addresses: { create: { receiver: `${firstName} ${lastName}`, phone, province: "تهران", city: pick(["تهران", "کرج", "اصفهان", "شیراز", "مشهد", "تبریز"]), addressLine: "آدرس نمایشی", postalCode: "0000000000", isDefault: true } },
      },
      include: { addresses: { select: { id: true } } },
    });
    customers.push({ id: user.id, phone, name: `${firstName} ${lastName}`, addressId: user.addresses[0].id });
  }

  // کارکنان — هیچ‌کدام نمی‌توانند وارد شوند (ورود دمو فقط با حساب مشترک است)
  const roles = new Map((await prisma.staffRole.findMany({ select: { id: true, slug: true } })).map((r) => [r.slug, r.id]));
  const staff: { id: string; name: string }[] = [];
  for (const [first, last, role] of [["مریم", "کریمی", "sales"], ["سعید", "نوری", "support"], ["الهام", "رستمی", "content"], ["حسین", "دادگر", "procurement"]] as const) {
    const u = await prisma.user.create({
      data: { phone: fakePhone(), firstName: first, lastName: last, role: "ADMIN", staffRoleId: roles.get(role) ?? null },
    });
    staff.push({ id: u.id, name: `${first} ${last}` });
  }
  // حساب مشترک ورود دمو — lib/demo/login.ts
  await prisma.user.upsert({
    where: { phone: demoAdminPhone() },
    update: { role: "ADMIN", isActive: true },
    create: {
      phone: demoAdminPhone(), role: "ADMIN", isActive: true, firstName: "مدیر", lastName: "نمایشی",
      // بازدیدکننده بی‌دردسر از سایت خرید کند — حساب مشترک است، پس آدرس واقعی نمی‌خواهیم
      addresses: { create: { title: "آدرس نمایشی", receiver: "خریدار نمایشی", phone: "09000000000", province: "تهران", city: "تهران", addressLine: "خیابان نمایشی، پلاک ۰", postalCode: "0000000000", isDefault: true } },
    },
  });
  return { customers, staff };
}

type Sellable = { productId: string; variantId: string | null; title: string; variantTitle: string | null; price: bigint };

async function sellables(): Promise<Sellable[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, title: true, price: true, salePrice: true, hasVariants: true, variants: { where: { isActive: true }, select: { id: true, title: true, price: true } } },
  });
  return products.flatMap((p): Sellable[] =>
    p.hasVariants
      ? p.variants.map((v) => ({ productId: p.id, variantId: v.id, title: p.title, variantTitle: v.title, price: v.price ?? p.price }))
      : [{ productId: p.id, variantId: null, title: p.title, variantTitle: null, price: p.salePrice ?? p.price }],
  );
}

const PAID: OrderStatus[] = ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"];

/** وضعیت سفارش بر حسب عمرش — قدیمی‌ها تحویل‌شده، امروزی‌ها در جریان */
function statusFor(daysAgo: number): OrderStatus {
  if (chance(0.04)) return "CANCELED";
  if (daysAgo === 0) return pick(["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING"]);
  if (daysAgo <= 2) return pick(["CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED"]);
  if (daysAgo <= 6) return pick(["SHIPPED", "DELIVERED"]);
  return chance(0.85) ? "DELIVERED" : "COMPLETED";
}

async function shopOrders(customers: { id: string; addressId: string }[], items: Sellable[]) {
  const events: { id: string; at: Date }[] = [];
  const paidOrders: string[] = [];
  for (let n = 0; n < 160; n++) {
    const daysAgo = n < 6 ? 0 : recentDay();
    const when = at(daysAgo);
    const status = statusFor(daysAgo);
    const lines = Array.from({ length: chance(0.7) ? 1 : rnd(2, 3) }, () => ({ ...pick(items), qty: chance(0.85) ? 1 : 2 }));
    const itemsTotal = lines.reduce((s, l) => s + l.price * BigInt(l.qty), 0n);
    const shippingFee = itemsTotal >= 500_000n ? 0n : 60_000n;
    const customer = pick(customers);
    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        addressId: customer.addressId,
        status,
        orderNumber: `GL-${String(10000 + n)}`,
        itemsTotal,
        shippingFee,
        grandTotal: itemsTotal + shippingFee,
        createdAt: when,
        trafficChannel: pick(["organic", "direct", "social", "referral", "paid"]),
        trackingCode: ["SHIPPED", "DELIVERED", "COMPLETED"].includes(status) ? `DEMO${rnd(100000, 999999)}` : null,
        items: {
          create: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, unitPrice: l.price, titleSnapshot: l.title, variantTitleSnapshot: l.variantTitle })),
        },
        payments: {
          create: { provider: "gateway", amount: itemsTotal + shippingFee, status: PAID.includes(status) ? "SUCCEEDED" : status === "CANCELED" ? "FAILED" : "PENDING", providerRef: `demo-${n}`, createdAt: when },
        },
      },
      select: { id: true, payments: { select: { id: true, status: true } } },
    });
    if (!PAID.includes(status)) continue;
    paidOrders.push(order.id);
    const sale = await prisma.accEvent.create({
      data: { type: "SALE_ISSUED", aggregateType: "Order", aggregateId: order.id, dedupeKey: `order:${order.id}:sale`, payload: { orderId: order.id }, createdAt: when },
    });
    events.push({ id: sale.id, at: when });
    for (const p of order.payments.filter((x) => x.status === "SUCCEEDED")) {
      const ev = await prisma.accEvent.create({
        data: { type: "PAYMENT_RECEIVED", aggregateType: "Order", aggregateId: order.id, dedupeKey: `payment:${p.id}:received`, payload: { paymentId: p.id, orderId: order.id }, createdAt: new Date(when.getTime() + 1000) },
      });
      events.push({ id: ev.id, at: when });
    }
  }
  return { paidOrders, events };
}

async function marketplaces(simple: { id: string; title: string; price: bigint; sale: bigint | null }[]) {
  const creds = encryptCredentials({ demo: "1" });
  const fee: Record<string, number> = { basalam: 8, snappshop: 10, tapsi_shop: 9 };
  for (const m of DEMO_MARKETPLACES) {
    await prisma.integConnection.create({
      data: { platformCode: m.code, credentials: creds, status: "CONNECTED", syncStockEnabled: true, syncPriceEnabled: true, syncIntervalMin: 5, lastSyncAt: new Date(), config: { demo: true } },
    });
    await prisma.integPriceRule.create({
      data: { name: `قیمت ${m.name}`, description: `کارمزد ${m.name} و بسته‌بندی روی قیمت خرید`, targetPlatforms: [m.code], feePercent: fee[m.code], packagingType: "FIXED", packagingValue: 15000, marginPercent: 35, roundTo: 1000, priority: 10,
        tiers: { create: [{ minStock: 0, maxStock: 5, marginPercent: 45, sortOrder: 0 }, { minStock: 6, maxStock: null, marginPercent: 35, sortOrder: 1 }] } },
    });
  }

  // هر کالای ساده یک نگاشت؛ هر بازارگاه بخشی از کاتالوگ را دارد
  const mapped: { platform: string; externalId: string; title: string; price: number; mappingId: string }[] = [];
  for (const [i, p] of simple.entries()) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: p.id }, select: { stock: true } });
    const mapping = await prisma.integMapping.create({
      data: { stock: product.stock, purchasePriceSource: "MANUAL", purchasePrice: Number((p.price * 6n) / 10n), links: { create: [{ platformCode: "shop", externalId: p.id, externalTitle: p.title }] } },
    });
    for (const m of DEMO_MARKETPLACES) {
      if (!chance(m.code === "basalam" ? 0.85 : 0.65)) continue;
      const externalId = m.code === "basalam" ? String(18_400_000 + i * 37) : `${m.code === "snappshop" ? "SNP" : "TPS"}-${10_000 + i}`;
      const price = Math.round((Number(p.sale ?? p.price) * (1 + fee[m.code] / 100)) / 1000) * 1000;
      await prisma.integPlatformProduct.create({
        data: { platformCode: m.code, platformProductId: externalId, title: p.title, sku: `GL-${i + 1}`, stock: product.stock, price, discountSynced: true },
      });
      await prisma.integMappingLink.create({ data: { mappingId: mapping.id, platformCode: m.code, externalId, externalTitle: p.title } });
      mapped.push({ platform: m.code, externalId, title: p.title, price, mappingId: mapping.id });
    }
  }
  // یکی بی‌نگاشت می‌ماند تا «پیشنهاد نگاشت» و «سفارش بی‌نگاشت» هم دیده شوند
  await prisma.integPlatformProduct.create({ data: { platformCode: "basalam", platformProductId: "18499999", title: "قاب چرمی کیف‌پولی (بی‌نگاشت)", stock: 7, price: 520000, discountSynced: true } });

  const events: { id: string; at: Date }[] = [];
  for (let n = 0; n < 190; n++) {
    const row = pick(mapped);
    const when = at(n < 4 ? 0 : recentDay());
    const qty = chance(0.85) ? 1 : 2;
    const order = await prisma.integOrder.create({
      data: {
        mappingId: row.mappingId, platformCode: row.platform, platformOrderId: `hist-${n}:1`, platformOrderNo: String(7_200_000 + n), platformOrderItemId: "1",
        productTitle: row.title, qty, unitPrice: row.price, customerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, customerPhone: fakePhone(),
        orderedAt: when, createdAt: when, status: chance(0.03) ? "CANCELLED" : "PENDING",
      },
    });
    if (order.status === "CANCELLED") continue;
    const ev = await prisma.accEvent.create({
      data: { type: "SALE_ISSUED", aggregateType: "IntegOrder", aggregateId: order.id, dedupeKey: `integ:${order.id}:sale`, payload: { integOrderId: order.id }, createdAt: when },
    });
    events.push({ id: ev.id, at: when });
  }

  // گفت‌وگوهای باسلام
  const questions = [
    ["سلام وقت بخیر، این پاوربانک با آیفون ۱۵ شارژ سریع می‌شود؟", "سلام، بله با کابل تایپ‌سی تا ۲۰ وات شارژ سریع دارد."],
    ["ارسال به رشت چقدر طول می‌کشد؟", "معمولاً دو روز کاری با پست پیشتاز."],
    ["قاب سیلیکونی سبز برای A55 موجود است؟", null],
    ["سفارشم رسید، ممنون از بسته‌بندی خوبتان 🌹", "خوشحالیم که راضی بودید؛ ممنون از خریدتان."],
  ] as const;
  for (const [i, [q, a]] of questions.entries()) {
    const when = at(rnd(0, 6));
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    await prisma.integChat.create({
      data: {
        platformCode: "basalam", externalId: `seed-chat-${i}`, chatType: "private", contactId: `seed-user-${i}`, contactName: name,
        unseenCount: a ? 0 : 1, lastMessageAt: when, lastMessageText: a ?? q, externalUpdatedAt: when, lastFetchedMsgId: String(when.getTime() + 1),
        messages: {
          create: [
            { externalId: String(when.getTime()), direction: "IN", senderId: `seed-user-${i}`, senderName: name, text: q, sentAt: when },
            ...(a ? [{ externalId: String(when.getTime() + 1), direction: "OUT", senderId: "demo-shop", senderName: "گجت‌لند", text: a, sentAt: new Date(when.getTime() + 600_000), seenAt: new Date(when.getTime() + 900_000) }] : []),
          ],
        },
      },
    });
  }
  return events;
}

/** صف رویداد مالی تا ته — فاکتور فروش، دریافت و کاردکس با تاریخ خود سفارش */
async function drainAccounting() {
  let total = { done: 0, blocked: 0, failed: 0, retried: 0 };
  for (let i = 0; i < 200; i++) {
    const s = await dispatchAccEvents();
    total = { done: total.done + s.done, blocked: total.blocked + s.blocked, failed: total.failed + s.failed, retried: total.retried + s.retried };
    if (!s.claimed) break;
  }
  return total;
}

/**
 * سفارش‌های سید فقط فاکتور زدند (`shopStock: false`)؛ موجودی سایت، تنوع‌ها و
 * نگاشت‌ها یک بار از کاردکس انبارهای قابل فروش بازسازی می‌شوند.
 */
async function reconcileStock() {
  await prisma.$executeRaw`
    UPDATE "Product" p SET stock = GREATEST(0, COALESCE((
      SELECT SUM(s.qty) FROM "AccStock" s JOIN "AccWarehouse" w ON w.id = s."warehouseId" AND w.sellable
      WHERE s."productId" = p.id), 0))
    WHERE p."hasVariants" = false`;
  await prisma.$executeRaw`
    UPDATE "ProductVariant" v SET stock = GREATEST(0, COALESCE((
      SELECT SUM(s.qty) FROM "AccStock" s JOIN "AccWarehouse" w ON w.id = s."warehouseId" AND w.sellable
      WHERE s."productId" = v."accItemId"), 0))
    WHERE v."accItemId" IS NOT NULL`;
  await prisma.$executeRaw`
    UPDATE "Product" p SET stock = COALESCE((SELECT SUM(v.stock) FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive"), 0)
    WHERE p."hasVariants" = true`;
  await prisma.$executeRaw`
    UPDATE "IntegMapping" m SET stock = p.stock
    FROM "IntegMappingLink" l JOIN "Product" p ON p.id = l."externalId"
    WHERE l."mappingId" = m.id AND l."platformCode" = 'shop'`;
  await prisma.$executeRaw`
    UPDATE "IntegPlatformProduct" pp SET stock = m.stock
    FROM "IntegMappingLink" l JOIN "IntegMapping" m ON m.id = l."mappingId"
    WHERE l."platformCode" = pp."platformCode" AND l."externalId" = pp."platformProductId"`;
}

async function storefront(cats: Map<CatKey, { id: string; title: string; slug: string }>, simple: { id: string; sale: bigint | null; cat: CatKey }[]) {
  for (const [i, n] of [1, 2, 3].entries()) {
    await prisma.heroSlide.create({ data: { imageUrl: img(`hero-${n}`), title: ["قاب و گلس", "شارژ سریع", "صدای بی‌سیم"][i], linkUrl: `/categories/${["phone-case", "powerbank", "earbuds"][i]}`, sortOrder: i } });
  }
  const deals = simple.filter((p) => p.sale).map((p) => p.id);
  const widgets: { type: Prisma.WidgetCreateInput["type"]; title: string; config: Prisma.InputJsonValue }[] = [
    { type: "HERO_SLIDER", title: "اسلایدر", config: {} },
    { type: "CATEGORIES", title: "دسته‌بندی‌ها", config: { categoryIds: [...cats.values()].map((c) => c.id) } },
    { type: "AMAZING_DEALS", title: "پیشنهاد شگفت‌انگیز", config: { productIds: deals, endsAt: new Date(Date.now() + 3 * DAY).toISOString() } },
    ...(["charger", "powerbank", "earbuds"] as const).map((k) => {
      const c = cats.get(k)!;
      return { type: "PRODUCTS_BY_CATEGORY" as const, title: c.title, config: { categoryId: c.id, categoryTitle: c.title, categorySlug: c.slug, count: 8, sortMode: "newest" } };
    }),
    { type: "FULL_BANNER", title: "ارسال رایگان", config: { imageUrl: img("banner-wide"), linkUrl: "/categories/holder", alt: "ارسال رایگان" } },
    { type: "NEWEST_PRODUCTS", title: "تازه‌ها", config: { categoryIds: [cats.get("case")!.id, cats.get("speaker")!.id, cats.get("watchband")!.id], perCategory: 4 } },
    { type: "LATEST_ARTICLES", title: "مجله", config: {} },
  ];
  for (const [i, w] of widgets.entries()) await prisma.widget.create({ data: { ...w, sortOrder: i } });

  for (const [i, c] of ["phone-case", "charger", "powerbank", "earbuds", "speaker"].entries()) {
    const cat = [...cats.values()].find((x) => x.slug === c)!;
    await prisma.menuItem.create({ data: { title: cat.title, url: `/categories/${c}`, sortOrder: i } });
  }

  const blogCat = await prisma.blogCategory.create({ data: { title: "راهنمای خرید", slug: "buying-guide" } });
  const posts = [
    ["راهنمای خرید پاوربانک؛ ظرفیت واقعی چقدر است؟", "hero-2", "ظرفیت روی بدنه با انرژی‌ای که به گوشی می‌رسد یکی نیست؛ حدود دوسوم آن قابل استفاده است."],
    ["قاب سیلیکونی یا ضدضربه؟ کدام برای شما مناسب است", "hero-1", "اگر گوشی را زیاد زمین می‌اندازید قاب ضدضربه، و اگر ظاهر باریک می‌خواهید سیلیکونی را انتخاب کنید."],
    ["ایرباد نویزگیر واقعاً ارزش خرید دارد؟", "hero-3", "نویزگیر فعال در مترو و هواپیما تفاوت محسوسی ایجاد می‌کند، ولی شارژدهی را کمتر می‌کند."],
  ];
  for (const [i, [title, cover, excerpt]] of posts.entries()) {
    await prisma.blogPost.create({
      data: { title, slug: slugify(title) || `post-${i}`, excerpt, content: `<p>${excerpt}</p><p>این مطلب نمونه‌ی مجله‌ی فروشگاه نمایشی است.</p>`, coverImage: img(cover), categoryId: blogCat.id, status: "PUBLISHED", publishedAt: at(i * 9 + 2), readingTime: 3 },
    });
  }
}

async function reviews(customers: { id: string }[]) {
  const texts = [
    ["کیفیت عالی، دقیقاً مثل عکس", 5], ["ارسال سریع بود و بسته‌بندی خوب", 5], ["نسبت به قیمت راضی‌ام", 4],
    ["کار می‌کند ولی کمی گرم می‌شود", 3], ["دومین بار است که می‌خرم", 5], ["رنگش کمی با عکس فرق داشت", 4],
  ] as const;
  const products = await prisma.product.findMany({ where: { isActive: true }, select: { id: true } });
  for (let i = 0; i < 40; i++) {
    const [body, rating] = pick(texts);
    await prisma.review.create({
      data: { productId: pick(products).id, userId: pick(customers).id, rating, body, isBuyer: true, status: chance(0.85) ? "APPROVED" : "PENDING", createdAt: at(recentDay()) },
    });
  }
  // میانگین امتیاز روی کارت محصول
  await prisma.$executeRaw`
    UPDATE "Product" p SET "ratingAvg" = r.avg, "ratingCount" = r.cnt
    FROM (SELECT "productId", AVG(rating)::float AS avg, COUNT(*)::int AS cnt FROM "Review" WHERE status = 'APPROVED' GROUP BY "productId") r
    WHERE r."productId" = p.id`;
}

async function worklist(staff: { id: string; name: string }[], customers: { id: string; phone: string; name: string }[]) {
  const types = new Map((await prisma.staffTaskType.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));
  const typeId = (slug: string) => types.get(slug) ?? [...types.values()][0];
  if (!types.size) return;
  const tasks = [
    { slug: "sales-followup", title: "پیگیری خرید عمده‌ی کابل برای مغازه", domain: "SALES", status: "OPEN", priority: "HIGH" },
    { slug: "sales-consult", title: "مشاوره‌ی خرید ایرباد برای هدیه", domain: "SALES", status: "IN_PROGRESS", priority: "NORMAL" },
    { slug: "supplier-quote", title: "استعلام قیمت پاوربانک از تأمین‌کننده", domain: "PROCUREMENT", status: "OPEN", priority: "NORMAL" },
    { slug: "shipping-coordination", title: "هماهنگی ارسال سفارش‌های امروز با پیک", domain: "FULFILLMENT", status: "OPEN", priority: "URGENT" },
    { slug: "payment-followup", title: "پیگیری واریز فاکتور فروش عمده", domain: "FINANCE", status: "OPEN", priority: "HIGH" },
    { slug: "regular-customer-call", title: "تماس با مشتری وفادار برای نظرسنجی", domain: "SALES", status: "DONE", priority: "LOW" },
    { slug: "sales-followup", title: "پاسخ به پرسش باسلام درباره‌ی قاب A55", domain: "SUPPORT", status: "OPEN", priority: "NORMAL" },
    { slug: "phone-order", title: "ثبت سفارش تلفنی گلس و قاب", domain: "SALES", status: "DONE", priority: "NORMAL" },
  ] as const;
  for (const t of tasks) {
    const owner = pick(staff);
    const c = pick(customers);
    await prisma.staffTask.create({
      data: {
        typeId: typeId(t.slug), domain: t.domain, channel: "CALL_IN", source: "MANUAL", title: t.title, ownerId: owner.id, ownerName: owner.name,
        createdByName: "مدیر نمایشی", status: t.status, priority: t.priority, customerId: c.id, contactName: c.name, contactPhone: c.phone,
        dueAt: new Date(Date.now() + rnd(-1, 3) * DAY), doneAt: t.status === "DONE" ? at(rnd(1, 4)) : null, createdAt: at(rnd(1, 8)),
      },
    });
  }
  for (const c of customers.slice(0, 5)) {
    await prisma.callbackRequest.create({ data: { phone: c.phone, status: "PENDING", note: "درخواست تماس از چت سایت", createdAt: at(rnd(0, 3)) } });
  }
}

async function main() {
  guard();
  if (await prisma.product.count()) {
    console.log("دیتابیس محصول دارد — سید فقط روی دیتابیس خالی اجرا می‌شود.");
    return;
  }
  const t0 = Date.now();
  const step = (s: string) => console.log(`· ${s} (${Math.round((Date.now() - t0) / 1000)}s)`);

  copyAssets();
  await settings();
  await runDefaultSeeds(DEFAULT_SEEDS);
  step("تنظیمات و اسکریپت‌های پیش‌فرض");

  const year = await activateInternal({ jalaliYear: jalaliYearOf(new Date()), actor: ACTOR });
  const wh = await warehouses();
  await treasuries();
  const { cats, brands } = await catalog();
  const simple = await simpleProducts(cats, brands);
  const models = await modelItems();
  step(`حسابداری داخلی، ${simple.length} کالای ساده و ${models.reduce((s, m) => s + m.itemIds.length, 0)} کالای تنوع‌دار`);

  await openingStock(year.id, wh, simple, models);
  await modelProducts(models, cats, brands);
  step("موجودی اول دوره و محصولات تنوع‌دار");

  const { customers, staff } = await people();
  const items = await sellables();
  const shop = await shopOrders(customers, items);
  const market = await marketplaces(simple);
  step(`${shop.paidOrders.length} سفارش پرداخت‌شده‌ی سایت و ${market.length} سفارش بازارگاه`);

  const acc = await drainAccounting();
  step(`صف مالی: ${acc.done} انجام، ${acc.blocked} مسدود، ${acc.failed} ناموفق`);

  await reconcileStock();
  // پروفایل باشگاه برای مشتری‌ها، بعد امتیاز و سطح از روی خریدها
  await runDefaultSeeds(["backfill-club-profiles"]);
  for (const id of shop.paidOrders) await processOrderForClub(id).catch(() => null);
  await storefront(cats, simple);
  await reviews(customers);
  await worklist(staff, customers);
  step("باشگاه، ویترین، نظرها و کارتابل");
  console.log("✅ داده‌ی نمایشی آماده است");
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
