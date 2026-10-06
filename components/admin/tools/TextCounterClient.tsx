"use client";

/**
 * کاراکترشمار و ویرایشگر متن — شمارش، بررسی برای مقصد (مقاله، توضیح محصول،
 * عنوان و متای سئو، اینستاگرام، ایکس، تلگرام، پیامک)، استانداردسازی نگارش
 * فارسی، نمودار کلمات و ساختار، و درصد تکراری بودن در محتوای خود سایت.
 *
 * همه‌ی تحلیل در مرورگر است؛ فقط «تکراری بودن» متن را به سرور خود سایت
 * می‌فرستد. پیش‌نویس، قالب و کلمه‌ی کلیدی در همین مرورگر می‌مانند.
 * فرم‌های دیگر (پیامک، محصول) متن را با `openTextCounter` به این‌جا می‌دهند.
 *
 * مستندات: docs/features/tools.md بخش ۵
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChartBar, ClipboardPaste, Copy, Eraser, FileText, Heading1, Highlighter, Instagram, KeyRound,
  MessageSquareText, Newspaper, Package, PencilLine, Rows3, SearchCheck, Send, Twitter, Undo2,
  Wand2, FileSearch, type LucideIcon,
} from "lucide-react";
import { LONG_SENTENCE, formatDurationShort, keywordStats, textStats, tokenize } from "@/lib/tools/text-stats";
import { FIXES, fixAll, type FixKey } from "@/lib/tools/text-fix";
import { PROFILES, evaluateProfile, type ProfileKey } from "@/lib/tools/text-profiles";
import { MIN_WORDS, tokenRangesToChars, type DupResult } from "@/lib/tools/text-similarity";
import { Card, PageHeader, api, btn } from "../accounting/ui";
import { MarkedText, type Mark } from "./text/MarkedText";
import { DupPanel, FixPanel, ProfileCard, StatsPanel, StructurePanel, WordsPanel } from "./text/panels";
import { HANDOFF_KEY, type TextHandoff } from "./text/handoff";

const DRAFT_KEY = "tools.textCounter.draft";
const PREFS_KEY = "tools.textCounter.prefs";
const UNDO_LIMIT = 30;

const fa = (n: number) => n.toLocaleString("fa-IR");

const PROFILE_ICON: Record<ProfileKey, LucideIcon> = {
  general: FileText,
  article: Newspaper,
  product: Package,
  seoTitle: Heading1,
  metaDesc: FileSearch,
  instagram: Instagram,
  x: Twitter,
  telegram: Send,
  sms: MessageSquareText,
};

type Tab = "stats" | "fix" | "words" | "structure" | "dup";

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "stats", label: "آمار", icon: ChartBar },
  { key: "fix", label: "ویرایش و نگارش", icon: Wand2 },
  { key: "words", label: "کلمات و عبارت‌ها", icon: KeyRound },
  { key: "structure", label: "ساختار و خوانایی", icon: Rows3 },
  { key: "dup", label: "تکراری بودن", icon: SearchCheck },
];

function readStore<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    if (value == null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function TextCounterClient() {
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [profile, setProfile] = useState<ProfileKey>("general");
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<Tab>("stats");
  const [view, setView] = useState<"edit" | "marks">("edit");
  const [history, setHistory] = useState<{ text: string; label: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ start: number; end: number } | null>(null);
  const [dup, setDup] = useState<{ result: DupResult; forText: string } | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const loaded = useRef(false);
  const marksRef = useRef<HTMLDivElement>(null);

  const deferred = useDeferredValue(text);
  const deferredKw = useDeferredValue(keyword);
  const stats = useMemo(() => textStats(deferred), [deferred]);
  const kw = useMemo(() => (deferredKw.trim() ? keywordStats(deferred, deferredKw) : null), [deferred, deferredKw]);
  const result = useMemo(() => evaluateProfile(profile, deferred, stats, deferredKw), [profile, deferred, stats, deferredKw]);
  const fixCounts = useMemo(
    () => Object.fromEntries(FIXES.map((f) => [f.key, deferred ? f.run(deferred).count : 0])) as Record<FixKey, number>,
    [deferred],
  );
  const profileDef = PROFILES.find((p) => p.key === profile)!;
  const words = useMemo(() => tokenize(deferred).length, [deferred]);

  // بار اول: متن تحویلی از فرم دیگر، وگرنه پیش‌نویس؛ قالب از آدرس یا ترجیح قبلی
  const fromParam = params.get("from");
  const profileParam = params.get("profile");
  useEffect(() => {
    const prefs = readStore<{ profile?: ProfileKey; keyword?: string }>(PREFS_KEY);
    const handoff = fromParam === "handoff" ? readStore<TextHandoff>(HANDOFF_KEY) : null;
    if (handoff) writeStore(HANDOFF_KEY, null);
    const draft = readStore<string>(DRAFT_KEY);
    const p = (handoff?.profile ?? profileParam ?? prefs?.profile) as ProfileKey | undefined;
    setText(handoff?.text ?? draft ?? "");
    if (p && PROFILES.some((x) => x.key === p)) setProfile(p);
    setKeyword(handoff?.keyword ?? prefs?.keyword ?? "");
    loaded.current = true;
  }, [fromParam, profileParam]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => writeStore(DRAFT_KEY, text || null), 400);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (loaded.current) writeStore(PREFS_KEY, { profile, keyword });
  }, [profile, keyword]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /** تغییر برنامه‌ای متن — قابل برگرداندن */
  const textRef = useRef(text);
  textRef.current = text;
  const replace = useCallback((next: string, label: string) => {
    const prev = textRef.current;
    if (next === prev) return;
    setHistory((h) => [...h.slice(-(UNDO_LIMIT - 1)), { text: prev, label }]);
    setText(next);
  }, []);

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setText(last.text);
    setToast(`«${last.label}» برگردانده شد`);
  };

  const runFix = (k: FixKey) => {
    const f = FIXES.find((x) => x.key === k)!;
    const r = f.run(text);
    replace(r.text, f.label);
    setToast(`${f.label}: ${fa(r.count)} مورد`);
  };

  const runAll = () => {
    const r = fixAll(text);
    replace(r.text, "استانداردسازی");
    setToast(`استانداردسازی: ${fa(r.count)} مورد اصلاح شد`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("کپی شد");
    } catch {
      setToast("کپی ممکن نشد");
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) replace(t, "چسباندن");
    } catch {
      setToast("مرورگر اجازه‌ی خواندن کلیپ‌بورد را نداد؛ با Ctrl+V بچسبانید");
    }
  };

  const runDup = async () => {
    setDupLoading(true);
    setDupError(null);
    try {
      const r = await api<DupResult>("/api/admin/tools/text-check", { method: "POST", json: { text } });
      setDup({ result: r, forText: text });
    } catch (e) {
      setDupError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setDupLoading(false);
    }
  };

  const showSentence = (i: number) => {
    const s = stats.sentences[i];
    if (!s) return;
    setFocus({ start: s.start, end: s.end });
    setView("marks");
    requestAnimationFrame(() => marksRef.current?.querySelector("[data-mark=focus]")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  const marks = useMemo<Mark[]>(() => {
    if (view !== "marks") return [];
    const out: Mark[] = stats.sentences.filter((s) => s.words > LONG_SENTENCE).map((s) => ({ start: s.start, end: s.end, kind: "long" }));
    kw?.hits.forEach((h) => out.push({ ...h, kind: "keyword" }));
    if (dup && dup.forText === deferred)
      tokenRangesToChars(deferred, dup.result.ranges).forEach((r) => out.push({ ...r, kind: "dup" }));
    if (focus) out.push({ ...focus, kind: "focus" });
    return out;
  }, [view, stats, kw, dup, deferred, focus]);

  const empty = !text.trim();

  return (
    <div className="space-y-5">
      <PageHeader
        title="کاراکترشمار و ویرایشگر متن"
        help="toolsText"
        desc="شمارش، بررسی برای مقاله و سئو و شبکه‌های اجتماعی و پیامک، استانداردسازی نگارش فارسی و درصد تکراری بودن در سایت. متن جز برای بررسی تکراری بودن از مرورگر بیرون نمی‌رود."
      />

      {/* قالب و کلمه‌ی کلیدی */}
      <Card className="p-3 sm:p-4">
        <p className="mb-2 text-[11px] font-bold text-gray-500">این متن برای کجاست؟</p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {PROFILES.map((p) => {
            const Icon = PROFILE_ICON[p.key];
            const on = p.key === profile;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setProfile(p.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  on
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "border-[var(--adm-border)] bg-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="flex-1 text-xs text-gray-500">{profileDef.hint}</p>
          {(profileDef.keyword || keyword) && (
            <label className="flex w-full items-center gap-2 sm:w-72">
              <KeyRound className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="کلمه‌ی کلیدی، مثلاً گوشی سامسونگ"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none transition focus:border-blue-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ویرایشگر */}
        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--adm-border)] px-3 py-2.5">
            <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
              <ViewBtn on={view === "edit"} onClick={() => setView("edit")} icon={PencilLine}>ویرایش</ViewBtn>
              <ViewBtn on={view === "marks"} onClick={() => { setFocus(null); setView("marks"); }} icon={Highlighter}>علامت‌ها</ViewBtn>
            </div>
            <div className="flex-1" />
            <ToolBtn onClick={runAll} disabled={empty || !FIXES.some((f) => f.standard && fixCounts[f.key])} icon={Wand2} accent>
              استانداردسازی
            </ToolBtn>
            <ToolBtn onClick={undo} disabled={!history.length} icon={Undo2} title={history.length ? `برگرداندن «${history.at(-1)?.label}»` : undefined}>
              برگرداندن
            </ToolBtn>
            <ToolBtn onClick={paste} icon={ClipboardPaste}>چسباندن</ToolBtn>
            <ToolBtn onClick={copy} disabled={empty} icon={Copy}>کپی</ToolBtn>
            <ToolBtn onClick={() => replace("", "پاک کردن")} disabled={empty} icon={Eraser}>پاک</ToolBtn>
          </div>

          {view === "edit" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              dir="auto"
              autoFocus
              spellCheck={false}
              placeholder="متن را اینجا بنویسید یا بچسبانید…"
              className="min-h-[340px] w-full flex-1 resize-y bg-transparent p-4 text-sm leading-8 text-gray-900 outline-none placeholder:text-gray-400 lg:min-h-[460px] dark:text-gray-100"
            />
          ) : (
            <div ref={marksRef} className="max-h-[560px] min-h-[340px] flex-1 overflow-y-auto p-4 lg:min-h-[460px]">
              {empty ? (
                <p className="text-sm text-gray-400">متنی نیست.</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
                    <Legend cls="bg-amber-200 dark:bg-amber-400/40">جمله‌ی بلند</Legend>
                    {kw && <Legend cls="bg-blue-300 dark:bg-blue-500/60">کلمه‌ی کلیدی</Legend>}
                    {dup && dup.forText === deferred && dup.result.percent > 0 && <Legend cls="bg-rose-400">تکراری در سایت</Legend>}
                  </div>
                  <MarkedText text={deferred} marks={marks} />
                </>
              )}
            </div>
          )}

          {/* نوار وضعیت */}
          <div className="grid grid-cols-3 gap-px border-t border-[var(--adm-border)] bg-[var(--adm-border)] text-center sm:grid-cols-6">
            {[
              ["کلمه", fa(stats.words)],
              ["کاراکتر", fa(stats.chars)],
              ["جمله", fa(stats.sentences.length)],
              ["پاراگراف", fa(stats.paragraphs.length)],
              ["خواندن", formatDurationShort(stats.readSec)],
              ["نوشتن", formatDurationShort(stats.typeSec)],
            ].map(([k, v]) => (
              <div key={k} className="bg-[var(--adm-surface)] px-2 py-2.5">
                <p className="text-[10.5px] font-bold text-gray-400">{k}</p>
                <p className="mt-0.5 truncate text-sm font-black tabular-nums text-gray-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <ProfileCard label={profileDef.label} result={result} empty={empty} />
        </div>
      </div>

      {/* زبانه‌ها */}
      <div>
        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-[var(--adm-border)] px-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const badge = t.key === "fix" ? FIXES.filter((f) => f.standard).reduce((n, f) => n + fixCounts[f.key], 0) : 0;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition ${
                  tab === t.key ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {!!badge && <span className="rounded-md bg-amber-500/15 px-1.5 text-[10px] text-amber-600">{fa(badge)}</span>}
                {t.key === "dup" && dup && <span className="rounded-md bg-gray-500/10 px-1.5 text-[10px] text-gray-500">{fa(dup.result.percent)}٪</span>}
              </button>
            );
          })}
        </div>

        {tab === "stats" && <StatsPanel s={stats} />}
        {tab === "fix" && <FixPanel counts={fixCounts} onFix={runFix} onFixAll={runAll} />}
        {tab === "words" && <WordsPanel text={deferred} keyword={kw} onPick={(w) => { setKeyword(w); setView("marks"); setFocus(null); }} />}
        {tab === "structure" && <StructurePanel s={stats} onPickSentence={showSentence} />}
        {tab === "dup" && (
          <DupPanel
            result={dup?.result ?? null}
            stale={!!dup && dup.forText !== text}
            loading={dupLoading}
            error={dupError}
            onRun={runDup}
            canRun={words >= MIN_WORDS}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg dark:bg-white dark:text-gray-900">
          {toast}
        </div>
      )}
    </div>
  );
}

function ViewBtn({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon: LucideIcon; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
        on ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white" : "text-gray-500"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function ToolBtn({ onClick, disabled, icon: Icon, children, accent, title }: {
  onClick: () => void;
  disabled?: boolean;
  icon: LucideIcon;
  children: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        accent
          ? "inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
          : `${btn.small} disabled:opacity-40`
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function Legend({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-4 rounded ${cls}`} />
      {children}
    </span>
  );
}
