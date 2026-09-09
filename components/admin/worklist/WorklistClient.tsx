"use client";

/**
 * فهرست کارها با تب، فیلتر و صفحه‌بندی cursor.
 *
 * هر دو صفحه از همین کامپوننت استفاده می‌کنند و تفاوتشان فقط در `scope` است:
 *  - «کارهای من» صفحه‌ی شخصی است و همیشه کار خودِ کاربر را نشان می‌دهد
 *  - «همه‌ی کارها» با `WORK_VIEW_ALL` کار همه را نشان می‌دهد
 *
 * ⚠️ تبِ ناشناخته سمت سرور به «امروز» برمی‌گردد. افزودن تب تازه در دو جا
 * لازم است: `TABS` این فایل و `TABS` مسیر `api/admin/worklist/tasks`.
 */

import { useCallback, useEffect, useState } from "react";
import QuickTaskForm from "./QuickTaskForm";
import TaskCard from "./TaskCard";
import NotesPanel from "./NotesPanel";
import { DOMAIN_LABELS } from "@/lib/worklist/types";
import type { StaffDomain } from "@/lib/worklist/types";
import type { TaskItem, WorklistCounts } from "./types";

const TABS = [
  { key: "today", label: "امروز" },
  { key: "overdue", label: "عقب‌افتاده" },
  { key: "upcoming", label: "پیش رو" },
  { key: "unlogged", label: "بدون نتیجه" },
  { key: "open", label: "باز" },
  { key: "done", label: "انجام‌شده" },
  { key: "all", label: "همه" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const DOMAINS: StaffDomain[] = [
  "SALES", "FINANCE", "PROCUREMENT", "FULFILLMENT",
  "CATALOG", "CONTENT", "SUPPORT", "INTERNAL",
];

interface Props {
  /** `me` صفحه‌ی شخصی، `all` فهرست تیم */
  scope: "me" | "all";
}

export default function WorklistClient({ scope }: Props) {
  const [tab, setTab] = useState<TabKey>(scope === "all" ? "open" : "today");
  const [domain, setDomain] = useState<StaffDomain | "">("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [items, setItems] = useState<TaskItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** آخرین کلید پارامتری که پاسخش نشست — «در حال بارگذاری» از همین مشتق می‌شود */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const [counts, setCounts] = useState<WorklistCounts | null>(null);
  const [canViewAll, setCanViewAll] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [notesTask, setNotesTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  const buildParams = useCallback(
    (nextCursor?: string | null) => {
      const p = new URLSearchParams({ tab });
      if (scope === "me") p.set("ownerId", "me");
      if (domain) p.set("domain", domain);
      if (debouncedQuery) p.set("q", debouncedQuery);
      if (nextCursor) p.set("cursor", nextCursor);
      return p;
    },
    [tab, scope, domain, debouncedQuery],
  );

  const paramsKey = buildParams().toString();
  const loading = loadedKey !== paramsKey;

  // پرچم `ignore` جلوی مسابقه را می‌گیرد: با تعویض سریع تب، پاسخ درخواست
  // قدیمی ممکن است بعد از تازه‌ترین برسد و فهرست غلط بنشیند.
  useEffect(() => {
    let ignore = false;
    fetch(`/api/admin/worklist/tasks?${paramsKey}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        return d;
      })
      .then((d) => {
        if (ignore) return;
        setItems(d.items ?? []);
        setCursor(d.nextCursor ?? null);
        setHasMore(!!d.nextCursor);
        setCanViewAll(!!d.canViewAll);
        setError(null);
        setLoadedKey(paramsKey);
      })
      .catch((e) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود");
        setLoadedKey(paramsKey);
      });
    return () => { ignore = true; };
  }, [paramsKey]);

  const loadCounts = useCallback(() => {
    fetch(`/api/admin/worklist/summary?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCounts(d.counts))
      .catch(() => {});
  }, [scope]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    fetch(`/api/admin/worklist/tasks?${buildParams(cursor)}`)
      .then((r) => r.json())
      .then((d) => {
        setItems((prev) => [...prev, ...(d.items ?? [])]);
        setCursor(d.nextCursor ?? null);
        setHasMore(!!d.nextCursor);
      })
      .finally(() => setLoadingMore(false));
  }

  /** کارِ به‌روزشده را جایگزین می‌کند و اگر دیگر به تب نمی‌خورد حذفش می‌کند */
  function onTaskChanged(updated: TaskItem) {
    setItems((prev) => {
      const next = prev.map((t) => (t.id === updated.id ? updated : t));
      const closed = updated.status === "DONE" || updated.status === "CANCELED";
      const dropFromOpenTab =
        closed && ["today", "overdue", "upcoming", "open", "unlogged"].includes(tab);
      return dropFromOpenTab ? next.filter((t) => t.id !== updated.id) : next;
    });
    loadCounts();
  }

  function onCreated(task: TaskItem) {
    // کارِ تازه فقط وقتی بالای فهرست می‌نشیند که به تب جاری بخورد
    const closed = task.status === "DONE";
    const belongs = tab === "all" || (closed ? tab === "done" : tab !== "done");
    if (belongs) setItems((prev) => [task, ...prev]);
    loadCounts();
  }

  function onNoteAdded(taskId: string) {
    // یادداشت کارِ باز را IN_PROGRESS می‌کند؛ از سرور تازه‌اش را می‌گیریم
    fetch(`/api/admin/worklist/tasks/${taskId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.task) return;
        setItems((prev) => prev.map((t) => (t.id === taskId ? d.task : t)));
        setNotesTask((cur) => (cur?.id === taskId ? d.task : cur));
      })
      .catch(() => {});
  }

  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <div className="space-y-5">
      {/* شمارنده‌ها */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "امروز", value: counts.today, tab: "today" as TabKey, tone: "text-blue-600 dark:text-blue-400" },
            { label: "عقب‌افتاده", value: counts.overdue, tab: "overdue" as TabKey, tone: "text-red-600 dark:text-red-400" },
            { label: "پیش رو", value: counts.upcoming, tab: "upcoming" as TabKey, tone: "text-gray-600 dark:text-gray-400" },
            { label: "بدون نتیجه", value: counts.unlogged, tab: "unlogged" as TabKey, tone: "text-amber-600 dark:text-amber-400" },
            { label: "امروز بسته شد", value: counts.doneToday, tab: "done" as TabKey, tone: "text-emerald-600 dark:text-emerald-400" },
          ].map((c) => (
            <button
              key={c.label}
              onClick={() => setTab(c.tab)}
              className={`rounded-2xl border p-3 text-right transition ${
                tab === c.tab
                  ? "border-blue-400 dark:border-blue-500/50 bg-blue-50/50 dark:bg-blue-500/5"
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/20"
              }`}
            >
              <p className={`text-xl font-black ${c.tone}`}>{fa(c.value)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{c.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* تب و جستجو */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                tab === t.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در عنوان، نام، شماره"
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent focus:border-blue-400 text-xs text-gray-900 dark:text-white outline-none w-full sm:w-56"
          />
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as StaffDomain | "")}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent focus:border-blue-400 text-xs text-gray-900 dark:text-white outline-none"
          >
            <option value="">همه دامنه‌ها</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {scope === "all" && !canViewAll && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-400">
          دسترسی دیدن کار همه را ندارید، پس فقط کارهای خودتان نشان داده می‌شود.
        </div>
      )}

      {/* فهرست */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-xs text-gray-500 py-10">در حال بارگذاری...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            کاری در این نما نیست
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {tab === "today"
              ? "امروز کاری برایتان ثبت نشده است"
              : "فیلترها را عوض کنید یا کار تازه‌ای ثبت کنید"}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              showOwner={scope === "all"}
              onChanged={onTaskChanged}
              onOpenNotes={setNotesTask}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-gray-700 dark:text-gray-300 transition"
        >
          {loadingMore ? "در حال بارگذاری..." : "بارگذاری بیشتر"}
        </button>
      )}

      {/* دکمه‌ی ثبت */}
      <button
        onClick={() => setFormOpen(true)}
        className="fixed bottom-6 left-6 z-40 h-14 px-5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-xl shadow-blue-500/30 transition flex items-center gap-2"
      >
        <span className="text-lg leading-none">+</span>
        ثبت کار
      </button>

      <QuickTaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={onCreated}
      />
      <NotesPanel
        task={notesTask}
        onClose={() => setNotesTask(null)}
        onNoteAdded={onNoteAdded}
      />
    </div>
  );
}
