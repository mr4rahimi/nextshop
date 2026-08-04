import { prisma } from "../lib/prisma";
import { writeFileSync } from "fs";

const RESERVED = new Set([
  "q", "category", "brand", "sort", "page", "pageSize",
  "minPrice", "maxPrice", "attr", "utm_source", "utm_medium", "utm_campaign",
]);

// دیکشنری عنوان ویژگی‌ها — کلید URL از اینجا میاد، پس مهم‌ترین بخشه
const ATTR_DICT: Record<string, string> = {
  "تکنولوژی چاپ": "print-type", "نوع چاپ": "print-type",
  "نوع کاربری": "usage-type", "کاربری": "usage-type",
  "رنگ": "color", "سایز": "size", "اندازه": "size",
  "جنس": "material", "وزن": "weight", "ابعاد": "dimensions",
  "سرعت چاپ": "print-speed", "رزولوشن": "resolution",
  "اتصال": "connectivity", "نوع اتصال": "connectivity",
  "گارانتی": "warranty", "کشور سازنده": "origin",
};

const VALUE_DICT: Record<string, string> = {
  "لیزری": "laser", "جوهرافشان": "inkjet", "جوهر افشان": "inkjet",
  "حرارتی": "thermal", "سوزنی": "dot-matrix",
  "تک کاره": "single-function", "تک‌کاره": "single-function",
  "چند کاره": "multifunction", "چندکاره": "multifunction",
  "سفید": "white", "مشکی": "black", "سیاه": "black", "قرمز": "red",
  "آبی": "blue", "سبز": "green", "زرد": "yellow", "طلایی": "gold",
  "نقره ای": "silver", "نقره‌ای": "silver", "کروم": "chrome",
  "خاکستری": "gray", "نارنجی": "orange", "بنفش": "purple", "صورتی": "pink",
  "بله": "yes", "خیر": "no", "دارد": "yes", "ندارد": "no",
  "کوچک": "small", "متوسط": "medium", "بزرگ": "large",
  "بی سیم": "wireless", "بی‌سیم": "wireless", "باسیم": "wired",
  "رنگی": "color", "سیاه سفید": "monochrome", "سیاه و سفید": "monochrome",
};

const MAP: Record<string, string> = {
  "ا":"a","آ":"a","أ":"a","إ":"a","ب":"b","پ":"p","ت":"t","ث":"s","ج":"j",
  "چ":"ch","ح":"h","خ":"kh","د":"d","ذ":"z","ر":"r","ز":"z","ژ":"zh",
  "س":"s","ش":"sh","ص":"s","ض":"z","ط":"t","ظ":"z","ع":"a","غ":"gh",
  "ف":"f","ق":"gh","ک":"k","ك":"k","گ":"g","ل":"l","م":"m","ن":"n",
  "و":"v","ه":"h","ی":"i","ي":"i","ئ":"y","ة":"h",
  "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
};

/** slug معتبر = فقط a-z0-9-، حداقل ۲ کاراکتر، غیر رزروشده */
function isValid(s: string | null | undefined): s is string {
  if (!s) return false;
  if (s.length < 2) return false;
  if (RESERVED.has(s)) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

function norm(s: string) {
  return s.trim().replace(/\u200c/g, " ").replace(/\s+/g, " ");
}

function make(raw: string, dict: Record<string, string>): { slug: string; fromDict: boolean } {
  const clean = norm(raw);
  const hit = dict[clean] ?? dict[clean.replace(/\s/g, "")];
  if (hit) return { slug: hit, fromDict: true };

  const slug = [...clean].map(ch => MAP[ch] ?? ch).join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return { slug: slug.length >= 2 ? slug : "item", fromDict: false };
}

function uniquify(base: string, taken: Set<string>) {
  let out = base, n = 2;
  while (taken.has(out)) out = `${base}-${n++}`;
  taken.add(out);
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force"); // slugهای معتبر را هم بازسازی کن
  const report: string[] = [];
  let review = 0;

  // ── ویژگی‌ها (یکتا در سطح groupId) ──
  const attrs = await prisma.attribute.findMany({
    select: { id: true, title: true, slug: true, groupId: true },
    orderBy: { sortOrder: "asc" },
  });

  const attrTaken = new Map<string, Set<string>>();
  for (const a of attrs) {
    if (!attrTaken.has(a.groupId)) attrTaken.set(a.groupId, new Set());
    if (isValid(a.slug) && !force) attrTaken.get(a.groupId)!.add(a.slug);
  }

  for (const a of attrs) {
    if (isValid(a.slug) && !force) {
      report.push(`[ATTR OK]   "${a.title}" = ${a.slug}`);
      continue;
    }
    const { slug, fromDict } = make(a.title, ATTR_DICT);
    const final = uniquify(slug, attrTaken.get(a.groupId)!);
    if (!fromDict) { review++; report.push(`[ATTR REVIEW] "${a.title}": "${a.slug}" → "${final}"  ← بررسی کن`); }
    else           { report.push(`[ATTR FIX]    "${a.title}": "${a.slug}" → "${final}"`); }
    if (apply) await prisma.attribute.update({ where: { id: a.id }, data: { slug: final } });
  }

  // ── مقادیر (یکتا در سطح attributeId) ──
  const values = await prisma.attributeValue.findMany({
    select: { id: true, value: true, slug: true, attributeId: true },
    orderBy: [{ attributeId: "asc" }, { sortOrder: "asc" }],
  });

  const valTaken = new Map<string, Set<string>>();
  for (const v of values) {
    if (!valTaken.has(v.attributeId)) valTaken.set(v.attributeId, new Set());
    if (isValid(v.slug) && !force) valTaken.get(v.attributeId)!.add(v.slug!);
  }

  for (const v of values) {
    if (isValid(v.slug) && !force) {
      report.push(`[VAL OK]    "${v.value}" = ${v.slug}`);
      continue;
    }
    const { slug, fromDict } = make(v.value, VALUE_DICT);
    const final = uniquify(slug, valTaken.get(v.attributeId)!);
    if (!fromDict) { review++; report.push(`[VAL REVIEW] "${v.value}": "${v.slug ?? "∅"}" → "${final}"  ← بررسی کن`); }
    else           { report.push(`[VAL FIX]    "${v.value}": "${v.slug ?? "∅"}" → "${final}"`); }
    if (apply) await prisma.attributeValue.update({ where: { id: v.id }, data: { slug: final } });
  }

  const out = report.join("\n");
  console.log(out);
  writeFileSync("attr-slug-report.txt", out);
  console.log(`\n${apply ? "✅ اعمال شد" : "🔍 dry-run — برای اعمال --apply بزن"}`);
  console.log(`${review} مورد نیاز به بررسی دستی دارد. گزارش: attr-slug-report.txt`);
}

main().finally(() => prisma.$disconnect());