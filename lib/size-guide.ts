/**
 * راهنمای سایز پوشاک — docs/features/size-guide.md
 *
 * این فایل هم در مرورگر و هم روی سرور خوانده می‌شود؛ هیچ import سروری نیاید.
 *
 * همه‌ی اندازه‌ها **روی لباسِ پهن‌شده** و به سانتی‌متر است (عرض، نه دور): کارمند
 * همان لباسی را که برای عکس پهن کرده متر می‌کند، مشتری هم لباس اندازه‌ی خودش را.
 * حرف هر اندازه (A، B…) همان حرفی است که روی طرح لباس (`SizeGuideDiagram`) فلش دارد.
 */

export type SizeGuideKind = "shirt" | "tshirt" | "outer" | "pants" | "manto" | "custom";

export interface SizeColumn {
  key: string;
  label: string;
}

export interface SizeRow {
  size: string;
  /** کلید ستون ← سانتی‌متر؛ خانه‌ی خالی = null */
  values: Record<string, number | null>;
}

export type SizeFit = "slim" | "regular" | "loose";
export type SizeRun = "true" | "small" | "large";

export interface SizeChart {
  kind: SizeGuideKind;
  columns: SizeColumn[];
  rows: SizeRow[];
  fit: SizeFit | null;
  sizing: SizeRun | null;
  note: string | null;
}

interface KindColumn extends SizeColumn {
  /** حرف روی طرح — ستون بی‌حرف روی طرح فلش ندارد */
  letter?: string;
  /** پیش‌فرض خاموش؛ ادمین روشنش می‌کند */
  optional?: boolean;
  /** فاصله‌ی پیشنهادی هر سایز با سایز بعدی (سانت) */
  step: number;
  /** راهنمای «چطور اندازه بگیرم» */
  how: string;
}

const CHEST: KindColumn = { key: "chest", label: "عرض سینه", letter: "A", step: 2, how: "زیر حلقه‌ی آستین، از درز کناری تا درز کناری دیگر" };
const SHOULDER: KindColumn = { key: "shoulder", label: "عرض شانه", letter: "B", step: 1, how: "از سر شانه‌ی چپ تا سر شانه‌ی راست، پشت لباس" };
const LENGTH: KindColumn = { key: "length", label: "قد لباس", letter: "C", step: 2, how: "از بالاترین نقطه‌ی شانه کنار یقه تا پایین لباس" };
const SLEEVE: KindColumn = { key: "sleeve", label: "قد آستین", letter: "D", step: 1, how: "از سر شانه تا لبه‌ی سرآستین" };

export const SIZE_GUIDE_KINDS: Record<SizeGuideKind, { label: string; columns: KindColumn[] }> = {
  shirt: {
    label: "پیراهن",
    columns: [CHEST, SHOULDER, LENGTH, SLEEVE, { key: "collar", label: "دور یقه", optional: true, step: 1, how: "دور یقه‌ی بسته، از جای دکمه تا جادکمه" }],
  },
  tshirt: { label: "تی‌شرت و پولوشرت", columns: [CHEST, SHOULDER, LENGTH, SLEEVE] },
  outer: { label: "پلیور، هودی، کاپشن، کت", columns: [CHEST, SHOULDER, LENGTH, SLEEVE] },
  manto: {
    label: "مانتو",
    columns: [CHEST, SHOULDER, LENGTH, SLEEVE, { key: "hip", label: "عرض باسن", optional: true, step: 2, how: "پهن‌ترین قسمت پایین‌تنه، از درز تا درز" }],
  },
  pants: {
    label: "شلوار",
    columns: [
      { key: "waist", label: "عرض کمر", letter: "A", step: 2, how: "لبه‌ی بالای کمر بسته، از این سر تا آن سر" },
      { key: "length", label: "قد شلوار", letter: "B", step: 1, how: "کنار پا، از بالای کمر تا لبه‌ی پایین" },
      { key: "rise", label: "فاق", letter: "C", step: 1, how: "از بالای کمر در جلو تا محل دوخت وسط پا" },
      { key: "hem", label: "دم‌پا", letter: "D", step: 0.5, how: "لبه‌ی پایین یک پاچه، از این سر تا آن سر" },
      { key: "hip", label: "عرض باسن", letter: "E", optional: true, step: 2, how: "پهن‌ترین قسمت، کمی بالاتر از وسط پا" },
    ],
  },
  custom: { label: "سفارشی (بدون طرح)", columns: [] },
};

export const FIT_LABEL: Record<SizeFit, string> = { slim: "جذب (اسلیم)", regular: "معمولی", loose: "آزاد" };
export const SIZING_LABEL: Record<SizeRun, string> = {
  true: "سایز استاندارد",
  small: "کوچک کار شده — یک سایز بزرگ‌تر بردارید",
  large: "بزرگ کار شده — یک سایز کوچک‌تر بردارید",
};

/** دکمه‌های سریع ردیف‌ها */
export const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "S تا 3XL", sizes: ["S", "M", "L", "XL", "2XL", "3XL"] },
  { label: "۳۸ تا ۴۸", sizes: ["38", "40", "42", "44", "46", "48"] },
  { label: "۲۸ تا ۳۸ (شلوار)", sizes: ["28", "30", "32", "34", "36", "38"] },
  { label: "فری‌سایز", sizes: ["فری‌سایز"] },
];

export const MAX_SIZE_ROWS = 20;
export const MAX_SIZE_COLUMNS = 8;

export const kindColumn = (kind: SizeGuideKind, key: string): KindColumn | undefined => SIZE_GUIDE_KINDS[kind]?.columns.find((c) => c.key === key);

/** ستون‌های پیش‌فرض یک نوع (بدون اختیاری‌ها) */
export const defaultColumns = (kind: SizeGuideKind): SizeColumn[] =>
  SIZE_GUIDE_KINDS[kind].columns.filter((c) => !c.optional).map(({ key, label }) => ({ key, label }));

/** نوع لباس از روی نام دسته و والدهایش — فقط پیشنهاد، ادمین عوضش می‌کند */
export function guessKind(text: string): SizeGuideKind {
  const t = text.replace(/‌/g, " ");
  if (/شلوار|جین|اسلش|جاگر|کارگو/.test(t)) return "pants";
  if (/مانتو/.test(t)) return "manto";
  if (/تی ?شرت|پولو|تیشرت/.test(t)) return "tshirt";
  if (/پیراهن/.test(t)) return "shirt";
  // «کت» جدا، نه «کتان»
  if (/پلیور|هودی|سویشرت|کاپشن|ژاکت|پافر|(^|\s)کت(\s|$)/.test(t)) return "outer";
  return "shirt";
}

/**
 * پر کردن سایزهای دیگر از روی یک سایز کامل: هر ردیف بالاتر `step` بیشتر.
 * خانه‌ای که خود ادمین پر کرده دست نمی‌خورد مگر `overwrite`.
 */
export function gradeRows(rows: SizeRow[], baseIndex: number, steps: Record<string, number>, overwrite = false): SizeRow[] {
  const base = rows[baseIndex];
  if (!base) return rows;
  return rows.map((r, i) => {
    if (i === baseIndex) return r;
    const values = { ...r.values };
    for (const [key, step] of Object.entries(steps)) {
      const b = base.values[key];
      if (b == null || !Number.isFinite(step)) continue;
      if (!overwrite && values[key] != null) continue;
      values[key] = Math.round((b + (i - baseIndex) * step) * 2) / 2;
    }
    return { ...r, values };
  });
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫,]/g, "."));
  return Number.isFinite(n) && n > 0 && n < 500 ? Math.round(n * 10) / 10 : null;
};

/** ورودی ادمین یا ستون Json دیتابیس ← جدول تمیز؛ ایراد ← پیام فارسی */
export function normalizeChart(raw: unknown): { chart: SizeChart } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kind = (String(b.kind ?? "") in SIZE_GUIDE_KINDS ? b.kind : "custom") as SizeGuideKind;
  const seen = new Set<string>();
  const columns: SizeColumn[] = [];
  for (const c of Array.isArray(b.columns) ? b.columns : []) {
    const key = String((c as SizeColumn)?.key ?? "").trim().slice(0, 30);
    const label = String((c as SizeColumn)?.label ?? "").trim().slice(0, 40);
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    columns.push({ key, label });
  }
  if (columns.length > MAX_SIZE_COLUMNS) return { error: `حداکثر ${MAX_SIZE_COLUMNS} اندازه` };
  const sizes = new Set<string>();
  const rows: SizeRow[] = [];
  for (const r of Array.isArray(b.rows) ? b.rows : []) {
    const size = String((r as SizeRow)?.size ?? "").trim().slice(0, 20);
    if (!size) continue;
    if (sizes.has(size)) return { error: `سایز «${size}» دو بار آمده` };
    sizes.add(size);
    const v = ((r as SizeRow)?.values ?? {}) as Record<string, unknown>;
    rows.push({ size, values: Object.fromEntries(columns.map((c) => [c.key, num(v[c.key])])) });
  }
  if (rows.length > MAX_SIZE_ROWS) return { error: `حداکثر ${MAX_SIZE_ROWS} سایز` };
  if (rows.length && !columns.length) return { error: "دست‌کم یک اندازه (ستون) لازم است" };
  const fit = (["slim", "regular", "loose"] as const).find((x) => x === b.fit) ?? null;
  const sizing = (["true", "small", "large"] as const).find((x) => x === b.sizing) ?? null;
  const note = String(b.note ?? "").trim().slice(0, 300) || null;
  return { chart: { kind, columns, rows, fit, sizing, note } };
}

/** جدولی که ارزش نمایش دارد — دست‌کم یک سایز با یک عدد */
export const chartHasData = (c: Pick<SizeChart, "rows">) => c.rows.some((r) => Object.values(r.values).some((v) => v != null));

export const faNum = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]).replace(".", "٫");
