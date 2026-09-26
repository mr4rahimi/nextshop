"use client";

/**
 * سند دستی — نمای حسابدار (docs/plans/accounting.md بخش ۶.۴).
 *
 * هر ردیف: حساب، تفصیلی لازمِ همان حساب (شخص یا صندوق/بانک)، بدهکار یا
 * بستانکار. نوار پایین جمع‌ها و اختلاف را همیشه نشان می‌دهد؛ «ترازکن» اختلاف
 * را در ردیف آخر می‌گذارد.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AccountPicker, { type AccountOption } from "./AccountPicker";
import AmountInput from "./AmountInput";
import PartyPicker, { type PartyOption } from "./PartyPicker";
import type { TreasuryRecord } from "./TreasuryForm";
import { api, btn, Card, ErrorText, Field, inputCls, PageHeader } from "./ui";
import { Plus } from "lucide-react";

interface Row {
  key: number;
  account: AccountOption | null;
  party: PartyOption | null;
  treasuryId: string;
  debit: string;
  credit: string;
  description: string;
}

let k = 0;
const blank = (): Row => ({ key: ++k, account: null, party: null, treasuryId: "", debit: "", credit: "", description: "" });

export default function VoucherEditor() {
  const router = useRouter();
  const [date, setDate] = useState(dayValue(todayKey()));
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank()]);
  const [treasuries, setTreasuries] = useState<TreasuryRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury").then((d) => setTreasuries(d.items)).catch(() => {});
  }, []);

  const patch = (key: number, p: Partial<Row>) => setRows((x) => x.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const totals = useMemo(() => {
    let d = 0n;
    let c = 0n;
    for (const r of rows) {
      d += BigInt(r.debit || "0");
      c += BigInt(r.credit || "0");
    }
    return { d, c, diff: d - c };
  }, [rows]);

  function balance() {
    if (totals.diff === 0n) return;
    const last = rows[rows.length - 1];
    const others = rows.slice(0, -1);
    let d = 0n;
    let c = 0n;
    for (const r of others) {
      d += BigInt(r.debit || "0");
      c += BigInt(r.credit || "0");
    }
    const need = d - c;
    patch(last.key, need > 0n ? { credit: need.toString(), debit: "" } : { debit: (-need).toString(), credit: "" });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ voucher: { id: string } }>("/api/admin/accounting/vouchers", {
        method: "POST",
        json: {
          date,
          description,
          lines: rows.map((r) => ({
            accountId: r.account?.id,
            partyId: r.account?.detailKind === "PARTY" ? r.party?.id : null,
            treasuryId: r.account?.detailKind === "TREASURY" ? r.treasuryId || null : null,
            debit: r.debit || "0",
            credit: r.credit || "0",
            description: r.description || null,
          })),
        },
      });
      router.push(`/admin/accounting/vouchers/${d.voucher.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="سند دستی" help="accountingVoucherNew" back={{ href: "/admin/accounting/vouchers", label: "اسناد" }} />

      <Card className="p-4 grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="شرح سند">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="مثلاً: آورده‌ی نقدی شریک" />
        </Field>
      </Card>

      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <Card key={r.key} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-400">ردیف {faNum(i + 1)}</span>
              {rows.length > 2 && (
                <button onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="text-xs text-gray-400 hover:text-red-600">
                  ✕ حذف
                </button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-[1.3fr_1.3fr_1fr_1fr]">
              <AccountPicker value={r.account} onChange={(a) => patch(r.key, { account: a, party: null, treasuryId: "" })} compact />
              {r.account?.detailKind === "PARTY" ? (
                <PartyPicker value={r.party} onChange={(p) => patch(r.key, { party: p })} canCreate compact />
              ) : r.account?.detailKind === "TREASURY" ? (
                <select value={r.treasuryId} onChange={(e) => patch(r.key, { treasuryId: e.target.value })} className={inputCls.replace("py-2.5", "py-2")}>
                  <option value="">— صندوق یا بانک —</option>
                  {treasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={r.description} onChange={(e) => patch(r.key, { description: e.target.value })} className={inputCls.replace("py-2.5", "py-2")} placeholder="شرح ردیف (اختیاری)" />
              )}
              <div>
                <span className="block text-[10px] text-gray-400 mb-0.5">بدهکار</span>
                <AmountInput compact value={r.debit} onChange={(v) => patch(r.key, { debit: v, credit: v ? "" : r.credit })} />
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 mb-0.5">بستانکار</span>
                <AmountInput compact value={r.credit} onChange={(v) => patch(r.key, { credit: v, debit: v ? "" : r.debit })} />
              </div>
            </div>
          </Card>
        ))}
        <button onClick={() => setRows((x) => [...x, blank()])} className={btn.soft}>
          <Plus className="h-4 w-4" aria-hidden />
          ردیف
        </button>
      </div>

      <div className="sticky bottom-20 md:bottom-4 z-30 rounded-2xl shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-xs">
            <span className="text-gray-500">بدهکار </span>
            <b className="tabular-nums">{formatAmount(totals.d)}</b>
          </div>
          <div className="text-xs">
            <span className="text-gray-500">بستانکار </span>
            <b className="tabular-nums">{formatAmount(totals.c)}</b>
          </div>
          <div className={`text-xs font-bold ${totals.diff === 0n ? "text-emerald-600" : "text-red-600"}`}>
            {totals.diff === 0n ? "✓ تراز است" : `اختلاف ${formatAmount(totals.diff < 0n ? -totals.diff : totals.diff)}`}
          </div>
          {totals.diff !== 0n && (
            <button onClick={balance} className={btn.small}>
              ترازکن
            </button>
          )}
          <button onClick={save} disabled={busy || totals.diff !== 0n || totals.d === 0n} className={`${btn.primary} mr-auto`}>
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
