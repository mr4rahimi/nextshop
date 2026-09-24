"use client";

/**
 * چاپ فاکتور — docs/plans/accounting.md بخش ۱۰. سه قالب:
 *   shop      فاکتور فروشگاهی A4 با لوگو
 *   official  «صورت‌حساب فروش کالا و خدمات» — مشخصات کامل فروشنده و خریدار،
 *             شناسه‌ی کالا، مالیات، مبلغ به حروف، مهر و امضا. مبالغ **ریال**
 *             است، مثل فرم رسمی (تبدیل ×۱۰ فقط در همین مرز چاپ)
 *   receipt   رسید حرارتی ۸۰ میلی‌متر
 *
 * PDF: از پنجره‌ی چاپ مرورگر «ذخیره به PDF». صفحه بیرون از قاب پنل رندر می‌شود
 * (`app/admin/layout.tsx` مسیرهای `/print` را بی‌قاب نشان می‌دهد) و همیشه روشن است.
 *
 * ⚠️ از تگ `<header>` استفاده نشود — CSS چاپی سراسری آن را پنهان می‌کند.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import { api } from "../ui";
import type { InvoiceData } from "./InvoiceDetail";

type Tpl = "shop" | "official" | "receipt";

interface PrintData extends InvoiceData {
  print: {
    seller: {
      name: string | null;
      nationalId: string | null;
      economicCode: string | null;
      regNo: string | null;
      postalCode: string | null;
      address: string | null;
      phone: string | null;
      stampImage: string | null;
      signatureImage: string | null;
      footerNote: string | null;
    };
    store: { name: string | null; logo: string | null };
    officialReady: boolean;
  };
}

const OFFICIAL_TITLE: Record<InvoiceTypeKey, string> = {
  SALES: "صورت‌حساب فروش کالا و خدمات",
  SALES_RETURN: "صورت‌حساب برگشت از فروش",
  PROFORMA: "پیش‌فاکتور فروش کالا و خدمات",
  PURCHASE: "صورت‌حساب خرید کالا و خدمات",
  PURCHASE_RETURN: "صورت‌حساب برگشت از خرید",
};

const b = (v: string | bigint) => (typeof v === "bigint" ? v : BigInt(v));

export default function InvoicePrint({ id }: { id: string }) {
  const sp = useSearchParams();
  const [tpl, setTpl] = useState<Tpl>(((sp.get("tpl") as Tpl) || "shop") as Tpl);
  const [d, setD] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PrintData>(`/api/admin/accounting/invoices/${id}?print=1`).then(setD).catch((e) => setError(e.message));
  }, [id]);

  // چاپ همیشه روشن — حالت تاریک پنل روی کاغذ معنا ندارد
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  useEffect(() => {
    if (d) document.title = `${INVOICE_TYPE_LABELS[d.invoice.type]} ${d.invoice.number ?? ""} — ${d.invoice.partyName}`;
  }, [d]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!d) return <p className="p-6 text-sm text-gray-500">در حال آماده‌سازی…</p>;

  const official = tpl === "official";
  const blocked = official && !d.print.officialReady;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-black [color-scheme:light]" dir="rtl">
      <style>{`
        @page { size: ${tpl === "receipt" ? "80mm auto" : "A4"}; margin: ${tpl === "receipt" ? "3mm" : "10mm"}; }
        @media print { body { background: #fff !important; } .print-sheet { box-shadow: none !important; margin: 0 !important; } }
      `}</style>
      <div className="no-print print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
        {(
          [
            ["shop", "فروشگاهی A4"],
            ["official", "رسمی"],
            ["receipt", "رسید ۸۰ میلی‌متر"],
          ] as [Tpl, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTpl(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tpl === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {l}
          </button>
        ))}
        <button onClick={() => window.print()} disabled={blocked} className="mr-auto px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-40">
          🖨️ چاپ / PDF
        </button>
        <Link href={`/admin/accounting/invoices/${id}`} className="text-xs font-bold text-blue-600">
          بازگشت به فاکتور
        </Link>
      </div>

      {blocked ? (
        <div className="max-w-lg mx-auto mt-10 bg-white rounded-2xl p-6 text-sm leading-7">
          <p className="font-black mb-2">فاکتور رسمی هنوز آماده نیست</p>
          <p className="text-gray-600">
            برای فاکتور رسمی نام، شناسه یا کد ملی، نشانی و کد پستی فروشنده لازم است. در «حسابداری ← تنظیمات ← اطلاعات کسب‌وکار» کاملشان کنید.
          </p>
          <Link href="/admin/accounting/settings" className="inline-block mt-3 text-blue-600 font-bold">
            رفتن به تنظیمات
          </Link>
        </div>
      ) : tpl === "receipt" ? (
        <Receipt d={d} />
      ) : official ? (
        <Official d={d} />
      ) : (
        <Shop d={d} />
      )}
    </div>
  );
}

function Sheet({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`print-sheet bg-white mx-auto my-6 shadow-lg ${narrow ? "w-[80mm] p-3" : "w-[210mm] min-h-[297mm] p-[10mm]"} print:w-auto print:min-h-0 print:p-0`}>
      {children}
    </div>
  );
}

function Totals({ d, rial }: { d: PrintData; rial?: boolean }) {
  const inv = d.invoice;
  const m = (v: string | bigint) => formatAmount(rial ? b(v) * 10n : b(v));
  const discount = b(inv.lineDiscount) + b(inv.invoiceDiscount);
  return (
    <table className="text-[12px] w-full">
      <tbody>
        <tr>
          <td className="py-0.5">جمع اقلام</td>
          <td className="py-0.5 text-left tabular-nums">{m(inv.subtotal)}</td>
        </tr>
        {discount > 0n && (
          <tr>
            <td className="py-0.5">تخفیف</td>
            <td className="py-0.5 text-left tabular-nums">{m(discount)}</td>
          </tr>
        )}
        {b(inv.vatTotal) > 0n && (
          <tr>
            <td className="py-0.5">{inv.pricesIncludeVat ? "مالیات و عوارض (داخل مبلغ)" : "مالیات و عوارض"}</td>
            <td className="py-0.5 text-left tabular-nums">{m(inv.vatTotal)}</td>
          </tr>
        )}
        {b(inv.additions) > 0n && (
          <tr>
            <td className="py-0.5">{inv.additionsTitle ?? "اضافات"}</td>
            <td className="py-0.5 text-left tabular-nums">{m(inv.additions)}</td>
          </tr>
        )}
        <tr className="border-t border-black font-black text-[13px]">
          <td className="pt-1">مبلغ قابل پرداخت</td>
          <td className="pt-1 text-left tabular-nums">
            {m(inv.total)} {rial ? "ریال" : "تومان"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── فروشگاهی A4 ──────────────────────────────────────────────────────

function Shop({ d }: { d: PrintData }) {
  const inv = d.invoice;
  const s = d.print.seller;
  const sales = inv.type === "SALES" || inv.type === "SALES_RETURN" || inv.type === "PROFORMA";
  const showVat = b(inv.vatTotal) > 0n;
  return (
    <Sheet>
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.print.store.logo && <img src={d.print.store.logo} alt="" className="h-14 w-auto object-contain" />}
          <div>
            <p className="text-lg font-black">{d.print.store.name ?? s.name}</p>
            {s.phone && <p className="text-[11px]">تلفن: {faNum(s.phone)}</p>}
            {s.address && <p className="text-[11px] max-w-sm">{s.address}</p>}
          </div>
        </div>
        <div className="text-left text-[12px] space-y-0.5">
          <p className="text-base font-black">{INVOICE_TYPE_LABELS[inv.type]}</p>
          <p>شماره: {faNum(inv.number ?? 0)}</p>
          <p>تاریخ: {formatJalali(new Date(inv.date))}</p>
          {inv.validUntil && <p>اعتبار تا: {formatJalali(new Date(inv.validUntil))}</p>}
          {inv.dueDate && <p>سررسید: {formatJalali(new Date(inv.dueDate))}</p>}
        </div>
      </div>

      <div className="mt-3 text-[12px] grid grid-cols-2 gap-x-6 gap-y-0.5">
        <p>
          <span className="text-gray-600">{sales ? "خریدار" : "فروشنده"}: </span>
          <b>{inv.partyName}</b>
        </p>
        {inv.partyPhone && <p>تلفن: {faNum(inv.partyPhone)}</p>}
        {inv.partyAddress && <p className="col-span-2">نشانی: {inv.partyAddress}{inv.partyPostalCode && ` — کد پستی ${faNum(inv.partyPostalCode)}`}</p>}
      </div>

      <table className="w-full mt-4 text-[12px] border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-1.5 py-1 w-8">#</th>
            <th className="border border-gray-400 px-1.5 py-1 text-right">شرح کالا یا خدمت</th>
            <th className="border border-gray-400 px-1.5 py-1 w-12">تعداد</th>
            <th className="border border-gray-400 px-1.5 py-1 w-24">فی (تومان)</th>
            <th className="border border-gray-400 px-1.5 py-1 w-20">تخفیف</th>
            {showVat && <th className="border border-gray-400 px-1.5 py-1 w-20">مالیات</th>}
            <th className="border border-gray-400 px-1.5 py-1 w-28">جمع (تومان)</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id}>
              <td className="border border-gray-400 px-1.5 py-1 text-center">{faNum(l.seq)}</td>
              <td className="border border-gray-400 px-1.5 py-1">
                {l.title}
                {l.sku && <span className="text-[10px] text-gray-500 mr-1">({faNum(l.sku)})</span>}
              </td>
              <td className="border border-gray-400 px-1.5 py-1 text-center tabular-nums">{faNum(l.qty)}</td>
              <td className="border border-gray-400 px-1.5 py-1 text-left tabular-nums">{formatAmount(l.unitPrice)}</td>
              <td className="border border-gray-400 px-1.5 py-1 text-left tabular-nums">{formatAmount(b(l.discount) + b(l.invoiceDiscountShare))}</td>
              {showVat && <td className="border border-gray-400 px-1.5 py-1 text-left tabular-nums">{formatAmount(l.vatAmount)}</td>}
              <td className="border border-gray-400 px-1.5 py-1 text-left tabular-nums font-bold">{formatAmount(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-[1fr_260px] gap-6">
        <div className="text-[12px] space-y-2">
          <p>
            مبلغ به حروف: <b>{amountToWords(inv.total)} تومان</b>
          </p>
          {inv.note && <p className="whitespace-pre-line text-gray-700">توضیح: {inv.note}</p>}
          {s.footerNote && <p className="text-[11px] text-gray-600 whitespace-pre-line">{s.footerNote}</p>}
        </div>
        <Totals d={d} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-6 text-[11px] text-center">
        <div className="h-24 border-t border-dashed border-gray-400 pt-1 relative">
          مهر و امضای فروشنده
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.stampImage && sales && <img src={s.stampImage} alt="" className="h-20 mx-auto mt-1 object-contain opacity-90" />}
        </div>
        <div className="h-24 border-t border-dashed border-gray-400 pt-1">امضای خریدار</div>
      </div>
    </Sheet>
  );
}

// ── رسمی ─────────────────────────────────────────────────────────────

function PartyBox({ title, rows }: { title: string; rows: [string, string | null | undefined][] }) {
  return (
    <div className="border border-black">
      <p className="bg-gray-200 text-center font-black text-[12px] py-1 border-b border-black">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-2 text-[11px]">
        {rows.map(([k, v]) => (
          <p key={k} className={k === "نشانی" ? "col-span-2" : ""}>
            <span className="text-gray-600">{k}: </span>
            <b>{v ? faNum(v) : "—"}</b>
          </p>
        ))}
      </div>
    </div>
  );
}

function Official({ d }: { d: PrintData }) {
  const inv = d.invoice;
  const s = d.print.seller;
  const r = (v: string | bigint) => formatAmount(b(v) * 10n);
  const weSell = inv.type === "SALES" || inv.type === "SALES_RETURN" || inv.type === "PROFORMA";
  const us: [string, string | null][] = [
    ["نام شخص حقیقی / حقوقی", s.name],
    ["شماره اقتصادی", s.economicCode],
    ["شناسه ملی / کد ملی", s.nationalId],
    ["شماره ثبت", s.regNo],
    ["کد پستی", s.postalCode],
    ["تلفن", s.phone],
    ["نشانی", s.address],
  ];
  const them: [string, string | null][] = [
    ["نام شخص حقیقی / حقوقی", inv.partyName],
    ["شماره اقتصادی", inv.partyEconomicCode],
    ["شناسه ملی / کد ملی", inv.partyNationalId],
    ["کد پستی", inv.partyPostalCode],
    ["تلفن", inv.partyPhone],
    ["نشانی", inv.partyAddress],
  ];
  return (
    <Sheet>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] w-40" />
        <p className="text-base font-black">{OFFICIAL_TITLE[inv.type]}</p>
        <div className="text-[11px] w-40 text-left space-y-0.5">
          <p>شماره: {faNum(inv.number ?? 0)}</p>
          <p>تاریخ: {formatJalali(new Date(inv.date))}</p>
        </div>
      </div>
      <div className="space-y-2">
        <PartyBox title="مشخصات فروشنده" rows={weSell ? us : them} />
        <PartyBox title="مشخصات خریدار" rows={weSell ? them : us} />
      </div>

      <p className="bg-gray-200 border border-black border-b-0 text-center font-black text-[12px] py-1 mt-2">مشخصات کالا یا خدمات مورد معامله</p>
      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {["ردیف", "کد کالا", "شرح کالا یا خدمات", "تعداد / مقدار", "واحد", "مبلغ واحد (ریال)", "مبلغ کل (ریال)", "مبلغ تخفیف (ریال)", "مبلغ کل پس از تخفیف (ریال)", "جمع مالیات و عوارض (ریال)", "جمع کل پس از تخفیف و مالیات (ریال)"].map((h) => (
              <th key={h} className="border border-black px-1 py-1 font-bold leading-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => {
            const gross = b(l.unitPrice) * BigInt(l.qty);
            const disc = b(l.discount) + b(l.invoiceDiscountShare);
            return (
              <tr key={l.id}>
                <td className="border border-black px-1 py-1 text-center">{faNum(l.seq)}</td>
                <td className="border border-black px-1 py-1 text-center">{l.sku ? faNum(l.sku) : "—"}</td>
                <td className="border border-black px-1 py-1">{l.title}</td>
                <td className="border border-black px-1 py-1 text-center">{faNum(l.qty)}</td>
                <td className="border border-black px-1 py-1 text-center">عدد</td>
                <td className="border border-black px-1 py-1 text-left tabular-nums">{r(l.unitPrice)}</td>
                <td className="border border-black px-1 py-1 text-left tabular-nums">{r(gross)}</td>
                <td className="border border-black px-1 py-1 text-left tabular-nums">{r(disc)}</td>
                <td className="border border-black px-1 py-1 text-left tabular-nums">{r(gross - disc - (inv.pricesIncludeVat ? b(l.vatAmount) : 0n))}</td>
                <td className="border border-black px-1 py-1 text-left tabular-nums">{r(l.vatAmount)}</td>
                <td className="border border-black px-1 py-1 text-left tabular-nums font-bold">{r(l.lineTotal)}</td>
              </tr>
            );
          })}
          {b(inv.additions) > 0n && (
            <tr>
              <td className="border border-black px-1 py-1" colSpan={10}>
                {inv.additionsTitle ?? "اضافات"}
              </td>
              <td className="border border-black px-1 py-1 text-left tabular-nums font-bold">{r(inv.additions)}</td>
            </tr>
          )}
          <tr className="font-black bg-gray-100">
            <td className="border border-black px-1 py-1.5" colSpan={10}>
              جمع کل — {amountToWords(b(inv.total) * 10n)} ریال
            </td>
            <td className="border border-black px-1 py-1.5 text-left tabular-nums">{r(inv.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="border border-black border-t-0 p-2 text-[11px] space-y-1">
        <p>
          شرایط و نحوه‌ی فروش: {inv.dueDate ? `غیرنقدی — سررسید ${formatJalali(new Date(inv.dueDate))}` : "نقدی"}
        </p>
        {inv.note && <p className="whitespace-pre-line">توضیحات: {inv.note}</p>}
      </div>

      <div className="grid grid-cols-2 border border-black border-t-0 text-[11px] text-center">
        <div className="h-28 p-1 border-l border-black">
          مهر و امضای فروشنده
          {weSell && (s.stampImage || s.signatureImage) && (
            <div className="flex items-center justify-center gap-2 mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.stampImage && <img src={s.stampImage} alt="" className="h-20 object-contain" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.signatureImage && <img src={s.signatureImage} alt="" className="h-16 object-contain" />}
            </div>
          )}
        </div>
        <div className="h-28 p-1">مهر و امضای خریدار</div>
      </div>
      {s.footerNote && <p className="text-[10px] text-gray-600 mt-2 whitespace-pre-line">{s.footerNote}</p>}
    </Sheet>
  );
}

// ── رسید حرارتی ──────────────────────────────────────────────────────

function Receipt({ d }: { d: PrintData }) {
  const inv = d.invoice;
  const s = d.print.seller;
  return (
    <Sheet narrow>
      <div className="text-center text-[12px] leading-5">
        <p className="text-[14px] font-black">{d.print.store.name ?? s.name}</p>
        {s.phone && <p>{faNum(s.phone)}</p>}
        <p className="mt-1 font-bold">
          {INVOICE_TYPE_LABELS[inv.type]} {faNum(inv.number ?? 0)}
        </p>
        <p>{formatJalali(new Date(inv.date))}</p>
        <p>{inv.partyName}</p>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-[11px] space-y-1.5">
        {inv.lines.map((l) => (
          <div key={l.id}>
            <p className="font-bold leading-4">{l.title}</p>
            <div className="flex justify-between tabular-nums">
              <span>
                {faNum(l.qty)} × {formatAmount(l.unitPrice)}
              </span>
              <span className="font-bold">{formatAmount(l.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <Totals d={d} />
      {inv.note && <p className="text-[10px] mt-2 whitespace-pre-line">{inv.note}</p>}
      {s.footerNote && <p className="text-[10px] mt-2 text-center whitespace-pre-line">{s.footerNote}</p>}
      <p className="text-center text-[10px] mt-3">سپاس از خرید شما</p>
    </Sheet>
  );
}
