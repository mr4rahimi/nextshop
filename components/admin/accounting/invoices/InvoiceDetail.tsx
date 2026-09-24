"use client";

/**
 * جزئیات فاکتور — ردیف‌ها، جمع‌ها، ارتباط‌ها (سفارش، مرجع، برگشتی‌ها، پیش‌فاکتور)
 * و کارها: صدور، ویرایش، ابطال، برگشت، تبدیل پیش‌فاکتور، چاپ.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { CHANNEL_LABELS, INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import { api, Badge, btn, Card, ErrorText, Money, PageHeader, SectionTitle } from "../ui";
import { invoiceTitle, isExpired, StatusBadge } from "./InvoicesList";

interface Line {
  id: string;
  seq: number;
  productId: string | null;
  title: string;
  qty: number;
  unitPrice: string;
  discount: string;
  invoiceDiscountShare: string;
  vatRateBp: number;
  vatAmount: string;
  lineTotal: string;
  net: string;
  sku: string | null;
  image: string | null;
  account: { id: string; code: string; name: string } | null;
  returnedQty: number;
  cost?: string;
}

interface Linked {
  id: string;
  type: InvoiceTypeKey;
  number: number | null;
  status?: string;
  date?: string;
  total?: string;
}

export interface InvoiceData {
  invoice: {
    id: string;
    type: InvoiceTypeKey;
    number: number | null;
    date: string;
    dueDate: string | null;
    validUntil: string | null;
    status: "DRAFT" | "ISSUED" | "VOID";
    proformaState: "OPEN" | "CONVERTED" | "CANCELED" | null;
    channel: keyof typeof CHANNEL_LABELS;
    platformCode: string | null;
    party: { id: string; code: number; name: string; mobile: string | null };
    partyName: string;
    partyNationalId: string | null;
    partyEconomicCode: string | null;
    partyPostalCode: string | null;
    partyAddress: string | null;
    partyPhone: string | null;
    pricesIncludeVat: boolean;
    subtotal: string;
    lineDiscount: string;
    invoiceDiscount: string;
    additions: string;
    additionsTitle: string | null;
    vatTotal: string;
    total: string;
    note: string | null;
    voidReason: string | null;
    createdByName: string;
    createdAt: string;
    issuedAt: string | null;
    lines: Line[];
  };
  warehouse: { id: string; name: string } | null;
  ref: Linked | null;
  returns: Linked[];
  convertedTo: Linked | null;
  convertedFrom: Linked | null;
  voucher: { id: string; number: number; status: string } | null;
  order: { id: string; orderNumber: string; status: string } | null;
  profit: { cost: string; gross: string } | null;
  can: { write: boolean; voucher: boolean };
}

const RETURN_TYPE: Partial<Record<InvoiceTypeKey, InvoiceTypeKey>> = { SALES: "SALES_RETURN", PURCHASE: "PURCHASE_RETURN" };

export default function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printMenu, setPrintMenu] = useState(false);

  const load = useCallback(() => {
    api<InvoiceData>(`/api/admin/accounting/invoices/${id}`)
      .then((x) => {
        setD(x);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id?: string }>(`/api/admin/accounting/invoices/${id}`, { method: "POST", json: { action, ...extra } });
      if (action === "convert" && r.id) router.push(`/admin/accounting/invoices/${r.id}`);
      else load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("این پیش‌نویس حذف شود؟")) return;
    try {
      await api(`/api/admin/accounting/invoices/${id}`, { method: "DELETE" });
      router.push(d && isSales(d.invoice.type) ? "/admin/accounting/sales" : "/admin/accounting/purchases");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف نشد");
    }
  }

  // میانبر «P» — چاپ (بخش ۱۳.۴)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      if ((e.key === "p" || e.key === "ح") && d && d.invoice.status !== "DRAFT") window.open(`/admin/accounting/invoices/${id}/print`, "_blank");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d, id]);

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const inv = d.invoice;
  const sales = isSales(inv.type);
  const returnType = RETURN_TYPE[inv.type];
  const returnable = inv.lines.some((l) => l.qty > l.returnedQty);
  const discount = BigInt(inv.lineDiscount) + BigInt(inv.invoiceDiscount);
  const showVat = BigInt(inv.vatTotal) > 0n;
  const expired = inv.type === "PROFORMA" && isExpired(inv.validUntil);

  return (
    <div className="space-y-4">
      <PageHeader
        title={invoiceTitle(inv)}
        help="accountingInvoice"
        back={{ href: sales ? `/admin/accounting/sales?type=${inv.type}` : `/admin/accounting/purchases?type=${inv.type}`, label: sales ? "فروش" : "خرید" }}
        actions={
          <>
            {inv.status !== "DRAFT" && (
              <div className="relative">
                <button onClick={() => setPrintMenu((x) => !x)} className={btn.soft}>
                  🖨️ چاپ
                </button>
                {printMenu && (
                  <div className="absolute left-0 mt-1 z-30 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl p-1">
                    {[
                      { tpl: "shop", label: "فاکتور فروشگاهی (A4)" },
                      { tpl: "official", label: "فاکتور رسمی (صورت‌حساب)" },
                      { tpl: "receipt", label: "رسید حرارتی (۸۰ میلی‌متر)" },
                    ].map((o) => (
                      <a
                        key={o.tpl}
                        href={`/admin/accounting/invoices/${id}/print?tpl=${o.tpl}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setPrintMenu(false)}
                        className="block px-3 py-2 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        {o.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            {d.can.write && inv.status !== "VOID" && inv.proformaState !== "CONVERTED" && (
              <Link href={`/admin/accounting/invoices/${id}/edit`} className={btn.soft}>
                ✏️ ویرایش
              </Link>
            )}
            {d.can.write && inv.status === "DRAFT" && (
              <>
                <button onClick={remove} className={btn.danger}>
                  حذف
                </button>
                <button onClick={() => act("issue")} disabled={busy} className={btn.primary}>
                  صدور
                </button>
              </>
            )}
          </>
        }
      />

      <ErrorText>{error}</ErrorText>

      <Card className="p-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge inv={inv} />
            {inv.status === "ISSUED" && inv.type !== "PROFORMA" && <Badge tone="green">صادرشده</Badge>}
            <Badge>{CHANNEL_LABELS[inv.channel]}</Badge>
            {d.warehouse && <Badge>انبار: {d.warehouse.name}</Badge>}
            {inv.pricesIncludeVat && showVat && <Badge>قیمت با مالیات</Badge>}
          </div>
          <p className="text-sm">
            {sales ? "خریدار" : "فروشنده"}:{" "}
            <Link href={`/admin/accounting/parties/${inv.party.id}`} className="font-black text-blue-600">
              {inv.partyName}
            </Link>
            {inv.partyPhone && <span className="text-xs text-gray-400 mr-2" dir="ltr">{faNum(inv.partyPhone)}</span>}
          </p>
          <p className="text-xs text-gray-500">
            تاریخ {formatJalali(new Date(inv.date))}
            {inv.dueDate && ` · سررسید ${formatJalali(new Date(inv.dueDate))}`}
            {inv.validUntil && ` · اعتبار تا ${formatJalali(new Date(inv.validUntil))}`}
            {expired && inv.proformaState === "OPEN" && <span className="text-amber-600 font-bold"> (منقضی)</span>}
          </p>
          {inv.partyAddress && <p className="text-xs text-gray-400">{inv.partyAddress}</p>}
          <p className="text-[11px] text-gray-400">
            ثبت: {inv.createdByName}، {formatJalali(new Date(inv.createdAt))}
          </p>
          {inv.voidReason && <p className="text-xs text-red-600">دلیل ابطال: {inv.voidReason}</p>}
          {inv.note && <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 rounded-lg px-2 py-1.5 whitespace-pre-line">{inv.note}</p>}
        </div>
        <div className="md:text-left border-t md:border-t-0 md:border-r border-gray-100 dark:border-white/5 pt-3 md:pt-0 md:pr-5 space-y-1">
          <p className="text-[11px] text-gray-500">جمع فاکتور</p>
          <Money value={inv.total} className="text-2xl" />
          <p className="text-[11px] text-gray-400 max-w-[16rem]">{amountToWords(inv.total)} تومان</p>
        </div>
      </Card>

      {/* ارتباط‌ها */}
      {(d.order || d.ref || d.returns.length > 0 || d.convertedTo || d.convertedFrom || d.voucher) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {d.order && (
            <Link href={`/admin/orders/${d.order.id}`} className={btn.small}>
              🛒 سفارش {d.order.orderNumber}
            </Link>
          )}
          {d.ref && (
            <Link href={`/admin/accounting/invoices/${d.ref.id}`} className={btn.small}>
              ↩ مرجع: {INVOICE_TYPE_LABELS[d.ref.type]} {faNum(d.ref.number ?? 0)}
            </Link>
          )}
          {d.convertedFrom && (
            <Link href={`/admin/accounting/invoices/${d.convertedFrom.id}`} className={btn.small}>
              از پیش‌فاکتور {faNum(d.convertedFrom.number ?? 0)}
            </Link>
          )}
          {d.convertedTo && (
            <Link href={`/admin/accounting/invoices/${d.convertedTo.id}`} className={btn.small}>
              ← فاکتور فروش {faNum(d.convertedTo.number ?? 0)}
              {d.convertedTo.status === "VOID" && " (باطل)"}
            </Link>
          )}
          {d.returns.map((r) => (
            <Link key={r.id} href={`/admin/accounting/invoices/${r.id}`} className={btn.small}>
              {INVOICE_TYPE_LABELS[r.type]} {r.number ? faNum(r.number) : "(پیش‌نویس)"} {r.status === "VOID" && "(باطل)"}
            </Link>
          ))}
          {d.voucher && (
            <Link href={`/admin/accounting/vouchers/${d.voucher.id}`} className={btn.small}>
              📒 سند {faNum(d.voucher.number)} {d.voucher.status === "VOID" && "(باطل)"}
            </Link>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 pt-4">
          <SectionTitle title={`اقلام (${faNum(inv.lines.length)})`} />
        </div>
        {/* موبایل */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
          {inv.lines.map((l) => (
            <div key={l.id} className="px-4 py-3 flex gap-3">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{l.title}</p>
                <p className="text-[11px] text-gray-400">
                  {faNum(l.qty)} × {formatAmount(l.unitPrice)}
                  {BigInt(l.discount) + BigInt(l.invoiceDiscountShare) > 0n && ` − تخفیف ${formatAmount(BigInt(l.discount) + BigInt(l.invoiceDiscountShare))}`}
                  {BigInt(l.vatAmount) > 0n && ` · مالیات ${formatAmount(l.vatAmount)}`}
                </p>
                {l.account && <p className="text-[10px] text-blue-600">{l.account.name}</p>}
                {l.returnedQty > 0 && <p className="text-[10px] text-amber-600 font-bold">{faNum(l.returnedQty)} عدد برگشت خورده</p>}
              </div>
              <Money value={l.lineTotal} className="text-sm shrink-0" />
            </div>
          ))}
        </div>
        {/* دسکتاپ */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">
            <tr>
              <th className="px-4 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-right">شرح</th>
              <th className="px-3 py-2 text-center w-16">تعداد</th>
              <th className="px-3 py-2 text-left w-32">فی</th>
              <th className="px-3 py-2 text-left w-28">تخفیف</th>
              {showVat && <th className="px-3 py-2 text-left w-28">مالیات</th>}
              <th className="px-3 py-2 text-left w-32">جمع</th>
              {d.profit && <th className="px-4 py-2 text-left w-28">بهای تمام‌شده</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {inv.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-xs text-gray-400">{faNum(l.seq)}</td>
                <td className="px-3 py-2">
                  <span className="font-bold">{l.title}</span>
                  {l.sku && <span className="text-[10px] text-gray-400 mr-2">کد {faNum(l.sku)}</span>}
                  {l.account && <span className="block text-[10px] text-blue-600">{l.account.name}</span>}
                  {l.returnedQty > 0 && <span className="block text-[10px] text-amber-600 font-bold">{faNum(l.returnedQty)} عدد برگشت خورده</span>}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">{faNum(l.qty)}</td>
                <td className="px-3 py-2 text-left tabular-nums">{formatAmount(l.unitPrice)}</td>
                <td className="px-3 py-2 text-left tabular-nums text-emerald-600">
                  {BigInt(l.discount) + BigInt(l.invoiceDiscountShare) > 0n ? formatAmount(BigInt(l.discount) + BigInt(l.invoiceDiscountShare)) : "—"}
                </td>
                {showVat && <td className="px-3 py-2 text-left tabular-nums">{formatAmount(l.vatAmount)}</td>}
                <td className="px-3 py-2 text-left font-bold tabular-nums">{formatAmount(l.lineTotal)}</td>
                {d.profit && <td className="px-4 py-2 text-left tabular-nums text-gray-500">{l.cost !== undefined ? formatAmount(l.cost) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 dark:border-white/5 px-4 py-3 grid gap-1.5 text-sm md:max-w-sm md:mr-auto">
          <Sum k="جمع اقلام" v={inv.subtotal} />
          {discount > 0n && <Sum k="تخفیف" v={String(-discount)} tone="green" />}
          {showVat && <Sum k={inv.pricesIncludeVat ? "مالیات (داخل قیمت)" : "مالیات بر ارزش افزوده"} v={inv.vatTotal} />}
          {BigInt(inv.additions) > 0n && <Sum k={inv.additionsTitle ?? "اضافات"} v={inv.additions} />}
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-2">
            <span className="font-black">جمع کل</span>
            <Money value={inv.total} className="text-base" />
          </div>
        </div>
      </Card>

      {d.profit && (
        <Card className="p-4">
          <SectionTitle title="سود ناخالص این فاکتور" help="accountingInvoice" />
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-gray-500">فروش خالص کالا</p>
              <Money value={String(BigInt(d.profit.gross) + BigInt(d.profit.cost))} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">بهای تمام‌شده (کاردکس)</p>
              <Money value={d.profit.cost} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">{inv.type === "SALES_RETURN" ? "سود برگشت‌خورده" : "سود ناخالص"}</p>
              <Money value={d.profit.gross} tone={BigInt(d.profit.gross) < 0n ? "red" : "green"} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 leading-5">
            بهای تمام‌شده از میانگین خرید کالا در انبار می‌آید و با ثبت خرید تازه با تاریخ قبل‌تر به‌روز می‌شود. سود «معامله» در کارتابل از قیمت خرید واردشده‌ی همان سفارش است و می‌تواند با این عدد فرق کند.
          </p>
        </Card>
      )}

      {/* کارهای پایینی */}
      {d.can.write && inv.status === "ISSUED" && (
        <Card className="p-4 flex flex-wrap gap-2 items-center">
          {inv.type === "PROFORMA" && inv.proformaState === "OPEN" && (
            <button
              onClick={() => window.confirm("پیش‌فاکتور با همین اقلام و مبالغ به فاکتور فروش امروز تبدیل شود؟ کالا از انبار کم می‌شود.") && act("convert")}
              disabled={busy}
              className={btn.primary}
            >
              ✅ تبدیل به فاکتور فروش
            </button>
          )}
          {returnType && returnable && (
            <Link href={`/admin/accounting/invoices/new?ref=${inv.id}`} className={btn.soft}>
              ↩ {INVOICE_TYPE_LABELS[returnType]}
            </Link>
          )}
          {inv.proformaState !== "CONVERTED" && (
            <button
              onClick={() => {
                const reason = window.prompt(`دلیل ابطال ${INVOICE_TYPE_LABELS[inv.type]}؟ ${inv.type === "PROFORMA" ? "" : "کالا به انبار برمی‌گردد و حساب‌ها خنثی می‌شوند."}`);
                if (reason) act("void", { reason });
              }}
              disabled={busy}
              className={`${btn.danger} mr-auto`}
            >
              ابطال
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

function isSales(t: InvoiceTypeKey) {
  return t === "SALES" || t === "SALES_RETURN" || t === "PROFORMA";
}

function Sum({ k, v, tone }: { k: string; v: string; tone?: "green" }) {
  return (
    <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
      <span className="text-xs">{k}</span>
      <span className={`font-bold tabular-nums ${tone === "green" ? "text-emerald-600" : ""}`}>{formatAmount(v)}</span>
    </div>
  );
}
