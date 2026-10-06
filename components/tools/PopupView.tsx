"use client";

/**
 * نمای پاپ‌آپ — هم در سایت (`PopupHost`) و هم پیش‌نمایش پنل.
 * docs/features/tools.md بخش ۹
 *
 * AUTO: در موبایل کارت پایین صفحه (بالای نوار پایین)، در دسکتاپ پنجره‌ی وسط.
 * پاپ‌آپ تمام‌صفحه‌ی فوری در موبایل را گوگل «مزاحم» می‌داند؛ پیش‌فرض‌ها از آن دورند.
 * z-index بالاتر از دکمه‌ی چت هوشمند (`AiChat`، ۹۹۹۹) تا دکمه‌ی پاپ‌آپ زیرش نماند.
 */

import { useEffect, useRef, useState } from "react";
import type { PopupContent, PopupKind, PopupPosition } from "@/lib/tools/popup-rules";

export interface LeadResult {
  ok: boolean;
  couponCode?: string | null;
  successText?: string;
  error?: string;
}

interface Props {
  kind: PopupKind;
  content: PopupContent;
  accent: string;
  position: PopupPosition;
  isMobile: boolean;
  /** پیش‌نمایش: داخل قاب پنل، نه fixed روی صفحه */
  preview?: boolean;
  onClose: () => void;
  onButton?: () => void;
  onLead?: (phone: string, consent: boolean, trap: string) => Promise<LeadResult>;
}

export default function PopupView({ kind, content, accent, position, isMobile, preview, onClose, onButton, onLead }: Props) {
  const bottom = position === "BOTTOM" || (position === "AUTO" && isMobile);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeadResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (preview) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!onLead) return;
    setBusy(true);
    const r = await onLead(phone, consent, trap);
    setBusy(false);
    setResult(r);
  }

  const done = result?.ok;
  const card = (
    <div
      className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white text-gray-800 shadow-2xl dark:bg-[#141821] dark:text-gray-100"
      style={{ borderTop: `4px solid ${accent}` }}
      dir="rtl"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="بستن"
        className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-500 hover:bg-black/10 dark:bg-white/10 dark:text-gray-300"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {content.imageUrl && !bottom && (
        // eslint-disable-next-line @next/next/no-img-element -- عکس از کتابخانه‌ی رسانه
        <img src={content.imageUrl} alt="" className="max-h-56 w-full object-cover" />
      )}

      <div className={`space-y-3 p-5 ${bottom ? "pl-12" : "sm:p-6"}`}>
        <div className="flex items-start gap-3">
          {content.imageUrl && bottom && (
            // eslint-disable-next-line @next/next/no-img-element -- عکس از کتابخانه‌ی رسانه
            <img src={content.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          )}
          <div className="min-w-0 space-y-1.5">
            {content.heading && <p className="text-base font-black leading-7 sm:text-lg">{content.heading}</p>}
            {content.body && <p className="whitespace-pre-line text-sm leading-7 text-gray-600 dark:text-gray-300">{content.body}</p>}
          </div>
        </div>

        {kind === "ANNOUNCE" && content.buttonText && (
          <a
            href={content.buttonUrl || "#"}
            onClick={onButton}
            className="block w-full rounded-2xl py-3 text-center text-sm font-black text-white"
            style={{ background: accent }}
          >
            {content.buttonText}
          </a>
        )}

        {kind === "LEAD" && !done && (
          <form onSubmit={submit} className="space-y-2.5">
            <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              required
              placeholder="09121234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-base outline-none focus:border-gray-400 dark:border-white/10 dark:bg-white/5"
            />
            {content.consentText && (
              <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" style={{ accentColor: accent }} />
                {content.consentText}
              </label>
            )}
            <button type="submit" disabled={busy} className="w-full rounded-2xl py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: accent }}>
              {busy ? "…" : content.buttonText || "ثبت"}
            </button>
            {result && !result.ok && <p className="text-center text-xs font-bold text-red-500">{result.error}</p>}
          </form>
        )}

        {kind === "LEAD" && done && (
          <div className="space-y-2.5 text-center">
            <p className="text-sm font-bold leading-7 text-emerald-600 dark:text-emerald-400">{result?.successText || "ثبت شد، ممنون!"}</p>
            {result?.couponCode && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-dashed px-4 py-2.5" style={{ borderColor: accent }}>
                <span className="text-lg font-black tracking-widest" dir="ltr">{result.couponCode}</span>
                <button
                  type="button"
                  className="text-xs font-bold"
                  style={{ color: accent }}
                  onClick={() => { navigator.clipboard?.writeText(result.couponCode!); setCopied(true); }}
                >
                  {copied ? "کپی شد ✓" : "کپی کد"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (preview) return card;

  if (bottom) {
    return (
      <div className="fixed inset-x-0 bottom-24 z-[10000] flex justify-center px-3 md:bottom-6 animate-[popupUp_.3s_ease-out]" role="dialog" aria-label={content.heading || "پیام"}>
        <style>{"@keyframes popupUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}"}</style>
        {card}
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={content.heading || "پیام"} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {card}
    </div>
  );
}
