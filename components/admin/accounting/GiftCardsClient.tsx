"use client";

/**
 * بن کارت فروشگاه — docs/plans/webhesab-parity.md بخش ۲۷.
 * فهرست و مانده، فروش (صدور) تکی یا گروهی، مرجوع بن خرج‌نشده، سوخت منقضی‌ها و گردش هر بن.
 * خرج بن در صندوق است: شماره‌ی بن را در کادر اسکن صندوق بزنید.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import AmountInput from "./AmountInput";
import PartyPicker, { type PartyOption } from "./PartyPicker";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet, Stat } from "./ui";

interface Gift {
  id: string;
  number: string;
  batch: string | null;
  amount: string;
  balance: string;
  saleDiscount: string;
  minInvoice: string;
  singleUse: boolean;
  expiresAt: string | null;
  status: "ACTIVE" | "CLOSED" | "RETURNED";
  createdAt: string;
  buyer: { id: string; name: string } | null;
}
interface Data {
  rows: Gift[];
  total: number;
  page: number;
  outstanding: { count: number; amount: string };
  expired: { count: number; amount: string };
  batches: { batch: string; count: number; amount: string; balance: string; createdAt: string }[];
  treasuries: { id: string; name: string; kind: string }[];
  can: { manage: boolean };
}
type Status = "" | "active" | "expired" | "closed" | "returned";

const KIND_LABEL: Record<string, string> = { ISSUE: "فروش", SPEND: "خرج در صندوق", RESTORE: "برگشت از مرجوعی", RETURN: "مرجوع به خریدار", FORFEIT: "سوخت" };

function statusOf(g: Gift) {
  if (g.status === "RETURNED") return <Badge tone="gray">مرجوع شده</Badge>;
  if (g.status === "CLOSED") return <Badge tone="gray">تمام شده</Badge>;
  if (g.expiresAt && new Date(g.expiresAt) < new Date(new Date().toISOString().slice(0, 10))) return <Badge tone="red">منقضی</Badge>;
  return <Badge tone="green">فعال</Badge>;
}

function downloadNumbers(name: string, numbers: string[], amount: string) {
  const text = "﻿" + [["شماره", "مبلغ"], ...numbers.map((n) => [n, amount])].map((r) => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `gift-cards-${name || "batch"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GiftCardsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [batch, setBatch] = useState("");
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState<null | "issue" | "return">(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (batch) p.set("batch", batch);
    api<Data>(`/api/admin/accounting/gift-cards?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [q, status, batch, page]);
  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  async function forfeit() {
    if (!data || !window.confirm(`مانده‌ی ${faNum(data.expired.count)} بن منقضی (${formatAmount(data.expired.amount)} تومان) سوخت شود و به «سایر درآمدها» برود؟`)) return;
    setBusy(true);
    try {
      const r = await api<{ count: number; amount: string }>("/api/admin/accounting/gift-cards", { method: "POST", json: { action: "forfeit" } });
      setNotice(`مانده‌ی ${faNum(r.count)} بن منقضی (${formatAmount(r.amount)} تومان) سوخت شد`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const actions = data?.can.manage && (
    <>
      <button onClick={() => setSheet("issue")} className={btn.primary}>
        ➕ فروش بن
      </button>
      <button onClick={() => setSheet("return")} className={btn.soft}>
        ↩️ مرجوع بن
      </button>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="بن کارت"
        help="accountingGiftCards"
        desc="کارت هدیه‌ی فروشگاه با مبلغ از پیش پرداخت‌شده. فروش به شخص یا سازمان، خرج در صندوق با اسکن شماره، مرجوع بن خرج‌نشده."
        actions={actions}
      />
      <ErrorText>{error}</ErrorText>
      {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="مانده‌ی بن‌های فعال (بدهی به دارندگان)" value={formatAmount(data.outstanding.amount)} sub={`${faNum(data.outstanding.count)} بن`} />
          <Stat
            label="منقضی با مانده"
            value={formatAmount(data.expired.amount)}
            tone={data.expired.count ? "red" : "gray"}
            sub={
              data.expired.count && data.can.manage ? (
                <button onClick={forfeit} disabled={busy} className="font-bold text-blue-600 hover:underline">
                  {faNum(data.expired.count)} بن — سوخت مانده
                </button>
              ) : (
                `${faNum(data.expired.count)} بن`
              )
            }
          />
          <Stat label="همه‌ی بن‌ها با این فیلتر" value={faNum(data.total)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chips<Status>
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "همه" },
            { value: "active", label: "فعال" },
            { value: "expired", label: "منقضی" },
            { value: "closed", label: "تمام شده" },
            { value: "returned", label: "مرجوع شده" },
          ]}
        />
        {!!data?.batches.length && (
          <select
            value={batch}
            onChange={(e) => {
              setBatch(e.target.value);
              setPage(1);
            }}
            className={`${inputCls} w-auto`}
            aria-label="دسته"
          >
            <option value="">همه‌ی دسته‌ها</option>
            {data.batches.map((b) => (
              <option key={b.batch} value={b.batch}>
                {b.batch} ({faNum(b.count)})
              </option>
            ))}
          </select>
        )}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="شماره، دسته یا خریدار"
          className={`${inputCls} flex-1 min-w-[10rem]`}
        />
      </div>

      {data && !data.rows.length && <Empty title="بنی پیدا نشد" desc="با «فروش بن» بن تکی یا یک دسته برای سازمان صادر کنید." action={actions} />}
      {!!data?.rows.length && (
        <Card className="divide-y divide-gray-100 overflow-hidden dark:divide-white/5">
          {data.rows.map((g) => (
            <button key={g.id} onClick={() => setDetail(g.number)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-right text-sm hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="font-black tabular-nums" dir="ltr">
                {g.number}
              </span>
              {statusOf(g)}
              {g.singleUse && <Badge tone="amber">یک‌بارمصرف</Badge>}
              <span className="text-xs text-gray-500">
                {g.buyer?.name ?? "فروش نقد"}
                {g.batch && ` · ${g.batch}`}
                {g.expiresAt && ` · تا ${formatJalali(new Date(g.expiresAt))}`}
              </span>
              <span className="mr-auto text-xs text-gray-500">
                مانده <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(g.balance)}</b> از {formatAmount(g.amount)}
              </span>
            </button>
          ))}
        </Card>
      )}
      {data && data.total > 100 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn.soft}>
            قبلی
          </button>
          <span className="tabular-nums">
            صفحه {faNum(page)} از {faNum(Math.ceil(data.total / 100))}
          </span>
          <button disabled={page * 100 >= data.total} onClick={() => setPage(page + 1)} className={btn.soft}>
            بعدی
          </button>
        </div>
      )}

      {sheet === "issue" && data && (
        <IssueSheet
          treasuries={data.treasuries}
          onClose={() => setSheet(null)}
          onDone={(msg) => {
            setNotice(msg);
            setSheet(null);
            load();
          }}
        />
      )}
      {sheet === "return" && (
        <ReturnSheet
          onClose={() => setSheet(null)}
          onDone={(msg) => {
            setNotice(msg);
            setSheet(null);
            load();
          }}
        />
      )}
      {detail && <DetailSheet number={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function IssueSheet({ treasuries, onClose, onDone }: { treasuries: Data["treasuries"]; onClose: () => void; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [count, setCount] = useState("1");
  const [prefix, setPrefix] = useState("GC");
  const [numbers, setNumbers] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [minInvoice, setMinInvoice] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [singleUse, setSingleUse] = useState(false);
  const [buyer, setBuyer] = useState<PartyOption | null>(null);
  const [batch, setBatch] = useState("");
  const [note, setNote] = useState("");
  const [payNow, setPayNow] = useState(true);
  const [treasuryId, setTreasuryId] = useState(treasuries[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = mode === "auto" ? Number(count) || 0 : numbers.split(/[\s,،;]+/).filter(Boolean).length;
  const each = BigInt(amount || "0") - BigInt(discount || "0");
  const total = each > 0n ? each * BigInt(n) : 0n;
  const tr = treasuries.find((t) => t.id === treasuryId);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ count: number; numbers: string[]; total: string; batch: string | null }>("/api/admin/accounting/gift-cards", {
        method: "POST",
        json: {
          action: "issue",
          ...(mode === "auto" ? { count: Number(count), prefix } : { numbers }),
          amount,
          saleDiscount: discount || "0",
          minInvoice: minInvoice || "0",
          expiresAt: expiresAt || null,
          singleUse,
          buyerPartyId: buyer?.id ?? null,
          batch: batch.trim() || null,
          note,
          pay: payNow ? { treasuryId, method: tr?.kind === "POS" ? "POS" : tr?.kind === "BANK" ? "BANK_TRANSFER" : "CASH" } : null,
        },
      });
      if (r.count > 1) downloadNumbers(r.batch ?? "", r.numbers, amount);
      onDone(`${faNum(r.count)} بن صادر شد${r.count === 1 ? `: ${r.numbers[0]}` : " — فایل شماره‌ها دانلود شد"}؛ مبلغ فروش ${formatAmount(r.total)} تومان`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title="فروش بن کارت"
      footer={
        <button onClick={submit} disabled={busy || !n || !amount} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : `صدور ${faNum(n)} بن — ${formatAmount(total)} تومان`}
        </button>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "auto", label: "شماره‌دهی خودکار" },
            { value: "manual", label: "شماره‌های کارت‌های چاپی" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {mode === "auto" ? (
            <>
              <Field label="تعداد بن" hint="حداکثر ۲٬۰۰۰">
                <input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} dir="ltr" />
              </Field>
              <Field label="پیشوند شماره" hint="شماره = پیشوند + ۸ رقم؛ با حرف شروع شود">
                <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} className={inputCls} dir="ltr" />
              </Field>
            </>
          ) : (
            <Field label="شماره‌ها" hint="هر خط یک شماره (از بارکد کارت یا اکسل بچسبانید)" className="sm:col-span-2">
              <textarea value={numbers} onChange={(e) => setNumbers(e.target.value)} rows={4} className={inputCls} dir="ltr" />
            </Field>
          )}
          <Field label="مبلغ هر بن (تومان)">
            <AmountInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="تخفیف فروش هر بن (اختیاری)" hint="مثلاً سازمانی که بن ۱ میلیونی را ۹۰۰ هزار می‌خرد">
            <AmountInput value={discount} onChange={setDiscount} />
          </Field>
          <Field label="حداقل خرید برای استفاده (اختیاری)">
            <AmountInput value={minInvoice} onChange={setMinInvoice} />
          </Field>
          <Field label="اعتبار تا (اختیاری)">
            <JalaliDatePicker value={expiresAt} onChange={setExpiresAt} />
          </Field>
          <Field label="خریدار (شخص یا سازمان)" hint="خالی = فروش نقد به مشتری حضوری">
            <PartyPicker value={buyer} onChange={setBuyer} canCreate />
          </Field>
          <Field label="نام دسته (اختیاری)" hint="مثلاً «بن نوروز اداره‌ی آموزش»">
            <input value={batch} onChange={(e) => setBatch(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} />
          فقط یک‌بار خرج شود (باقی‌مانده بعد از اولین خرید می‌سوزد)
        </label>
        <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
            مبلغ همین حالا دریافت شد
          </label>
          {payNow ? (
            <select value={treasuryId} onChange={(e) => setTreasuryId(e.target.value)} className={`${inputCls} mt-2`} aria-label="به کجا">
              {treasuries.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 text-[11px] text-gray-500">مبلغ به بدهی خریدار اضافه می‌شود و بعداً با «دریافت» تسویه می‌شود.</p>
          )}
        </div>
        <Field label="یادداشت (اختیاری)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function ReturnSheet({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [numbers, setNumbers] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ count: number }>("/api/admin/accounting/gift-cards", { method: "POST", json: { action: "return", numbers, note } });
      onDone(`${faNum(r.count)} بن مرجوع شد و از بدهی خریدار کم شد`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title="مرجوع بن کارت"
      footer={
        <button onClick={submit} disabled={busy || !numbers.trim()} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : "مرجوع کردن"}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-500">فقط بن دست‌نخورده (مانده = مبلغ) مرجوع می‌شود. مبلغ فروش، به همان اندازه از بدهی خریدار کم یا به طلبش اضافه می‌شود.</p>
        <Field label="شماره‌ها" hint="هر خط یک شماره، یا اسکن پشت‌سرهم">
          <textarea value={numbers} onChange={(e) => setNumbers(e.target.value)} rows={6} className={inputCls} dir="ltr" autoFocus />
        </Field>
        <Field label="یادداشت (اختیاری)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function DetailSheet({ number, onClose }: { number: string; onClose: () => void }) {
  const [d, setD] = useState<{
    card: Gift & { note: string | null; issueVoucherId: string | null; createdByName: string; txs: { id: string; kind: string; amount: string; ticketId: string | null; voucherId: string | null; note: string | null; actorName: string; createdAt: string }[] };
    tickets: { id: string; number: number; saleInvoiceId: string | null; returnInvoiceId: string | null }[];
    vouchers: { id: string; number: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<NonNullable<typeof d>>(`/api/admin/accounting/gift-cards?number=${encodeURIComponent(number)}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [number]);
  const c = d?.card;
  return (
    <Sheet open wide onClose={onClose} title={`بن ${number}`}>
      <ErrorText>{error}</ErrorText>
      {c && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {statusOf(c)}
            {c.singleUse && <Badge tone="amber">یک‌بارمصرف</Badge>}
            <span className="text-gray-500">
              مانده <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(c.balance)}</b> از {formatAmount(c.amount)} تومان
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <dt className="text-gray-500">خریدار</dt>
            <dd>{c.buyer ? <Link href={`/admin/accounting/parties/${c.buyer.id}`} className="font-bold text-blue-600 hover:underline">{c.buyer.name}</Link> : "فروش نقد"}</dd>
            {BigInt(c.saleDiscount) > 0n && (
              <>
                <dt className="text-gray-500">تخفیف فروش</dt>
                <dd className="tabular-nums">{formatAmount(c.saleDiscount)}</dd>
              </>
            )}
            {BigInt(c.minInvoice) > 0n && (
              <>
                <dt className="text-gray-500">حداقل خرید</dt>
                <dd className="tabular-nums">{formatAmount(c.minInvoice)}</dd>
              </>
            )}
            <dt className="text-gray-500">اعتبار</dt>
            <dd>{c.expiresAt ? `تا ${formatJalali(new Date(c.expiresAt))}` : "بی انقضا"}</dd>
            {c.batch && (
              <>
                <dt className="text-gray-500">دسته</dt>
                <dd>{c.batch}</dd>
              </>
            )}
            <dt className="text-gray-500">صادرکننده</dt>
            <dd>{c.createdByName}</dd>
          </dl>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-white/5 dark:border-white/10">
            {c.txs.map((t) => {
              const tk = d.tickets.find((x) => x.id === t.ticketId);
              const v = d.vouchers.find((x) => x.id === t.voucherId);
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-xs">
                  <span className="font-bold">{KIND_LABEL[t.kind] ?? t.kind}</span>
                  <span className="text-gray-400">{formatJalali(new Date(t.createdAt))}</span>
                  {tk && (
                    <Link href={`/admin/accounting/pos/tickets/${tk.id}/print`} className="text-blue-600 hover:underline">
                      رسید {faNum(tk.number)}
                    </Link>
                  )}
                  {v && (
                    <Link href={`/admin/accounting/vouchers/${v.id}`} className="text-blue-600 hover:underline">
                      سند {faNum(v.number)}
                    </Link>
                  )}
                  <span className={`mr-auto font-black tabular-nums ${BigInt(t.amount) < 0n ? "text-rose-600" : "text-emerald-600"}`} dir="ltr">
                    {BigInt(t.amount) > 0n ? "+" : "−"}
                    {formatAmount(BigInt(t.amount) < 0n ? -BigInt(t.amount) : BigInt(t.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}
