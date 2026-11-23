"use client";

/**
 * پنجره‌ی پرداخت صندوق — نقد، کارتخوان (با انتخاب دستگاه)، کارت به کارت یا ترکیبی؛ باقی پول مشتری درشت.
 * مبلغ کارت و کارت به کارت را می‌نویسید، نقد «باقی» است (سرور حساب می‌کند). Enter = ثبت و چاپ.
 * اعتبار کارت اشتراک خودکار کم می‌شود (تا سقف مبلغ)؛ «استفاده نشود» برش می‌دارد.
 * مرجوعی بیشتر از خرید ← همین پنجره برای «پس دادن» (نقد یا برگشت به کارت).
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Banknote, Building2, CreditCard, Printer, X } from "lucide-react";
import { api } from "../ui";
import { amountToWords } from "@/lib/accounting/money";
import { B, BigAmount, Kbd, abs, formatAmount, local } from "./shared";

export interface PayResult {
  card: bigint;
  /** کارتخوانی که کشیده شد */
  cardTreasuryId: string | null;
  /** کارت به کارت */
  transfer: bigint;
  transferTreasuryId: string | null;
  transferRef: string | null;
  /** اقساط سازمانی (docs/plans/org-installments.md) */
  org: { orgId: string; amount: bigint; employeeCode: string | null; letterNo: string | null } | null;
  /** null = باقی نقد (`"rest"`) */
  cash: bigint | null;
  /** از اعتبار کارت اشتراک */
  club: bigint;
  tendered: bigint | null;
}

export interface PayReader {
  id: string;
  name: string;
}
export interface PayOrg {
  id: string;
  name: string;
  months: number;
  commissionBp: number;
  requireRef: boolean;
  color: string | null;
  capPerCustomer: string | null;
}
interface OrgQuote {
  commission: string;
  net: string;
  monthly: string;
  schedule: { seq: number; dueDate: string; amount: string }[];
  cap: { limit: string | null; used: string; available: string | null };
  problems: string[];
}

export interface PayTransfer {
  id: string;
  name: string;
  bankName: string | null;
  cardNo: string | null;
}

const cardFmt = (c: string) => c.replace(/(\d{4})(?=\d)/g, "$1 - ");

const QUICK = [50_000n, 100_000n, 200_000n, 500_000n, 1_000_000n];

export default function PaySheet({
  net,
  exact,
  hasCard,
  readers = [],
  transfers = [],
  orgs = [],
  partyId = null,
  terminalId = "",
  canCredit,
  clubCredit = null,
  giftPaid = 0n,
  start,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  /** + مشتری می‌دهد، − پس می‌گیرد */
  net: bigint;
  /** جمع دقیق است (برای مرجوعی از پیش‌نمایش سرور) */
  exact: boolean;
  hasCard: boolean;
  /** کارتخوان‌های صندوق (اولی پیش‌فرض) */
  readers?: PayReader[];
  /** حساب‌های کارت به کارت */
  transfers?: PayTransfer[];
  /** سازمان‌های اقساط فعال */
  orgs?: PayOrg[];
  /** مشتری رسید (اقساط سازمانی بی مشتری نمی‌شود) */
  partyId?: string | null;
  /** برای به یاد سپردن آخرین کارتخوان روی همین دستگاه */
  terminalId?: string;
  /** مشتری انتخاب شده — بخشی نسیه ممکن است */
  canCredit: boolean;
  /** اعتبار قابل خرج کارت اشتراک مشتری؛ null = ندارد */
  clubCredit?: bigint | null;
  /** بخشی که با بن کارت اسکن‌شده پرداخت می‌شود (از `net` کم شده) */
  giftPaid?: bigint;
  /** `credit` = ثبت بدهکار: همه روی حساب مشتری */
  start: "cash" | "card" | "transfer" | "credit" | "org";
  busy: boolean;
  error: string | null;
  onSubmit: (r: PayResult) => void;
  onClose: () => void;
}) {
  const refund = net < 0n;
  const due = abs(net);
  const clubMax = clubCredit && !refund ? (clubCredit < due ? clubCredit : due) : 0n;
  // اعتبار کارت اشتراک خودکار کم می‌شود؛ بقیه‌ی روش‌ها روی «باقی»
  const [club, setClub] = useState(clubMax > 0n && start !== "credit" ? clubMax.toString() : "");
  const afterClub = due - (clubMax > 0n ? clubMax : 0n);
  const canTransfer = !refund && transfers.length > 0;
  const [card, setCard] = useState(start === "card" && hasCard ? afterClub.toString() : "");
  const [transfer, setTransfer] = useState(start === "transfer" && canTransfer ? afterClub.toString() : "");
  const [reader, setReader] = useState(() => {
    const saved = local.get<string>(`pos:reader:${terminalId}`, "");
    return readers.some((r) => r.id === saved) ? saved : readers[0]?.id ?? null;
  });
  const [account, setAccount] = useState(transfers[0]?.id ?? null);
  const [ref, setRef] = useState("");
  const [tendered, setTendered] = useState("");
  const [credit, setCredit] = useState(start === "credit" && canCredit && !refund);
  const [cashManual, setCashManual] = useState(start === "credit" ? "0" : "");
  // اقساط سازمانی
  const canOrg = !refund && orgs.length > 0;
  const [orgId, setOrgId] = useState<string | null>(start === "org" && orgs.length === 1 ? orgs[0].id : null);
  const [orgAmt, setOrgAmt] = useState(start === "org" ? afterClub.toString() : "");
  const [empCode, setEmpCode] = useState("");
  const [letterNo, setLetterNo] = useState("");
  const [quote, setQuote] = useState<{ key: string; q: OrgQuote | null; error?: string } | null>(null);
  const org = orgs.find((o) => o.id === orgId) ?? null;
  const orgB = canOrg && org ? B(orgAmt) : 0n;
  const quoteKey = `${orgId}:${partyId}:${orgB}`;
  useEffect(() => {
    if (!orgId || orgB <= 0n) return;
    let live = true;
    const t = setTimeout(() => {
      api<{ quote: OrgQuote }>(`/api/admin/accounting/installment-orgs/quote?orgId=${orgId}&partyId=${partyId ?? ""}&amount=${orgB}`)
        .then((r) => live && setQuote({ key: `${orgId}:${partyId}:${orgB}`, q: r.quote }))
        .catch((e) => live && setQuote({ key: `${orgId}:${partyId}:${orgB}`, q: null, error: e instanceof Error ? e.message : "برآورد نشد" }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [orgId, partyId, orgB]);
  const oq = quote?.key === quoteKey ? quote : null;
  const orgProblem = org && orgB > 0n
    ? !partyId
      ? "برای اقساط اول مشتری (کارمند معرفی‌شده) را انتخاب کنید"
      : org.requireRef && !empCode.trim() && !letterNo.trim()
        ? "کد پرسنلی یا شماره‌ی معرفی‌نامه را بنویسید"
        : oq?.error ?? oq?.q?.problems[0] ?? null
    : null;
  const orgPending = !!org && orgB > 0n && !oq;

  const cardB = B(card);
  const transferB = canTransfer ? B(transfer) : 0n;
  const clubB = refund ? 0n : B(club);
  const paidOther = cardB + clubB + transferB + orgB;
  const cash = credit ? B(cashManual) : due > paidOther ? due - paidOther : 0n;
  const tenderedB = B(tendered);
  const change = !refund && tenderedB > cash ? tenderedB - cash : 0n;
  const short = !refund && tenderedB > 0n && tenderedB < cash;
  const over = paidOther > due || clubB > clubMax;
  const left = credit ? due - paidOther - cash : 0n;
  const allCredit = credit && left === due;
  function setAllCredit() {
    setCard("");
    setTransfer("");
    setClub("");
    setTendered("");
    setCashManual("0");
    setCredit(true);
  }
  const rest = (without: bigint) => (due - clubB - without > 0n ? due - clubB - without : 0n);

  const quick = useMemo(() => {
    if (refund || cash <= 0n) return [];
    const ups = QUICK.map((q) => ((cash + q - 1n) / q) * q).filter((v) => v > cash);
    return [...new Set(ups.map(String))].slice(0, 4).map(BigInt);
  }, [cash, refund]);

  function submit() {
    if (busy || over || short || (credit && left < 0n) || orgProblem || orgPending) return;
    if (cardB > 0n && reader) local.set(`pos:reader:${terminalId}`, reader);
    onSubmit({
      card: cardB,
      cardTreasuryId: cardB > 0n ? reader : null,
      transfer: transferB,
      transferTreasuryId: transferB > 0n ? account : null,
      transferRef: transferB > 0n && ref.trim() ? ref.trim() : null,
      org: orgB > 0n && org ? { orgId: org.id, amount: orgB, employeeCode: empCode.trim() || null, letterNo: letterNo.trim() || null } : null,
      cash: credit ? cash : null,
      club: clubB,
      tendered: tenderedB > 0n ? tenderedB : null,
    });
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && !(e.target as HTMLElement).closest("button")) {
        e.preventDefault();
        submit();
      } else if (e.key === "F10" && hasCard) {
        e.preventDefault();
        setTransfer("");
        setCard(rest(0n).toString());
      } else if (e.key === "F9") {
        e.preventDefault();
        setCard("");
        setTransfer("");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        <div className={`px-6 pb-5 pt-5 text-white ${refund ? "bg-gradient-to-br from-rose-500 to-rose-700" : allCredit ? "bg-gradient-to-br from-orange-500 to-orange-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold opacity-90">{refund ? "پس دادن به مشتری" : allCredit ? "ثبت بدهکار — همه روی حساب مشتری" : "مبلغ قابل پرداخت"}</p>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="بستن">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
            {!exact && "≈ "}
            {formatAmount(due)}
            <span className="mr-2 text-base font-bold opacity-80">تومان</span>
          </p>
          {due > 0n && <p className="mt-1 text-[11px] opacity-80">{amountToWords(due)} تومان</p>}
          {giftPaid > 0n && <p className="mt-1 text-xs font-bold opacity-90">{formatAmount(giftPaid)} تومان با بن کارت پرداخت شد؛ این مبلغ باقی است</p>}
        </div>

        <div className="space-y-4 p-5">
          {due > 0n && (
            <>
              <div className={`grid gap-2 ${canTransfer ? "grid-cols-3" : "grid-cols-2"}`}>
                <button
                  onClick={() => {
                    setCard("");
                    setTransfer("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition ${cardB === 0n && transferB === 0n ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                >
                  <Banknote className="h-5 w-5" aria-hidden /> همه نقد <Kbd>F9</Kbd>
                </button>
                <button
                  disabled={!hasCard}
                  onClick={() => {
                    setTransfer("");
                    setCard(rest(0n).toString());
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition disabled:opacity-40 ${cardB > 0n && cardB === rest(transferB) ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                >
                  <CreditCard className="h-5 w-5" aria-hidden /> {refund ? "برگشت به کارت" : "کارتخوان"} <Kbd>F10</Kbd>
                </button>
                {canOrg && (
                  <button
                    onClick={() => {
                      setCard("");
                      setTransfer("");
                      setClub("");
                      setOrgAmt(due.toString());
                      if (!orgId && orgs.length === 1) setOrgId(orgs[0].id);
                    }}
                    className={`col-span-full flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition ${orgB > 0n ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                  >
                    <Building2 className="h-5 w-5" aria-hidden /> اقساط سازمانی
                  </button>
                )}
                {canTransfer && (
                  <button
                    onClick={() => {
                      setCard("");
                      setTransfer(rest(0n).toString());
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition ${transferB > 0n && transferB === rest(cardB) ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                  >
                    <ArrowLeftRight className="h-5 w-5" aria-hidden /> کارت به کارت
                  </button>
                )}
              </div>

              {canOrg && (orgB > 0n || start === "org" || orgAmt !== "") && (
                <div className="space-y-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                  <div className="flex flex-wrap gap-1.5">
                    {orgs.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setOrgId(o.id)}
                        className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black transition ${orgId === o.id ? "bg-white dark:bg-white/10" : "border-transparent bg-white/50 dark:bg-white/[0.03]"}`}
                        style={orgId === o.id ? { borderColor: o.color ?? "#4f46e5", color: o.color ?? "#4f46e5" } : undefined}
                      >
                        {o.name}
                        <span className="mr-1 text-[10px] font-bold opacity-70">
                          {o.months} قسط{o.commissionBp ? ` · ${o.commissionBp / 100}٪` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                  {org && (
                    <>
                      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                        <div>
                          <p className="mb-1 text-xs font-bold text-indigo-900 dark:text-indigo-200">مبلغ اقساطی — باقی نقد یا کارت</p>
                          <BigAmount value={orgAmt} onChange={setOrgAmt} onEnter={submit} autoFocus={start === "org"} />
                        </div>
                        <button onClick={() => (setOrgAmt(""), setOrgId(null))} className="mb-1 rounded-lg px-2 py-1 text-xs font-bold text-gray-500">
                          برداشتن
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={empCode} onChange={(e) => setEmpCode(e.target.value)} placeholder={`کد پرسنلی${org.requireRef ? "" : " (اختیاری)"}`} className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5" />
                        <input value={letterNo} onChange={(e) => setLetterNo(e.target.value)} placeholder="شماره‌ی معرفی‌نامه" className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5" />
                      </div>
                      {oq?.q && orgB > 0n && (
                        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-2 text-center dark:bg-white/5">
                          <div>
                            <p className="text-[10px] font-bold text-gray-500">{org.months} قسط ماهانه</p>
                            <p className="text-base font-black tabular-nums text-indigo-700 dark:text-indigo-300">{formatAmount(B(oq.q.monthly))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500">پورسانت سازمان</p>
                            <p className="text-sm font-black tabular-nums text-amber-600">{formatAmount(B(oq.q.commission))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500">باقی سقف مشتری</p>
                            <p className="text-sm font-black tabular-nums">{oq.q.cap.available === null ? "بی‌سقف" : formatAmount(B(oq.q.cap.available))}</p>
                          </div>
                        </div>
                      )}
                      {orgProblem && <p className="text-xs font-bold text-red-600">{orgProblem}</p>}
                    </>
                  )}
                  {!org && <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">سازمان طرف قرارداد مشتری را انتخاب کنید.</p>}
                </div>
              )}

              {clubMax > 0n && (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                    <span>
                      کارت اشتراک — اعتبار {formatAmount(clubCredit ?? 0n)} تومان
                      {clubB > 0n && <span className="block text-[11px] font-bold opacity-80">مانده‌ی کارت بعد از این خرید: {formatAmount((clubCredit ?? 0n) - clubB)} تومان (شارژ همین خرید جدا اضافه می‌شود)</span>}
                    </span>
                    <button onClick={() => setClub(clubB > 0n ? "" : clubMax.toString())} className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-1 font-black">
                      {clubB > 0n ? "استفاده نشود" : "کم کردن از کارت"}
                    </button>
                  </div>
                  {clubB > 0n && (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-amber-800 dark:text-amber-200">از کارت کم می‌شود</span>
                      <BigAmount value={club} onChange={setClub} onEnter={submit} className="w-48" />
                    </div>
                  )}
                  {clubB > clubMax && <p className="mt-1 text-xs font-bold text-red-600">بیشتر از اعتبار یا مبلغ قابل پرداخت است</p>}
                </div>
              )}

              {hasCard && (
                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-500">{refund ? "مبلغ برگشت به کارت" : "مبلغ کارتخوان"} — باقی نقد</p>
                  <BigAmount value={card} onChange={setCard} onEnter={submit} autoFocus={start === "card"} />
                  {readers.length > 1 && cardB > 0n && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="self-center text-[11px] font-bold text-gray-500">با کدام دستگاه؟</span>
                      {readers.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setReader(r.id)}
                          className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black transition ${reader === r.id ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {over && <p className="mt-1 text-xs font-bold text-red-600">از مبلغ کل بیشتر است</p>}
                </div>
              )}

              {canTransfer && (transferB > 0n || start === "transfer") && (
                <div className="rounded-2xl bg-violet-50 p-3 dark:bg-violet-500/10">
                  <p className="mb-1.5 text-xs font-bold text-violet-800 dark:text-violet-200">مبلغ کارت به کارت</p>
                  <BigAmount value={transfer} onChange={setTransfer} onEnter={submit} autoFocus={start === "transfer"} />
                  <div className="mt-2 space-y-1.5">
                    {transfers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setAccount(t.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-right transition ${account === t.id ? "border-violet-500 bg-white dark:bg-white/5" : "border-transparent bg-white/60 dark:bg-white/[0.03]"}`}
                      >
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                          {t.name}
                          {t.bankName ? ` · ${t.bankName}` : ""}
                        </span>
                        {t.cardNo && (
                          <span className="text-lg font-black tabular-nums tracking-wider text-gray-900 dark:text-white" dir="ltr">
                            {cardFmt(t.cardNo)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <input
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="شماره پیگیری یا ۴ رقم آخر کارت مشتری (اختیاری)"
                    inputMode="numeric"
                    className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5"
                  />
                  <p className="mt-1 text-[11px] text-violet-700/80 dark:text-violet-300/80">پیش از ثبت، پیامک واریز یا رسید انتقال را روی گوشی مشتری ببینید.</p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{refund ? "پس دادن نقد" : "نقد"}</span>
                {credit ? (
                  <BigAmount value={cashManual} onChange={setCashManual} className="w-56" />
                ) : (
                  <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{formatAmount(cash)}</span>
                )}
              </div>

              {!refund && cash > 0n && !credit && (
                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-500">پول دریافتی از مشتری (برای باقی پول — اختیاری)</p>
                  <BigAmount value={tendered} onChange={setTendered} onEnter={submit} autoFocus={start === "cash"} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button onClick={() => setTendered(cash.toString())} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 dark:bg-white/5 dark:text-gray-200">
                      همان مبلغ
                    </button>
                    {quick.map((q) => (
                      <button key={String(q)} onClick={() => setTendered(q.toString())} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black tabular-nums text-gray-700 dark:bg-white/5 dark:text-gray-200">
                        {formatAmount(q)}
                      </button>
                    ))}
                  </div>
                  {change > 0n && (
                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
                      <span className="text-sm font-black text-amber-700 dark:text-amber-300">باقی پول مشتری</span>
                      <span className="text-3xl font-black tabular-nums text-amber-700 dark:text-amber-300">{formatAmount(change)}</span>
                    </div>
                  )}
                  {short && <p className="mt-1 text-xs font-bold text-red-600">پول دریافتی کمتر از مبلغ نقد است</p>}
                </div>
              )}

              {canCredit && (
                <div className="space-y-2">
                  {!refund && (
                    <button
                      onClick={() => (allCredit ? (setCredit(false), setCashManual("")) : setAllCredit())}
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-2.5 text-sm font-black transition ${allCredit ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "border-dashed border-orange-300 text-orange-700 dark:border-orange-500/30 dark:text-orange-300"}`}
                    >
                      {allCredit ? "✓ همه‌ی مبلغ بدهی مشتری می‌شود (برداشتن)" : "ثبت بدهکار — همه نسیه، پرداخت بعداً"}
                    </button>
                  )}
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                    {refund ? "بخشی پس داده نشود و روی حساب مشتری بماند" : "بخشی نسیه روی حساب مشتری"}
                    {credit && <span className="mr-auto tabular-nums">{refund ? "روی حساب" : "نسیه"}: {formatAmount(left > 0n ? left : 0n)}</span>}
                  </label>
                  {credit && !refund && left > 0n && <p className="text-[11px] font-bold text-orange-700 dark:text-orange-300">رسید با امضای مشتری چاپ می‌شود؛ پرداخت بعدی در «دریافت» حسابداری به نام همین مشتری ثبت شود.</p>}
                </div>
              )}
            </>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || over || short || (credit && left < 0n) || !!orgProblem || orgPending}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-black text-white shadow-lg transition active:scale-[0.99] disabled:opacity-50 ${refund ? "bg-rose-600 shadow-rose-600/25" : allCredit ? "bg-orange-600 shadow-orange-600/25" : "bg-emerald-600 shadow-emerald-600/25"}`}
          >
            <Printer className="h-5 w-5" aria-hidden />
            {busy ? "در حال ثبت…" : due === 0n ? "ثبت تعویض" : refund ? "پس دادن و چاپ رسید" : allCredit ? "ثبت بدهکار و چاپ رسید" : "ثبت و چاپ رسید"}
            <Kbd>Enter</Kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
