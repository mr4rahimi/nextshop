"use client";

/**
 * چک‌ها — دریافتی و صادره، با نماهای «باز»، «۷ روز آینده»، «سررسید گذشته»،
 * «برگشتی» و «بسته‌شده»؛ و زبانه‌ی دسته‌چک‌ها. docs/plans/accounting.md بخش ۹.۲.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, Money, PageHeader, Segmented, Sheet } from "../ui";

type Dir = "RECEIVED" | "ISSUED";
const LABELS: Record<string, string> = {
  IN_HAND: "نزد ما",
  IN_COLLECTION: "در جریان وصول",
  CLEARED: "وصول شد",
  BOUNCED: "برگشتی",
  ENDORSED: "خرج شد",
  RETURNED: "عودت داده شد",
  ISSUED: "منتظر سررسید",
};
export function CHEQUE_LABEL(dir: Dir, status: string) {
  if (dir === "ISSUED" && status === "CLEARED") return "پاس شد";
  if (dir === "ISSUED" && status === "RETURNED") return "باطل / پس گرفته شد";
  return LABELS[status] ?? status;
}
export function chequeTone(status: string): "green" | "red" | "amber" | "blue" | "gray" {
  if (status === "CLEARED") return "green";
  if (status === "BOUNCED") return "red";
  if (status === "IN_COLLECTION" || status === "ISSUED") return "blue";
  if (status === "IN_HAND") return "amber";
  return "gray";
}

interface Row {
  id: string;
  direction: Dir;
  status: string;
  serialNo: string;
  bankName: string;
  amount: string;
  dueDate: string;
  sayadId: string | null;
  sayadRegistered: boolean;
  holderPartyId: string | null;
  party: { id: string; name: string };
}

export default function ChequesList() {
  const router = useRouter();
  const sp = useSearchParams();
  const [dir, setDir] = useState<Dir>(sp.get("dir") === "ISSUED" ? "ISSUED" : "RECEIVED");
  const [view, setView] = useState(sp.get("view") ?? "open");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: Row[]; holders: Record<string, string>; counts: Record<string, number>; total: string; can: { manage: boolean; pay: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = dayValue(todayKey());

  const load = useCallback(() => {
    if (view === "books") return;
    const p = new URLSearchParams({ dir, view });
    if (q.trim()) p.set("q", q.trim());
    api<NonNullable<typeof data>>(`/api/admin/accounting/cheques?${p}`).then(setData).catch((e) => setError(e.message));
  }, [dir, view, q]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  const c = data?.counts ?? {};
  return (
    <div className="space-y-4">
      <PageHeader
        title="چک‌ها"
        help="accountingCheques"
        desc="چک دریافتی از ثبت «دریافت» و چک صادره از ثبت «پرداخت» می‌آید. وصول، برگشت و عودت را از صفحه‌ی هر چک بزنید."
        actions={
          data?.can.pay && (
            <Link href={`/admin/accounting/money/new?kind=${dir === "RECEIVED" ? "RECEIPT" : "PAYMENT"}`} className={btn.primary}>
              ➕ {dir === "RECEIVED" ? "دریافت چک" : "صدور چک"}
            </Link>
          )
        }
      />
      <Segmented
        value={dir}
        onChange={(d) => {
          setDir(d);
          if (view === "books") setView("open");
          router.replace(`?dir=${d}`, { scroll: false });
        }}
        options={[
          { value: "RECEIVED", label: "دریافتی" },
          { value: "ISSUED", label: "صادره" },
        ]}
      />
      <Chips
        value={view}
        onChange={setView}
        options={[
          { value: "open", label: dir === "RECEIVED" ? "در دست" : "منتظر پاس", count: c.open },
          { value: "week", label: "۷ روز آینده", count: c.week },
          { value: "overdue", label: "سررسید گذشته", count: c.overdue },
          { value: "bounced", label: "برگشتی", count: c.bounced },
          { value: "closed", label: "بسته‌شده", count: c.closed },
          { value: "all", label: "همه" },
          ...(dir === "ISSUED" ? [{ value: "books", label: "دسته‌چک‌ها" }] : []),
        ]}
      />
      {view === "books" ? (
        <ChequeBooks />
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شماره‌ی چک، صیادی، نام شخص یا بانک" className={inputCls} />
          <ErrorText>{error}</ErrorText>
          {data && (
            <p className="text-xs text-gray-500">
              {faNum(data.items.length)} چک · جمع <Money value={data.total} />
            </p>
          )}
          <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
            {data?.items.map((r) => {
              const due = r.dueDate.slice(0, 10);
              const open = ["IN_HAND", "IN_COLLECTION", "ISSUED"].includes(r.status);
              const late = open && due < today;
              return (
                <Link key={r.id} href={`/admin/accounting/cheques/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                  <div className={`w-14 text-center shrink-0 rounded-xl py-1.5 ${late ? "bg-red-500/10 text-red-600" : open && due <= dayValue(new Date(todayKey().getTime() + 7 * 86_400_000)) ? "bg-amber-500/10 text-amber-600" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"}`}>
                    <p className="text-[10px]">سررسید</p>
                    <p className="text-[11px] font-black">{formatJalali(new Date(r.dueDate)).split(" ").slice(0, 2).join(" ")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.party.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {faNum(r.serialNo)} · {r.bankName}
                      {r.holderPartyId && ` · خرج شد به ${data.holders[r.holderPartyId] ?? ""}`}
                      {r.sayadId && !r.sayadRegistered && open && " · صیاد ثبت نشده"}
                    </p>
                  </div>
                  <div className="text-left shrink-0 space-y-1">
                    <Money value={r.amount} className="text-sm" />
                    <div>
                      <Badge tone={chequeTone(r.status)}>{CHEQUE_LABEL(r.direction, r.status)}</Badge>
                    </div>
                  </div>
                </Link>
              );
            })}
            {data && !data.items.length && (
              <Empty
                title="چکی در این نما نیست"
                desc={dir === "RECEIVED" ? "چک مشتری را در فرم «دریافت» با روش «چک» ثبت کنید." : "چک خودتان را در فرم «پرداخت» با روش «چک» صادر کنید."}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ChequeBooks() {
  const [data, setData] = useState<{ items: { id: string; treasuryId: string; fromSerial: string; toSerial: string; isActive: boolean; leaves: number; used: number }[]; banks: { id: string; name: string; isActive: boolean }[]; can: { manage: boolean } } | null>(null);
  const [form, setForm] = useState<{ treasuryId: string; fromSerial: string; toSerial: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<NonNullable<typeof data>>("/api/admin/accounting/cheques/books").then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function save() {
    try {
      await api("/api/admin/accounting/cheques/books", { method: "POST", json: form });
      setForm(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    }
  }
  async function toggle(id: string, isActive: boolean) {
    await api("/api/admin/accounting/cheques/books", { method: "PATCH", json: { id, isActive } }).catch(() => {});
    load();
  }
  const bank = (id: string) => data?.banks.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 leading-6">فرم پرداخت شماره‌ی چک بعدی را از دسته‌چک فعال همان حساب پیشنهاد می‌کند.</p>
        {data?.can.manage && data.banks.length > 0 && (
          <button onClick={() => setForm({ treasuryId: data.banks.find((b) => b.isActive)?.id ?? "", fromSerial: "", toSerial: "" })} className={btn.soft}>
            ➕ دسته‌چک
          </button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
      <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
        {data?.items.map((b) => (
          <div key={b.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className={`text-sm font-bold ${b.isActive ? "" : "text-gray-400"}`}>{bank(b.treasuryId)}</p>
              <p className="text-[11px] text-gray-400">
                {faNum(b.fromSerial)} تا {faNum(b.toSerial)} · {faNum(b.used)} از {faNum(b.leaves)} برگ مصرف شده
              </p>
            </div>
            {data.can.manage && (
              <button onClick={() => toggle(b.id, !b.isActive)} className={btn.small}>
                {b.isActive ? "بایگانی" : "فعال"}
              </button>
            )}
          </div>
        ))}
        {data && !data.items.length && <Empty title="دسته‌چکی ثبت نشده" desc={data.banks.length ? "دسته‌چک هر حساب بانکی را اینجا تعریف کنید." : "اول یک حساب بانکی در «صندوق و بانک» بسازید."} />}
      </Card>
      {form && (
        <Sheet
          open
          onClose={() => setForm(null)}
          title="دسته‌چک تازه"
          help="accountingCheques"
          footer={
            <button onClick={save} className={`${btn.primary} w-full`}>
              ثبت
            </button>
          }
        >
          <div className="space-y-3">
            <Field label="حساب بانکی">
              <select value={form.treasuryId} onChange={(e) => setForm({ ...form, treasuryId: e.target.value })} className={inputCls}>
                {data?.banks.filter((b) => b.isActive).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="شماره‌ی اولین برگ">
                <input value={form.fromSerial} onChange={(e) => setForm({ ...form, fromSerial: e.target.value })} className={inputCls} inputMode="numeric" dir="ltr" />
              </Field>
              <Field label="شماره‌ی آخرین برگ">
                <input value={form.toSerial} onChange={(e) => setForm({ ...form, toSerial: e.target.value })} className={inputCls} inputMode="numeric" dir="ltr" />
              </Field>
            </div>
            {form.fromSerial && form.toSerial && /^\d+$/.test(form.fromSerial) && /^\d+$/.test(form.toSerial) && (
              <p className="text-xs text-gray-500">{faNum(formatAmount(BigInt(form.toSerial) - BigInt(form.fromSerial) + 1n))} برگ</p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
