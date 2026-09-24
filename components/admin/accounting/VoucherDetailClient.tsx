"use client";

/** نمایش سند — ابطال و معکوس فقط برای سند دستی */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { SOURCE_LABELS } from "./Statement";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, Sheet } from "./ui";

interface Line {
  id: string;
  seq: number;
  debit: string;
  credit: string;
  description: string | null;
  account: { id: string; code: string; name: string };
  party: { id: string; code: number; name: string } | null;
  treasury: { id: string; code: number; name: string } | null;
}
interface Data {
  voucher: {
    id: string;
    number: number;
    date: string;
    description: string;
    status: "POSTED" | "VOID";
    source: string;
    totalDebit: string;
    voidReason: string | null;
    createdByName: string;
    createdAt: string;
    year: { title: string };
    lines: Line[];
  };
  reversedBy: { id: string; number: number } | null;
  reversalOf: { id: string; number: number } | null;
  can: { manage: boolean };
}

export default function VoucherDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"void" | "reverse" | null>(null);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(dayValue(todayKey()));
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/vouchers/${id}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ id?: string }>(`/api/admin/accounting/vouchers/${id}`, {
        method: "POST",
        json: action === "void" ? { action, reason } : { action, date },
      });
      setAction(null);
      if (d.id) window.location.href = `/admin/accounting/vouchers/${d.id}`;
      else load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const v = data.voucher;
  const manual = v.source === "MANUAL";
  const canAct = data.can.manage && manual && v.status === "POSTED";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`سند شماره‌ی ${faNum(v.number)}`}
        help="accountingVouchers"
        back={{ href: "/admin/accounting/vouchers", label: "اسناد" }}
        actions={
          canAct && (
            <>
              {!data.reversedBy && !data.reversalOf && (
                <button onClick={() => setAction("reverse")} className={btn.soft}>
                  ↩️ سند معکوس
                </button>
              )}
              <button onClick={() => setAction("void")} className={btn.danger}>
                ابطال
              </button>
            </>
          )
        }
      />

      <Card className="p-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={manual ? "amber" : "blue"}>{SOURCE_LABELS[v.source] ?? v.source}</Badge>
          <Badge>سال مالی {faNum(v.year.title)}</Badge>
          {v.status === "VOID" && <Badge tone="red">باطل شده</Badge>}
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{v.description}</p>
        <p className="text-xs text-gray-500">
          تاریخ سند {formatJalali(new Date(v.date))} · ثبت: {v.createdByName}، {formatJalali(new Date(v.createdAt))}
        </p>
        {v.voidReason && <p className="text-xs text-red-600">دلیل ابطال: {v.voidReason}</p>}
        {data.reversedBy && (
          <p className="text-xs">
            با سند{" "}
            <Link className="text-blue-600 font-bold" href={`/admin/accounting/vouchers/${data.reversedBy.id}`}>
              {faNum(data.reversedBy.number)}
            </Link>{" "}
            معکوس شده است.
          </p>
        )}
        {data.reversalOf && (
          <p className="text-xs">
            معکوسِ سند{" "}
            <Link className="text-blue-600 font-bold" href={`/admin/accounting/vouchers/${data.reversalOf.id}`}>
              {faNum(data.reversalOf.number)}
            </Link>
          </p>
        )}
        {!manual && <p className="text-[11px] text-gray-400">این سند خودکار است و از همان جایی که ساختش اصلاح می‌شود.</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {v.lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1.5fr_1fr_1fr] gap-2 px-4 py-3 items-center">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  <Link href={`/admin/accounting/accounts/${l.account.id}`} className="hover:text-blue-600">
                    {l.account.name}
                  </Link>{" "}
                  <span className="text-[10px] text-gray-400 tabular-nums">{faNum(l.account.code)}</span>
                </p>
                {l.party && (
                  <Link href={`/admin/accounting/parties/${l.party.id}`} className="text-xs text-blue-600">
                    👤 {l.party.name}
                  </Link>
                )}
                {l.treasury && (
                  <Link href={`/admin/accounting/treasury/${l.treasury.id}`} className="text-xs text-blue-600">
                    🏦 {l.treasury.name}
                  </Link>
                )}
              </div>
              <p className="hidden md:block text-xs text-gray-500">{l.description}</p>
              <p className="text-sm tabular-nums font-bold text-left">{BigInt(l.debit) > 0n ? formatAmount(l.debit) : ""}</p>
              <p className="text-sm tabular-nums font-bold text-left md:col-start-4 col-start-2">{BigInt(l.credit) > 0n ? formatAmount(l.credit) : ""}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/5 text-sm">
          <span className="font-bold">جمع (بدهکار = بستانکار)</span>
          <Money value={v.totalDebit} />
        </div>
      </Card>

      <Sheet
        open={!!action}
        onClose={() => setAction(null)}
        title={action === "void" ? "ابطال سند" : "سند معکوس"}
        help="accountingVouchers"
        footer={
          <button onClick={run} disabled={busy} className={`${action === "void" ? btn.danger : btn.primary} w-full`}>
            {busy ? "…" : action === "void" ? "باطل کن" : "ثبت سند معکوس"}
          </button>
        }
      >
        {action === "void" ? (
          <Field label="دلیل ابطال" hint="سند و شماره‌اش می‌ماند ولی در هیچ مانده‌ای شمرده نمی‌شود">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} rows={3} autoFocus />
          </Field>
        ) : (
          <Field label="تاریخ سند معکوس" hint="برای وقتی که تاریخ سند اصلی قفل شده؛ یک سند برعکس در این تاریخ ثبت می‌شود">
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>
        )}
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      </Sheet>
    </div>
  );
}
