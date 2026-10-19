"use client";

/**
 * امتیاز عملکرد ماهانه — docs/features/staff-worklist.md بخش ۱۵.
 *
 * سه تب، هر کدام با مجوز خودش:
 *  - «امتیاز من» (`SCORE_VIEW_OWN`): فقط عدد خودِ کارمند — هرگز نام یا عدد دیگران
 *  - «رتبه‌بندی» (`SCORE_VIEW_ALL`): جدول هر گروه با ریز معیار و ثبت برنده
 *  - «تنظیمات» (`SCORE_SETTINGS_MANAGE`): کلید، وزن‌ها، گروه کارکنان — **یک** دکمه‌ی ذخیره
 *
 * عدد خام همیشه کنار امتیاز است: «چرا او» فقط با صورت و مخرج جواب می‌گیرد.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Trophy } from "lucide-react";
import {
  metricDef, metricsOf, SCORE_GROUP_HINTS, SCORE_GROUP_LABELS, SCORE_GROUPS, type ScoreGroup,
} from "@/lib/worklist/score-metrics";

// ── انواع پاسخ API ───────────────────────────────────────────────

interface MetricResult {
  code: string;
  raw: number | null;
  num?: number;
  den?: number;
  compared: number | null;
  reference: number | null;
  normalized: number | null;
  weight: number;
  points: number;
  status: "ok" | "na" | "dropped";
}

interface MemberResult {
  userId: string;
  name: string;
  score: number;
  rank: number | null;
  eligible: boolean;
  reason: string | null;
  volume: number;
  presentDays: number | null;
  metrics: MetricResult[];
  info?: { profit?: number };
}

interface Award {
  id: string;
  userId: string | null;
  userName: string;
  score: number;
  note: string | null;
  createdByName: string;
  createdAt: string;
}

interface GroupView {
  group: ScoreGroup;
  members: MemberResult[];
  medianVolume: number;
  minVolume: number;
  perDayApplied: boolean;
  warnings: string[];
  locked: boolean;
  award: Award | null;
}

interface MonthScore {
  month: { key: string; label: string; isCurrent: boolean; daysLeft: number };
  settings: { enabled: boolean; minVolumePct: number; conversionDays: number; showRank: boolean };
  groups: GroupView[];
  unassigned: { userId: string; name: string }[];
  conversionPendingUntil: string | null;
  canManage: boolean;
}

// ── قالب‌بندی ────────────────────────────────────────────────────

const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const n1 = (v: number) => nf.format(Math.round(v * 10) / 10);
const pct = (v: number) => `${n1(v * 100)}٪`;

function currentKey(): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    year: "numeric", month: "numeric", timeZone: "Asia/Tehran",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1405";
  const m = parts.find((p) => p.type === "month")?.value ?? "1";
  return `${y}-${m.padStart(2, "0")}`;
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** عدد خام یک معیار، به زبان آدم */
function rawText(m: Pick<MetricResult, "code" | "raw" | "num" | "den" | "status">): string {
  const def = metricDef(m.code);
  if (m.raw === null) return "صدق نمی‌کند";
  if (def?.kind === "rate") return `${pct(m.raw)} (${n1(m.num ?? 0)} از ${n1(m.den ?? 0)})`;
  // کار وزنی: اگر وزن‌ها ۱ نیستند، تعداد واقعی هم کنارش
  if (m.num !== undefined && Math.abs(m.num - m.raw) > 0.01) return `${n1(m.raw)} (${n1(m.num)} مورد)`;
  return n1(m.raw);
}

function statusText(m: MetricResult): string | null {
  if (m.status === "na") return "برای او صدق نمی‌کند — نه جریمه، نه امتیاز";
  if (m.status === "dropped") return m.weight === 0 ? "غیرفعال" : "هیچ‌کس در گروه عددی نداشت — کنار رفت";
  return null;
}

function scoreTone(score: number) {
  return score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500";
}

// ── پوسته ───────────────────────────────────────────────────────

type Tab = "me" | "team" | "settings";

export default function ScoreClient({
  canOwn, canAll, canManage, enabled,
}: { canOwn: boolean; canAll: boolean; canManage: boolean; enabled: boolean }) {
  const tabs = useMemo(
    () =>
      [
        canOwn && { key: "me" as const, label: "امتیاز من" },
        canAll && { key: "team" as const, label: "رتبه‌بندی" },
        canManage && { key: "settings" as const, label: "تنظیمات" },
      ].filter(Boolean) as { key: Tab; label: string }[],
    [canOwn, canAll, canManage],
  );
  const [tab, setTab] = useState<Tab>(enabled ? (tabs[0]?.key ?? "me") : canManage ? "settings" : "me");

  if (tabs.length === 0) {
    return <Notice>به امتیاز عملکرد دسترسی ندارید.</Notice>;
  }

  return (
    <div className="space-y-5 min-w-0">
      {!enabled && (
        <Notice tone="warn">
          امتیاز عملکرد خاموش است.{" "}
          {canManage ? "از تب «تنظیمات» گروه کارکنان را تعیین و روشنش کنید." : "مدیر هنوز روشنش نکرده است."}
        </Notice>
      )}

      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                tab === t.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "me" && canOwn && enabled && <MyPanel />}
      {tab === "team" && canAll && enabled && <TeamPanel />}
      {tab === "settings" && canManage && <SettingsPanel />}
    </div>
  );
}

// ── امتیاز من ───────────────────────────────────────────────────

interface MyScore {
  enabled: boolean;
  group: ScoreGroup | null;
  month: { key: string; label: string; daysLeft: number; isCurrent: boolean };
  score: number | null;
  eligible: boolean;
  reason: string | null;
  rank: number | null;
  rankOf: number | null;
  metrics: Pick<MetricResult, "code" | "raw" | "num" | "den" | "normalized" | "weight" | "status">[];
  locked: boolean;
}

function MyPanel() {
  const [month, setMonth] = useState(currentKey);
  const [data, setData] = useState<MyScore | null>(null);
  const [awards, setAwards] = useState<(Omit<Award, "score"> & { monthKey: string; group: ScoreGroup })[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/worklist/score/me?month=${month}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [month]);

  useEffect(() => {
    fetch("/api/admin/worklist/score/award")
      .then((r) => (r.ok ? r.json() : { awards: [] }))
      .then((d) => setAwards(d.awards ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <MonthNav value={month} onChange={setMonth} label={data?.month.label} />
      {error && <Notice tone="bad">{error}</Notice>}

      {data && !data.group && (
        <Notice>هنوز در هیچ گروه امتیازی نیستید. گروه را مدیر در تنظیمات امتیاز تعیین می‌کند.</Notice>
      )}

      {data?.group && data.score !== null && (
        <Card
          title={`امتیاز ${data.month.label}`}
          sub={`گروه ${SCORE_GROUP_LABELS[data.group]} — نسبت به بهترین عملکرد همین ماه در همین گروه`}
        >
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <span className={`text-4xl font-black tabular-nums ${scoreTone(data.score)}`}>{n1(data.score)}</span>
            <span className="text-xs text-gray-500 pb-1">از ۱۰۰</span>
            {data.rank !== null && (
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 pb-1">
                رتبه‌ی {n1(data.rank)} از {n1(data.rankOf ?? 0)}
              </span>
            )}
            {data.month.isCurrent && (
              <span className="text-[11px] text-gray-400 pb-1">{n1(data.month.daysLeft)} روز تا پایان ماه</span>
            )}
            {data.locked && <LockedBadge />}
          </div>
          <Bar value={data.score / 100} className="mt-3" />
          {!data.eligible && data.reason && (
            <p className="mt-3 text-[11px] text-amber-600">در رتبه‌بندی این ماه نیستید: {data.reason}</p>
          )}

          <div className="mt-4 divide-y divide-gray-100 dark:divide-white/5">
            {data.metrics
              .filter((m) => m.weight > 0)
              .sort((a, b) => (b.normalized ?? -1) - (a.normalized ?? -1))
              .map((m) => (
                <div key={m.code} className="py-2.5 flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{metricDef(m.code)?.label}</p>
                    <p className="text-[10.5px] text-gray-400 truncate">{metricDef(m.code)?.hint}</p>
                  </div>
                  <div className="w-36 shrink-0 text-left">
                    <p className="text-[11px] tabular-nums text-gray-600 dark:text-gray-300">{rawText(m)}</p>
                    {m.normalized !== null ? (
                      <Bar value={m.normalized} className="mt-1" />
                    ) : (
                      <p className="text-[10px] text-gray-400">{m.status === "na" ? "صدق نمی‌کند" : "کنار رفت"}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-3 text-[10.5px] leading-5 text-gray-400">
            نوار هر معیار یعنی شما چند درصدِ بهترین عدد گروه را دارید. عدد همکاران نشان داده نمی‌شود.
          </p>
        </Card>
      )}

      {awards.length > 0 && (
        <Card title="کارمندان نمونه" sub="برنده‌ی هر گروه در ماه‌های گذشته، با دلیلی که مدیر نوشته">
          <ul className="space-y-2">
            {awards.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-xs">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <b className="text-gray-800 dark:text-gray-100">{a.userName}</b>
                  <span className="text-gray-400"> — {SCORE_GROUP_LABELS[a.group]} · {monthLabel(a.monthKey)}</span>
                  {a.note && <span className="block text-[11px] text-gray-500">{a.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y.toLocaleString("fa-IR", { useGrouping: false })}`;
}

// ── رتبه‌بندی ───────────────────────────────────────────────────

function TeamPanel() {
  const [month, setMonth] = useState(currentKey);
  const [data, setData] = useState<MonthScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  // بارگذاری دوباره بعد از ثبت یا برداشتن برنده — شمارنده، نه setState داخل effect
  const [version, setVersion] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${month}:${version}`;
  const loading = loadedKey !== requestKey;
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/worklist/score?month=${month}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        if (alive) { setData(d); setError(null); }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoadedKey(`${month}:${version}`));
    return () => { alive = false; };
  }, [month, version]);

  const groups = data?.groups.filter((g) => g.members.length > 0) ?? [];

  return (
    <div className="space-y-4">
      <MonthNav value={month} onChange={setMonth} label={data?.month.label} />
      {error && <Notice tone="bad">{error}</Notice>}
      {loading && !data && <p className="p-10 text-center text-xs text-gray-400">در حال بارگذاری…</p>}

      {data && (
        <>
          {data.month.isCurrent && (
            <Notice>
              ماه جاری است و عددها تا همین لحظه حساب می‌شوند — {n1(data.month.daysLeft)} روز مانده. برنده بعد از پایان ماه ثبت می‌شود.
            </Notice>
          )}
          {data.conversionPendingUntil && (
            <Notice tone="warn">
              پنجره‌ی {n1(data.settings.conversionDays)} روزه‌ی تبدیل تماس‌های آخر ماه هنوز باز است و آن تماس‌ها فعلاً
              شمرده نمی‌شوند. اگر می‌شود، برنده‌ی فروش را بعد از{" "}
              {new Date(data.conversionPendingUntil).toLocaleDateString("fa-IR")} ثبت کنید.
            </Notice>
          )}
          {data.unassigned.length > 0 && (
            <Notice tone="warn">
              {data.unassigned.map((u) => u.name).join("، ")} هنوز گروه امتیاز ندارند و در هیچ جدولی نیستند.
            </Notice>
          )}
          {groups.length === 0 && <Notice>هیچ کارمندی گروه امتیاز ندارد. از تب «تنظیمات» تعیین کنید.</Notice>}

          {groups.map((g) => (
            <GroupCard key={g.group} g={g} month={data.month} canManage={data.canManage} onChanged={load} />
          ))}

          <p className="text-[11px] text-gray-400 leading-6">
            هر معیار نسبت به بهترین عدد همان ماه در همان گروه سنجیده می‌شود، پس امتیاز ۱۰۰ یعنی «بهترین در همه‌ی
            معیارها»، نه «کامل». سود فروش در امتیاز نیست — آن را پورسانت پاداش می‌دهد — و فقط برای تساوی‌شکنی آمده.
          </p>
        </>
      )}
    </div>
  );
}

function GroupCard({
  g, month, canManage, onChanged,
}: {
  g: GroupView;
  month: MonthScore["month"];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function unlock() {
    if (!confirm("قفل این ماه برداشته شود؟ عددها دوباره با وزن‌های فعلی حساب می‌شوند.")) return;
    setBusy(true);
    const r = await fetch(`/api/admin/worklist/score/award?month=${month.key}&group=${g.group}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) alert((await r.json()).error ?? "ناموفق بود");
    else onChanged();
  }

  return (
    <Card
      title={`گروه ${SCORE_GROUP_LABELS[g.group]}`}
      sub={`${SCORE_GROUP_HINTS[g.group]} · میانه‌ی حجم ${n1(g.medianVolume)} · کف واجد شرایط ${n1(g.minVolume)}${
        g.perDayApplied ? " · حجم بر روز حضور تقسیم شد" : ""
      }`}
    >
      {g.award && (
        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 text-xs flex flex-wrap items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <b className="text-gray-800 dark:text-gray-100">برنده: {g.award.userName}</b>
          <span className="text-gray-500">— ثبت {g.award.createdByName}</span>
          {g.award.note && <span className="basis-full text-[11px] text-gray-600 dark:text-gray-300">{g.award.note}</span>}
          <LockedBadge />
          {canManage && (
            <button onClick={unlock} disabled={busy} className="mr-auto text-[11px] font-bold text-red-500 hover:underline">
              برداشتن قفل
            </button>
          )}
        </div>
      )}

      {g.warnings.map((w) => (
        <p key={w} className="mb-2 text-[11px] text-amber-600">{w}</p>
      ))}

      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {g.members.map((m) => (
          <div key={m.userId}>
            <button
              onClick={() => setOpen(open === m.userId ? null : m.userId)}
              className="w-full py-2.5 flex items-center gap-3 text-right hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg px-1"
            >
              <span className="w-6 text-center text-xs font-black text-gray-400 tabular-nums">
                {m.rank !== null ? n1(m.rank) : "—"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{m.name}</span>
                {!m.eligible && <span className="block text-[10px] text-amber-600">واجد شرایط نیست: {m.reason}</span>}
              </span>
              {m.info?.profit !== undefined && m.info.profit > 0 && (
                <span className="hidden sm:block text-[10px] text-gray-400 tabular-nums">
                  سود {nf.format(Math.round(m.info.profit))}
                </span>
              )}
              <span className="w-24 shrink-0">
                <span className={`block text-left text-sm font-black tabular-nums ${scoreTone(m.score)}`}>{n1(m.score)}</span>
                <Bar value={m.score / 100} />
              </span>
            </button>
            {open === m.userId && <Breakdown m={m} perDay={g.perDayApplied} />}
          </div>
        ))}
      </div>

      {canManage && !g.locked && !month.isCurrent && (
        <div className="mt-3">
          {awarding ? (
            <AwardForm g={g} monthKey={month.key} onDone={() => { setAwarding(false); onChanged(); }} onCancel={() => setAwarding(false)} />
          ) : (
            <button
              onClick={() => setAwarding(true)}
              disabled={!g.members.some((m) => m.eligible)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white disabled:opacity-40"
            >
              ثبت برنده‌ی {month.label}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function Breakdown({ m, perDay }: { m: MemberResult; perDay: boolean }) {
  return (
    <div className="mb-3 overflow-x-auto rounded-xl bg-gray-50 dark:bg-white/5">
      <table className="w-full text-[11px] min-w-[560px]">
        <thead>
          <tr className="text-gray-400">
            <th className="py-2 px-2 text-right font-bold">معیار</th>
            <th className="py-2 px-2 font-bold">عدد خام</th>
            <th className="py-2 px-2 font-bold">بهترین گروه</th>
            <th className="py-2 px-2 font-bold">نرمال</th>
            <th className="py-2 px-2 font-bold">وزن</th>
            <th className="py-2 px-2 font-bold">امتیاز</th>
          </tr>
        </thead>
        <tbody>
          {m.metrics.map((x) => {
            const def = metricDef(x.code);
            const note = statusText(x);
            const daily = def?.perDay && perDay && x.compared !== null;
            return (
              <tr key={x.code} className="border-t border-gray-100 dark:border-white/5">
                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">
                  {def?.label}
                  {def?.direction === -1 && <span className="text-gray-400"> (کمتر بهتر)</span>}
                  {note && <span className="block text-[10px] text-gray-400">{note}</span>}
                </td>
                <td className="py-2 px-2 text-center tabular-nums">
                  {rawText(x)}
                  {daily && <span className="block text-[10px] text-gray-400">{n1(x.compared!)} در روز</span>}
                </td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-500">
                  {x.reference === null ? "—" : def?.kind === "rate" ? pct(x.reference) : n1(x.reference)}
                </td>
                <td className="py-2 px-2 text-center tabular-nums">{x.normalized === null ? "—" : pct(x.normalized)}</td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-500">{x.status === "ok" ? n1(x.weight) : "—"}</td>
                <td className="py-2 px-2 text-center tabular-nums font-bold">{x.status === "ok" ? n1(x.points) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 pb-2 text-[10px] text-gray-400">
        حضور در سیستم: {m.presentDays === null ? "ثبت نشده" : `${n1(m.presentDays)} روز`} · حجم کار {n1(m.volume)}
      </p>
    </div>
  );
}

function AwardForm({
  g, monthKey, onDone, onCancel,
}: { g: GroupView; monthKey: string; onDone: () => void; onCancel: () => void }) {
  const eligible = g.members.filter((m) => m.eligible);
  const [userId, setUserId] = useState(eligible[0]?.userId ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/worklist/score/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: monthKey, group: g.group, userId, note }),
    });
    setBusy(false);
    if (r.ok) onDone();
    else setError((await r.json()).error ?? "ثبت ناموفق بود");
  }

  return (
    <div className="p-3 rounded-xl border border-amber-500/30 space-y-2">
      <p className="text-[11px] text-gray-500">
        با ثبت برنده، جدول این گروه با وزن‌های همین لحظه قفل می‌شود و تغییر وزن‌ها در آینده این ماه را عوض نمی‌کند.
        انتخاب با شماست؛ نفر اول فقط پیشنهاد سیستم است.
      </p>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs"
      >
        {eligible.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.rank !== null ? `${n1(m.rank)}. ` : ""}{m.name} — {n1(m.score)}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="چرا او؟ (به همه نشان داده می‌شود)"
        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs"
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy || !userId} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white disabled:opacity-40">
          ثبت و قفل
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
          انصراف
        </button>
      </div>
    </div>
  );
}

// ── تنظیمات ─────────────────────────────────────────────────────

interface SettingsData {
  enabled: boolean;
  minVolumePct: number;
  conversionDays: number;
  showRank: boolean;
  metrics: Record<ScoreGroup, { code: string; weight: number; isActive: boolean }[]>;
  staff: { userId: string; name: string; roleTitle: string | null; group: ScoreGroup | null; excluded: boolean }[];
}

function SettingsPanel() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/worklist/score/settings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!data) return <p className="p-10 text-center text-xs text-gray-400">در حال بارگذاری…</p>;

  const patch = (p: Partial<SettingsData>) => { setData({ ...data, ...p }); setSaved(false); };
  const setMetric = (g: ScoreGroup, code: string, p: Partial<{ weight: number; isActive: boolean }>) =>
    patch({ metrics: { ...data.metrics, [g]: data.metrics[g].map((m) => (m.code === code ? { ...m, ...p } : m)) } });
  const setStaff = (userId: string, p: Partial<{ group: ScoreGroup | null; excluded: boolean }>) =>
    patch({ staff: data.staff.map((s) => (s.userId === userId ? { ...s, ...p } : s)) });

  function resetDefaults(g: ScoreGroup) {
    patch({
      metrics: {
        ...data!.metrics,
        [g]: metricsOf(g).map((d) => ({ code: d.code, weight: d.defaults[g] ?? 0, isActive: true })),
      },
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/worklist/score/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (r.ok) setSaved(true);
    else setError((await r.json()).error ?? "ذخیره ناموفق بود");
  }

  const assigned = data.staff.filter((s) => s.group && !s.excluded).length;

  return (
    <div className="space-y-4">
      <Card title="کلی">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-100">
          <input type="checkbox" checked={data.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          امتیاز عملکرد روشن باشد
        </label>
        <p className="mt-1 text-[10.5px] text-gray-400">خاموش یعنی نه رتبه‌بندی دیده می‌شود نه کارت «امتیاز من».</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField
            label="کف واجد شرایط بودن (درصد میانه‌ی حجم گروه)"
            hint="کسی که حجم کارش کمتر از این باشد امتیاز می‌گیرد ولی رتبه نه — چهار کارِ عالی برنده نمی‌شود."
            value={data.minVolumePct}
            onChange={(v) => patch({ minVolumePct: v })}
          />
          <NumberField
            label="پنجره‌ی تبدیل تماس به سفارش (روز)"
            hint="سفارشی که تا این چند روز بعد از اولین تماس فروش بیاید، تبدیل حساب می‌شود."
            value={data.conversionDays}
            onChange={(v) => patch({ conversionDays: v })}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={data.showRank} onChange={(e) => patch({ showRank: e.target.checked })} />
          کارمند رتبه‌ی خودش را ببیند (نام و امتیاز دیگران هرگز دیده نمی‌شود)
        </label>
      </Card>

      <Card
        title="گروه کارکنان"
        sub={`هر کس فقط با هم‌گروه‌های خودش مقایسه می‌شود. «بیرون» یعنی صراحتاً در رتبه‌بندی نیست. ${n1(assigned)} نفر در رتبه‌بندی.`}
      >
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {data.staff.map((s) => (
            <div key={s.userId} className="py-2 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-[8rem]">
                <span className="block text-xs font-bold text-gray-800 dark:text-gray-100">{s.name}</span>
                {s.roleTitle && <span className="block text-[10px] text-gray-400">نقش: {s.roleTitle}</span>}
              </span>
              <select
                value={s.excluded ? "__out" : (s.group ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__out") setStaff(s.userId, { excluded: true });
                  else setStaff(s.userId, { excluded: false, group: (v || null) as ScoreGroup | null });
                }}
                className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5 text-xs"
              >
                <option value="">تعیین‌نشده</option>
                {SCORE_GROUPS.map((g) => (
                  <option key={g} value={g}>{SCORE_GROUP_LABELS[g]}</option>
                ))}
                <option value="__out">بیرون از رتبه‌بندی</option>
              </select>
            </div>
          ))}
        </div>
      </Card>

      {SCORE_GROUPS.map((g) => {
        const total = data.metrics[g].filter((m) => m.isActive).reduce((s, m) => s + m.weight, 0);
        return (
          <Card
            key={g}
            title={`وزن معیارهای گروه ${SCORE_GROUP_LABELS[g]}`}
            sub={`لازم نیست جمع وزن‌ها ۱۰۰ باشد؛ نسبت‌ها مهم‌اند. جمع فعلی ${n1(total)}.`}
          >
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {data.metrics[g].map((m) => {
                const def = metricDef(m.code);
                return (
                  <div key={m.code} className="py-2.5 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={m.isActive}
                      onChange={(e) => setMetric(g, m.code, { isActive: e.target.checked })}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-gray-800 dark:text-gray-100">
                        {def?.label}
                        {def?.direction === -1 && <span className="font-normal text-gray-400"> (کمتر بهتر)</span>}
                      </span>
                      <span className="block text-[10.5px] text-gray-400">{def?.hint}</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={m.weight}
                      disabled={!m.isActive}
                      onChange={(e) => setMetric(g, m.code, { weight: Number(e.target.value) })}
                      className="w-24 sm:w-32"
                    />
                    <span className="w-6 text-xs tabular-nums text-gray-600 dark:text-gray-300">{n1(m.weight)}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => resetDefaults(g)} className="mt-2 text-[11px] font-bold text-blue-500 hover:underline">
              بازگشت به وزن‌های پیش‌فرض
            </button>
          </Card>
        );
      })}

      <div className="sticky bottom-4 flex items-center gap-3 p-3 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur border border-gray-100 dark:border-white/10">
        <button onClick={save} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500 text-white disabled:opacity-40">
          ذخیره‌ی همه‌ی تنظیمات
        </button>
        {saved && <span className="text-[11px] text-emerald-600">ذخیره شد</span>}
        <span className="text-[10.5px] text-gray-400">
          وزن‌ها روی ماه‌هایی که برنده‌شان ثبت شده اثری ندارند.
        </span>
      </div>
    </div>
  );
}

// ── اجزای کوچک ──────────────────────────────────────────────────

function MonthNav({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const atCurrent = value >= currentKey();
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(shiftMonth(value, -1))} className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5" aria-label="ماه قبل">
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="min-w-[7rem] text-center text-sm font-black text-gray-900 dark:text-white">{label ?? monthLabel(value)}</span>
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={atCurrent}
        className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-30"
        aria-label="ماه بعد"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
}

function NumberField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-gray-700 dark:text-gray-200">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        className="mt-1 w-28 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs tabular-nums"
      />
      <span className="block mt-1 text-[10.5px] text-gray-400">{hint}</span>
    </label>
  );
}

function Bar({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${v >= 0.75 ? "bg-emerald-500" : v >= 0.5 ? "bg-amber-500" : "bg-red-400"}`}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

function LockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-gray-500">
      <Lock className="w-3 h-3" /> قفل‌شده
    </span>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "warn" | "bad" }) {
  const cls =
    tone === "bad" ? "bg-red-500/10 text-red-600"
      : tone === "warn" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return <div className={`p-3 rounded-2xl text-xs leading-6 ${cls}`}>{children}</div>;
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 min-w-0">
      <h2 className="text-xs font-black text-gray-900 dark:text-white">{title}</h2>
      {sub && <p className="mt-0.5 mb-3 text-[10.5px] leading-5 text-gray-400">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

/** کارت کوچک خانه‌ی کارتابل — فقط وقتی روشن است و کارمند گروه دارد */
export function MyScoreMini() {
  const [data, setData] = useState<MyScore | null>(null);
  useEffect(() => {
    fetch("/api/admin/worklist/score/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data?.enabled || !data.group || data.score === null) return null;

  const ranked = data.metrics.filter((m) => m.normalized !== null && m.weight > 0);
  const best = [...ranked].sort((a, b) => (b.normalized ?? 0) - (a.normalized ?? 0))[0];
  const worst = [...ranked].sort((a, b) => (a.normalized ?? 0) - (b.normalized ?? 0))[0];

  return (
    <Link
      href="/admin/worklist/score"
      className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-blue-300"
    >
      <Trophy className="w-5 h-5 text-amber-500" />
      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">امتیاز {data.month.label}</span>
      <span className={`text-xl font-black tabular-nums ${scoreTone(data.score)}`}>{n1(data.score)}</span>
      {data.rank !== null && <span className="text-[11px] text-gray-500">رتبه‌ی {n1(data.rank)} از {n1(data.rankOf ?? 0)}</span>}
      {best && best !== worst && (
        <span className="text-[11px] text-gray-500">
          قوی: {metricDef(best.code)?.label} · جای کار: {metricDef(worst.code)?.label}
        </span>
      )}
      <span className="text-[11px] text-gray-400 mr-auto">{n1(data.month.daysLeft)} روز تا پایان ماه</span>
    </Link>
  );
}
