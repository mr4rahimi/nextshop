"use client";

/**
 * textarea متن ساده با دکمه‌ی «درج لینک» — توضیحات دسته، متن صفحه‌ی فرود
 * و متن کارشناسی محصول. لینک به شکل `[متن](آدرس)` در همان متن ذخیره
 * می‌شود و سایت آن را با LinkedText به لینک واقعی تبدیل می‌کند.
 * lib/text-links.ts
 */

import { useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { countTextLinks, safeHref } from "@/lib/text-links";

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}

/** آدرس کامل همین سایت نسبی ذخیره شود تا با عوض شدن دامنه نشکند */
function toStoredHref(raw: string): string {
  let href = raw.trim();
  if (!href) return "";
  if (/^www\./i.test(href)) href = `https://${href}`;
  try {
    const u = new URL(href);
    if (u.host.replace(/^www\./, "") === window.location.host.replace(/^www\./, "")) {
      return `${u.pathname}${u.search}${u.hash}` || "/";
    }
  } catch { /* مسیر نسبی */ }
  if (!/^(\/|https?:|tel:|mailto:)/i.test(href)) href = `/${href}`;
  return href;
}

export default function LinkTextarea({ value, onChange, rows = 3, placeholder, className = "" }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");

  const text = value ?? "";
  const links = countTextLinks(text);

  function openForm() {
    const el = ref.current;
    const s = el?.selectionStart ?? text.length;
    const e = el?.selectionEnd ?? text.length;
    setSel([s, e]);
    setLabel(text.slice(s, e).trim());
    setUrl("");
    setErr("");
    setOpen(true);
  }

  function insert() {
    const t = label.replace(/[[\]\n]/g, " ").trim();
    const href = toStoredHref(url);
    if (!t) return setErr("متن لینک را بنویسید.");
    if (!href || !safeHref(href) || /[\s)]/.test(href)) return setErr("آدرس معتبر نیست؛ مثل /collections/kharid-printer یا https://…");
    const md = `[${t}](${href})`;
    onChange(text.slice(0, sel[0]) + md + text.slice(sel[1]));
    setOpen(false);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(sel[0] + md.length, sel[0] + md.length);
    });
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500";

  return (
    <div>
      <textarea
        ref={ref}
        value={text}
        rows={rows}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={className}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
        <button type="button" onClick={openForm}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 px-2.5 py-1 font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10">
          <Link2 className="h-3.5 w-3.5" /> درج لینک
        </button>
        <span className="text-gray-400">
          {links ? `${links.toLocaleString("fa-IR")} لینک · ` : ""}
          اول کلمه را انتخاب کنید، بعد «درج لینک». شکل ذخیره: [متن](آدرس)
        </span>
      </div>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5 p-3"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insert(); } if (e.key === "Escape") setOpen(false); }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inp} placeholder="متن لینک (مثلاً خرید پرینتر سه کاره)" value={label}
              onChange={e => setLabel(e.target.value)} autoFocus={!label} />
            <input className={inp} dir="ltr" placeholder="/collections/kharid-printer-se-kare" value={url}
              onChange={e => setUrl(e.target.value)} autoFocus={!!label} />
          </div>
          <p className="text-[11px] text-gray-500">
            آدرس صفحه‌های همین سایت را می‌توانید کامل (https://…) یا از / به بعد بدهید؛ خودکار داخلی ذخیره می‌شود.
          </p>
          {err && <p className="text-[11px] font-bold text-rose-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={insert}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-black text-white hover:bg-blue-700">درج</button>
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">انصراف</button>
          </div>
        </div>
      )}
    </div>
  );
}
