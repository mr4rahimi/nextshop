"use client";

/**
 * نمایش «قبل ← بعد» یک تغییر.
 *
 * برای تصویر، خودِ عکس قبلی و جدید کنار هم نشان داده می‌شود — همین بخش است
 * که به سؤال «عکس را عوض کردم، چه شد؟» جواب چشمی می‌دهد.
 */

const fa = (n: number) => n.toLocaleString("fa-IR");

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  kind?: "image" | "images" | "price" | "bool" | "text";
}

function Thumb({ url, tone }: { url: string | null; tone: "before" | "after" }) {
  const ring = tone === "before"
    ? "border-red-200 dark:border-red-900/50"
    : "border-emerald-200 dark:border-emerald-900/50";
  if (!url) {
    return (
      <div className={`w-14 h-14 rounded-xl border-2 border-dashed ${ring} flex items-center justify-center text-[10px] text-gray-400`}>
        ندارد
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={url}>
      <img src={url} alt="" loading="lazy"
        className={`w-14 h-14 rounded-xl object-cover border-2 ${ring} bg-gray-50 dark:bg-white/5`} />
    </a>
  );
}

function renderValue(v: unknown, kind?: FieldChange["kind"]) {
  if (v === null || v === undefined || v === "") return <span className="text-gray-400">—</span>;
  if (kind === "bool") return <span>{v ? "فعال" : "غیرفعال"}</span>;
  if (kind === "price") return <span className="tabular-nums">{fa(Number(v))} تومان</span>;
  const s = String(v);
  return <span className="break-all">{s.length > 160 ? s.slice(0, 160) + "…" : s}</span>;
}

export default function ChangeDetails({ changes }: { changes: FieldChange[] }) {
  if (!changes?.length) {
    return <p className="text-xs text-gray-400">جزئیاتی ثبت نشده است.</p>;
  }

  return (
    <div className="space-y-3">
      {changes.map((c, i) => {
        if (c.kind === "image") {
          return (
            <div key={i} className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{c.label}</span>
              <Thumb url={(c.before as string) || null} tone="before" />
              <svg className="w-4 h-4 text-gray-300 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <Thumb url={(c.after as string) || null} tone="after" />
            </div>
          );
        }

        if (c.kind === "images") {
          const before = Array.isArray(c.before) ? (c.before as string[]) : [];
          const after = Array.isArray(c.after) ? (c.after as string[]) : [];
          const removed = before.filter((u) => !after.includes(u));
          const added = after.filter((u) => !before.includes(u));
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{c.label}</span>
                <span className="text-[11px] text-gray-400">
                  {fa(before.length)} ← {fa(after.length)} تصویر
                </span>
              </div>
              {removed.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-red-500 w-16">حذف‌شده</span>
                  {removed.map((u) => <Thumb key={u} url={u} tone="before" />)}
                </div>
              )}
              {added.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-emerald-600 w-16">اضافه‌شده</span>
                  {added.map((u) => <Thumb key={u} url={u} tone="after" />)}
                </div>
              )}
              {removed.length === 0 && added.length === 0 && (
                <p className="text-[11px] text-gray-400">فقط ترتیب تصاویر عوض شده است.</p>
              )}
            </div>
          );
        }

        return (
          <div key={i} className="flex items-start gap-3 flex-wrap text-xs">
            <span className="font-bold text-gray-500 dark:text-gray-400 w-28 flex-shrink-0 pt-0.5">{c.label}</span>
            <span className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through max-w-[45%]">
              {renderValue(c.before, c.kind)}
            </span>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 max-w-[45%]">
              {renderValue(c.after, c.kind)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
