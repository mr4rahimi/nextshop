"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  announcementKey,
  ANNOUNCEMENT_OFF_CLASS,
  ANNOUNCEMENT_STORAGE_KEY,
  type AnnouncementBarConfig,
} from "@/lib/announcementBar";

/**
 * نوار اعلان باریک بالای همه‌ی صفحات — بالاتر از لوگو و ردیف اول هدر.
 *
 * کاربر می‌تواند با ضربدر آن را ببندد؛ انتخابش در localStorage می‌ماند و تا وقتی
 * ادمین متن اعلان را عوض نکند دیگر به او نشان داده نمی‌شود.
 *
 * نکته‌ی مهم: مخفی‌کردنِ نوارِ بسته‌شده با یک اسکریپت inline و کلاس روی <html>
 * انجام می‌شود، نه با state — دقیقاً مثل dark mode. اگر منتظر hydration می‌ماندیم،
 * کاربری که نوار را بسته بود در هر بار لود یک فریم آن را می‌دید و کل صفحه
 * به‌اندازه‌ی ارتفاع نوار می‌پرید.
 */

const CSS = `
.ann-bar{
  background:var(--ann-bg);
  color:var(--ann-text);
  overflow:hidden;
  transition:height .28s cubic-bezier(.4,0,.2,1), opacity .2s ease;
}
html.${ANNOUNCEMENT_OFF_CLASS} .ann-bar{display:none}
.ann-bar-inner{
  position:relative;
  display:flex;align-items:center;justify-content:center;
  min-height:2.25rem;
  padding-block:.375rem;
  padding-inline:2.5rem;
  text-align:center;
}
.ann-bar-text{
  font-size:.75rem;line-height:1.5;font-weight:700;
  color:inherit;
}
@media (min-width:768px){ .ann-bar-text{font-size:.8125rem} }
a.ann-bar-text:hover{text-decoration:underline}
.ann-bar-x{
  position:absolute;inset-inline-end:.25rem;top:50%;transform:translateY(-50%);
  display:flex;align-items:center;justify-content:center;
  width:1.75rem;height:1.75rem;border-radius:.5rem;
  color:inherit;opacity:.7;
  transition:opacity .2s, background-color .2s;
}
.ann-bar-x:hover{opacity:1;background:rgba(255,255,255,.15)}
@media (prefers-reduced-motion:reduce){ .ann-bar{transition-duration:.01ms} }
`;

export default function AnnouncementBar({ config }: { config: AnnouncementBarConfig }) {
  const barRef = useRef<HTMLDivElement>(null);
  const key = announcementKey(config);

  // قبل از اولین رنگ‌آمیزی اجرا می‌شود؛ فقط کلاس روی <html> می‌گذارد و به DOMِ React دست نمی‌زند
  const script =
    `(function(){try{if(localStorage.getItem(${JSON.stringify(ANNOUNCEMENT_STORAGE_KEY)})===${JSON.stringify(key)})` +
    `document.documentElement.classList.add(${JSON.stringify(ANNOUNCEMENT_OFF_CLASS)})}catch(e){}})()`;

  function dismiss() {
    try {
      localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, key);
    } catch {}

    const el = barRef.current;
    if (!el) {
      document.documentElement.classList.add(ANNOUNCEMENT_OFF_CLASS);
      return;
    }
    // جمع‌شدن نرم به‌جای ناپدید شدن ناگهانی
    el.style.height = `${el.offsetHeight}px`;
    void el.offsetHeight; // reflow تا مرورگر ارتفاع شروع را ثبت کند
    el.style.height = "0px";
    el.style.opacity = "0";
    window.setTimeout(() => document.documentElement.classList.add(ANNOUNCEMENT_OFF_CLASS), 300);
  }

  const text = <span className="ann-bar-text">{config.text}</span>;

  return (
    <div
      ref={barRef}
      className="ann-bar"
      role="region"
      aria-label="اعلان سایت"
      style={{ "--ann-bg": config.bgColor, "--ann-text": config.textColor } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />

      <div className="container">
        <div className="ann-bar-inner">
          {config.linkUrl ? (
            <Link href={config.linkUrl} className="ann-bar-text">
              {config.text}
            </Link>
          ) : (
            text
          )}

          {config.dismissible && (
            <button type="button" onClick={dismiss} className="ann-bar-x" aria-label="بستن اعلان">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
