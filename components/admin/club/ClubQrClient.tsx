"use client";

import { useState } from "react";

/**
 * نمایش و چاپ QR عضویت
 *
 * چاپ با `window.print()` روی یک ظرف مخصوص انجام می‌شود؛ منوی ادمین و بقیه‌ی
 * صفحه با `print:hidden` کنار می‌روند تا خروجی، خودِ استند باشد.
 */
export default function ClubQrClient({
  url,
  svg,
  enabled,
  title,
}: {
  url: string;
  svg: string;
  enabled: boolean;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="print:hidden">
        <h1 className="text-lg font-black text-gray-900 dark:text-white">QR عضویت باشگاه</h1>
        <p className="text-xs font-bold text-gray-400 mt-1 leading-relaxed">
          این کد را چاپ کنید و روی پیشخوان بگذارید. مشتری با اسکن، شماره‌اش را
          وارد می‌کند، کد پیامکی را تأیید می‌کند و عضو می‌شود.
        </p>
      </div>

      <details className="print:hidden rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4 group">
        <summary className="text-[11px] font-black text-gray-700 dark:text-gray-300 cursor-pointer list-none flex items-center justify-between">
          چطور بیشترین استفاده را ببرم؟
          <span className="text-[10px] font-bold text-gray-400 group-open:hidden">نمایش</span>
        </summary>
        <div className="mt-3 space-y-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
          <p>
            • این کد را چاپ کنید و روی <b>پیشخوان صندوق</b> بگذارید. بهترین لحظه
            برای عضو کردن مشتری، وقتی است که دارد پول می‌دهد.
          </p>
          <p>
            • در تنظیمات باشگاه برای «امتیاز عضویت» و «امتیاز رضایت» عدد بگذارید و
            روی استند بنویسید چه چیزی گیرش می‌آید. عضویت بدون پاداش، عضویت
            نمی‌آورد.
          </p>
          <p>
            • هرکس از این QR عضو شود به‌عنوان <b>«حضوری»</b> ثبت می‌شود، پس در
            گزارش‌ها می‌بینید چند نفر از فروشگاه آمده‌اند و چند نفر از سایت.
          </p>
          <p>
            • برای اعضای <b>قدیمی</b> که شماره‌شان را دارید ولی رضایت نداده‌اند،
            راه سریع‌تر این است: یک پیامک خدماتی بفرستید با متن «برای دریافت
            تخفیف‌ها عدد ۱ را بفرستید». پاسخشان خودکار به رضایت تبدیل می‌شود.
          </p>
        </div>
      </details>

      {!enabled && (
        <div className="print:hidden rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-xs font-black text-amber-600 dark:text-amber-400">
            باشگاه مشتریان خاموش است — صفحه‌ی عضویت به مشتری پیام «فعال نیست»
            نشان می‌دهد. اول آن را از تنظیمات باشگاه روشن کنید.
          </p>
        </div>
      )}

      {/* استند قابل چاپ */}
      <div className="bg-white rounded-3xl border border-gray-200 dark:border-gray-700 p-8 max-w-sm mx-auto text-center space-y-5 print:border-0 print:max-w-full">
        <h2 className="text-xl font-black text-gray-900">{title}</h2>
        <p className="text-sm font-bold text-gray-600 leading-relaxed">
          اسکن کنید، عضو شوید
          <span className="block text-xs font-medium text-gray-400 mt-1">
            از تخفیف‌ها و جشنواره‌ها باخبر شوید
          </span>
        </p>

        <div
          className="mx-auto w-56 h-56 [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="text-[10px] font-bold text-gray-400 break-all" dir="ltr">
          {url}
        </p>
      </div>

      <div className="print:hidden flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black"
        >
          چاپ
        </button>
        <button
          onClick={copy}
          className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-black"
        >
          {copied ? "کپی شد" : "کپی لینک"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-black"
        >
          باز کردن صفحه
        </a>
      </div>
    </div>
  );
}
