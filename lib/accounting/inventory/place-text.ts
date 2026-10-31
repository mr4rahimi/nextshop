/**
 * مکان کالا — نرمال‌سازی و نمایش، بی‌دیتابیس (سرور و مرورگر). webhesab-parity.md بخش ۱۱.
 */

export interface PlaceParts {
  zone: string | null;
  aisle: string | null;
  shelf: string | null;
  level: string | null;
}

export const PLACE_FIELDS = ["zone", "aisle", "shelf", "level"] as const;
export const PLACE_LABELS: Record<(typeof PLACE_FIELDS)[number], string> = { zone: "منطقه", aisle: "ردیف", shelf: "قفسه", level: "طبقه" };

/** «  a ۰۳ » ← «A 03»؛ خالی ← null؛ حداکثر ۲۴ نویسه */
export function normPart(v: unknown): string | null {
  const t = String(v ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 24);
  return t || null;
}

export const isEmptyPlace = (p: Partial<PlaceParts> | null | undefined) => !p || PLACE_FIELDS.every((f) => !p[f]);

/** «ویترین · A-03-2» — ردیف، قفسه، طبقه با خط تیره؛ خالی‌ها جا می‌افتند */
export function placeText(p: Partial<PlaceParts> | null | undefined): string {
  if (!p) return "";
  const code = [p.aisle, p.shelf, p.level].filter(Boolean).join("-");
  return [p.zone, code].filter(Boolean).join(" · ");
}

const coll = new Intl.Collator("fa", { numeric: true, sensitivity: "base" });

/** ترتیب طبیعی مکان (A-2 پیش از A-10)؛ فیلد خالی و بی‌مکان آخر */
export function comparePlace(a: Partial<PlaceParts> | null, b: Partial<PlaceParts> | null): number {
  const ea = isEmptyPlace(a);
  const eb = isEmptyPlace(b);
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  for (const f of PLACE_FIELDS) {
    // فیلد خالی بعد از پر (کالای بی‌منطقه بعد از منطقه‌دارها)
    if (!a![f] !== !b![f]) return a![f] ? -1 : 1;
    const c = coll.compare(a![f] ?? "", b![f] ?? "");
    if (c) return c;
  }
  return 0;
}
