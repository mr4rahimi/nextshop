/**
 * بلوک‌های لندینگ‌ساز — نوع‌ها، پیش‌فرض‌ها، اعتبارسنجی.
 *
 * ⚠️ بدون Prisma و Next: ویرایشگر در مرورگر و API از همین می‌خوانند.
 *
 * سه سطح سخت‌گیری:
 * - **ذخیره‌ی پیش‌نویس** شکل آزاد می‌پذیرد (`sanitizeBlocks`) — نیمه‌کاره هم ذخیره شود.
 * - **انتشار** سخت‌گیر است و خطا را با شماره‌ی بلوک می‌دهد (`validateForPublish`).
 * - **رندر عمومی** بلوک خراب را کنار می‌گذارد (`parseBlocksLenient`)، کل صفحه نمی‌افتد.
 *
 * مستندات: docs/features/tools.md بخش ۳
 */

import { normalizeTarget } from "./common";

export type SocialKey = "instagram" | "telegram" | "whatsapp" | "eitaa" | "rubika" | "bale";

export const SOCIALS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "instagram", label: "اینستاگرام", placeholder: "نام کاربری یا آدرس" },
  { key: "telegram", label: "تلگرام", placeholder: "نام کاربری یا آدرس" },
  { key: "whatsapp", label: "واتساپ", placeholder: "شماره موبایل" },
  { key: "eitaa", label: "ایتا", placeholder: "نام کاربری یا آدرس" },
  { key: "rubika", label: "روبیکا", placeholder: "نام کاربری یا آدرس" },
  { key: "bale", label: "بله", placeholder: "نام کاربری یا آدرس" },
];

export type ButtonIcon = "link" | "phone" | "cart" | "map" | "instagram" | "telegram" | "whatsapp" | "mail" | "gift" | "star";

export const BUTTON_ICONS: { key: ButtonIcon; label: string }[] = [
  { key: "link", label: "لینک" },
  { key: "phone", label: "تماس" },
  { key: "cart", label: "خرید" },
  { key: "map", label: "نقشه" },
  { key: "instagram", label: "اینستاگرام" },
  { key: "telegram", label: "تلگرام" },
  { key: "whatsapp", label: "واتساپ" },
  { key: "mail", label: "ایمیل" },
  { key: "gift", label: "هدیه" },
  { key: "star", label: "ستاره" },
];

/** ۰ = شنبه */
export const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export interface HoursDay {
  open: boolean;
  from: string;
  to: string;
}

export type Block =
  | { id: string; type: "header"; logo: string; name: string; tagline: string; cover: string }
  | { id: string; type: "buttons"; items: { label: string; url: string; icon: ButtonIcon }[] }
  | { id: string; type: "social"; links: Partial<Record<SocialKey, string>> }
  | { id: string; type: "text"; title: string; body: string }
  | { id: string; type: "image"; images: string[]; caption: string }
  | { id: string; type: "products"; title: string; productIds: string[] }
  | { id: string; type: "callback"; title: string; text: string }
  | { id: string; type: "address"; address: string; lat: string; lng: string }
  | { id: string; type: "hours"; days: HoursDay[]; note: string }
  | { id: string; type: "faq"; title: string; items: { q: string; a: string }[] }
  | { id: string; type: "review"; title: string; text: string };

export type BlockType = Block["type"];

export const BLOCK_META: Record<BlockType, { label: string; hint: string }> = {
  header: { label: "سربرگ", hint: "لوگو، نام، شعار و عکس کاور" },
  buttons: { label: "دکمه‌ها", hint: "لینک به محصول، دسته، تماس یا هر آدرس" },
  social: { label: "شبکه‌های اجتماعی", hint: "ردیف آیکن اینستاگرام، تلگرام، واتساپ و …" },
  products: { label: "محصولات", hint: "چند محصول انتخابی با قیمت و دکمه‌ی خرید" },
  callback: { label: "درخواست تماس", hint: "فرم شماره؛ در «درخواست‌های تماس» پنل می‌نشیند" },
  text: { label: "متن", hint: "عنوان و متن ساده" },
  image: { label: "عکس / گالری", hint: "یک یا چند عکس" },
  address: { label: "آدرس و مسیریابی", hint: "دکمه‌ی نشان، بلد و گوگل‌مپ" },
  hours: { label: "ساعت کاری", hint: "با «الان باز است / بسته است»" },
  faq: { label: "سؤالات متداول", hint: "پرسش و پاسخ جمع‌شونده" },
  review: { label: "ثبت نظر", hint: "دکمه‌های نشان، بلد و گوگل از تنظیمات «درخواست نظر»" },
};

export const BLOCK_ORDER: BlockType[] = [
  "header", "buttons", "products", "social", "callback", "text", "image", "address", "hours", "faq", "review",
];

export interface LandingTheme {
  /** رنگ دکمه‌ها و تأکید */
  primary: string;
  /** زمینه‌ی صفحه */
  background: string;
}

export const DEFAULT_THEME: LandingTheme = { primary: "#2563eb", background: "#f4f6fb" };

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultBlock(type: BlockType, defaults: { name?: string; logo?: string; phone?: string } = {}): Block {
  const id = newId();
  switch (type) {
    case "header":
      return { id, type, logo: defaults.logo ?? "", name: defaults.name ?? "", tagline: "", cover: "" };
    case "buttons":
      return {
        id, type,
        items: [
          { label: "ورود به فروشگاه", url: "/", icon: "cart" },
          // شماره‌ی خالی عمداً است: تا ادمین ننویسد منتشر نمی‌شود
          { label: "تماس با ما", url: defaults.phone ? `tel:${defaults.phone}` : "tel:", icon: "phone" },
        ],
      };
    case "social":
      return { id, type, links: {} };
    case "text":
      return { id, type, title: "", body: "" };
    case "image":
      return { id, type, images: [], caption: "" };
    case "products":
      return { id, type, title: "محصولات پیشنهادی", productIds: [] };
    case "callback":
      return { id, type, title: "با شما تماس می‌گیریم", text: "شماره‌تان را بگذارید، همکاران ما به‌زودی تماس می‌گیرند." };
    case "address":
      return { id, type, address: "", lat: "", lng: "" };
    case "hours":
      return {
        id, type, note: "",
        days: WEEKDAYS.map((_, i) => ({ open: i !== 6, from: "09:00", to: i === 5 ? "14:00" : "18:00" })),
      };
    case "faq":
      return { id, type, title: "سؤالات متداول", items: [{ q: "", a: "" }] };
    case "review":
      return { id, type, title: "نظر شما برای ما مهم است", text: "تجربه‌تان از خرید را با دیگران به اشتراک بگذارید." };
  }
}

export function defaultBlocks(d: { name?: string; logo?: string; phone?: string }): Block[] {
  return [defaultBlock("header", d), defaultBlock("buttons", d), defaultBlock("social", d)];
}

// ─── پاک‌سازی ورودی ──────────────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-f]{6}$/i;
const ICONS = new Set(BUTTON_ICONS.map((i) => i.key));
const MAX_BLOCKS = 40;

/** هر بلوک ناشناخته کنار می‌رود؛ فیلدها رشته و کوتاه می‌شوند. برای پیش‌نویس. */
export function sanitizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const b of raw.slice(0, MAX_BLOCKS)) {
    const s = sanitizeBlock(b);
    if (s) out.push(s);
  }
  return out;
}

function sanitizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const id = str(b.id, 20) || newId();
  switch (b.type) {
    case "header":
      return { id, type: "header", logo: str(b.logo, 500), name: str(b.name, 80), tagline: str(b.tagline, 200), cover: str(b.cover, 500) };
    case "buttons": {
      const items = Array.isArray(b.items) ? b.items.slice(0, 12) : [];
      return {
        id, type: "buttons",
        items: items.map((i) => {
          const x = (i ?? {}) as Record<string, unknown>;
          const icon = typeof x.icon === "string" && ICONS.has(x.icon as ButtonIcon) ? (x.icon as ButtonIcon) : "link";
          return { label: str(x.label, 60), url: str(x.url, 1000), icon };
        }),
      };
    }
    case "social": {
      const src = (b.links ?? {}) as Record<string, unknown>;
      const links: Partial<Record<SocialKey, string>> = {};
      for (const s of SOCIALS) if (typeof src[s.key] === "string" && (src[s.key] as string).trim()) links[s.key] = str(src[s.key], 300);
      return { id, type: "social", links };
    }
    case "text":
      return { id, type: "text", title: str(b.title, 120), body: str(b.body, 3000) };
    case "image":
      return {
        id, type: "image",
        images: (Array.isArray(b.images) ? b.images : []).filter((x): x is string => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 500)),
        caption: str(b.caption, 200),
      };
    case "products":
      return {
        id, type: "products", title: str(b.title, 120),
        productIds: (Array.isArray(b.productIds) ? b.productIds : []).filter((x): x is string => typeof x === "string").slice(0, 12),
      };
    case "callback":
      return { id, type: "callback", title: str(b.title, 120), text: str(b.text, 400) };
    case "address":
      return { id, type: "address", address: str(b.address, 400), lat: str(b.lat, 20), lng: str(b.lng, 20) };
    case "hours": {
      const days = Array.isArray(b.days) ? b.days : [];
      return {
        id, type: "hours", note: str(b.note, 200),
        days: WEEKDAYS.map((_, i) => {
          const d = (days[i] ?? {}) as Record<string, unknown>;
          return {
            open: d.open === true,
            from: typeof d.from === "string" && HHMM.test(d.from) ? d.from : "09:00",
            to: typeof d.to === "string" && HHMM.test(d.to) ? d.to : "18:00",
          };
        }),
      };
    }
    case "faq":
      return {
        id, type: "faq", title: str(b.title, 120),
        items: (Array.isArray(b.items) ? b.items : []).slice(0, 20).map((i) => {
          const x = (i ?? {}) as Record<string, unknown>;
          return { q: str(x.q, 200), a: str(x.a, 1500) };
        }),
      };
    case "review":
      return { id, type: "review", title: str(b.title, 120), text: str(b.text, 300) };
    default:
      return null;
  }
}

export function sanitizeTheme(raw: unknown): LandingTheme {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    primary: typeof t.primary === "string" && HEX.test(t.primary) ? t.primary : DEFAULT_THEME.primary,
    background: typeof t.background === "string" && HEX.test(t.background) ? t.background : DEFAULT_THEME.background,
  };
}

/** آدرس تصویر: فقط آپلودهای همین سایت یا https */
function okImage(u: string): boolean {
  return /^\/uploads\/[^\s]+$/.test(u) || /^https:\/\/[^\s]+$/.test(u);
}

/**
 * سخت‌گیری انتشار — خطاها با شماره‌ی بلوک («بلوک ۲: …»).
 * آدرس دکمه‌ها همان قاعده‌ی لینک کوتاه را دارد.
 */
export function validateForPublish(blocks: Block[], siteUrl: string): string[] {
  const errors: string[] = [];
  if (blocks.length === 0) errors.push("لندینگ هیچ بلوکی ندارد");
  blocks.forEach((b, i) => {
    const at = `بلوک ${(i + 1).toLocaleString("fa-IR")} (${BLOCK_META[b.type].label})`;
    switch (b.type) {
      case "header":
        if (!b.name.trim() && !b.logo) errors.push(`${at}: نام یا لوگو لازم است`);
        if (b.logo && !okImage(b.logo)) errors.push(`${at}: آدرس لوگو معتبر نیست`);
        if (b.cover && !okImage(b.cover)) errors.push(`${at}: آدرس کاور معتبر نیست`);
        break;
      case "buttons":
        if (b.items.length === 0) errors.push(`${at}: دست‌کم یک دکمه لازم است`);
        b.items.forEach((it, j) => {
          const n = (j + 1).toLocaleString("fa-IR");
          if (!it.label.trim()) errors.push(`${at}: دکمه‌ی ${n} برچسب ندارد`);
          if (!normalizeTarget(it.url, siteUrl)) errors.push(`${at}: آدرس دکمه‌ی ${n} معتبر نیست`);
        });
        break;
      case "social":
        if (Object.keys(b.links).length === 0) errors.push(`${at}: دست‌کم یک شبکه را پر کنید`);
        break;
      case "text":
        if (!b.title.trim() && !b.body.trim()) errors.push(`${at}: خالی است`);
        break;
      case "image":
        if (b.images.length === 0) errors.push(`${at}: عکسی انتخاب نشده`);
        if (b.images.some((u) => !okImage(u))) errors.push(`${at}: آدرس یکی از عکس‌ها معتبر نیست`);
        break;
      case "products":
        if (b.productIds.length === 0) errors.push(`${at}: محصولی انتخاب نشده`);
        break;
      case "address":
        if (!b.address.trim() && !(b.lat && b.lng)) errors.push(`${at}: آدرس یا مختصات لازم است`);
        if ((b.lat || b.lng) && !(Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)) && b.lat && b.lng))
          errors.push(`${at}: مختصات معتبر نیست`);
        break;
      case "faq":
        if (!b.items.some((x) => x.q.trim() && x.a.trim())) errors.push(`${at}: دست‌کم یک پرسش و پاسخ کامل لازم است`);
        break;
      case "hours":
      case "callback":
      case "review":
        break;
    }
  });
  return errors;
}

/** رندر عمومی: هر بلوک خراب کنار می‌رود، بقیه نمایش داده می‌شوند */
export function parseBlocksLenient(raw: unknown): Block[] {
  try {
    return sanitizeBlocks(raw);
  } catch {
    return [];
  }
}

/**
 * JSON با کلیدهای مرتب — مقایسه‌ی «تغییرات منتشرنشده».
 * ⚠️ Postgres در `jsonb` ترتیب کلیدها را عوض می‌کند؛ `JSON.stringify` ساده
 * بعد از انتشار هم «تغییر دارد» می‌گفت.
 */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** نامک‌هایی که مسیر یا معنای دیگری دارند */
export const RESERVED_LANDING_SLUGS = new Set(["admin", "api", "new", "img", "shop", "static"]);

// ─── آدرس سکوها ──────────────────────────────────────────────────────────

/** لینک مسیریابی از مختصات — نقشه‌ی جاسازی‌شده نداریم (از اینترنت خارجی لود می‌شود) */
export function mapLinks(lat: string, lng: string): { key: string; label: string; url: string }[] {
  if (!lat || !lng) return [];
  return [
    { key: "neshan", label: "نشان", url: `https://neshan.org/maps/@${lat},${lng},16z,0p` },
    { key: "balad", label: "بلد", url: `https://balad.ir/location?latitude=${lat}&longitude=${lng}&zoom=16` },
    { key: "google", label: "گوگل‌مپ", url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` },
  ];
}

/** نام کاربری یا شماره → آدرس کامل هر شبکه */
export function socialUrl(key: SocialKey, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const user = v.replace(/^@/, "");
  switch (key) {
    case "instagram":
      return `https://instagram.com/${user}`;
    case "telegram":
      return `https://t.me/${user}`;
    case "whatsapp": {
      let d = user.replace(/[^\d]/g, "");
      if (d.startsWith("0")) d = `98${d.slice(1)}`;
      return `https://wa.me/${d}`;
    }
    case "eitaa":
      return `https://eitaa.com/${user}`;
    case "rubika":
      return `https://rubika.ir/${user}`;
    case "bale":
      return `https://ble.ir/${user}`;
  }
}

/**
 * «الان باز است؟» با ساعت تهران. بستن بعد از نیمه‌شب (۲۰:۰۰ تا ۰۲:۰۰) به روز
 * قبل تعلق دارد. **فقط پس از mount در مرورگر صدا زده شود** تا رندر سرور و
 * مرورگر یکی بماند.
 */
export function openNow(days: HoursDay[], now = new Date()): boolean | null {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sat";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const order = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const today = order.indexOf(wd);
  if (today < 0 || days.length !== 7) return null;
  const minutes = h * 60 + m;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

  const t = days[today];
  if (t.open) {
    const f = toMin(t.from), e = toMin(t.to);
    if (e > f ? minutes >= f && minutes < e : minutes >= f) return true;
  }
  const y = days[(today + 6) % 7];
  if (y.open) {
    const f = toMin(y.from), e = toMin(y.to);
    if (e <= f && minutes < e) return true;
  }
  return false;
}
