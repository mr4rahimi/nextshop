/**
 * محتوای کیوآر کد — نوع‌ها، ساخت متن داخل QR و اعتبارسنجی.
 *
 * ⚠️ بدون Prisma و Next: هم فرم پنل در مرورگر و هم API از همین می‌خوانند.
 *
 * | حالت | داخل QR | مقصد قابل تغییر | آمار اسکن |
 * |---|---|---|---|
 * | ثابت | خود محتوا | ✗ | ✗ |
 * | پویا | یک لینک کوتاه `/s/<code>` | ✓ | ✓ |
 *
 * نوع‌هایی که لینک نیستند (وای‌فای، کارت ویزیت، تلفن) را گوشی خودش می‌فهمد و
 * از سرور ما عبور نمی‌کنند، پس پویا برایشان معنی ندارد.
 *
 * مستندات: docs/features/tools.md بخش ۲
 */

export type QrType = "url" | "tel" | "sms" | "whatsapp" | "wifi" | "vcard" | "geo" | "text";

export type QrContent = Record<string, string>;

export interface QrTypeMeta {
  type: QrType;
  label: string;
  /** پویا ممکن است؟ */
  dynamic: boolean;
  fields: { key: string; label: string; placeholder?: string; multiline?: boolean; dir?: "ltr" }[];
}

export const QR_TYPES: QrTypeMeta[] = [
  { type: "url", label: "لینک", dynamic: true, fields: [{ key: "url", label: "آدرس", placeholder: "https://… یا /products/…", dir: "ltr" }] },
  { type: "whatsapp", label: "واتساپ", dynamic: true, fields: [
    { key: "phone", label: "شماره", placeholder: "09121234567", dir: "ltr" },
    { key: "text", label: "متن آماده (اختیاری)", multiline: true },
  ] },
  { type: "geo", label: "موقعیت", dynamic: true, fields: [
    { key: "lat", label: "عرض جغرافیایی", placeholder: "35.6997", dir: "ltr" },
    { key: "lng", label: "طول جغرافیایی", placeholder: "51.3380", dir: "ltr" },
  ] },
  { type: "tel", label: "تماس", dynamic: false, fields: [{ key: "phone", label: "شماره", placeholder: "02112345678", dir: "ltr" }] },
  { type: "sms", label: "پیامک", dynamic: false, fields: [
    { key: "phone", label: "شماره", dir: "ltr" },
    { key: "text", label: "متن پیامک", multiline: true },
  ] },
  { type: "wifi", label: "وای‌فای", dynamic: false, fields: [
    { key: "ssid", label: "نام شبکه", dir: "ltr" },
    { key: "password", label: "رمز", dir: "ltr" },
    { key: "security", label: "نوع رمز (WPA، WEP یا nopass)", placeholder: "WPA", dir: "ltr" },
  ] },
  { type: "vcard", label: "کارت ویزیت", dynamic: false, fields: [
    { key: "name", label: "نام" },
    { key: "org", label: "کسب‌وکار" },
    { key: "title", label: "سمت" },
    { key: "phone", label: "تلفن", dir: "ltr" },
    { key: "email", label: "ایمیل", dir: "ltr" },
    { key: "website", label: "سایت", dir: "ltr" },
    { key: "address", label: "آدرس" },
  ] },
  { type: "text", label: "متن", dynamic: false, fields: [{ key: "text", label: "متن", multiline: true }] },
];

export const QR_TYPE_MAP = Object.fromEntries(QR_TYPES.map((t) => [t.type, t])) as Record<QrType, QrTypeMeta>;

export function isQrType(v: unknown): v is QrType {
  return typeof v === "string" && v in QR_TYPE_MAP;
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function latinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (c) => String(FA_DIGITS.indexOf(c) >= 0 ? FA_DIGITS.indexOf(c) : AR_DIGITS.indexOf(c)));
}

function phoneDigits(s: string | undefined): string {
  return latinDigits(s ?? "").replace(/[^\d+]/g, "");
}

/** 0912… → 98912… برای wa.me */
function intlPhone(s: string | undefined): string {
  let d = phoneDigits(s).replace(/^\+/, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `98${d.slice(1)}`;
  return d;
}

function escWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, "\\$1");
}

function escV(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([;,])/g, "\\$1");
}

/** مقصد لینک برای نوع‌هایی که می‌توانند پویا باشند */
export function qrLinkTarget(type: QrType, c: QrContent): string {
  switch (type) {
    case "url":
      return (c.url ?? "").trim();
    case "whatsapp": {
      const text = (c.text ?? "").trim();
      return `https://wa.me/${intlPhone(c.phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
    }
    case "geo":
      // geo: را دوربین آیفون نمی‌فهمد؛ لینک گوگل‌مپ را همه باز می‌کنند
      return `https://www.google.com/maps/search/?api=1&query=${latinDigits(c.lat ?? "").trim()},${latinDigits(c.lng ?? "").trim()}`;
    default:
      return "";
  }
}

/** متنی که داخل QR ثابت می‌نشیند */
export function qrStaticPayload(type: QrType, c: QrContent): string {
  switch (type) {
    case "url":
    case "whatsapp":
    case "geo":
      return qrLinkTarget(type, c);
    case "tel":
      return `tel:${phoneDigits(c.phone)}`;
    case "sms":
      return `SMSTO:${phoneDigits(c.phone)}:${(c.text ?? "").trim()}`;
    case "wifi": {
      const sec = /^(wep|nopass)$/i.test(c.security ?? "") ? c.security!.toUpperCase().replace("NOPASS", "nopass") : "WPA";
      return `WIFI:T:${sec};S:${escWifi(c.ssid ?? "")};${sec === "nopass" ? "" : `P:${escWifi(c.password ?? "")};`};`;
    }
    case "vcard": {
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escV(c.name ?? "")}`, `N:${escV(c.name ?? "")};;;;`];
      if (c.org) lines.push(`ORG:${escV(c.org)}`);
      if (c.title) lines.push(`TITLE:${escV(c.title)}`);
      if (c.phone) lines.push(`TEL;TYPE=CELL:${phoneDigits(c.phone)}`);
      if (c.email) lines.push(`EMAIL:${c.email.trim()}`);
      if (c.website) lines.push(`URL:${c.website.trim()}`);
      if (c.address) lines.push(`ADR:;;${escV(c.address)};;;;`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "text":
      return c.text ?? "";
  }
}

/** خطای فرم یا `null`. آدرس نوع «لینک» را API با قواعد لینک کوتاه هم می‌سنجد. */
export function validateQrContent(type: QrType, c: QrContent): string | null {
  const need = (k: string, label: string) => (!(c[k] ?? "").trim() ? `${label} را وارد کنید` : null);
  switch (type) {
    case "url":
      return need("url", "آدرس");
    case "whatsapp":
    case "tel":
      return phoneDigits(c.phone).length < 5 ? "شماره معتبر نیست" : null;
    case "sms":
      return phoneDigits(c.phone).length < 5 ? "شماره معتبر نیست" : null;
    case "geo": {
      const lat = Number(latinDigits(c.lat ?? "")), lng = Number(latinDigits(c.lng ?? ""));
      if (!(c.lat ?? "").trim() || !(c.lng ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        return "مختصات معتبر نیست — مثل 35.6997 و 51.3380";
      return null;
    }
    case "wifi":
      return need("ssid", "نام شبکه");
    case "vcard":
      return need("name", "نام");
    case "text":
      return need("text", "متن") ?? ((c.text ?? "").length > 1200 ? "متن طولانی است (حداکثر ۱۲۰۰ نویسه)" : null);
  }
}

/** فقط کلیدهای همان نوع، رشته و کوتاه — ورودی API */
export function cleanQrContent(type: QrType, raw: unknown): QrContent {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: QrContent = {};
  for (const f of QR_TYPE_MAP[type].fields) {
    const v = src[f.key];
    if (typeof v === "string") out[f.key] = v.slice(0, f.multiline ? 1200 : 300);
  }
  return out;
}

// ─── ظاهر ────────────────────────────────────────────────────────────────

export interface QrStyle {
  fg: string;
  bg: string;
  /** لوگوی وسط — data URL مربع حداکثر ۲۵۶ پیکسل */
  logo: string | null;
  /** متن زیر QR، مثل «برای دیدن محصول اسکن کنید» */
  caption: string;
}

export const DEFAULT_QR_STYLE: QrStyle = { fg: "#111111", bg: "#ffffff", logo: null, caption: "" };

/** سقف لوگو داخل `QrCode.style` — بزرگ‌ترش یعنی هر بار خواندن فهرست سنگین */
export const QR_LOGO_MAX_CHARS = 200_000;

const HEX = /^#[0-9a-f]{6}$/i;

export function cleanQrStyle(raw: unknown): QrStyle {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const logo =
    typeof s.logo === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(s.logo) && s.logo.length <= QR_LOGO_MAX_CHARS
      ? s.logo
      : null;
  return {
    fg: typeof s.fg === "string" && HEX.test(s.fg) ? s.fg : DEFAULT_QR_STYLE.fg,
    bg: typeof s.bg === "string" && HEX.test(s.bg) ? s.bg : DEFAULT_QR_STYLE.bg,
    logo,
    caption: typeof s.caption === "string" ? s.caption.trim().slice(0, 80) : "",
  };
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** نسبت کنتراست WCAG — QR کم‌کنتراست اسکن نمی‌شود، و پیش‌زمینه باید تیره‌تر باشد */
export function qrContrastWarning(fg: string, bg: string): string | null {
  if (!HEX.test(fg) || !HEX.test(bg)) return null;
  const lf = luminance(fg), lb = luminance(bg);
  if (lf > lb) return "رنگ نقطه‌ها روشن‌تر از زمینه است؛ خیلی از دوربین‌ها QR معکوس را نمی‌خوانند.";
  const ratio = (lb + 0.05) / (lf + 0.05);
  return ratio < 4 ? "کنتراست رنگ‌ها کم است؛ ممکن است اسکن نشود." : null;
}
