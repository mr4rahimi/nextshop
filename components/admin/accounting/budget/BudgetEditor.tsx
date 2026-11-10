"use client";

/**
 * تنظیم بودجه‌ی ماهانه‌ی هر حساب — docs/plans/webhesab-parity.md بخش ۲۲.
 * تغییرها تا «ذخیره» فقط در همین صفحه‌اند؛ فقط ردیف‌های تغییرکرده فرستاده می‌شوند.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { growAmount, spreadEvenly } from "@/lib/accounting/budget-calc";
import { faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import { api, Badge, btn, Card, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet } from "../ui";

interface Account {
  accountId: string;
  code: string;
  name: string;
  contra: boolean;
  budget: string[];
  prevActual: string[];
  prevBudget: string[];
}
interface Section {
  key: string;
  title: string;
  accounts: Account[];
}
interface Data {
  year: { id: string; title: string; status: string };
  years: { id: string; title: string; status: string }[];
  prevYear: { id: string; title: string } | null;
  readOnly: boolean;
  months: { seq: number; label: string }[];
  sections: Section[];
}
type Values = Record<string, string[]>;
type Source = "prevActual" | "prevBudget";
type Scope = "empty" | "all";

const asValue = (v: bigint) => (v > 0n ? v.toString() : "");
const toBig = (v: string) => (v ? BigInt(v) : 0n);
const sum = (xs: string[]) => xs.reduce((s, x) => s + toBig(x), 0n);
const fromServer = (xs: string[]) => xs.map((x) => asValue(BigInt(x)));

export default function BudgetEditor() {
  const initialYear = useSearchParams().get("yearId") ?? "";
  const [yearId, setYearId] = useState(initialYear);
  const [data, setData] = useState<Data | null>(null);
  const [values, setValues] = useState<Values>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fillOpen, setFillOpen] = useState(false);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/budget${yearId ? `?yearId=${yearId}` : ""}`)
      .then((d) => {
        setData(d);
        setValues(Object.fromEntries(d.sections.flatMap((s) => s.accounts.map((a) => [a.accountId, fromServer(a.budget)]))));
        setDirty(new Set());
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [yearId]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!dirty.size) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setRow = (id: string, next: string[]) => {
    setValues((v) => ({ ...v, [id]: next }));
    setDirty((d) => new Set(d).add(id));
    setNotice(null);
  };

  const sections = useMemo(() => {
    const text = q.trim();
    if (!data) return [];
    if (!text) return data.sections;
    return data.sections.map((s) => ({ ...s, accounts: s.accounts.filter((a) => a.name.includes(text) || a.code.includes(text)) })).filter((s) => s.accounts.length);
  }, [data, q]);

  function changeYear(next: string) {
    if (dirty.size && !window.confirm("تغییرهای ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟")) return;
    setYearId(next);
    setOpen(new Set());
  }

  async function save() {
    if (!data || !dirty.size) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/admin/accounting/budget", {
        method: "PUT",
        json: { yearId: data.year.id, rows: [...dirty].map((accountId) => ({ accountId, months: values[accountId].map((v) => v || "0") })) },
      });
      setNotice(`بودجه‌ی ${faNum(dirty.size)} حساب ذخیره شد`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function applyFill(source: Source, pct: number, scope: Scope) {
    if (!data) return;
    const next = { ...values };
    const changed = new Set(dirty);
    for (const a of data.sections.flatMap((s) => s.accounts)) {
      if (scope === "empty" && sum(next[a.accountId]) > 0n) continue;
      const filled = a[source].map((x) => asValue(growAmount(BigInt(x), pct)));
      if (filled.join() === next[a.accountId].join()) continue;
      next[a.accountId] = filled;
      changed.add(a.accountId);
    }
    setValues(next);
    setDirty(changed);
    setNotice(changed.size === dirty.size ? "چیزی برای پر کردن پیدا نشد" : null);
    setFillOpen(false);
  }

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const count = data.months.length;
  return (
    <div className="space-y-4 pb-20">
      <PageHeader
        title="تنظیم بودجه"
        help="accountingBudget"
        desc="برای هر حساب برنامه‌ی ماهانه بگذارید. بودجه سند نمی‌سازد."
        back={{ href: "/admin/accounting/reports/budget", label: "بودجه در برابر عملکرد" }}
        actions={
          !data.readOnly && (
            <button className={btn.soft} onClick={() => setFillOpen(true)} disabled={!data.prevYear}>
              ✨ پر کردن خودکار
            </button>
          )
        }
      />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="سال مالی">
          <select className={inputCls} value={data.year.id} onChange={(e) => changeYear(e.target.value)}>
            {data.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title}
                {y.status !== "OPEN" ? " (بسته)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="جستجوی حساب">
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام یا کد حساب" />
        </Field>
      </div>
      {data.readOnly && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">این سال مالی بسته است و بودجه‌اش فقط قابل دیدن است.</p>}
      {!sections.length && <Empty title="حسابی پیدا نشد" />}

      {sections.map((s) => (
        <Card key={s.key} className="overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-black dark:border-white/5 dark:bg-white/[0.04]">{s.title}</div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {s.accounts.map((a) => (
              <BudgetRow
                key={a.accountId}
                account={a}
                months={data.months}
                count={count}
                values={values[a.accountId] ?? []}
                readOnly={data.readOnly}
                isOpen={open.has(a.accountId)}
                edited={dirty.has(a.accountId)}
                onToggle={() =>
                  setOpen((o) => {
                    const n = new Set(o);
                    if (!n.delete(a.accountId)) n.add(a.accountId);
                    return n;
                  })
                }
                onChange={(next) => setRow(a.accountId, next)}
              />
            ))}
          </div>
        </Card>
      ))}

      {(dirty.size > 0 || notice) && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-white/10 dark:bg-[#111620]">
          <span className="text-sm font-bold">{dirty.size > 0 ? `${faNum(dirty.size)} حساب تغییر کرده` : notice}</span>
          {dirty.size > 0 && (
            <div className="mr-auto flex gap-2">
              <button className={btn.soft} onClick={load} disabled={saving}>
                انصراف
              </button>
              <button className={btn.primary} onClick={save} disabled={saving}>
                {saving ? "در حال ذخیره…" : "ذخیره"}
              </button>
            </div>
          )}
        </div>
      )}

      <FillSheet open={fillOpen} prevTitle={data.prevYear?.title ?? ""} onClose={() => setFillOpen(false)} onApply={applyFill} />
    </div>
  );
}

function BudgetRow({
  account,
  months,
  count,
  values,
  readOnly,
  isOpen,
  edited,
  onToggle,
  onChange,
}: {
  account: Account;
  months: { seq: number; label: string }[];
  count: number;
  values: string[];
  readOnly: boolean;
  isOpen: boolean;
  edited: boolean;
  onToggle: () => void;
  onChange: (next: string[]) => void;
}) {
  const annual = sum(values);
  const prevAnnual = account.prevActual.reduce((s, x) => s + BigInt(x), 0n);
  return (
    <div className="px-4 py-3">
      <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_9rem_12rem_5rem]">
        <div className="min-w-0 text-sm">
          <span className="font-bold">{account.name}</span>
          <span className="mr-2 text-[11px] tabular-nums text-gray-400">{faNum(account.code)}</span>
          {account.contra && <Badge>کاهنده</Badge>}
          {edited && <span className="mr-2 text-[11px] font-bold text-blue-600">ذخیره نشده</span>}
        </div>
        <div className="text-xs text-gray-500">
          سال قبل <b className="tabular-nums text-gray-700 dark:text-gray-300">{formatAmount(prevAnnual)}</b>
        </div>
        <AmountInput
          compact
          disabled={readOnly}
          value={annual > 0n ? annual.toString() : ""}
          placeholder="بودجه‌ی سالانه"
          onChange={(v) => onChange(spreadEvenly(toBig(v), count).map(asValue))}
        />
        <button type="button" className={btn.small} onClick={onToggle} aria-expanded={isOpen}>
          ماه‌ها {isOpen ? "▴" : "▾"}
        </button>
      </div>
      {isOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {months.map((m, i) => (
            <label key={m.seq} className="block text-xs text-gray-500">
              <span className="mb-1 block font-bold">{m.label}</span>
              <AmountInput
                compact
                disabled={readOnly}
                value={values[i] ?? ""}
                onChange={(v) => {
                  const next = [...values];
                  next[i] = v;
                  onChange(next);
                }}
              />
              <span className="mt-1 block text-[11px] text-gray-400">سال قبل {formatAmount(account.prevActual[i])}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FillSheet({ open, prevTitle, onClose, onApply }: { open: boolean; prevTitle: string; onClose: () => void; onApply: (source: Source, pct: number, scope: Scope) => void }) {
  const [source, setSource] = useState<Source>("prevActual");
  const [scope, setScope] = useState<Scope>("empty");
  const [pct, setPct] = useState("");
  const parsed = Number(toLatinDigits(pct).replace(/[٫]/g, ".") || "0");
  const valid = Number.isFinite(parsed) && parsed >= -100 && parsed <= 1000;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="پر کردن خودکار"
      footer={
        <button className={`${btn.primary} w-full`} disabled={!valid} onClick={() => onApply(source, parsed, scope)}>
          پر کردن جدول
        </button>
      }
    >
      <div className="space-y-4">
        <Field label={`از ${prevTitle}`}>
          <Segmented<Source>
            value={source}
            onChange={setSource}
            options={[
              { value: "prevActual", label: "عملکرد واقعی" },
              { value: "prevBudget", label: "بودجه" },
            ]}
          />
        </Field>
        <Field label="درصد افزایش یا کاهش" hint="برای کاهش عدد منفی بزنید؛ مبلغ‌ها به هزار گرد می‌شوند.">
          <input className={inputCls} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="۰" />
        </Field>
        <Field label="کدام حساب‌ها">
          <Segmented<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "empty", label: "فقط حساب‌های خالی" },
              { value: "all", label: "همه‌ی حساب‌ها" },
            ]}
          />
        </Field>
        <p className="text-xs text-gray-500">جدول فقط در همین صفحه پر می‌شود و تا «ذخیره» چیزی ثبت نمی‌شود.</p>
      </div>
    </Sheet>
  );
}
