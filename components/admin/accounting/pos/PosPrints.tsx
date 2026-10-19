"use client";

/**
 * چاپ رسید صندوق (حرارتی ۸۰ یا ۵۸ میلی‌متر، با بارکد رسید برای مرجوعی) و برگه‌ی بستن صندوق.
 * `?auto=1` ← بلافاصله پنجره‌ی چاپ، و بعد از چاپ زبانه بسته می‌شود.
 * ⚠️ از تگ `<header>` استفاده نشود — CSS چاپی سراسری آن را پنهان می‌کند.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { code128Bars } from "@/lib/barcode/code128";
import { api } from "../ui";
import { ShiftReport } from "./ShiftPanels";
import { B, TICKET_KIND, abs, faNum, formatAmount, timeFa, type ShiftSummary } from "./shared";

interface TicketData {
  ticket: {
    id: string;
    number: number;
    kind: string;
    createdAt: string;
    sellerName: string | null;
    cashierName: string;
    partyName: string;
    cash: string;
    card: string;
    credit: string;
    tendered: string | null;
    change: string;
  };
  terminal: { name: string; header: string | null; footer: string | null; paperMm: number };
  store: { name: string | null; phone: string | null; address: string | null; footer: string | null };
  sale: { number: number | null; subtotal: string; discount: string; vat: string; total: string; lines: Line[] } | null;
  ret: { number: number | null; total: string; lines: Line[] } | null;
  barcode: string;
}
interface Line {
  title: string;
  qty: number;
  unitPrice: string;
  discount: string;
  lineTotal: string;
}

function useAutoPrint(ready: boolean) {
  const sp = useSearchParams();
  const auto = sp.get("auto") === "1";
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);
  useEffect(() => {
    if (!ready || !auto) return;
    const close = () => window.setTimeout(() => window.close(), 300);
    window.addEventListener("afterprint", close);
    const t = window.setTimeout(() => window.print(), 250);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", close);
    };
  }, [ready, auto]);
}

function Bar({ value }: { value: string }) {
  const { bars, width } = code128Bars(value);
  return (
    <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ width: "70%", height: "11mm", display: "block", margin: "0 auto" }} aria-label={value}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="#000" />
      ))}
    </svg>
  );
}

const Dash = () => <div className="my-1.5 border-t border-dashed border-black" />;

function Lines({ lines, sign = "" }: { lines: Line[]; sign?: string }) {
  return (
    <div className="space-y-1">
      {lines.map((l, i) => (
        <div key={i}>
          <p className="font-bold leading-4">{l.title}</p>
          <div className="flex justify-between tabular-nums">
            <span>
              {faNum(l.qty)} × {formatAmount(l.unitPrice)}
              {B(l.discount) > 0n && ` − ${formatAmount(l.discount)}`}
            </span>
            <span className="font-bold">
              {sign}
              {formatAmount(B(l.unitPrice) * BigInt(l.qty) - B(l.discount))}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const Kv = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between tabular-nums ${bold ? "text-[13px] font-black" : ""}`}>
    <span>{k}</span>
    <span>{v}</span>
  </div>
);

export function TicketPrint({ id }: { id: string }) {
  const [d, setD] = useState<TicketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<TicketData>(`/api/admin/accounting/pos/tickets/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useAutoPrint(!!d);
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!d) return <p className="p-6 text-sm text-gray-500">…</p>;
  const t = d.ticket;
  const mm = d.terminal.paperMm === 58 ? 58 : 80;
  const net = (d.sale ? B(d.sale.total) : 0n) - (d.ret ? B(d.ret.total) : 0n);
  const cash = B(t.cash);
  const card = B(t.card);
  return (
    <div className="min-h-screen bg-gray-100 text-black [color-scheme:light] print:bg-white" dir="rtl">
      <style>{`@page { size: ${mm}mm auto; margin: 2mm; } @media print { body { background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; } }`}</style>
      <div className="no-print flex gap-2 border-b border-gray-200 bg-white px-4 py-2.5 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white">
          🖨️ چاپ
        </button>
      </div>
      <div className="sheet mx-auto my-4 bg-white p-2 text-[11px] leading-5 shadow" style={{ width: `${mm - 4}mm` }}>
        <div className="text-center">
          <p className="text-[15px] font-black">{d.store.name}</p>
          {d.terminal.header && <p className="whitespace-pre-line">{d.terminal.header}</p>}
          {d.store.phone && <p>{faNum(d.store.phone)}</p>}
          <p className="mt-1 text-[12px] font-black">
            {TICKET_KIND[t.kind]} — رسید {faNum(t.number)}
          </p>
          <p>
            {formatJalali(new Date(t.createdAt))} · {timeFa(t.createdAt)} · {d.terminal.name}
          </p>
          <p>
            {t.sellerName ? `فروشنده: ${t.sellerName} · ` : ""}صندوقدار: {t.cashierName}
          </p>
          {t.partyName !== "مشتری حضوری" && <p>مشتری: {t.partyName}</p>}
        </div>
        {d.sale && (
          <>
            <Dash />
            <Lines lines={d.sale.lines} />
          </>
        )}
        {d.ret && (
          <>
            <Dash />
            <p className="font-black">مرجوعی</p>
            <Lines lines={d.ret.lines} sign="−" />
          </>
        )}
        <Dash />
        {d.sale && B(d.sale.discount) > 0n && <Kv k="تخفیف" v={`−${formatAmount(d.sale.discount)}`} />}
        {d.sale && d.ret && <Kv k="خرید" v={formatAmount(d.sale.total)} />}
        {d.ret && <Kv k="مرجوعی" v={`−${formatAmount(d.ret.total)}`} />}
        {d.sale && B(d.sale.vat) > 0n && <Kv k="مالیات (داخل قیمت)" v={formatAmount(d.sale.vat)} />}
        <Kv k={net < 0n ? "پس داده شد" : "جمع"} v={`${formatAmount(abs(net))} تومان`} bold />
        {cash !== 0n && <Kv k={cash < 0n ? "نقد پس داده شد" : "نقد"} v={formatAmount(abs(cash))} />}
        {card !== 0n && <Kv k={card < 0n ? "برگشت به کارت" : "کارت"} v={formatAmount(abs(card))} />}
        {B(t.credit) !== 0n && <Kv k={B(t.credit) > 0n ? "نسیه" : "روی حساب مشتری"} v={formatAmount(abs(B(t.credit)))} />}
        {t.tendered && <Kv k="دریافتی" v={formatAmount(t.tendered)} />}
        {B(t.change) > 0n && <Kv k="باقی پول" v={formatAmount(t.change)} bold />}
        <Dash />
        <Bar value={d.barcode} />
        <p className="text-center text-[9px] tracking-widest">{d.barcode}</p>
        {d.terminal.footer && <p className="mt-1 whitespace-pre-line text-center text-[10px]">{d.terminal.footer}</p>}
        {!d.terminal.footer && d.store.footer && <p className="mt-1 whitespace-pre-line text-center text-[10px]">{d.store.footer}</p>}
        <p className="mt-1 text-center text-[10px]">برای تعویض یا مرجوعی همین رسید را همراه داشته باشید</p>
      </div>
    </div>
  );
}

export function ShiftPrint({ id }: { id: string }) {
  const [s, setS] = useState<(ShiftSummary & { treasuryNames: Record<string, string> }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<NonNullable<typeof s>>(`/api/admin/accounting/pos/shifts/${id}`).then(setS).catch((e) => setError(e.message));
  }, [id]);
  useAutoPrint(!!s);
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!s) return <p className="p-6 text-sm text-gray-500">…</p>;
  const sh = s.shift;
  return (
    <div className="min-h-screen bg-gray-100 text-black [color-scheme:light] print:bg-white" dir="rtl">
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; } }`}</style>
      <div className="no-print flex gap-2 border-b border-gray-200 bg-white px-4 py-2.5 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white">
          🖨️ چاپ
        </button>
      </div>
      <div className="sheet mx-auto my-4 max-w-3xl bg-white p-8 shadow">
        <h1 className="text-xl font-black">
          گزارش بستن صندوق — {sh.terminal.name}، شیفت {faNum(sh.number)}
        </h1>
        <p className="mt-1 text-xs text-gray-600">
          باز: {formatJalali(new Date(sh.openedAt))} {timeFa(sh.openedAt)} ({sh.openedByName})
          {sh.closedAt && ` · بسته: ${formatJalali(new Date(sh.closedAt))} ${timeFa(sh.closedAt)} (${sh.closedByName})`}
        </p>
        <div className="mt-5">
          <ShiftReport s={s} names={s.treasuryNames} />
        </div>
        {sh.note && <p className="mt-4 text-sm">یادداشت: {sh.note}</p>}
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
          <p className="border-t border-gray-400 pt-2">امضای صندوقدار</p>
          <p className="border-t border-gray-400 pt-2">امضای مدیر</p>
        </div>
      </div>
    </div>
  );
}
