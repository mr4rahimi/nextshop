"use client";

/** جزئیات یک دریافت/پرداخت/انتقال — روش‌ها، چک‌ها، تخصیص به فاکتورها، ابطال */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import AmountInput from "../AmountInput";
import { api, Badge, btn, Card, ErrorText, Money, PageHeader, SectionTitle } from "../ui";
import { KIND_LABELS } from "./MoneyForm";
import { METHOD_FA } from "./MoneyList";
import { CHEQUE_LABEL } from "./ChequesList";

interface Data {
  doc: {
    id: string;
    kind: "RECEIPT" | "PAYMENT" | "TRANSFER";
    number: number;
    date: string;
    total: string;
    status: "POSTED" | "VOID";
    description: string | null;
    voidReason: string | null;
    createdByName: string;
    createdAt: string;
    party: { id: string; code: number; name: string; mobile: string | null } | null;
    items: { id: string; method: string; treasuryId: string | null; toTreasuryId: string | null; chequeId: string | null; amount: string; fee: string; trackingCode: string | null }[];
    allocations: { invoiceId: string; amount: string }[];
  };
  treasuries: { id: string; name: string }[];
  cheques: { id: string; serialNo: string; dueDate: string; status: string; direction: "RECEIVED" | "ISSUED"; bankName: string }[];
  voucher: { id: string; number: number; status: string } | null;
  order: { id: string; orderNumber: string } | null;
  allocatable: { id: string; type: InvoiceTypeKey; number: number | null; date: string; total: string; open: string; allocated: string }[];
  can: { write: boolean };
}

export default function MoneyDetail({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/money/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function post(json: object) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/money/${id}`, { method: "POST", json });
      setEdit(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const doc = d.doc;
  const tName = (tid: string | null) => d.treasuries.find((t) => t.id === tid)?.name ?? "—";
  const allocated = doc.allocations.reduce((s, a) => s + BigInt(a.amount), 0n);
  const excess = BigInt(doc.total) - allocated;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${KIND_LABELS[doc.kind]} ${faNum(doc.number)}`}
        help="accountingMoney"
        back={{ href: `/admin/accounting/money?kind=${doc.kind}`, label: "دریافت و پرداخت" }}
        actions={
          d.can.write &&
          doc.status === "POSTED" && (
            <button
              onClick={() => {
                const reason = window.prompt(`دلیل ابطال ${KIND_LABELS[doc.kind]}؟ چک‌هایش هم حذف یا برگردانده می‌شوند.`);
                if (reason) post({ action: "void", reason });
              }}
              disabled={busy}
              className={btn.danger}
            >
              ابطال
            </button>
          )
        }
      />
      <ErrorText>{error}</ErrorText>

      <Card className="p-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {doc.status === "VOID" ? <Badge tone="red">باطل</Badge> : <Badge tone="green">ثبت شده</Badge>}
            {d.order && <Badge tone="blue">خودکار از سایت</Badge>}
          </div>
          {doc.party && (
            <p className="text-sm">
              {doc.kind === "RECEIPT" ? "از" : "به"}{" "}
              <Link href={`/admin/accounting/parties/${doc.party.id}`} className="font-black text-blue-600">
                {doc.party.name}
              </Link>
            </p>
          )}
          <p className="text-xs text-gray-500">
            تاریخ {formatJalali(new Date(doc.date))} · ثبت: {doc.createdByName}
          </p>
          {doc.description && <p className="text-xs text-gray-600 dark:text-gray-300">{doc.description}</p>}
          {doc.voidReason && <p className="text-xs text-red-600">دلیل ابطال: {doc.voidReason}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {d.order && (
              <Link href={`/admin/orders/${d.order.id}`} className={btn.small}>
                🛒 سفارش {d.order.orderNumber}
              </Link>
            )}
            {d.voucher && (
              <Link href={`/admin/accounting/vouchers/${d.voucher.id}`} className={btn.small}>
                📒 سند {faNum(d.voucher.number)}
              </Link>
            )}
          </div>
        </div>
        <div className="md:text-left md:border-r border-gray-100 dark:border-white/5 md:pr-5">
          <p className="text-[11px] text-gray-500">مبلغ</p>
          <Money value={doc.total} className="text-2xl" />
          <p className="text-[11px] text-gray-400 max-w-[16rem]">{amountToWords(doc.total)} تومان</p>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="روش‌ها" />
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {doc.items.map((it) => {
            const ch = d.cheques.find((c) => c.id === it.chequeId);
            return (
              <div key={it.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0 text-sm">
                  {doc.kind === "TRANSFER" ? (
                    <p className="font-bold">
                      {tName(it.treasuryId)} ← {tName(it.toTreasuryId)}
                      {BigInt(it.fee) > 0n && <span className="text-xs text-gray-500 font-normal"> · کارمزد {formatAmount(it.fee)}</span>}
                    </p>
                  ) : ch ? (
                    <p className="font-bold">
                      چک{" "}
                      <Link href={`/admin/accounting/cheques/${ch.id}`} className="text-blue-600">
                        {faNum(ch.serialNo)}
                      </Link>{" "}
                      <span className="text-xs font-normal text-gray-500">
                        {ch.bankName} · سررسید {formatJalali(new Date(ch.dueDate))} · {CHEQUE_LABEL(ch.direction, ch.status)}
                      </span>
                    </p>
                  ) : (
                    <p className="font-bold">
                      {METHOD_FA[it.method]} <span className="text-xs font-normal text-gray-500">— {tName(it.treasuryId)}</span>
                    </p>
                  )}
                  {it.trackingCode && <p className="text-[11px] text-gray-400" dir="ltr">{it.trackingCode}</p>}
                </div>
                <Money value={it.amount} className="text-sm" />
              </div>
            );
          })}
        </div>
      </Card>

      {doc.kind !== "TRANSFER" && (
        <Card className="p-4 space-y-3">
          <SectionTitle
            title="بابت فاکتورها"
            help="accountingMoney"
            actions={
              d.can.write &&
              doc.status === "POSTED" &&
              d.allocatable.length > 0 &&
              !edit && (
                <button onClick={() => setEdit(Object.fromEntries(d.allocatable.map((a) => [a.id, a.allocated === "0" ? "" : a.allocated])))} className={btn.small}>
                  ✏️ تغییر تخصیص
                </button>
              )
            }
          />
          {edit ? (
            <div className="space-y-2">
              {d.allocatable.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
                  <span className="flex-1 text-sm font-bold">
                    {INVOICE_TYPE_LABELS[a.type]} {faNum(a.number ?? 0)}
                    <span className="block text-[11px] font-normal text-gray-400">
                      {formatJalali(new Date(a.date))} · مانده‌ی بی‌این‌سند {formatAmount(a.open)}
                    </span>
                  </span>
                  <div className="w-44">
                    <AmountInput compact value={edit[a.id] ?? ""} onChange={(v) => setEdit((x) => ({ ...x!, [a.id]: v }))} />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  onClick={() => post({ action: "allocate", allocations: Object.entries(edit).filter(([, v]) => v && v !== "0").map(([invoiceId, amount]) => ({ invoiceId, amount })) })}
                  disabled={busy}
                  className={btn.primary}
                >
                  ذخیره‌ی تخصیص
                </button>
                <button onClick={() => setEdit(null)} className={btn.soft}>
                  انصراف
                </button>
              </div>
            </div>
          ) : doc.allocations.length ? (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {d.allocatable
                .filter((a) => a.allocated !== "0")
                .map((a) => (
                  <Link key={a.id} href={`/admin/accounting/invoices/${a.id}`} className="py-2 flex items-center justify-between text-sm hover:text-blue-600">
                    <span className="font-bold">
                      {INVOICE_TYPE_LABELS[a.type]} {faNum(a.number ?? 0)}
                    </span>
                    <Money value={a.allocated} className="text-sm" />
                  </Link>
                ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">به فاکتوری وصل نشده.</p>
          )}
          {doc.status === "POSTED" && excess > 0n && (
            <p className="text-xs text-gray-500">
              {formatAmount(excess)} تومان {doc.kind === "RECEIPT" ? "پیش‌دریافت" : "پیش‌پرداخت"} روی حساب شخص مانده است.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
