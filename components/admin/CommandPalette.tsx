"use client";

/**
 * جستجوی سریع پنل (Ctrl+K) — رفتن به هر صفحه‌ی منو بدون گشتن در سایدبار.
 *
 * فهرست از همان درخت منو (`nav.tsx`) و همان فیلتر دسترسی سایدبار ساخته
 * می‌شود، پس صفحه‌ای که کاربر اجازه‌اش را ندارد اینجا هم نمی‌آید.
 *
 * مستندات: docs/features/admin-ui.md
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { Icon, MENU_GROUPS } from "./nav";
import { filterByAccess, normalize } from "./AdminSidebar";
import { useAdminMe } from "./useAdminMe";

interface Entry {
  href: string;
  label: string;
  /** مسیر منو: «فروشگاه › محصولات» */
  trail: string;
  icon?: string;
  target?: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const me = useAdminMe();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const access = me ? { isUnrestricted: me.isUnrestricted, permissions: me.permissions } : null;
    const out: Entry[] = [];
    const seen = new Set<string>();
    for (const g of filterByAccess(MENU_GROUPS, access)) {
      for (const item of g.items) {
        const push = (e: Entry) => {
          const key = e.href + e.label;
          if (seen.has(key)) return;
          seen.add(key);
          out.push(e);
        };
        if (!item.children?.length) push({ href: item.href, label: item.label, trail: g.label, icon: item.icon });
        for (const c of item.children ?? []) {
          push({ href: c.href, label: c.label, trail: `${g.label === item.label ? g.label : `${g.label} › ${item.label}`}`, icon: item.icon, target: c.target });
        }
      }
    }
    return out;
  }, [me]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return entries;
    const words = q.split(/\s+/);
    return entries.filter((e) => {
      const hay = normalize(`${e.label} ${e.trail}`);
      return words.every((w) => hay.includes(w));
    });
  }, [entries, query]);

  // پنجره‌ی تازه همیشه خالی و با فوکوس روی جستجو باز می‌شود
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بازنشانی هنگام باز شدن
    setQuery("");
    setCursor(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function go(e: Entry | undefined) {
    if (!e) return;
    onClose();
    if (e.target) window.open(e.href, "_blank");
    else router.push(e.href);
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      go(results[cursor]);
    } else if (ev.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="جستجوی سریع">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-pop-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--adm-border)] px-4">
          <Search className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="به کجا برویم؟ مثلاً «فاکتور» یا «پیامک»"
            aria-label="جستجوی صفحه"
            className="h-14 w-full bg-transparent text-[15px] font-bold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400 dark:text-white"
          />
          <kbd className="hidden flex-shrink-0 rounded-md border border-[var(--adm-border-strong)] px-1.5 py-0.5 font-sans text-[10px] font-bold text-gray-400 sm:block">
            Esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[min(60vh,26rem)] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-10 text-center text-sm font-bold text-gray-400">صفحه‌ای پیدا نشد</li>}
          {results.map((e, i) => (
            <li key={e.href + e.label} data-i={i} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseMove={() => setCursor(i)}
                onClick={() => go(e)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors ${
                  i === cursor ? "bg-[var(--adm-accent-soft)]" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] ${
                    i === cursor ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
                  }`}
                >
                  <Icon name={e.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-gray-900 dark:text-gray-100">{e.label}</span>
                  <span className="block truncate text-[11px] font-medium text-gray-400">{e.trail}</span>
                </span>
                {i === cursor && <CornerDownLeft className="h-4 w-4 flex-shrink-0 text-[var(--adm-accent)]" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 border-t border-[var(--adm-border)] px-4 py-2 text-[11px] font-bold text-gray-400 sm:flex">
          <span>↑ ↓ جابه‌جایی</span>
          <span>Enter باز کردن</span>
          <span className="mr-auto">Ctrl K</span>
        </div>
      </div>
    </div>
  );
}
