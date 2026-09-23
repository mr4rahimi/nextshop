"use client";

/**
 * موعدهای پرداخت اعتباری (فاز ۱۰، بخش ۲۴).
 *
 * تب پیش‌فرض «گذشته» است: پولی که باید رسیده باشد و نرسیده، مهم‌ترین عدد
 * این صفحه است. ثبت واریز و تمدید همین‌جا، هر ردیف با فرم کوچک خودش.
 */

import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";

interface Installment {
  id: string;
  orderId: string;
  seq: number;
  dueDate: string;
  amount: string;
  status: "DUE" | "PAID" | "CANCELED";
  paidAt: string | null;
  paidAmount: string | null;
  paidNote: string | null;
  confirmedByName: string | null;
  reminderSentAt: string | null;
  followUpTaskId: string | null;
  order: {
    orderNumber: string;
    status: string;
    grandTotal: string;
    createdByStaffId: string | null;
    _count: { installments: number };
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      phone: string;
      clubProfile: { ownerId: string | null; ownerName: string | null } | null;
    };
  };
}

interface Data {
  items: Installment[];
  counts: Record<string, number>;
  outstanding: string;
  overdue: string;
  unowned: number;
  can: { manage: boolean; viewAll: boolean };
}

const TABS = [
  { key: "overdue", label: "گذشته" },
  { key: "today", label: "امروز" },
  { key: "tomorrow", label: "فردا" },
  { key: "week", label: "هفت روز آینده" },
  { key: "paid", label: "پرداخت‌شده" },
  { key: "all", label: "همه" },
];

const fa = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("fa-IR");

const DAY = 86_400_000;
function relative(dueDate: string): { text: string; cls: string } {
  const today = Math.floor((Date.now() + 3.5 * 3_600_000) / DAY) * DAY;
  const d = Math.round((new Date(dueDate).getTime() - today) / DAY);
  if (d < 0) return { text: `${fa(-d)} روز گذشته`, cls: "text-red-600" };
  if (d === 0) return { text: "امروز", cls: "text-amber-600" };
  if (d === 1) return { text: "فردا", cls: "text-blue-600" };
  return { text: `${fa(d)} روز دیگر`, cls: "text-gray-500" };
}

export default function CreditClient({ initialTab, initialQ }: { initialTab?: string; initialQ?: string }) {
  // لینک از پرونده‌ی مشتری: `?tab=all&q=09...` — صفحه‌ی سرور می‌خواندش
  const [tab, setTab] = useState(initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : "overdue");
  const [q, setQ] = useState(initialQ ?? "");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; kind: "pay" | "postpone" } | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ tab });
    if (q.trim()) p.set("q", q.trim());
    fetch(`/api/admin/worklist/credit?${p}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری نشد");
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری نشد"));
  }, [tab, q]);

  useEffect(() => {
    const h = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="مانده‌ی بدهی" value={`${fa(data.outstanding)} تومان`} />
          <Stat label="معوق (موعد گذشته)" value={`${fa(data.overdue)} تومان`} tone={Number(data.overdue) > 0 ? "red" : undefined} />
          {data.can.viewAll && (
            <Stat
              label="موعد بی‌مسئول"
              value={fa(data.unowned)}
              hint="مشتری صاحب ندارد و سفارش ثبت‌کننده ندارد؛ کار پیگیری نمی‌گیرد. از «مشتریان» صاحب تعیین کنید."
              tone={data.unowned > 0 ? "amber" : undefined}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="شماره سفارش، نام یا موبایل مشتری"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              tab === t.key
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
            }`}
          >
            {t.label}
            {data && (
              <span className={`mr-1 ${t.key === "overdue" && data.counts.overdue > 0 && tab !== t.key ? "text-red-600" : "opacity-60"}`}>
                {fa(data.counts[t.key] ?? 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((i) => {
          const u = i.order.user;
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone;
          const rel = relative(i.dueDate);
          const isOpen = open?.id === i.id;
          return (
            <div key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-[160px] flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{name}</p>
                  <p className="text-[11px] text-gray-400">
                    <span dir="ltr">{u.phone}</span> · سفارش <span dir="ltr">{i.order.orderNumber}</span>
                    {i.order._count.installments > 1 && ` · قسط ${fa(i.seq)} از ${fa(i.order._count.installments)}`}
                  </p>
                  {data.can.viewAll && (
                    <p className="text-[10px] text-gray-400">
                      مسئول: {u.clubProfile?.ownerName ?? (i.order.createdByStaffId ? "ثبت‌کننده‌ی سفارش" : <span className="text-amber-600">ندارد</span>)}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{formatJalali(new Date(i.dueDate))}</p>
                  {i.status === "DUE" && <p className={`text-[10px] font-bold ${rel.cls}`}>{rel.text}</p>}
                </div>
                <div className="text-center min-w-[100px]">
                  <p className="text-xs font-black text-gray-900 dark:text-white">{fa(i.amount)}</p>
                  <p className="text-[10px] text-gray-400">تومان</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 min-w-[120px] justify-end">
                  {i.status === "PAID" && (
                    <span className="text-[10px] px-2 py-1 rounded-lg font-bold bg-emerald-500/10 text-emerald-600">
                      واریز شد {i.paidAt && `· ${formatJalali(new Date(i.paidAt))}`}
                    </span>
                  )}
                  {i.status === "CANCELED" && (
                    <span className="text-[10px] px-2 py-1 rounded-lg font-bold bg-gray-500/10 text-gray-500">لغو</span>
                  )}
                  {i.status === "DUE" && i.reminderSentAt && (
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600" title="پیامک یادآوری روز قبل">
                      یادآوری رفت
                    </span>
                  )}
                  {i.status === "DUE" && data.can.manage && (
                    <>
                      <button
                        onClick={() => setOpen(isOpen && open.kind === "pay" ? null : { id: i.id, kind: "pay" })}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold"
                      >
                        ثبت واریز
                      </button>
                      <button
                        onClick={() => setOpen(isOpen && open.kind === "postpone" ? null : { id: i.id, kind: "postpone" })}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-[11px] font-bold"
                      >
                        تمدید
                      </button>
                    </>
                  )}
                </div>
              </div>
              {i.status === "PAID" && (i.paidNote || i.confirmedByName) && (
                <p className="mt-1 text-[10px] text-gray-400">
                  {i.paidAmount && i.paidAmount !== i.amount && `مبلغ واریز: ${fa(i.paidAmount)} · `}
                  {i.confirmedByName && `ثبت: ${i.confirmedByName}`}
                  {i.paidNote && ` · ${i.paidNote}`}
                </p>
              )}
              {isOpen && open.kind === "pay" && (
                <PayForm inst={i} onDone={() => { setOpen(null); load(); }} />
              )}
              {isOpen && open.kind === "postpone" && (
                <PostponeForm inst={i} onDone={() => { setOpen(null); load(); }} />
              )}
            </div>
          );
        })}
        {data && data.items.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-gray-400">موعدی در این بخش نیست.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "amber" }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3.5" title={hint}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p
        className={`text-sm font-black mt-1 ${
          tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

async function post(id: string, body: unknown): Promise<string | null> {
  const r = await fetch(`/api/admin/worklist/credit/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.ok) return null;
  return (await r.json().catch(() => ({}))).error ?? "انجام نشد";
}

const inputCls =
  "px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400";

function PayForm({ inst, onDone }: { inst: Installment; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 p-2.5">
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="numeric"
        placeholder={`مبلغ — خالی = ${fa(inst.amount)}`}
        className={`${inputCls} w-44`}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="شماره فیش یا روش واریز"
        className={`${inputCls} flex-1 min-w-[160px]`}
      />
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const err = await post(inst.id, { action: "pay", amount: amount || undefined, note });
          setSaving(false);
          if (err) setError(err);
          else onDone();
        }}
        className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-40"
      >
        {saving ? "..." : "ثبت"}
      </button>
      {error && <p className="w-full text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

function PostponeForm({ inst, onDone }: { inst: Installment; onDone: () => void }) {
  const [date, setDate] = useState(inst.dueDate.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/5 p-2.5">
      <span className="text-[11px] text-gray-500">تاریخ تازه</span>
      <div className="w-44">
        <JalaliDatePicker value={date} onChange={setDate} clearable={false} className={inputCls} />
      </div>
      <button
        disabled={saving || date === inst.dueDate.slice(0, 10)}
        onClick={async () => {
          setSaving(true);
          const err = await post(inst.id, { action: "postpone", date });
          setSaving(false);
          if (err) setError(err);
          else onDone();
        }}
        className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold disabled:opacity-40"
      >
        {saving ? "..." : "تمدید"}
      </button>
      <p className="w-full text-[10px] text-gray-400">
        یادآوری پیامکی برای تاریخ تازه دوباره می‌رود و کار پیگیری فعلی با «قول پرداخت داد» بسته می‌شود.
      </p>
      {error && <p className="w-full text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
