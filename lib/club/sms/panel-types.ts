/**
 * نوع‌های بخش مدیریتی پنل پیامک
 *
 * جدا از `types.ts` که قرارداد *ارسال* است. این‌ها موجودیت‌های خود پنل‌اند
 * (خط، پترن، دفترچه تلفن، ...) و در دیتابیس ما ذخیره نمی‌شوند — منبع حقیقتشان
 * پنل است و زنده خوانده می‌شوند.
 */

export interface Paged<T> {
  items: T[];
  page: number;
  lastPage: number;
  perPage: number;
  total: number;
}

// ── خطوط ────────────────────────────────────────────────────────────

export interface Line {
  number: string;
  isDedicated: boolean;
  /** تعرفه هر صفحه پیامک روی این خط (تومان) */
  smsCost: number;
  description?: string;
  /** آیا خط خدماتی است — روی خط خدماتی متن آزاد نیاز به تأیید دارد */
  service?: boolean;
}

// ── پترن ────────────────────────────────────────────────────────────

export type PatternStatus = "pending" | "active" | "rejected";
export type PatternVarType = "int" | "str" | "date";

export interface PatternVar {
  var: string;
  length: number;
  type: PatternVarType;
}

export interface Pattern {
  id: number;
  code: string;
  text: string;
  description: string | null;
  website: string | null;
  status: PatternStatus;
  shared: boolean;
  /** پیام اپراتور هنگام رد شدن پترن */
  adminMessage: string | null;
  reviewedAt: string | null;
  vars: PatternVar[];
}

export interface PatternInput {
  text: string;
  description?: string;
  website?: string;
  shared?: boolean;
  /** 1=ورود، 2=باشگاه، 3=سفارش، 255=سایر */
  category?: number;
  vars: PatternVar[];
}

// ── دفترچه تلفن ─────────────────────────────────────────────────────

export interface Phonebook {
  id: number;
  title: string;
  contactCount?: number;
  attributeIds: number[];
}

export type AttributeType = "string" | "number" | "date";

export interface PhonebookAttribute {
  id: number;
  title: string;
  type: AttributeType;
}

export type ContactPrefix = "man" | "woman" | "co" | "org";

export interface Contact {
  id: number;
  mobile: string;
  name: string;
  prefix: ContactPrefix | null;
  phonebookId: number | null;
  attributes: { attributeId: number; value: string }[];
}

export interface ContactInput {
  mobile: string;
  name?: string;
  prefix?: ContactPrefix;
  attributes?: { attribute_id: number; value: string }[];
}

// ── گزارش ارسال ─────────────────────────────────────────────────────

export interface SendRequestRow {
  id: number;
  status: string;
  type: string;
  lineNumber: string | null;
  text: string | null;
  schedule: string | null;
  rejectedDue: string | null;
  createdAt: string | null;
  counts: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
  } | null;
}

// ── بانک شماره ──────────────────────────────────────────────────────

export interface NumberBank {
  id: number;
  title: string;
  count: number;
}

// ── پیام صوتی ───────────────────────────────────────────────────────

export interface VoiceFile {
  id: number;
  title?: string;
  duration?: number;
}

// ── موقعیت جغرافیایی ────────────────────────────────────────────────

export interface Province {
  id: number;
  title: string;
}

export interface City {
  id: number;
  title: string;
  provinceId?: number;
}

// ── ارسال موقعیت‌محور (LBS) ─────────────────────────────────────────

export interface LbsRequest {
  id: number;
  status: string;
  text: string | null;
  address: string | null;
  receiverCount: number;
  createdAt: string | null;
}

export interface LbsInput {
  text: string;
  startTime: number;
  endTime: number;
  receiverCount: number;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string;
  /** «ورود» | «حضور» | «خروج» */
  dispatchMoment?: string;
  /** «همه» | «آقا» | «خانم» */
  receiverGender?: string;
  receiverAgeFrom?: number;
  receiverAgeTo?: number;
  /** «همه» | Android | IOS */
  device?: string;
}

// ── کیف پول ─────────────────────────────────────────────────────────

export interface ChargeResult {
  /** آدرس درگاه که کاربر باید به آن برود */
  payUrl: string | null;
  raw: unknown;
}

// ── هزینه ───────────────────────────────────────────────────────────

export interface CostEstimate {
  /** هزینه‌ی کل (تومان) */
  total: number;
  /** طول متن به کاراکتر، طبق محاسبه‌ی خود پنل */
  textLength?: number;
  /** تعداد صفحه‌ی هر پیامک */
  pages?: number;
  /** تعداد گیرنده‌ای که هزینه بر اساس آن حساب شده */
  receiverCount?: number;
}
