"use client";

/**
 * شمارنده‌ی کوچک زیر فیلدهای متنی — کاراکتر، کلمه و برای پیامک تعداد پیامک؛
 * رنگش با بازه‌ی مناسب همان قالب (عنوان سئو ۳۰ تا ۶۰، متا ۱۲۰ تا ۱۶۰) عوض
 * می‌شود. «بررسی کامل» متن را در کاراکترشمار باز می‌کند.
 * docs/features/tools.md بخش ۵
 */

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { smsInfo, splitWords } from "@/lib/tools/text-stats";
import type { ProfileKey } from "@/lib/tools/text-profiles";
import { openTextCounter } from "./text/handoff";

const fa = (n: number) => n.toLocaleString("fa-IR");

/** بازه‌ی کاراکتر هر قالب برای رنگ شمارنده */
const RANGE: Partial<Record<ProfileKey, [number, number, number]>> = {
  seoTitle: [30, 60, 70],
  metaDesc: [120, 160, 170],
  instagram: [0, 2200, 2200],
  telegram: [0, 4096, 4096],
};

export default function TextMeter({
  text, profile = "general", keyword, className = "",
}: { text: string; profile?: ProfileKey; keyword?: string; className?: string }) {
  const m = useMemo(() => {
    const chars = Array.from(text ?? "").length;
    return { chars, words: splitWords(text ?? "").length, sms: profile === "sms" ? smsInfo(text ?? "") : null };
  }, [text, profile]);

  const range = RANGE[profile];
  const tone = !range || !m.chars
    ? "text-gray-400"
    : m.chars > range[2] ? "text-rose-600"
    : m.chars > range[1] || m.chars < range[0] ? "text-amber-600"
    : "text-emerald-600";

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${className}`}>
      <span className={`font-bold tabular-nums ${tone}`}>
        {fa(m.chars)} کاراکتر{range && range[0] ? ` (${fa(range[0])}–${fa(range[1])})` : ""}
      </span>
      <span className="tabular-nums text-gray-400">{fa(m.words)} کلمه</span>
      {m.sms && (
        <span className={`font-bold tabular-nums ${m.sms.parts > 1 ? "text-amber-600" : "text-gray-500"}`}>
          {m.sms.parts ? `${fa(m.sms.parts)} پیامک ${m.sms.unicode ? "فارسی" : "لاتین"} · ${fa(m.sms.left)} کاراکتر تا بعدی` : "۰ پیامک"}
        </span>
      )}
      {!!m.chars && (
        <button
          type="button"
          onClick={() => openTextCounter({ text, profile, keyword })}
          className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
        >
          بررسی کامل <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
