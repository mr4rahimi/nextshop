"use client";

/** یک وام: جدول اقساط، پرداخت و برگشت پرداخت */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import type { TreasuryRecord } from "../TreasuryForm";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, PageHeader, Sheet, Stat } from "../ui";

interface Item {
  id: string;
  seq: number;
  dueDate: string;
  principal: string;
  interest: string;
  penalty: string;
  paidAt: string | null;
  voucherId: string | null;
  treasury: { id: string; name: string } | null;
}
interface Data {
  loan: {
    id: string;
    number: number;
    title: string;
    lender: string;
    date: string;
    principal: string;
    upfrontFee: string;
    rateBp: number;
    status: "ACTIVE" | "SETTLED" | "VOID";
    voucherId: string | null;
    voidReason: string | null;
    note: string | null;
    treasury: { id: string; name: string } | null;
    items: Item[];
  };
  today: string;
  stats: { paidPrincipal: string; paidTotal: string; paidCount: number; count: number; remaining: string; remainingInterest: string; overdue: number };
  can: { manage: boolean };
}

const day = (v: string) => formatJalali(new Date(v));

export default function LoanDetail({ id }: { id: string }) {
  const url = `/api/admin/accounting/loans/${id}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Item | null>(null);
  const [date, setDate] = useState(dayValue(todayKey()));
  const [treasuryId, setTreasuryId] = useState("");
  const [penalty, setPenalty] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [treasuries, setTreasuries] = useState<TreasuryRecord[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Data>(url)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [url]);

  useEffect(() => {
    load();
    api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury").then((d) => setTreasuries(d.items.filter((t) => t.isActive))).catch(() => {});
  }, [load]);

  async function post(json: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await api(url, { method: "POST", json });
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const { loan: l, stats: s } = data;
  const active = data.can.manage && l.status === "ACTIVE";
  const canAct = data.can.manage && l.status !== "VOID";

  function openPay(it: Item) {
    setPaying(it);
    setDate(dayValue(todayKey()));
    setTreasuryId(l.treasury?.id ?? "");
    setPenalty("");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={l.title}
        help="accountingLoans"
        desc={`${l.lender} · وام شماره‌ی ${faNum(l.number)} · ${day(l.date)}`}
        back={{ href: "/admin/accounting/loans", label: "وام و تسهیلات" }}
        actions={
          active &&
          s.paidCount === 0 && (
            <button onClick={() => { setVoiding(true); setReason(""); }} className={btn.danger}>
              ابطال وام
            </button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {l.status === "SETTLED" && <Badge tone="green">تسویه شد</Badge>}
        {l.status === "VOID" && <Badge tone="red">باطل: {l.voidReason}</Badge>}
        {l.voucherId && (
          <Link href={`/admin/accounting/vouchers/${l.voucherId}`} className="font-bold text-blue-600 hover:underline">
            سند دریافت وام ←
          </Link>
        )}
        {l.treasury && <span className="text-gray-500">واریز به {l.treasury.name}</span>}
        {BigInt(l.upfrontFee) > 0n && <span className="text-gray-500">کارمزد اول کار {formatAmount(l.upfrontFee)}</span>}
        {l.rateBp > 0 && <span className="text-gray-500">نرخ {faNum(l.rateBp / 100)}٪</span>}
        {l.note && <span className="text-gray-500">{l.note}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="اصل وام" value={formatAmount(l.principal)} />
        <Stat label="مانده‌ی اصل" value={formatAmount(s.remaining)} sub={`سود باقی‌مانده ${formatAmount(s.remainingInterest)}`} />
        <Stat label="پرداخت‌شده" value={formatAmount(s.paidTotal)} sub={`${faNum(s.paidCount)} از ${faNum(s.count)} قسط`} />
        <Stat label="قسط معوق" value={faNum(s.overdue)} tone={s.overdue ? "red" : "gray"} />
      </div>
      <ErrorText>{error}</ErrorText>

      <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
        {l.items.map((it) => {
          const total = BigInt(it.principal) + BigInt(it.interest) + BigInt(it.penalty);
          const overdue = !it.paidAt && l.status === "ACTIVE" && new Date(it.dueDate).getTime() < new Date(data.today).getTime();
          return (
            <div key={it.id} id={`i${it.seq}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-xs">
              <span className="font-black tabular-nums w-6">{faNum(it.seq)}</span>
              <span className="font-bold tabular-nums">{day(it.dueDate)}</span>
              {it.paidAt ? <Badge tone="green">پرداخت {day(it.paidAt)}</Badge> : overdue ? <Badge tone="red">معوق</Badge> : null}
              <span className="text-gray-500">
                اصل {formatAmount(it.principal)} · سود {formatAmount(it.interest)}
                {BigInt(it.penalty) > 0n ? ` · جریمه ${formatAmount(it.penalty)}` : ""}
              </span>
              <span className="mr-auto font-black tabular-nums text-sm">{formatAmount(total)}</span>
              {it.voucherId && (
                <Link href={`/admin/accounting/vouchers/${it.voucherId}`} className="text-blue-600 hover:underline">
                  سند
                </Link>
              )}
              {active && !it.paidAt && (
                <button onClick={() => openPay(it)} className={btn.small}>
                  پرداخت
                </button>
              )}
              {canAct && it.paidAt && (
                <button
                  onClick={() => {
                    if (window.confirm("پرداخت این قسط برگردد؟ سندش باطل می‌شود.")) post({ action: "unpay", seq: it.seq });
                  }}
                  disabled={busy}
                  className={btn.small}
                >
                  برگشت
                </button>
              )}
            </div>
          );
        })}
      </Card>

      <Sheet
        open={!!paying}
        onClose={() => setPaying(null)}
        title={`پرداخت قسط ${faNum(paying?.seq ?? 0)}`}
        footer={
          <button
            disabled={busy || !treasuryId}
            onClick={async () => {
              if (paying && (await post({ action: "pay", seq: paying.seq, date, treasuryId, penalty: penalty || "0" }))) setPaying(null);
            }}
            className={`${btn.primary} w-full`}
          >
            {busy ? "در حال ثبت…" : `ثبت پرداخت ${paying ? formatAmount(BigInt(paying.principal) + BigInt(paying.interest) + BigInt(penalty || "0")) : ""}`}
          </button>
        }
      >
        <div className="space-y-3">
          <Field label="تاریخ پرداخت">
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>
          <Field label="پرداخت از">
            <select value={treasuryId} onChange={(e) => setTreasuryId(e.target.value)} className={inputCls}>
              <option value="">— انتخاب حساب —</option>
              {treasuries.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="جریمه‌ی دیرکرد (اختیاری)">
            <AmountInput value={penalty} onChange={setPenalty} />
          </Field>
          <ErrorText>{error}</ErrorText>
        </div>
      </Sheet>

      <Sheet
        open={voiding}
        onClose={() => setVoiding(false)}
        title="ابطال وام"
        footer={
          <button
            disabled={busy || !reason.trim()}
            onClick={async () => {
              if (await post({ action: "void", reason })) setVoiding(false);
            }}
            className={`${btn.danger} w-full`}
          >
            ابطال و باطل کردن سند دریافت
          </button>
        }
      >
        <Field label="دلیل ابطال">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </Field>
      </Sheet>
    </div>
  );
}
