"use client";

/**
 * ویجت «فضای خالی» — فقط یک فاصله‌ی عمودی خالی در صفحه اصلی ایجاد می‌کند.
 *
 * ارتفاع دسکتاپ و موبایل جداگانه تنظیم می‌شود. چون مقدار ارتفاع در زمان اجرا
 * از دیتابیس می‌آید، نمی‌توان از کلاس‌های Tailwind استفاده کرد (Tailwind کلاس‌ها
 * را در زمان build می‌سازد)؛ به‌جای آن مقدارها به‌صورت متغیر CSS اینلاین ست
 * می‌شوند و قانون media query در globals.css بین موبایل و دسکتاپ سوییچ می‌کند.
 *
 * توجه: این ویجت داخل جریان `space-y-12` صفحه اصلی قرار می‌گیرد، پس فاصله‌ی
 * نهایی برابر است با ۹۶ پیکسل پیش‌فرض + ارتفاع این ویجت.
 */

export const SPACER_MIN = 0;
export const SPACER_MAX = 400;

export interface SpacerConfig {
  /** ارتفاع در دسکتاپ (≥ ۷۶۸px) بر حسب پیکسل */
  height: number;
  /** ارتفاع در موبایل بر حسب پیکسل — اگر null باشد از ارتفاع دسکتاپ استفاده می‌شود */
  heightMobile: number | null;
}

/**
 * پیش‌فرض عمداً `heightMobile: null` است تا با خروجی `normalizeSpacerConfig({})`
 * یکی باشد؛ یعنی ویجت تازه‌ساخته‌شده (config خالی)، حالت اولیه‌ی فرم ادمین و دکمه‌ی
 * «بازگرداندن به پیش‌فرض» هر سه دقیقاً یک رفتار داشته باشند.
 */
export const SPACER_DEFAULT: SpacerConfig = { height: 64, heightMobile: null };

function clampHeight(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(SPACER_MAX, Math.max(SPACER_MIN, Math.round(n)));
}

/** هر ورودی‌ای (از DB یا فرم ادمین) را به یک config معتبر تبدیل می‌کند */
export function normalizeSpacerConfig(raw: unknown): SpacerConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<SpacerConfig>;
  const height = clampHeight(c.height, SPACER_DEFAULT.height);
  const heightMobile =
    c.heightMobile === null || c.heightMobile === undefined
      ? null
      : clampHeight(c.heightMobile, height);
  return { height, heightMobile };
}

export default function SpacerSection({ config }: { config?: Record<string, any> }) {
  const { height, heightMobile } = normalizeSpacerConfig(config);

  return (
    <div
      className="widget-spacer"
      aria-hidden="true"
      style={
        {
          "--spacer-h": `${height}px`,
          "--spacer-h-mobile": `${heightMobile ?? height}px`,
        } as React.CSSProperties
      }
    />
  );
}
