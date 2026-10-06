"use client";

/**
 * نمای «علامت‌ها» — همان متن، با جمله‌های بلند، کلمه‌ی کلیدی و بخش‌های
 * تکراری رنگی. فقط‌خواندنی است؛ ویرایش در حالت «ویرایش» انجام می‌شود.
 */

import { memo, useMemo } from "react";

export type MarkKind = "long" | "keyword" | "dup" | "focus";

export interface Mark {
  start: number;
  end: number;
  kind: MarkKind;
}

const CLS: Record<MarkKind, string> = {
  long: "bg-amber-100/80 dark:bg-amber-400/15",
  keyword: "rounded bg-blue-200/80 px-0.5 font-bold text-blue-900 dark:bg-blue-500/30 dark:text-blue-100",
  dup: "underline decoration-rose-500 decoration-2 underline-offset-4 bg-rose-100/70 dark:bg-rose-500/20",
  focus: "outline outline-2 outline-violet-400 rounded",
};

function MarkedTextInner({ text, marks }: { text: string; marks: Mark[] }) {
  const parts = useMemo(() => {
    const cuts = new Set<number>([0, text.length]);
    for (const m of marks) {
      cuts.add(Math.max(0, Math.min(text.length, m.start)));
      cuts.add(Math.max(0, Math.min(text.length, m.end)));
    }
    const sorted = [...cuts].sort((a, b) => a - b);
    const out: { s: number; e: number; kinds: MarkKind[] }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i]!;
      const e = sorted[i + 1]!;
      if (s === e) continue;
      const kinds = [...new Set(marks.filter((m) => m.start <= s && m.end >= e).map((m) => m.kind))];
      out.push({ s, e, kinds });
    }
    return out;
  }, [text, marks]);

  return (
    <div dir="auto" className="whitespace-pre-wrap break-words text-sm leading-8 text-gray-900 dark:text-gray-100">
      {parts.map((p) =>
        p.kinds.length ? (
          <span key={p.s} data-mark={p.kinds.includes("focus") ? "focus" : undefined} className={p.kinds.map((k) => CLS[k]).join(" ")}>
            {text.slice(p.s, p.e)}
          </span>
        ) : (
          text.slice(p.s, p.e)
        ),
      )}
    </div>
  );
}

export const MarkedText = memo(MarkedTextInner);
