"use client";

/**
 * چاپ رسید صندوق (حرارتی ۸۰ یا ۵۸ میلی‌متر، با بارکد رسید برای مرجوعی) و برگه‌ی بستن صندوق.
 * `?auto=1` ← بلافاصله پنجره‌ی چاپ، و بعد از چاپ زبانه بسته می‌شود.
 * پیش‌فاکتور (پیش از پرداخت): سبد صندوق از `localStorage` (`pos:prebill:<terminalId>`)، بی ثبت در دفتر.
 * ⚠️ از تگ `<header>` استفاده نشود — CSS چاپی سراسری آن را پنهان می‌کند.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { code128Bars } from "@/lib/barcode/code128";
import QRCode from "qrcode";
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
    couponCode?: string | null;
    couponDiscount?: string;
    giftSpent?: string;
    giftRestored?: string;
    transfer?: string;
    transferRef?: string | null;
    voidedAt?: string | null;
    voidReason?: string | null;
    voidedByName?: string | null;
  };
  pay?: { reader: string | null; transferTo: string | null };
  terminal: ReceiptTerminal;
  store: { name: string | null; phone: string | null; address: string | null; footer: string | null };
  sale: { number: number | null; subtotal: string; discount: string; vat: string; total: string; lines: Line[] } | null;
  ret: { number: number | null; total: string; lines: Line[] } | null;
  barcode: string;
  /** کارت اشتراک (بخش ۲۳ هم‌ترازی) */
  club: { card: string | null; spent: string; earned: string; restored: string; reversed: string; balance: string } | null;
}
interface Line {
  title: string;
  qty: number;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  serials?: string[];
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

/** تنظیمات رسید هر صندوق (فرم «ویرایش صندوق») */
export interface ReceiptTerminal {
  name: string;
  /** عنوان بالای رسید؛ خالی = نام فروشگاه */
  title?: string | null;
  header: string | null;
  footer: string | null;
  qr?: string | null;
  qrCaption?: string | null;
  showStaff?: boolean;
  paperMm: number;
}

/** QR پایین رسید — بی شبکه، از کتابخانه‌ی qrcode */
function Qr({ value, caption }: { value: string; caption?: string | null }) {
  let size = 0;
  let cells: boolean[] = [];
  try {
    const q = QRCode.create(value, { errorCorrectionLevel: "M" });
    size = q.modules.size;
    cells = Array.from(q.modules.data as unknown as ArrayLike<number>, (v) => !!v);
  } catch {
    return null;
  }
  const pad = 2;
  const n = size + pad * 2;
  return (
    <div className="mt-1.5 text-center">
      <svg viewBox={`0 0 ${n} ${n}`} style={{ width: "26mm", height: "26mm", display: "block", margin: "0 auto" }} shapeRendering="crispEdges" aria-label={value}>
        <rect width={n} height={n} fill="#fff" />
        {cells.map((on, i) => (on ? <rect key={i} x={(i % size) + pad} y={Math.floor(i / size) + pad} width={1} height={1} fill="#000" /> : null))}
      </svg>
      {caption && <p className="text-[10px] font-bold">{caption}</p>}
    </div>
  );
}

const Dash = () => <div className="my-1.5 border-t border-dashed border-black" />;

function Lines({ lines, sign = "" }: { lines: Line[]; sign?: string }) {
  return (
    <div className="space-y-1">
      {lines.map((l, i) => (
        <div key={i}>
          <p className="font-bold leading-4">{l.title}</p>
          {!!l.serials?.length && <p className="font-mono text-[10px]" dir="ltr">سریال: {l.serials.join("، ")}</p>}
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
  // سهم مرجوعی که به کارت اشتراک برگشت، نقد پس داده نمی‌شود
  const net = (d.sale ? B(d.sale.total) : 0n) - (d.ret ? B(d.ret.total) : 0n) + (d.club ? B(d.club.restored) : 0n) + B(d.ticket.giftRestored ?? "0");
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
          <p className="text-[15px] font-black">{d.terminal.title || d.store.name}</p>
          {d.terminal.header && <p className="whitespace-pre-line">{d.terminal.header}</p>}
          {d.store.phone && <p>{faNum(d.store.phone)}</p>}
          <p className="mt-1 text-[12px] font-black">
            {TICKET_KIND[t.kind]} — رسید {faNum(t.number)}
          </p>
          <p>
            {formatJalali(new Date(t.createdAt))} · {timeFa(t.createdAt)} · {d.terminal.name}
          </p>
          {d.terminal.showStaff && (
            <p>
              {t.sellerName ? `فروشنده: ${t.sellerName} · ` : ""}صندوقدار: {t.cashierName}
            </p>
          )}
          {t.partyName !== "مشتری حضوری" && <p>مشتری: {t.partyName}</p>}
          {t.voidedAt && (
            <p className="mt-1 border-2 border-black py-0.5 text-[13px] font-black">
              باطل شده — {formatJalali(new Date(t.voidedAt))}
              <span className="block text-[10px] font-bold">
                {t.voidReason} ({t.voidedByName})
              </span>
            </p>
          )}
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
        {d.ticket.couponCode && B(d.ticket.couponDiscount ?? "0") > 0n && <Kv k={`از آن، کد ${d.ticket.couponCode}`} v={`−${formatAmount(d.ticket.couponDiscount!)}`} />}
        {d.sale && d.ret && <Kv k="خرید" v={formatAmount(d.sale.total)} />}
        {d.ret && <Kv k="مرجوعی" v={`−${formatAmount(d.ret.total)}`} />}
        {d.sale && B(d.sale.vat) > 0n && <Kv k="مالیات (داخل قیمت)" v={formatAmount(d.sale.vat)} />}
        <Kv k={net < 0n ? "پس داده شد" : "جمع"} v={`${formatAmount(abs(net))} تومان`} bold />
        {cash !== 0n && <Kv k={cash < 0n ? "نقد پس داده شد" : "نقد"} v={formatAmount(abs(cash))} />}
        {card !== 0n && <Kv k={`${card < 0n ? "برگشت به کارت" : "کارت"}${d.pay?.reader ? ` (${d.pay.reader})` : ""}`} v={formatAmount(abs(card))} />}
        {B(t.transfer ?? "0") > 0n && <Kv k={`کارت به کارت${d.pay?.transferTo ? ` (${d.pay.transferTo})` : ""}${t.transferRef ? ` — ${t.transferRef}` : ""}`} v={formatAmount(t.transfer!)} />}
        {B(t.credit) !== 0n && <Kv k={B(t.credit) > 0n ? "نسیه" : "روی حساب مشتری"} v={formatAmount(abs(B(t.credit)))} />}
        {d.club && B(d.club.spent) > 0n && <Kv k="کارت اشتراک" v={formatAmount(d.club.spent)} />}
        {d.club && B(d.club.restored) > 0n && <Kv k="برگشت به کارت اشتراک" v={formatAmount(d.club.restored)} />}
        {B(d.ticket.giftSpent ?? "0") > 0n && <Kv k="بن کارت" v={formatAmount(d.ticket.giftSpent!)} />}
        {B(d.ticket.giftRestored ?? "0") > 0n && <Kv k="برگشت به بن کارت" v={formatAmount(d.ticket.giftRestored!)} />}
        {t.tendered && <Kv k="دریافتی" v={formatAmount(t.tendered)} />}
        {B(t.change) > 0n && <Kv k="باقی پول" v={formatAmount(t.change)} bold />}
        {B(t.credit) > 0n && (
          <>
            <p className="mt-1 text-center text-[11px] font-black">مبلغ {formatAmount(t.credit)} تومان بدهی مشتری است</p>
            <p className="mt-5 border-t border-dashed border-black pt-1 text-center text-[10px]">امضای مشتری</p>
          </>
        )}
        {d.club && (
          <>
            <Dash />
            <p className="text-center text-[10px] font-black">کارت اشتراک {d.club.card ?? ""}</p>
            {B(d.club.earned) > 0n && <Kv k="شارژ این خرید" v={`+${formatAmount(d.club.earned)}`} />}
            {B(d.club.reversed) > 0n && <Kv k="کسر شارژ مرجوعی" v={`−${formatAmount(d.club.reversed)}`} />}
            <Kv k="مانده‌ی اعتبار" v={`${formatAmount(d.club.balance)} تومان`} bold />
          </>
        )}
        <Dash />
        <Bar value={d.barcode} />
        <p className="text-center text-[9px] tracking-widest">{d.barcode}</p>
        {d.terminal.footer && <p className="mt-1 whitespace-pre-line text-center text-[10px]">{d.terminal.footer}</p>}
        {!d.terminal.footer && d.store.footer && <p className="mt-1 whitespace-pre-line text-center text-[10px]">{d.store.footer}</p>}
        {d.terminal.qr && <Qr value={d.terminal.qr} caption={d.terminal.qrCaption} />}
        <p className="mt-1 text-center text-[10px]">برای تعویض یا مرجوعی همین رسید را همراه داشته باشید</p>
      </div>
    </div>
  );
}

/** سبد صندوق برای پیش‌فاکتور — `PosRegister` می‌نویسد */
export interface PreBill {
  at: string;
  terminal: ReceiptTerminal;
  store: { name: string | null; phone: string | null };
  seller: string | null;
  cashier: string;
  party: string | null;
  lines: Line[];
  ret: Line[];
  subtotal: string;
  discounts: { label: string; amount: string }[];
  retTotal: string;
  net: string;
  club: { credit: string; use: string; charge: string } | null;
}

export function PreBillPrint({ terminalId }: { terminalId: string }) {
  // فقط در مرورگر (سرور localStorage ندارد) — بی ناهمخوانی hydration
  const raw = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(`pos:prebill:${terminalId}`);
      } catch {
        return null;
      }
    },
    () => undefined,
  );
  const d = useMemo<PreBill | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as PreBill) : null;
    } catch {
      return null;
    }
  }, [raw]);
  useAutoPrint(!!d);
  if (raw === undefined) return <p className="p-6 text-sm text-gray-500">…</p>;
  if (!d) return <p className="p-6 text-sm text-gray-500">سبدی برای چاپ نیست؛ از صفحه‌ی صندوق «چاپ پیش‌فاکتور» را بزنید.</p>;
  const mm = d.terminal.paperMm === 58 ? 58 : 80;
  const net = B(d.net);
  const due = d.club ? net - B(d.club.use) : net;
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
          {(d.terminal.title || d.store.name) && <p className="text-[15px] font-black">{d.terminal.title || d.store.name}</p>}
          {d.terminal.header && <p className="whitespace-pre-line">{d.terminal.header}</p>}
          {d.store.phone && <p>{faNum(d.store.phone)}</p>}
          <p className="mt-1 border-y-2 border-black py-0.5 text-[13px] font-black">پیش‌فاکتور — پرداخت نشده</p>
          <p>
            {formatJalali(new Date(d.at))} · {timeFa(d.at)} · {d.terminal.name}
          </p>
          {d.terminal.showStaff && (
            <p>
              {d.seller ? `فروشنده: ${d.seller} · ` : ""}صندوقدار: {d.cashier}
            </p>
          )}
          {d.party && <p>مشتری: {d.party}</p>}
        </div>
        {d.lines.length > 0 && (
          <>
            <Dash />
            <Lines lines={d.lines} />
          </>
        )}
        {d.ret.length > 0 && (
          <>
            <Dash />
            <p className="font-black">مرجوعی</p>
            <Lines lines={d.ret} sign="−" />
          </>
        )}
        <Dash />
        {d.lines.length > 0 && <Kv k="جمع کالاها" v={formatAmount(d.subtotal)} />}
        {d.discounts.map((x) => (
          <Kv key={x.label} k={x.label} v={`−${formatAmount(x.amount)}`} />
        ))}
        {B(d.retTotal) > 0n && <Kv k="مرجوعی (تقریبی)" v={`−${formatAmount(d.retTotal)}`} />}
        <Kv k={net < 0n ? "پس دادنی" : "جمع"} v={`${formatAmount(abs(net))} تومان`} bold />
        {d.club && B(d.club.use) > 0n && (
          <>
            <Kv k="از اعتبار کارت اشتراک" v={`−${formatAmount(d.club.use)}`} />
            <Kv k="قابل پرداخت" v={`${formatAmount(due)} تومان`} bold />
          </>
        )}
        {d.club && B(d.club.charge) > 0n && <Kv k="شارژ کارت با این خرید" v={`+${formatAmount(d.club.charge)}`} />}
        <Dash />
        <p className="text-center text-[10px] font-bold">این برگه رسید پرداخت نیست؛ رسید بعد از پرداخت چاپ می‌شود.</p>
        <p className="text-center text-[10px]">قیمت‌ها و تخفیف‌ها تا لحظه‌ی پرداخت معتبر است.</p>
        {d.terminal.footer && <p className="mt-1 whitespace-pre-line text-center text-[10px]">{d.terminal.footer}</p>}
        {d.terminal.qr && <Qr value={d.terminal.qr} caption={d.terminal.qrCaption} />}
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
