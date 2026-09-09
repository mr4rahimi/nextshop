"use client";

/**
 * صفحه‌ی تماس‌ها.
 *
 * ⚠️ تماس **موجودیت جدا نیست**؛ یک `StaffTask` با کانال `CALL_IN` یا
 * `CALL_OUT` است. این صفحه همان فهرست کارهاست با فیلترِ از پیش‌بسته روی این
 * دو کانال.
 *
 * دلیلش مهم است: در برتر تماس و کار دو دنیای جدا بودند و هر گزارشی باید هر
 * دو را می‌دید. اینجا از اول یکی‌اند و تفاوت فقط در فیلتر است.
 *
 * وقتی وویپ آمد، تماس ورودی به‌جای ثبت دستی یک `StaffTask` با
 * `source = SYSTEM` می‌سازد و **هیچ تغییری در این صفحه لازم نیست**.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QuickTaskForm from "./QuickTaskForm";
import TaskCard from "./TaskCard";
import NotesPanel from "./NotesPanel";
import ReferDialog from "./ReferDialog";
import HelpButton from "./HelpButton";
import type { TaskItem } from "./types";

const TABS = [
  { key: "unlogged", label: "ثبت‌نشده" },
  { key: "today", label: "امروز" },
  { key: "referred", label: "ارجاع به من" },
  { key: "open", label: "در انتظار پیگیری" },
  { key: "done", label: "انجام‌شده" },
  { key: "all", label: "همه" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CHANNELS = [
  { key: "", label: "ورودی و خروجی" },
  { key: "CALL_IN", label: "فقط ورودی" },
  { key: "CALL_OUT", label: "فقط خروجی" },
] as const;

export default function CallsClient() {
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t.key === searchParams.get("tab"))?.key;

  const [tab, setTab] = useState<TabKey>(initialTab ?? "today");
  const [channel, setChannel] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [onlyMine, setOnlyMine] = useState(true);

  const [items, setItems] = useState<TaskItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [canViewAll, setCanViewAll] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [notesTask, setNotesTask] = useState<TaskItem | null>(null);
  const [referTask, setReferTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  const buildParams = useCallback(
    (next?: string | null) => {
      const p = new URLSearchParams({ tab });
      // بدون انتخاب کانال، هر دو نوع تماس. مسیر یک `channel` می‌گیرد، پس
      // حالت «هر دو» را با نبودِ پارامتر و فیلتر سمت کلاینت پوشش می‌دهیم.
      if (channel) p.set("channel", channel);
      if (onlyMine) p.set("ownerId", "me");
      if (debounced) p.set("q", debounced);
      if (next) p.set("cursor", next);
      return p;
    },
    [tab, channel, onlyMine, debounced],
  );

  const paramsKey = buildParams().toString();
  const loading = loadedKey !== paramsKey;

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

  function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    fetch(`/api/admin/worklist/tasks?${buildParams(cursor)}`)
      .then((r) => r.json())
      .then((d) => {
        setItems((prev) => [...prev, ...(d.items ?? [])]);
        setCursor(d.nextCursor ?? null);
      })
      .finally(() => setLoadingMore(false));
  }

  const refreshTask = useCallback((taskId: string) => {
    fetch(`/api/admin/worklist/tasks/${taskId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.task) return;
        setItems((prev) => prev.map((t) => (t.id === taskId ? d.task : t)));
        setNotesTask((cur) => (cur?.id === taskId ? d.task : cur));
      })
      .catch(() => {});
  }, []);

  // فقط تماس‌ها؛ وقتی کانال انتخاب نشده، سمت کلاینت به دو کانال تماس محدود می‌شود
  const calls = items.filter(
    (t) => t.channel === "CALL_IN" || t.channel === "CALL_OUT",
  );

  return (
    <div className="space-y-5">
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
            placeholder="نام یا شماره"
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent focus:border-blue-400 text-xs text-gray-900 dark:text-white outline-none w-full sm:w-44"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent focus:border-blue-400 text-xs text-gray-900 dark:text-white outline-none"
          >
            {CHANNELS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canViewAll && (
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-500"
          />
          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
            فقط تماس‌های من
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-xs text-gray-500 py-10">در حال بارگذاری...</p>
      ) : calls.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            تماسی در این نما نیست
          </p>
          <p className="text-xs text-gray-400 mt-1">
            با دکمه‌ی «ثبت تماس» موردی وارد کنید یا فیلترها را عوض کنید.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {calls.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              showOwner={!onlyMine}
              onChanged={(u) => setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onOpenNotes={setNotesTask}
              onOpenRefer={setReferTask}
            />
          ))}
        </div>
      )}

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-gray-700 dark:text-gray-300 transition"
        >
          {loadingMore ? "در حال بارگذاری..." : "بارگذاری بیشتر"}
        </button>
      )}

      <button
        onClick={() => setFormOpen(true)}
        className="fixed bottom-6 left-6 z-40 h-14 px-5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-xl shadow-blue-500/30 transition flex items-center gap-2"
      >
        <span className="text-lg leading-none">+</span>
        ثبت تماس
      </button>

      <div className="pt-2">
        <HelpButton topic="calls" />
      </div>

      {/* همان فرم، ولی فقط نوع‌کارهای تماس — کارمند فهرست نامربوط نمی‌بیند */}
      <QuickTaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(t) => setItems((prev) => [t, ...prev])}
        onlyChannels={["CALL_IN", "CALL_OUT"]}
        title="ثبت تماس"
        helpTopic="calls"
      />
      <NotesPanel
        task={notesTask}
        onClose={() => setNotesTask(null)}
        onNoteAdded={refreshTask}
      />
      <ReferDialog
        task={referTask}
        onClose={() => setReferTask(null)}
        onReferred={refreshTask}
      />
    </div>
  );
}
