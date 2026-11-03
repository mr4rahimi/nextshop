"use client";

/** سلامت دفتر — آزمون‌های درستی اسناد، کاردکس و رویدادها (webhesab-parity.md بخش ۱۵) */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { rangeText } from "./ProfitLossReport";
import { api, btn, Card, Chips } from "../ui";
import { downloadCsv, ReportFrame } from "./kit";

type Severity = "error" | "warn" | "info";
interface Check {
  key: string;
  group: "ledger" | "docs" | "stock" | "other";
  title: string;
  severity: Severity;
  hint: string;
  count: number;
  rows: { label: string; detail: string; href: string }[];
  fix?: "stock" | "paid";
  more?: string;
}
interface Data {
  checks: Check[];
  at: string;
  can: { fix: boolean };
}

const GROUPS: { key: Check["group"]; title: string }[] = [
  { key: "ledger", title: "دفتر و اسناد حسابداری" },
  { key: "docs", title: "فاکتور و دریافت/پرداخت" },
  { key: "stock", title: "کالا و کاردکس" },
  { key: "other", title: "رویدادها و اشخاص" },
];

const SEV: Record<Severity, { icon: string; label: string; cls: string; ring: string }> = {
  error: { icon: "⛔", label: "خطا", cls: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", ring: "border-red-300 dark:border-red-500/40" },
  warn: { icon: "⚠️", label: "هشدار", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", ring: "border-amber-300 dark:border-amber-500/40" },
  info: { icon: "ℹ️", label: "یادآوری", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", ring: "border-sky-200 dark:border-sky-500/30" },
};

type Show = "issues" | "all" | Severity;

export default function LedgerHealthReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("3m"));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState<Show>("issues");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [fixing, setFixing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    api<Data>(`/api/admin/accounting/health?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);
  useEffect(load, [load]);

  async function fix(c: Check) {
    if (!c.fix || !confirm(`«${c.title}» اصلاح شود؟\n${c.hint}`)) return;
    setFixing(c.key);
    setMsg(null);
    try {
      const r = await api<{ fixed: number }>("/api/admin/accounting/health", { method: "POST", json: { fix: c.fix } });
      setMsg(`${faNum(r.fixed)} مورد اصلاح شد.`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setFixing(null);
    }
  }

  const toggle = (k: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });

  const checks = data?.checks ?? [];
  const issues = (s?: Severity) => checks.filter((c) => c.count > 0 && (!s || c.severity === s));
  const visible = checks.filter((c) => (show === "all" ? true : show === "issues" ? c.count > 0 : c.severity === show && c.count > 0));

  function exportCsv() {
    downloadCsv("ledger-health", ["آزمون", "سطح", "تعداد", "مورد", "توضیح"], checks.flatMap((c) =>
      c.count ? c.rows.map((r) => [c.title, SEV[c.severity].label, c.count, r.label, r.detail]) : [[c.title, SEV[c.severity].label, 0, "موردی یافت نشد", ""]],
    ));
  }

  const tiles: { s: Show; label: string; n: number; tone: string }[] = [
    { s: "error", label: "خطا", n: issues("error").length, tone: "text-red-600" },
    { s: "warn", label: "هشدار", n: issues("warn").length, tone: "text-amber-600" },
    { s: "info", label: "یادآوری", n: issues("info").length, tone: "text-sky-600" },
    { s: "all", label: "سالم", n: checks.filter((c) => !c.count).length, tone: "text-emerald-600" },
  ];

  return (
    <ReportFrame
      title="سلامت دفتر"
      help="accountingHealth"
      desc="آزمون‌های خودکار درستی دفتر: سند تراز نشده، فاکتور بی سند، کاردکس منفی، بهای صفر، رویداد مسدود و … — هر مورد به خود سند لینک دارد."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <>
          <p className="text-[11px] text-gray-500">بازه فقط برای «منفی شدن در بازه» و «ورود با بهای صفر» است؛ بقیه‌ی آزمون‌ها کل دفتر را می‌بینند.</p>
          <RangeBar value={range} onChange={setRange} />
          <Chips<Show>
            value={show}
            onChange={setShow}
            options={[
              { value: "issues", label: "فقط مشکل‌دارها" },
              { value: "all", label: "همه‌ی آزمون‌ها" },
            ]}
          />
        </>
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map((t) => (
              <button
                key={t.s}
                type="button"
                onClick={() => setShow(t.s === "all" ? "all" : t.s)}
                className={`acc-card rounded-2xl border bg-[var(--adm-surface)] p-3 text-right transition hover:-translate-y-0.5 ${show === t.s ? "border-blue-400" : "border-[var(--adm-border)]"}`}
              >
                <span className="block text-xs font-bold text-gray-500">{t.label}</span>
                <span className={`mt-1 block text-xl font-black ${t.tone}`}>{faNum(t.n)}</span>
                <span className="block text-[10px] text-gray-400">آزمون</span>
              </button>
            ))}
          </div>
          {msg && <p className="text-xs font-bold text-blue-600">{msg}</p>}
          {!visible.length && (
            <Card>
              <p className="py-6 text-center text-sm font-bold text-emerald-600">✓ همه‌ی آزمون‌ها سالم‌اند.</p>
            </Card>
          )}
          {GROUPS.map((g) => {
            const list = visible.filter((c) => c.group === g.key);
            if (!list.length) return null;
            return (
              <section key={g.key} className="space-y-2">
                <h2 className="text-sm font-black text-gray-700 dark:text-gray-200">{g.title}</h2>
                {list.map((c) => {
                  const sev = SEV[c.severity];
                  const isOpen = open.has(c.key);
                  return (
                    <div key={c.key} className={`rounded-2xl border bg-[var(--adm-surface)] ${c.count ? sev.ring : "border-[var(--adm-border)]"}`}>
                      <div className="flex flex-wrap items-center gap-2 p-3">
                        <span className="text-lg">{c.count ? sev.icon : "✅"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-gray-900 dark:text-white">{c.title}</span>
                          {(c.count > 0 || show === "all") && <span className="mt-0.5 block text-[11px] leading-5 text-gray-500">{c.hint}</span>}
                        </span>
                        {c.count > 0 ? (
                          <button type="button" onClick={() => toggle(c.key)} className={`rounded-xl px-3 py-1.5 text-xs font-black ${sev.cls}`}>
                            {faNum(c.count)} مورد {isOpen ? "▴" : "▾"}
                          </button>
                        ) : (
                          <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">موردی یافت نشد</span>
                        )}
                        {c.fix && c.count > 0 && data.can.fix && (
                          <button type="button" onClick={() => fix(c)} disabled={fixing === c.key} className={btn.small}>
                            {fixing === c.key ? "…" : "🔧 اصلاح"}
                          </button>
                        )}
                      </div>
                      {isOpen && c.count > 0 && (
                        <div className="border-t border-[var(--adm-border)] px-3 py-2">
                          <ul className="divide-y divide-[var(--adm-border)]">
                            {c.rows.map((r, i) => (
                              <li key={i}>
                                <Link href={r.href} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5 text-xs hover:text-blue-600">
                                  <span className="font-bold">{r.label}</span>
                                  <span className="text-gray-500">{r.detail}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                          {c.count > c.rows.length && (
                            <p className="mt-1 text-[11px] text-gray-400">
                              {faNum(c.rows.length)} مورد از {faNum(c.count)} نشان داده شد؛ بعد از اصلاح این‌ها دوباره بررسی کنید.
                              {c.more && (
                                <Link href={c.more} className="mr-1 font-bold text-blue-600">
                                  فهرست کامل
                                </Link>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
          <p className="text-[10px] text-gray-400">
            آخرین بررسی: {new Date(data.at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })} ·{" "}
            <button type="button" onClick={load} className="font-bold text-blue-600">
              بررسی دوباره
            </button>
          </p>
        </>
      )}
    </ReportFrame>
  );
}
