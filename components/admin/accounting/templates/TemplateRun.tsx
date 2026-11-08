"use client";

/**
 * ثبت سند از روی ورودی سریع: مبلغ پایه + چیزهایی که الگو باز گذاشته.
 * عددها با همان `calcTemplate` سرور حساب می‌شوند.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { calcTemplate, usesBase } from "@/lib/accounting/ledger/template-calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import type { TreasuryRecord } from "../TreasuryForm";
import { api, btn, Card, ErrorText, Field, inputCls, PageHeader } from "../ui";
import type { Template } from "./types";

interface LineState {
  party: PartyOption | null;
  treasuryId: string;
  amount: string;
}

const smallInput = inputCls.replace("py-2.5", "py-2");

export default function TemplateRun({ id }: { id: string }) {
  const [t, setT] = useState<Template | null>(null);
  const [treasuries, setTreasuries] = useState<TreasuryRecord[]>([]);
  const [date, setDate] = useState(dayValue(todayKey()));
  const [base, setBase] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<Record<string, LineState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; number: number } | null>(null);

  useEffect(() => {
    api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury").then((d) => setTreasuries(d.items)).catch(() => {});
    api<{ template: Template }>(`/api/admin/accounting/vouchers/templates/${id}`)
      .then(({ template }) => {
        setT(template);
        setBase(template.baseAmount === "0" ? "" : template.baseAmount);
        setDescription(template.description);
        setState(Object.fromEntries(template.lines.map((l) => [l.id, { party: l.party, treasuryId: l.treasury?.id ?? "", amount: "" }])));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const patch = (key: string, p: Partial<LineState>) => setState((s) => ({ ...s, [key]: { ...s[key], ...p } }));

  const calc = useMemo(() => {
    if (!t) return null;
    const asked = Object.fromEntries(t.lines.filter((l) => l.kind === "ASK").map((l) => [l.id, BigInt(state[l.id]?.amount || "0")]));
    return calcTemplate(
      t.lines.map((l) => ({ key: l.id, side: l.side, kind: l.kind, percentBps: l.percentBps, fixedAmount: l.fixedAmount === null ? null : BigInt(l.fixedAmount) })),
      BigInt(base || "0"),
      asked,
    );
  }, [t, base, state]);

  if (!t || !calc) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const needsBase = usesBase(t.lines);
  const diff = calc.debit - calc.credit;
  const missing = t.lines.some((l) => {
    if ((calc.amounts[l.id] ?? 0n) === 0n) return false;
    return (l.account.detailKind === "PARTY" && !state[l.id]?.party) || (l.account.detailKind === "TREASURY" && !state[l.id]?.treasuryId);
  });
  const ready = calc.debit > 0n && diff === 0n && !calc.negativeRemainder && !missing;

  async function save() {
    if (!t) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const d = await api<{ voucher: { id: string; number: number } }>(`/api/admin/accounting/vouchers/templates/${id}/run`, {
        method: "POST",
        json: {
          date,
          base: base || "0",
          description,
          version: t.updatedAt,
          lines: t.lines.map((l) => ({ id: l.id, amount: state[l.id]?.amount || "0", partyId: state[l.id]?.party?.id ?? null, treasuryId: state[l.id]?.treasuryId || null })),
        },
      });
      setDone(d.voucher);
      setBase(t.baseAmount === "0" ? "" : t.baseAmount);
      setState((s) => Object.fromEntries(Object.entries(s).map(([key, v]) => [key, { ...v, amount: "" }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t.name} help="accountingTemplates" back={{ href: "/admin/accounting/vouchers/templates", label: "ورودی سریع" }} />

      {done && (
        <Card className="p-3 text-sm text-emerald-700 dark:text-emerald-400">
          ✓ سند شماره‌ی {faNum(done.number)} ثبت شد.{" "}
          <Link href={`/admin/accounting/vouchers/${done.id}`} className="underline">
            دیدن سند
          </Link>
        </Card>
      )}

      <Card className="p-4 grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="شرح سند">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
        {needsBase && (
          <Field label={t.baseLabel} className="sm:col-span-2">
            <AmountInput value={base} onChange={setBase} autoFocus />
          </Field>
        )}
      </Card>

      <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
        {t.lines.map((l) => {
          const amount = calc.amounts[l.id] ?? 0n;
          const st = state[l.id];
          return (
            <div key={l.id} className="p-3 grid gap-2 md:grid-cols-[1.4fr_1.4fr_160px] md:items-center">
              <div className="text-sm">
                <span className={`text-xs font-bold ml-1.5 ${l.side === "DEBIT" ? "text-emerald-600" : "text-rose-600"}`}>{l.side === "DEBIT" ? "بدهکار" : "بستانکار"}</span>
                {l.account.name}
                {l.description && <div className="text-[11px] text-gray-400">{l.description}</div>}
              </div>
              <div>
                {l.account.detailKind === "PARTY" && st && <PartyPicker value={st.party} onChange={(p) => patch(l.id, { party: p })} canCreate compact />}
                {l.account.detailKind === "TREASURY" && st && (
                  <select value={st.treasuryId} onChange={(e) => patch(l.id, { treasuryId: e.target.value })} className={smallInput} aria-label="صندوق یا بانک">
                    <option value="">— صندوق یا بانک —</option>
                    {treasuries.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {l.kind === "ASK" && st ? (
                <AmountInput compact value={st.amount} onChange={(v) => patch(l.id, { amount: v })} />
              ) : (
                <div className="text-sm font-bold tabular-nums md:text-left">{amount > 0n ? formatAmount(amount) : "—"}</div>
              )}
            </div>
          );
        })}
      </Card>

      <div className="sticky bottom-20 md:bottom-4 z-30 rounded-2xl shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-xs">
            <span className="text-gray-500">بدهکار </span>
            <b className="tabular-nums">{formatAmount(calc.debit)}</b>
          </div>
          <div className="text-xs">
            <span className="text-gray-500">بستانکار </span>
            <b className="tabular-nums">{formatAmount(calc.credit)}</b>
          </div>
          {calc.negativeRemainder ? (
            <div className="text-xs font-bold text-red-600">ردیف «مانده» منفی شده؛ مبلغ‌ها را بررسی کنید</div>
          ) : diff !== 0n ? (
            <div className="text-xs font-bold text-red-600">اختلاف {formatAmount(diff < 0n ? -diff : diff)}</div>
          ) : missing ? (
            <div className="text-xs font-bold text-amber-600">شخص یا صندوق/بانک را انتخاب کنید</div>
          ) : calc.debit > 0n ? (
            <div className="text-xs font-bold text-emerald-600">✓ تراز است</div>
          ) : null}
          <button onClick={save} disabled={busy || !ready} className={`${btn.primary} mr-auto`}>
            {busy ? "در حال ثبت…" : "ثبت سند"}
          </button>
        </div>
        {error && (
          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </div>
    </div>
  );
}
