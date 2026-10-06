"use client";

/**
 * بخش‌های کاراکترشمار: بررسی قالب، آمار، ویرایش، کلمات، ساختار و تکراری بودن.
 * همه‌ی محاسبه در lib/tools/text-*.ts است؛ این‌جا فقط نمایش.
 * docs/features/tools.md بخش ۵
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, Info, Loader2, SearchCheck, Wand2, XCircle,
} from "lucide-react";
import {
  LONG_SENTENCE, READ_WPM, SPEAK_WPM, TYPE_WPM, formatDuration, topPhrases, topWords,
  type KeywordStats, type TextStats,
} from "@/lib/tools/text-stats";
import { FIXES, type FixKey } from "@/lib/tools/text-fix";
import type { Check, ProfileResult } from "@/lib/tools/text-profiles";
import type { DupResult } from "@/lib/tools/text-similarity";
import { Card, Segmented, btn } from "../../accounting/ui";
import { ColumnChart, Donut, HBarChart, LengthMeter, ScoreRing } from "./charts";

const fa = (n: number) => n.toLocaleString("fa-IR");
const pct = (n: number) => `${n.toLocaleString("fa-IR")}٪`;

function Title({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-black text-gray-900 dark:text-white">{children}</h3>
      {aside}
    </div>
  );
}

// ── بررسی قالب (ستون کناری) ─────────────────────────────────────────────

const CHECK_ICON: Record<Check["status"], ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  bad: <XCircle className="h-4 w-4 text-rose-500" />,
  info: <Info className="h-4 w-4 text-gray-400" />,
};

export function ProfileCard({ label, result, empty }: { label: string; result: ProfileResult; empty: boolean }) {
  const order: Record<Check["status"], number> = { bad: 0, warn: 1, info: 2, ok: 3 };
  const checks = [...result.checks].sort((a, b) => order[a.status] - order[b.status]);
  const verdict =
    result.score == null ? "" : result.score >= 80 ? "آماده‌ی انتشار" : result.score >= 50 ? "قابل بهتر شدن" : "نیاز به اصلاح";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={empty ? null : result.score} label="امتیاز" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-400">بررسی برای</p>
          <p className="text-base font-black text-gray-900 dark:text-white">{label}</p>
          {!empty && verdict && <p className="mt-1 text-xs font-bold text-gray-500">{verdict}</p>}
          {empty && <p className="mt-1 text-xs text-gray-400">متن را بنویسید یا بچسبانید</p>}
        </div>
      </div>
      {result.meter && !empty && (
        <div className="mt-4">
          <LengthMeter {...result.meter} />
        </div>
      )}
      {!empty && (
        <ul className="mt-4 space-y-2.5">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0">{CHECK_ICON[c.status]}</span>
              <div className="min-w-0 text-xs leading-5">
                <p className="font-bold text-gray-800 dark:text-gray-100">{c.title}</p>
                {c.detail && <p className="text-gray-500 dark:text-gray-400">{c.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── آمار ─────────────────────────────────────────────────────────────────

function Tile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--adm-border)] bg-gray-50/60 p-3 dark:bg-white/[0.03]">
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-black tabular-nums tracking-tight ${accent ?? "text-gray-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10.5px] text-gray-400">{sub}</p>}
    </div>
  );
}

export function StatsPanel({ s }: { s: TextStats }) {
  const c = s.composition;
  const diversity = s.words ? Math.round((s.uniqueWords / Math.max(1, s.words)) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="کلمه" value={fa(s.words)} sub={`${fa(s.uniqueWords)} کلمه‌ی یکتا`} />
        <Tile label="کاراکتر" value={fa(s.chars)} sub={`${fa(s.charsNoSpace)} بدون فاصله`} />
        <Tile label="جمله" value={fa(s.sentences.length)} sub={`میانگین ${fa(s.avgSentence)} کلمه`} />
        <Tile label="پاراگراف" value={fa(s.paragraphs.length)} sub={`میانگین ${fa(s.avgParagraph)} کلمه`} />
        <Tile label="زمان خواندن" value={formatDuration(s.readSec)} sub={`${fa(READ_WPM)} کلمه در دقیقه`} />
        <Tile label="زمان نوشتن" value={formatDuration(s.typeSec)} sub={`تایپ ${fa(TYPE_WPM)} کلمه در دقیقه`} />
        <Tile label="با صدای بلند" value={formatDuration(s.speakSec)} sub={`${fa(SPEAK_WPM)} کلمه در دقیقه — ویدیو و ویس`} />
        <Tile
          label="پیامک"
          value={s.sms.parts ? `${fa(s.sms.parts)} پیامک` : "—"}
          sub={s.sms.parts ? `${s.sms.unicode ? "فارسی" : "لاتین"} · ${fa(s.sms.left)} تا پیامک بعدی` : "فارسی ۷۰ · لاتین ۱۶۰"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <Title>ترکیب نویسه‌ها</Title>
          <Donut
            center={<><b className="text-lg font-black text-gray-900 dark:text-white">{fa(s.chars)}</b><span className="text-[10px] text-gray-400">کاراکتر</span></>}
            segments={[
              { label: "حروف فارسی", value: c.persian, tone: "blue" },
              { label: "حروف لاتین", value: c.latin, tone: "violet" },
              { label: "ارقام", value: c.digits, tone: "teal" },
              { label: "فاصله و نیم‌فاصله", value: c.spaces, tone: "gray" },
              { label: "علامت‌ها", value: c.punct, tone: "amber" },
              { label: "ایموجی", value: c.emoji, tone: "rose" },
            ]}
          />
        </Card>
        <Card className="p-4">
          <Title>جزئیات</Title>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <Row k="تنوع واژگان" v={pct(diversity)} hint="کلمه‌ی یکتا به کل" />
            <Row k="بلندترین جمله" v={`${fa(s.longestSentence)} کلمه`} />
            <Row k="خط" v={fa(s.lines)} />
            <Row k="نیم‌فاصله" v={fa(s.halfSpaces)} />
            <Row k="هشتگ" v={fa(s.hashtags.length)} />
            <Row k="منشن" v={fa(s.mentions.length)} />
            <Row k="لینک" v={fa(s.urls.length)} />
            <Row k="ایموجی" v={fa(s.emojis)} />
            <Row k="طول با وزن ایکس" v={fa(s.xLength)} hint="لینک ۲۳" />
            <Row k="کاراکتر پیامک" v={fa(s.sms.length)} hint="ایموجی ۲" />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-gray-100 pb-1.5 dark:border-white/5">
      <dt className="text-gray-500 dark:text-gray-400">
        {k}
        {hint && <span className="mr-1 text-[10px] text-gray-400">({hint})</span>}
      </dt>
      <dd className="font-bold tabular-nums text-gray-900 dark:text-white">{v}</dd>
    </div>
  );
}

// ── ویرایش و نگارش ───────────────────────────────────────────────────────

export function FixPanel({ counts, onFix, onFixAll }: {
  counts: Record<FixKey, number>;
  onFix: (k: FixKey) => void;
  onFixAll: () => void;
}) {
  const standard = FIXES.filter((f) => f.standard);
  const total = standard.reduce((n, f) => n + counts[f.key], 0);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-black text-gray-900 dark:text-white">
            {total ? `${fa(total)} مورد ایراد نگارشی` : "نگارش متن استاندارد است"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">ی و ک عربی، نیم‌فاصله، علامت‌گذاری فارسی، فاصله‌ها، کشیده و اعراب</p>
        </div>
        <button type="button" className={btn.primary} disabled={!total} onClick={onFixAll}>
          <Wand2 className="h-4 w-4" /> استانداردسازی کامل
        </button>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {FIXES.map((f) => {
          const n = counts[f.key];
          return (
            <div key={f.key} className="flex items-center gap-3 rounded-xl border border-[var(--adm-border)] p-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${
                  !n ? "bg-gray-100 text-gray-400 dark:bg-white/5" : f.standard ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"
                }`}
              >
                {fa(n)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{f.label}</p>
                <p className="truncate text-[11px] text-gray-500" title={f.desc}>{f.desc}</p>
              </div>
              <button type="button" className={btn.small} disabled={!n} onClick={() => onFix(f.key)}>
                {f.standard ? "اصلاح" : "اعمال"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-6 text-gray-400">
        «میخواهم» چسبیده خودکار نیم‌فاصله نمی‌گیرد چون از کلمه‌هایی مثل «میز» و «میدان» قابل تشخیص نیست. هر تغییر با «برگرداندن» بالای متن قابل لغو است.
      </p>
    </div>
  );
}

// ── کلمات و عبارت‌ها ─────────────────────────────────────────────────────

export function WordsPanel({ text, keyword, onPick }: {
  text: string;
  keyword: KeywordStats | null;
  onPick: (w: string) => void;
}) {
  const [mode, setMode] = useState<"1" | "2" | "3">("1");
  const items = useMemo(() => {
    const list = mode === "1" ? topWords(text, 15) : topPhrases(text, Number(mode) as 2 | 3, 12);
    return list.map((w) => ({
      label: w.word,
      value: w.count,
      sub: pct(w.density),
      tone: (w.density > 3 ? "rose" : w.density > 2 ? "amber" : "blue") as "rose" | "amber" | "blue",
    }));
  }, [text, mode]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="p-4">
        <Title aside={<div className="w-56"><Segmented value={mode} onChange={setMode} options={[{ value: "1", label: "کلمه" }, { value: "2", label: "دوکلمه‌ای" }, { value: "3", label: "سه‌کلمه‌ای" }]} /></div>}>
          پرتکرارها
        </Title>
        <HBarChart items={items} empty="هنوز چیزی بیش از یک بار تکرار نشده" onPick={onPick} />
        <p className="mt-3 text-[11px] leading-5 text-gray-400">
          حروف ربط مثل «و، در، از، که» شمرده نمی‌شوند. سرخ یعنی بیش از ۳٪ متن — برای سئو زیاد است. روی هر ردیف بزنید تا کلمه‌ی کلیدی شود و در متن علامت بخورد.
        </p>
      </Card>
      <Card className="p-4">
        <Title>کلمه‌ی کلیدی</Title>
        {!keyword ? (
          <p className="text-xs leading-6 text-gray-400">کلمه‌ی کلیدی را بالای صفحه بنویسید یا از فهرست پرتکرارها انتخاب کنید.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-black text-gray-900 dark:text-white" dir="auto">«{keyword.keyword}»</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile label="تکرار" value={fa(keyword.count)} />
              <Tile
                label="تراکم"
                value={pct(keyword.density)}
                accent={keyword.density > 3 ? "text-rose-600" : keyword.density >= 0.5 ? "text-emerald-600" : "text-amber-600"}
              />
            </div>
            <ul className="space-y-1.5 text-xs">
              <Yes ok={keyword.inFirstParagraph}>در پاراگراف اول</Yes>
              <Yes ok={keyword.nearStart}>نزدیک ابتدای متن</Yes>
              <Yes ok={keyword.density >= 0.5 && keyword.density <= 2.5}>تراکم ۰٫۵ تا ۲٫۵٪ (مقاله)</Yes>
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function Yes({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleDashed className="h-4 w-4 text-gray-300" />}
      <span className={ok ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}>{children}</span>
    </li>
  );
}

// ── ساختار ───────────────────────────────────────────────────────────────

export function StructurePanel({ s, onPickSentence }: { s: TextStats; onPickSentence: (i: number) => void }) {
  const r = s.readability;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <Card className="p-4">
          <Title aside={<span className="text-[11px] text-gray-400">{fa(s.sentences.length)} جمله · بلندترین {fa(s.longestSentence)} کلمه</span>}>
            طول جمله‌ها
          </Title>
          <ColumnChart values={s.sentences.map((x) => x.words)} threshold={LONG_SENTENCE} unit="کلمه" onPick={onPickSentence} />
          <p className="mt-2 text-[11px] text-gray-400">
            هر ستون یک جمله است به ترتیب متن؛ قرمزها بیش از {fa(LONG_SENTENCE)} کلمه‌اند. روی ستون بزنید تا همان جمله در متن نشان داده شود.
          </p>
        </Card>
        <Card className="p-4">
          <Title aside={<span className="text-[11px] text-gray-400">میانگین {fa(s.avgParagraph)} کلمه</span>}>طول پاراگراف‌ها</Title>
          <ColumnChart values={s.paragraphs.map((x) => x.words)} threshold={150} unit="کلمه" height={100} />
        </Card>
      </div>
      <Card className="p-4">
        <Title>سادگی خواندن</Title>
        <div className="flex flex-col items-center gap-2 py-2">
          <ScoreRing score={r.label === "—" ? null : r.score} label={r.label === "—" ? "" : r.label} size={128} />
          {r.label === "—" && <p className="text-xs text-gray-400">برای سنجش دست‌کم ۳۰ کلمه لازم است</p>}
        </div>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="flex justify-between"><span className="text-gray-500">میانگین طول جمله</span><b className="tabular-nums">{fa(s.avgSentence)} کلمه</b></li>
          <li className="flex justify-between"><span className="text-gray-500">جمله‌ی بلند</span><b className="tabular-nums">{pct(s.longShare)}</b></li>
          <li className="flex justify-between"><span className="text-gray-500">میانگین پاراگراف</span><b className="tabular-nums">{fa(s.avgParagraph)} کلمه</b></li>
        </ul>
        <p className="mt-3 text-[11px] leading-5 text-gray-400">
          نمره از طول جمله‌ها و پاراگراف‌ها ساخته می‌شود؛ جمله‌ی کوتاه‌تر و پاراگراف کوتاه‌تر یعنی متن ساده‌تر، به‌خصوص در موبایل.
        </p>
      </Card>
    </div>
  );
}

// ── تکراری بودن ──────────────────────────────────────────────────────────

export function DupPanel({ result, stale, loading, error, onRun, canRun }: {
  result: DupResult | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  canRun: boolean;
}) {
  const tone = !result ? "gray" : result.percent >= 30 ? "rose" : result.percent >= 10 ? "amber" : "emerald";
  const color = { gray: "text-gray-400", rose: "text-rose-600", amber: "text-amber-600", emerald: "text-emerald-600" }[tone];
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="max-w-xl">
          <p className="text-sm font-black text-gray-900 dark:text-white">درصد تکراری بودن در محتوای همین سایت</p>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            متن با محصولات، مقاله‌ها، دسته‌ها، برندها، برگه‌ها و لندینگ‌های سایت مقایسه می‌شود. هر پنج کلمه‌ی پشت‌سرهم که عیناً جای دیگری آمده باشد تکراری حساب می‌شود (ی/ک عربی، نیم‌فاصله و ارقام فرقی نمی‌کنند). با اینترنت مقایسه نمی‌شود.
          </p>
        </div>
        <button type="button" className={btn.primary} disabled={loading || !canRun} onClick={onRun}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
          {result ? "بررسی دوباره" : "بررسی کن"}
        </button>
      </Card>

      {!canRun && <p className="text-xs text-gray-400">برای بررسی دست‌کم ۱۵ کلمه بنویسید.</p>}
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      {result && (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="flex flex-col items-center justify-center gap-1 p-5 text-center">
            <p className={`text-5xl font-black tabular-nums ${color}`}>{pct(result.percent)}</p>
            <p className="text-xs font-bold text-gray-500">تکراری</p>
            <p className="mt-2 text-[11px] text-gray-400">{fa(result.scanned)} صفحه بررسی شد</p>
            {stale && <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-600">متن بعد از بررسی تغییر کرده</p>}
          </Card>
          <Card className="p-4">
            <Title>{result.matches.length ? "صفحه‌های مشابه" : "در سایت متن مشابهی پیدا نشد"}</Title>
            {result.matches.length > 0 && (
              <ul className="space-y-2">
                {result.matches.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl border border-[var(--adm-border)] p-2.5">
                    <span className="w-14 shrink-0 text-center text-sm font-black tabular-nums text-gray-900 dark:text-white">{pct(m.percent)}</span>
                    <div className="h-8 w-px bg-gray-100 dark:bg-white/10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">{m.title}</p>
                      <p className="text-[11px] text-gray-400">{m.kind}</p>
                    </div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noreferrer" className={btn.small} title="باز کردن">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {result.percent > 0 && (
              <p className="mt-3 text-[11px] leading-5 text-gray-400">بخش‌های تکراری در حالت «علامت‌ها» بالای متن با زیرخط قرمز نشان داده می‌شوند.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
