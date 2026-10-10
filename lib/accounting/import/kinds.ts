/**
 * چهار نوع ورود از اکسل و ستون‌هایشان — مشترک مرورگر و سرور (بی import سروری).
 * docs/plans/inventory-items.md بخش ۶. `aliases` برای حدس خودکار ستون از سرستون فایل.
 */

export type ImportKind = "items" | "stock" | "parties" | "cheques";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  aliases: string[];
}

export const IMPORT_KINDS: Record<ImportKind, { title: string; desc: string; fields: ImportField[] }> = {
  items: {
    title: "کالاها",
    desc: "کد، نام، بارکد، واحد، قیمت فروش، گروه؛ برای پوشاک مدل و رنگ و سایز. کالای با همان کد به‌روز می‌شود.",
    fields: [
      { key: "code", label: "کد کالا", required: true, aliases: ["کد", "کد کالا", "کدکالا", "code", "sku", "شماره کالا", "کد محصول"] },
      { key: "title", label: "نام کالا", required: true, aliases: ["نام", "نام کالا", "شرح", "شرح کالا", "عنوان", "title", "name", "نام محصول"] },
      { key: "barcode", label: "بارکد", hint: "چند بارکد با ویرگول", aliases: ["بارکد", "barcode", "ean", "gtin"] },
      { key: "unit", label: "واحد", aliases: ["واحد", "واحد اصلی", "unit"] },
      { key: "salePrice", label: "قیمت فروش", aliases: ["قیمت فروش", "قیمت", "فی فروش", "price", "مبلغ فروش"] },
      { key: "group", label: "گروه", hint: "پوشاک/پیراهن", aliases: ["گروه", "گروه کالا", "دسته", "دسته بندی", "group", "category"] },
      { key: "model", label: "مدل", hint: "برای رنگ و سایز", aliases: ["مدل", "model", "طرح اصلی"] },
    ],
  },
  stock: {
    title: "موجودی اول دوره",
    desc: "تعداد و بهای هر کالا در هر انبار، روز اول سال مالی. کالاها باید از قبل وارد شده باشند.",
    fields: [
      { key: "code", label: "کد کالا", required: true, aliases: ["کد", "کد کالا", "کدکالا", "code", "sku", "بارکد"] },
      { key: "qty", label: "تعداد", required: true, aliases: ["تعداد", "موجودی", "مقدار", "qty", "quantity", "مانده"] },
      { key: "unitCost", label: "بهای واحد", required: true, hint: "میانگین بهای خرید", aliases: ["بها", "بهای واحد", "فی", "فی خرید", "قیمت خرید", "میانگین", "cost", "قیمت تمام شده"] },
      { key: "warehouse", label: "انبار", hint: "خالی = انبار پیش‌فرض", aliases: ["انبار", "نام انبار", "کد انبار", "warehouse"] },
    ],
  },
  parties: {
    title: "اشخاص و مانده",
    desc: "مشتری و تأمین‌کننده با مانده‌ی اول دوره. شخص با همان کد قبلی، موبایل یا نام دقیق به‌روز می‌شود.",
    fields: [
      { key: "externalCode", label: "کد قبلی شخص", aliases: ["کد", "کد شخص", "کد طرف حساب", "کد حساب", "code"] },
      { key: "name", label: "نام", required: true, aliases: ["نام", "نام شخص", "نام و نام خانوادگی", "طرف حساب", "نام طرف حساب", "شرح", "name"] },
      { key: "mobile", label: "موبایل", aliases: ["موبایل", "همراه", "تلفن همراه", "شماره همراه", "mobile"] },
      { key: "phone", label: "تلفن", aliases: ["تلفن", "تلفن ثابت", "phone", "tel"] },
      { key: "nationalId", label: "کد ملی / شناسه ملی", aliases: ["کد ملی", "کدملی", "شناسه ملی", "national"] },
      { key: "economicCode", label: "کد اقتصادی", aliases: ["کد اقتصادی", "economic"] },
      { key: "postalCode", label: "کد پستی", aliases: ["کد پستی", "postal"] },
      { key: "city", label: "شهر", aliases: ["شهر", "city"] },
      { key: "address", label: "نشانی", aliases: ["نشانی", "آدرس", "address"] },
      { key: "role", label: "نقش", hint: "مشتری / تأمین‌کننده", aliases: ["نوع", "نقش", "نوع شخص", "role"] },
      { key: "balance", label: "مانده (+ بدهکار، − بستانکار)", hint: "یا دو ستون بدهکار و بستانکار", aliases: ["مانده", "مانده حساب", "balance"] },
      { key: "debit", label: "مانده بدهکار", hint: "به ما بدهکار است", aliases: ["بدهکار", "مانده بدهکار", "debit"] },
      { key: "credit", label: "مانده بستانکار", hint: "ما به او بدهکاریم", aliases: ["بستانکار", "مانده بستانکار", "credit"] },
    ],
  },
  cheques: {
    title: "چک‌های باز",
    desc: "چک‌های دریافتی نزد ما و چک‌های صادره‌ی پاس‌نشده، روز اول سال مالی. اشخاص باید از قبل وارد شده باشند.",
    fields: [
      { key: "direction", label: "نوع", required: true, hint: "دریافتی / پرداختی", aliases: ["نوع", "نوع چک", "دریافتی/پرداختی", "direction"] },
      { key: "serialNo", label: "شماره چک", required: true, aliases: ["شماره", "شماره چک", "سریال", "serial"] },
      { key: "amount", label: "مبلغ", required: true, aliases: ["مبلغ", "مبلغ چک", "amount"] },
      { key: "dueDate", label: "سررسید", required: true, hint: "۱۴۰۵/۰۸/۱۵", aliases: ["سررسید", "تاریخ سررسید", "due"] },
      { key: "party", label: "شخص", required: true, hint: "کد قبلی، موبایل یا نام", aliases: ["شخص", "طرف حساب", "نام", "صاحب حساب", "در وجه", "party"] },
      { key: "bankName", label: "بانک", hint: "دریافتی: بانک چک", aliases: ["بانک", "نام بانک", "bank"] },
      { key: "treasury", label: "حساب بانکی ما", hint: "صادره: نام حساب در پنل", aliases: ["حساب", "حساب بانکی", "حساب ما", "از حساب"] },
      { key: "sayadId", label: "شناسه صیادی", aliases: ["صیادی", "شناسه صیادی", "sayad"] },
      { key: "branch", label: "شعبه", aliases: ["شعبه", "branch"] },
      { key: "ownerName", label: "صاحب حساب چک", aliases: ["صاحب حساب", "صادرکننده", "owner"] },
      { key: "issueDate", label: "تاریخ صدور", aliases: ["تاریخ صدور", "تاریخ", "issue"] },
      { key: "note", label: "توضیح", aliases: ["توضیح", "شرح", "note"] },
    ],
  },
};

const norm = (s: string) =>
  s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s_\-.:]+/g, "")
    .toLowerCase();

/** حدس ستون فایل برای هر فیلد از سرستون — دقیق اول، بعد «شامل» */
export function guessMapping(kind: ImportKind, header: string[], extra: ImportField[] = []): Record<string, number> {
  const fields = [...IMPORT_KINDS[kind].fields, ...extra];
  const h = header.map((x) => norm(x ?? ""));
  const out: Record<string, number> = {};
  const used = new Set<number>();
  for (const pass of ["exact", "contains"] as const) {
    for (const f of fields) {
      if (out[f.key] !== undefined) continue;
      const names = [f.label, ...f.aliases].map(norm);
      const i = h.findIndex((col, idx) => !used.has(idx) && col && (pass === "exact" ? names.includes(col) : names.some((n) => n.length > 2 && col.includes(n))));
      if (i >= 0) {
        out[f.key] = i;
        used.add(i);
      }
    }
  }
  return out;
}
