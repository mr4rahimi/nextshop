"use client";

/**
 * باز کردن صندوق، خلاصه‌ی شیفت و «بستن صندوق» (در وب حساب «صفر کردن صندوق»).
 * docs/plans/inventory-items.md بخش ۱۳.
 */

import { useCallback, useEffect, useState } from "react";
import { Calculator, Lock, Unlock } from "lucide-react";
import { api } from "../ui";
import { B, BigAmount, CashCounter, abs, faNum, formatAmount, local, timeFa, type ShiftSummary } from "./shared";

export function OpenShift({
  terminalName,
  suggested,
  onOpen,
  busy,
  error,
}: {
  terminalName: string;
  suggested: bigint;
  onOpen: (float: bigint) => void;
  busy: boolean;
  error: string | null;
}) {
  const [amount, setAmount] = useState(suggested > 0n ? suggested.toString() : "");
  const [count, setCount] = useState(false);
  const onTotal = useCallback((v: bigint) => setAmount(v > 0n ? v.toString() : ""), []);
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 shadow-[var(--adm-shadow-lg)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-600/30">
          <Unlock className="h-8 w-8" aria-hidden />
        </div>
        <h2 className="text-center text-xl font-black text-gray-900 dark:text-white">باز کردن {terminalName}</h2>
        <p className="mt-1 text-center text-xs leading-6 text-gray-500">پول خرد داخل صندوق را بشمارید و بنویسید.</p>
        <div className="mt-5 space-y-3">
          {count ? <CashCounter onTotal={onTotal} /> : <BigAmount value={amount} onChange={setAmount} autoFocus onEnter={() => onOpen(B(amount))} />}
          <button onClick={() => setCount((c) => !c)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
            <Calculator className="h-3.5 w-3.5" aria-hidden /> {count ? "نوشتن مبلغ" : "شمارش اسکناس"}
          </button>
          {suggested > 0n && B(amount) !== suggested && (
            <p className="text-[11px] font-bold text-amber-600">مانده‌ی دفتری صندوق {formatAmount(suggested)} تومان است؛ اختلاف هنگام بستن صندوق دیده می‌شود.</p>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}
          <button
            onClick={() => onOpen(B(amount))}
            disabled={busy}
            className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "…" : "باز کردن صندوق"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: bigint | string; strong?: boolean; tone?: "red" | "green" | "gray" }) {
  const v = B(value);
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : "text-gray-900 dark:text-white";
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? "border-t border-gray-100 pt-2.5 dark:border-white/10" : ""}`}>
      <span className={`text-xs ${strong ? "font-black text-gray-800 dark:text-gray-100" : "font-bold text-gray-500"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-black" : "text-sm font-bold"} ${color}`}>{formatAmount(v)}</span>
    </div>
  );
}

/** جدول خلاصه — هم صفحه‌ی صندوق، هم صفحه‌ی شیفت و برگه‌ی چاپ */
export function ShiftReport({ s, names }: { s: ShiftSummary; names?: Record<string, string> }) {
  const closed = s.shift.status === "CLOSED";
  const diff = B(s.shift.cashDiff);
  const cardDiff = s.shift.countedCard !== null ? B(s.shift.countedCard) - B(s.expectedCard) : null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-gray-400">فروش</p>
        <Row label={`فروش (${faNum(s.counts.sale + s.counts.exchange)} رسید، ${faNum(s.saleQty)} عدد)`} value={s.saleTotal} />
        <Row label={`مرجوعی (${faNum(s.counts.ret + s.counts.exchange)} رسید، ${faNum(s.returnQty)} عدد)`} value={s.returnTotal} tone="red" />
        <Row label="تخفیف‌ها (داخل فروش)" value={s.discount} tone="gray" />
        <Row label="فروش خالص" value={s.net} strong />
        {s.sellers.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-black text-gray-400">فروشنده‌ها</p>
            {s.sellers.map((x) => (
              <div key={x.sellerId ?? "-"} className="flex items-center justify-between py-1 text-xs">
                <span className="font-bold text-gray-600 dark:text-gray-300">
                  {x.name} <span className="text-gray-400">· {faNum(x.tickets)} رسید · {faNum(x.qty)} عدد</span>
                </span>
                <span className="font-black tabular-nums">{formatAmount(x.net)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-gray-400">صندوق نقد</p>
        <Row label="مانده‌ی اول شیفت (دفتری)" value={s.shift.openingBook} />
        <Row label="دریافت نقد" value={s.cashIn} tone="green" />
        <Row label="پس‌داده‌ی نقد" value={s.cashOut} tone="red" />
        {B(s.otherCash) !== 0n && <Row label="گردش‌های دیگر صندوق (هزینه، انتقال…)" value={s.otherCash} />}
        <Row label="نقد مورد انتظار" value={s.expectedCash} strong />
        {closed && (
          <>
            <Row label="شمرده‌شده" value={s.shift.countedCash ?? "0"} />
            <Row label={diff === 0n ? "مغایرت" : diff < 0n ? "کسری" : "اضافه"} value={abs(diff)} tone={diff === 0n ? "gray" : diff < 0n ? "red" : "green"} />
            <Row label={`انتقال${s.shift.transferToId && names?.[s.shift.transferToId] ? ` به ${names[s.shift.transferToId]}` : ""}`} value={s.shift.transferred ?? "0"} />
            <Row label="پول خرد ماندنی" value={s.shift.keptFloat ?? "0"} />
          </>
        )}
        <p className="mb-1 mt-3 text-[11px] font-black uppercase tracking-wide text-gray-400">کارتخوان</p>
        <Row label="دریافت کارتی" value={s.cardIn} tone="green" />
        {B(s.cardOut) > 0n && <Row label="برگشت به کارت" value={s.cardOut} tone="red" />}
        <Row label="خالص کارتخوان" value={s.expectedCard} strong />
        {cardDiff !== null && <Row label={`رسید پایان روز دستگاه${cardDiff !== 0n ? " — اختلاف " + formatAmount(abs(cardDiff)) : ""}`} value={s.shift.countedCard ?? "0"} tone={cardDiff === 0n ? "gray" : "red"} />}
        {B(s.credit) !== 0n && <Row label="نسیه / روی حساب مشتری" value={s.credit} />}
      </div>
    </div>
  );
}

export function CloseShift({ shiftId, onClosed, onCancel }: { shiftId: string; onClosed: (shiftId: string) => void; onCancel?: () => void }) {
  const [s, setS] = useState<(ShiftSummary & { targets: { id: string; name: string; kind: string }[]; can: { manage: boolean } }) | null>(null);
  const [counted, setCounted] = useState("");
  const [card, setCard] = useState("");
  const [keep, setKeep] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [count, setCount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTotal = useCallback((v: bigint) => setCounted(v > 0n ? v.toString() : ""), []);

  useEffect(() => {
    api<NonNullable<typeof s>>(`/api/admin/accounting/pos/shifts/${shiftId}`)
      .then((d) => {
        setS(d);
        setKeep(d.shift.openingFloat !== "0" ? d.shift.openingFloat : "");
        const last = local.get<string>("pos:transferTo", "");
        setTo(d.targets.some((t) => t.id === last) ? last : d.targets[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, [shiftId]);

  if (!s) return <p className="p-6 text-sm text-gray-400">{error ?? "در حال بارگذاری…"}</p>;
  const countedB = B(counted);
  const diff = counted === "" ? null : countedB - B(s.expectedCash);
  const transfer = countedB - B(keep);

  async function close() {
    setBusy(true);
    setError(null);
    try {
      local.set("pos:transferTo", to);
      await api(`/api/admin/accounting/pos/shifts/${shiftId}`, {
        method: "POST",
        json: { countedCash: counted || "0", countedCard: card === "" ? null : card, keepFloat: keep || "0", transferToId: transfer > 0n ? to : null, note },
      });
      onClosed(shiftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "بسته نشد");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ShiftReport s={s} />
      <div className="grid gap-4 rounded-2xl bg-gray-50 p-4 md:grid-cols-2 dark:bg-white/[0.03]">
        <div className="space-y-2">
          <p className="text-xs font-black text-gray-700 dark:text-gray-200">پول نقد شمرده‌شده‌ی صندوق</p>
          {count ? <CashCounter onTotal={onTotal} /> : <BigAmount value={counted} onChange={setCounted} autoFocus />}
          <button onClick={() => setCount((c) => !c)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
            <Calculator className="h-3.5 w-3.5" aria-hidden /> {count ? "نوشتن مبلغ" : "شمارش اسکناس"}
          </button>
          {diff !== null && (
            <p className={`rounded-xl px-3 py-2 text-sm font-black ${diff === 0n ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" : diff < 0n ? "bg-red-50 text-red-700 dark:bg-red-500/10" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10"}`}>
              {diff === 0n ? "✓ بی‌مغایرت" : `${diff < 0n ? "کسری" : "اضافه"} ${formatAmount(abs(diff))} تومان`}
              {diff !== 0n && !s.can.manage && <span className="block text-[11px] font-bold">دوباره بشمارید؛ بستن با مغایرت با مدیر صندوق است.</span>}
            </p>
          )}
        </div>
        <div className="space-y-3">
          {s.shift.terminal.cardTreasuryId && (
            <label className="block">
              <span className="mb-1 block text-xs font-black text-gray-700 dark:text-gray-200">جمع رسید پایان روز کارتخوان (اختیاری)</span>
              <BigAmount value={card} onChange={setCard} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-black text-gray-700 dark:text-gray-200">پول خرد که برای فردا در صندوق می‌ماند</span>
            <BigAmount value={keep} onChange={setKeep} />
          </label>
          {transfer > 0n && (
            <label className="block">
              <span className="mb-1 block text-xs font-black text-gray-700 dark:text-gray-200">انتقال {formatAmount(transfer)} تومان به</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-white/10 dark:bg-white/5">
                {s.targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت (اختیاری)" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5" />
        </div>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="rounded-2xl bg-gray-100 px-5 py-3.5 text-sm font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">
            انصراف
          </button>
        )}
        <button
          onClick={close}
          disabled={busy || counted === "" || B(keep) > countedB || (diff !== 0n && !s.can.manage)}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3.5 text-base font-black text-white disabled:opacity-40 dark:bg-white dark:text-gray-900"
        >
          <Lock className="h-5 w-5" aria-hidden /> {busy ? "در حال بستن…" : "بستن صندوق و چاپ گزارش"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        شیفت {faNum(s.shift.number)} · باز از {timeFa(s.shift.openedAt)} توسط {s.shift.openedByName}
      </p>
    </div>
  );
}
