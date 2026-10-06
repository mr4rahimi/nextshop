"use client";

/**
 * کاراکترشمار — کلمه، کاراکتر، جمله، پاراگراف، زمان خواندن و نوشتن، تعداد
 * پیامک، جا شدن در عنوان سئو و کپشن، و کلمات پرتکرار.
 *
 * همه در مرورگر حساب می‌شود و متن به سرور نمی‌رود. پیش‌نویس فقط در همین
 * مرورگر می‌ماند تا با رفرش گم نشود.
 *
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Copy, Eraser, Sparkles, Undo2 } from "lucide-react";
import {
  LENGTH_LIMITS, READ_WPM, SPEAK_WPM, TYPE_WPM,
  cleanupText, formatDuration, textStats, topWords,
} from "@/lib/tools/text-stats";
import { Card, PageHeader, SectionTitle, btn } from "../accounting/ui";

const DRAFT_KEY = "tools.textCounter.draft";
/** جمله‌ی بلندتر از این سخت خوانده می‌شود */
const LONG_SENTENCE = 25;

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function TextCounterClient() {
  const [text, setText] = useState("");
  const [undo, setUndo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // متن بلند (چند ده هزار کلمه) تایپ را کند نکند
  const deferred = useDeferredValue(text);
  const s = useMemo(() => textStats(deferred), [deferred]);
  const top = useMemo(() => topWords(deferred), [deferred]);

  useEffect(() => {
    try {
      setText(localStorage.getItem(DRAFT_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (text) localStorage.setItem(DRAFT_KEY, text);
        else localStorage.removeItem(DRAFT_KEY);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [text]);

  const replace = (next: string) => {
    if (next === text) return;
    setUndo(text);
    setText(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const main = [
    { label: "کلمه", value: fa(s.words) },
    { label: "کاراکتر", value: fa(s.chars), sub: `${fa(s.charsNoSpace)} بدون فاصله` },
    { label: "جمله", value: fa(s.sentences) },
    { label: "پاراگراف", value: fa(s.paragraphs) },
    { label: "زمان خواندن", value: formatDuration(s.readSec), sub: `${fa(READ_WPM)} کلمه در دقیقه` },
    { label: "زمان نوشتن", value: formatDuration(s.typeSec), sub: `${fa(TYPE_WPM)} کلمه در دقیقه` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="کاراکترشمار"
        help="toolsText"
        desc="متن را بنویسید یا بچسبانید؛ همان لحظه شمرده می‌شود. متن از مرورگر شما بیرون نمی‌رود."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-3 sm:p-4">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setUndo(null);
            }}
            dir="auto"
            autoFocus
            placeholder="متن خود را اینجا بنویسید یا بچسبانید…"
            className="min-h-[320px] w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm leading-7 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:bg-white lg:min-h-[480px] dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btn.small} disabled={!text} onClick={() => replace(cleanupText(text))}
              title="ي و ك عربی، فاصله‌های اضافه، فاصله پیش از ویرگول و نقطه، خط‌های خالی پشت‌سرهم">
              <Sparkles className="h-3.5 w-3.5" /> یکدست‌سازی متن
            </button>
            <button type="button" className={btn.small} disabled={!text} onClick={copy}>
              <Copy className="h-3.5 w-3.5" /> {copied ? "کپی شد" : "کپی"}
            </button>
            <button type="button" className={btn.small} disabled={!text} onClick={() => replace("")}>
              <Eraser className="h-3.5 w-3.5" /> پاک کردن
            </button>
            {undo !== null && (
              <button type="button" className={btn.small} onClick={() => { setText(undo); setUndo(null); }}>
                <Undo2 className="h-3.5 w-3.5" /> برگرداندن
              </button>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {main.map((m) => (
              <Card key={m.label} className="p-3">
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{m.label}</div>
                <div className="mt-1 text-lg font-black tabular-nums text-gray-900 dark:text-white">{m.value}</div>
                {m.sub && <div className="mt-0.5 text-[10.5px] text-gray-400">{m.sub}</div>}
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <SectionTitle title="جزئیات" />
            <dl className="space-y-2 text-xs">
              <Row label="زمان خواندن با صدای بلند" value={formatDuration(s.speakSec)} hint={`${fa(SPEAK_WPM)} کلمه در دقیقه`} />
              <Row label="میانگین طول جمله" value={`${fa(s.avgSentence)} کلمه`} />
              <Row
                label="بلندترین جمله"
                value={`${fa(s.longestSentence)} کلمه`}
                warn={s.longestSentence > LONG_SENTENCE ? "بلند است؛ بهتر است بشکنید" : undefined}
              />
              <Row
                label={s.sms.unicode ? "پیامک (فارسی)" : "پیامک (لاتین)"}
                value={s.sms.parts ? `${fa(s.sms.parts)} پیامک` : "—"}
                hint={s.sms.parts ? `${fa(s.sms.left)} کاراکتر تا پیامک بعدی` : `هر پیامک ${fa(s.sms.perPart)} کاراکتر`}
              />
            </dl>
          </Card>

          <Card className="p-4">
            <SectionTitle title="جا می‌شود؟" />
            <div className="space-y-3">
              {LENGTH_LIMITS.map((l) => {
                const over = s.chars > l.max;
                const short = s.chars > 0 && s.chars < l.min;
                const pct = Math.min(100, (s.chars / l.max) * 100);
                return (
                  <div key={l.key}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="font-bold text-gray-700 dark:text-gray-200">{l.label}</span>
                      <span className={`tabular-nums ${over ? "text-red-600" : short ? "text-amber-600" : "text-gray-500"}`}>
                        {fa(s.chars)} / {l.min ? `${fa(l.min)}–${fa(l.max)}` : fa(l.max)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${over ? "bg-red-500" : short ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle title="کلمات پرتکرار" />
            {top.length === 0 ? (
              <p className="text-xs text-gray-400">هنوز کلمه‌ای بیش از یک بار تکرار نشده.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {top.map((w) => (
                  <li key={w.word} className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-gray-800 dark:text-gray-100" dir="auto">{w.word}</span>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      {fa(w.count)} بار · {w.density.toLocaleString("fa-IR")}٪
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10.5px] leading-5 text-gray-400">
              حروف ربط مثل «و، در، از، که» شمرده نمی‌شوند. برای سئو، تکرار کلمه‌ی کلیدی بیش از ۳٪ زیاد است.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">
        {label}
        {hint && <span className="block text-[10.5px] text-gray-400">{hint}</span>}
        {warn && <span className="block text-[10.5px] text-amber-600">{warn}</span>}
      </dt>
      <dd className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
