"use client";

/**
 * صفحه‌ی صندوق (پیشخوان) — docs/plans/inventory-items.md بخش ۱۳.
 *
 * تمام‌صفحه و بی‌قاب پنل. کادر اسکن همیشه فعال است: بارکد، کد تازه، کد قبلی یا نام.
 * کد قبلیِ چندرنگ/چندسایز پنجره‌ی رنگ × سایز باز می‌کند؛ بارکد رسید (`POS12`) مرجوعی.
 *
 * میانبرها: F2 اسکن · F3 فروشنده · F4 تخفیف · F6 مشتری · F7 سبد معلق · F8 مرجوعی ·
 * F9 پرداخت نقد · F10 پرداخت کارتی · ↑↓ ردیف · + − تعداد · عدد* تعداد · Delete حذف ردیف · Esc
 *
 * ⚠️ پنجره‌ی رسید پیش از `await` باز می‌شود (تله‌ی ۴۱ حسابداری).
 * ⚠️ مبلغ دقیق مرجوعی را فقط سرور می‌داند (سهم تخفیف گرد می‌شود) — با مرجوعی، جمع از
 *    `?quote=1` می‌آید و پرداخت نقد همیشه «باقی» فرستاده می‌شود.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Banknote, ClipboardList, CreditCard, Lock, Minus, PauseCircle, Percent, Plus, Printer, RotateCcw, ScanLine, ShoppingBag, Trash2, User, UserRound, X,
} from "lucide-react";
import { calcInvoice } from "@/lib/accounting/invoices/calc";
import { parseAmountInput } from "@/lib/accounting/money";
import HelpButton from "@/components/admin/worklist/HelpButton";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api } from "../ui";
import ModelPicker from "./ModelPicker";
import PaySheet, { type PayResult } from "./PaySheet";
import ReturnSheet, { type Returnable } from "./ReturnSheet";
import { CloseShift, OpenShift } from "./ShiftPanels";
import { B, Kbd, TICKET_KIND, abs, beep, faNum, formatAmount, local, timeFa, type ModelPick, type PosItem, type ScanResult, type ShiftSummary } from "./shared";

interface Boot {
  terminal: {
    id: string;
    name: string;
    roundTo: number;
    isActive: boolean;
    warehouseName: string;
    cash: { id: string; name: string } | null;
    card: { id: string; name: string } | null;
  };
  shift: ShiftSummary | null;
  sellers: { id: string; code: number; name: string }[];
  cashBook: string;
  lastKeptFloat: string | null;
  cashier: string;
  can: { manage: boolean };
}

interface Line {
  key: string;
  productId: string;
  code: string;
  title: string;
  image: string | null;
  qty: number;
  unitPrice: string;
  basePrice: string;
  discount: string;
  stock: number;
}
interface RetLine {
  key: string;
  refLineId: string | null;
  productId: string;
  title: string;
  qty: number;
  max: number;
  each: string;
}
interface RetState {
  /** null = بی‌رسید (مدیر) */
  src: Returnable | null;
  lines: RetLine[];
}
interface Held {
  at: string;
  lines: Line[];
  ret: RetState | null;
  party: PartyOption | null;
  discount: string;
}
type Modal = null | "seller" | "party" | "pay" | "return" | "model" | "list" | "discount" | "held" | "close" | "tickets";

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export default function PosRegister({ terminalId }: { terminalId: string }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [party, setParty] = useState<PartyOption | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [ret, setRet] = useState<RetState | null>(null);
  const [blind, setBlind] = useState(false);
  const [discount, setDiscount] = useState("");
  const [sel, setSel] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [payStart, setPayStart] = useState<"cash" | "card">("cash");
  const [pick, setPick] = useState<ModelPick | null>(null);
  const [list, setList] = useState<PosItem[]>([]);
  const [returnCode, setReturnCode] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [quote, setQuote] = useState<{ saleTotal: string; returnTotal: string; net: string } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: string; number: number; net: bigint; change: bigint; kind: string } | null>(null);
  const [printOn, setPrintOn] = useState(true);
  const [held, setHeld] = useState<Held[]>([]);
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const b = await api<Boot>(`/api/admin/accounting/pos/terminals/${terminalId}`);
      setBoot(b);
      setSellerId((cur) => {
        const saved = cur ?? local.get<string | null>(`pos:seller:${terminalId}`, null);
        return b.sellers.some((s) => s.id === saved) ? saved : null;
      });
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "بارگذاری نشد");
    }
  }, [terminalId]);

  useEffect(() => {
    load();
    setHeld(local.get<Held[]>(`pos:held:${terminalId}`, []));
    setPrintOn(local.get<boolean>("pos:print", true));
  }, [load, terminalId]);

  const flash = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    setToast({ text, tone });
    if (tone === "err") beep(false);
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), tone === "err" ? 4000 : 2200);
  }, []);

  const focusScan = useCallback(() => window.setTimeout(() => scanRef.current?.focus(), 30), []);
  useEffect(() => {
    if (!modal) focusScan();
  }, [modal, focusScan]);

  // فروشنده لازم و انتخاب نشده ← پنجره‌ی فروشنده
  useEffect(() => {
    if (boot?.shift && boot.sellers.length && !sellerId && !modal) setModal("seller");
  }, [boot, sellerId, modal]);

  const seller = boot?.sellers.find((s) => s.id === sellerId) ?? null;
  const roundTo = BigInt(boot?.terminal.roundTo ?? 0);

  // ── جمع‌ها ──
  const sale = useMemo(() => {
    if (!lines.length) return { subtotal: 0n, discount: 0n, total: 0n, rounding: 0n, valid: true };
    try {
      const c = calcInvoice({
        lines: lines.map((l) => ({ qty: l.qty, unitPrice: B(l.unitPrice), discount: B(l.discount), vatRateBp: 0 })),
        invoiceDiscount: B(discount),
        additions: 0n,
        pricesIncludeVat: true,
      });
      const rounding = roundTo > 0n ? c.total % roundTo : 0n;
      return { subtotal: c.subtotal, discount: c.lineDiscount + c.invoiceDiscount + rounding, total: c.total - rounding, rounding, valid: true };
    } catch {
      return { subtotal: 0n, discount: 0n, total: 0n, rounding: 0n, valid: false };
    }
  }, [lines, discount, roundTo]);
  const retApprox = useMemo(() => (ret?.lines ?? []).reduce((s, l) => s + B(l.each) * BigInt(l.qty), 0n), [ret]);
  const hasRet = !!ret?.lines.length;
  const saleTotal = hasRet && quote ? B(quote.saleTotal) : sale.total;
  const retTotal = hasRet && quote ? B(quote.returnTotal) : retApprox;
  const net = saleTotal - retTotal;
  const exact = !hasRet || !!quote;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  const ticketBody = useCallback(
    () => ({
      terminalId,
      sellerId,
      partyId: ret?.src ? (ret.src.walkIn ? null : ret.src.partyId) : party?.id ?? null,
      invoiceDiscount: discount || "0",
      sale: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice || "0", discount: l.discount || "0" })),
      ret: ret?.lines.length ? { invoiceId: ret.src?.invoiceId ?? null, lines: ret.lines.map((l) => ({ refLineId: l.refLineId, productId: l.productId, qty: l.qty })) } : null,
    }),
    [terminalId, sellerId, party, discount, lines, ret],
  );

  // پیش‌نمایش دقیق وقتی مرجوعی در سبد است
  useEffect(() => {
    if (!hasRet || !boot?.shift) {
      setQuote(null);
      return;
    }
    setQuote(null);
    setQuoting(true);
    const h = window.setTimeout(() => {
      api<{ quote: { saleTotal: string; returnTotal: string; net: string } }>(`/api/admin/accounting/pos/tickets?quote=1`, { method: "POST", json: { ...ticketBody(), pay: { cash: "rest", card: "0" } } })
        .then((r) => setQuote(r.quote))
        .catch((e) => flash(e.message, "err"))
        .finally(() => setQuoting(false));
    }, 350);
    return () => window.clearTimeout(h);
  }, [hasRet, ticketBody, boot?.shift, flash]);

  // ── سبد ──
  function addItem(it: PosItem) {
    setLast(null);
    if (blind) {
      if (B(it.price) <= 0n) return flash(`«${it.title}» قیمت ندارد`, "err");
      setRet((r) => {
        const base = r && !r.src ? r : { src: null, lines: [] as RetLine[] };
        const hit = base.lines.find((l) => l.productId === it.id);
        return {
          src: null,
          lines: hit
            ? base.lines.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l))
            : [...base.lines, { key: newKey(), refLineId: null, productId: it.id, title: it.title, qty: 1, max: 9999, each: it.price }],
        };
      });
      beep();
      return;
    }
    setLines((x) => {
      const i = x.findIndex((l) => l.productId === it.id && l.unitPrice === (B(it.price) > 0n ? it.price : l.unitPrice));
      if (i >= 0) {
        setSel(i);
        return x.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l));
      }
      setSel(x.length);
      return [
        ...x,
        { key: newKey(), productId: it.id, code: it.code, title: it.title, image: it.image, qty: 1, unitPrice: B(it.price) > 0n ? it.price : "", basePrice: it.price, discount: "", stock: it.stock },
      ];
    });
    beep();
    if (B(it.price) <= 0n) flash(`«${it.title}» قیمت ندارد — قیمت را بنویسید`, "err");
  }

  function setQty(i: number, n: number) {
    setLines((x) => (n <= 0 ? x.filter((_, k) => k !== i) : x.map((l, k) => (k === i ? { ...l, qty: n } : l))));
    if (n <= 0) setSel((s) => Math.max(0, Math.min(s, lines.length - 2)));
  }

  function clearCart() {
    setLines([]);
    setRet(null);
    setBlind(false);
    setDiscount("");
    setParty(null);
    setSel(0);
    setQuote(null);
  }

  async function scan(raw: string) {
    const code = raw.trim();
    if (!code || scanning) return;
    setScanning(true);
    try {
      const r = await api<ScanResult>(`/api/admin/accounting/pos/scan?terminalId=${terminalId}&q=${encodeURIComponent(code)}`);
      setQ("");
      if (r.kind === "item") addItem(r.item);
      else if (r.kind === "model") {
        if (r.pick.items.length === 1 && !boot?.can.manage) addItem(r.pick.items[0]);
        else {
          setPick(r.pick);
          setModal("model");
        }
      } else if (r.kind === "ticket") {
        setReturnCode(r.code);
        setModal("return");
      } else if (!r.items.length) flash(`«${code}» پیدا نشد`, "err");
      else if (r.items.length === 1) addItem(r.items[0]);
      else {
        setList(r.items);
        setModal("list");
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "پیدا نشد", "err");
    } finally {
      setScanning(false);
    }
  }

  // ── سبد معلق (فقط همین دستگاه) ──
  function hold() {
    if (!lines.length && !ret?.lines.length) return setModal("held");
    const next = [...held, { at: new Date().toISOString(), lines, ret, party, discount }];
    setHeld(next);
    local.set(`pos:held:${terminalId}`, next);
    clearCart();
    flash("سبد کنار گذاشته شد — F7 برای برگرداندن");
  }
  function unhold(i: number) {
    const h = held[i];
    if (lines.length || ret?.lines.length) hold();
    const next = held.filter((_, k) => k !== i);
    setHeld(next);
    local.set(`pos:held:${terminalId}`, next);
    setLines(h.lines);
    setRet(h.ret);
    setParty(h.party);
    setDiscount(h.discount);
    setModal(null);
  }

  // ── ثبت ──
  async function submit(p: PayResult, override = false) {
    if (busy) return;
    setBusy(true);
    setPayError(null);
    const win = printOn ? window.open("about:blank", "_blank") : null;
    try {
      const r = await api<{ ticket: { id: string; number: number; saleTotal: string; returnTotal: string; change: string; kind: string } }>("/api/admin/accounting/pos/tickets", {
        method: "POST",
        json: { ...ticketBody(), pay: { cash: p.cash === null ? "rest" : p.cash.toString(), card: p.card.toString() }, tendered: p.tendered?.toString() ?? null, overrideCredit: override },
      });
      const t = r.ticket;
      if (win) win.location.href = `/admin/accounting/pos/tickets/${t.id}/print?auto=1`;
      setLast({ id: t.id, number: t.number, net: B(t.saleTotal) - B(t.returnTotal), change: B(t.change), kind: t.kind });
      beep();
      clearCart();
      setModal(null);
      setBusy(false);
      load();
    } catch (e) {
      win?.close();
      setBusy(false);
      const msg = e instanceof Error ? e.message : "ثبت نشد";
      if (msg.startsWith("OVER_CREDIT: ")) {
        if (window.confirm(`${msg.slice(13)}.\n\nبا این حال ثبت شود؟`)) return submit(p, true);
        setPayError(msg.slice(13));
      } else setPayError(msg);
      beep(false);
    }
  }

  function openPay(start: "cash" | "card") {
    if (!lines.length && !ret?.lines.length) return flash("سبد خالی است", "err");
    if (!sale.valid) return flash("تخفیف یا قیمت یک ردیف درست نیست", "err");
    if (lines.some((l) => B(l.unitPrice) <= 0n)) return flash("یک کالا قیمت ندارد", "err");
    if (boot?.sellers.length && !sellerId) return setModal("seller");
    setPayStart(start);
    setPayError(null);
    setModal("pay");
  }

  // ── کیبورد ──
  const stateRef = useRef({ modal, lines, sel, q, blind });
  stateRef.current = { modal, lines, sel, q, blind };
  const actions = useRef({ openPay, hold, setQty, clearCart });
  actions.current = { openPay, hold, setQty, clearCart };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.modal) return;
      const fk: Record<string, () => void> = {
        F2: () => scanRef.current?.focus(),
        F3: () => setModal("seller"),
        F4: () => setModal("discount"),
        F6: () => setModal("party"),
        F7: () => actions.current.hold(),
        F8: () => {
          setReturnCode(undefined);
          setModal("return");
        },
        F9: () => actions.current.openPay("cash"),
        F10: () => actions.current.openPay("card"),
      };
      if (fk[e.key]) {
        e.preventDefault();
        fk[e.key]();
        return;
      }
      const empty = !s.q;
      const cur = s.lines[s.sel];
      if (e.key === "Escape") {
        if (s.blind) setBlind(false);
        else if (s.lines.length && window.confirm("سبد خالی شود؟")) actions.current.clearCart();
      } else if (e.key === "ArrowDown" && empty) {
        e.preventDefault();
        setSel((x) => Math.min(s.lines.length - 1, x + 1));
      } else if (e.key === "ArrowUp" && empty) {
        e.preventDefault();
        setSel((x) => Math.max(0, x - 1));
      } else if ((e.key === "+" || e.key === "-") && empty && cur) {
        e.preventDefault();
        actions.current.setQty(s.sel, cur.qty + (e.key === "+" ? 1 : -1));
      } else if (e.key === "*" && cur && /^\d+$/.test(parseAmountInput(s.q))) {
        e.preventDefault();
        actions.current.setQty(s.sel, Math.min(10_000, Number(parseAmountInput(s.q))));
        setQ("");
      } else if (e.key === "Delete" && empty && cur) {
        e.preventDefault();
        actions.current.setQty(s.sel, 0);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── باز کردن صندوق ──
  async function openShift(float: bigint) {
    setOpenBusy(true);
    setOpenError(null);
    try {
      await api("/api/admin/accounting/pos/shifts", { method: "POST", json: { terminalId, openingFloat: float.toString() } });
      await load();
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : "باز نشد");
    } finally {
      setOpenBusy(false);
    }
  }

  if (bootError) return <Center>{bootError}</Center>;
  if (!boot) return <Center>در حال آماده‌سازی صندوق…</Center>;

  const header = (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[var(--adm-border)] bg-[var(--adm-chrome)] px-3 backdrop-blur-xl sm:px-4">
      <Link href="/admin/accounting/pos" className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5" aria-label="بازگشت">
        <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-base font-black text-gray-900 dark:text-white">
          {boot.terminal.name} <HelpButton topic="accountingPosRegister" size="sm" />
        </p>
        <p className="truncate text-[11px] font-bold text-gray-400">
          {boot.shift ? `شیفت ${faNum(boot.shift.shift.number)} · از ${timeFa(boot.shift.shift.openedAt)} · ${boot.terminal.warehouseName}` : "بسته"}
        </p>
      </div>
      {boot.shift && (
        <>
          <div className="mx-2 hidden h-8 w-px bg-[var(--adm-border)] md:block" />
          {boot.sellers.length > 0 && (
            <button onClick={() => setModal("seller")} className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-black transition ${seller ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-amber-500/15 text-amber-700"}`}>
              <UserRound className="h-4 w-4" aria-hidden />
              <span className="max-w-[9rem] truncate">{seller ? seller.name : "فروشنده؟"}</span>
              <Kbd>F3</Kbd>
            </button>
          )}
          <button onClick={() => !ret?.src && setModal("party")} className="flex h-10 items-center gap-2 rounded-xl bg-gray-100 px-3 text-sm font-bold text-gray-700 dark:bg-white/5 dark:text-gray-200">
            <User className="h-4 w-4" aria-hidden />
            <span className="max-w-[9rem] truncate">{ret?.src ? ret.src.partyName : party?.name ?? "مشتری حضوری"}</span>
            <Kbd>F6</Kbd>
          </button>
          <div className="mr-auto flex items-center gap-1">
            <HeadBtn icon={RotateCcw} label="مرجوعی" k="F8" onClick={() => { setReturnCode(undefined); setModal("return"); }} tone="rose" />
            <HeadBtn icon={PauseCircle} label={held.length ? `معلق (${faNum(held.length)})` : "معلق"} k="F7" onClick={hold} />
            <HeadBtn icon={ClipboardList} label="رسیدها" onClick={() => setModal("tickets")} />
            <HeadBtn icon={Lock} label="بستن صندوق" onClick={() => setModal("close")} />
          </div>
        </>
      )}
    </header>
  );

  if (!boot.shift) {
    return (
      <div className="flex h-dvh flex-col bg-[var(--adm-bg)] text-gray-900 dark:text-gray-100">
        {header}
        <OpenShift terminalName={boot.terminal.name} suggested={B(boot.lastKeptFloat ?? boot.cashBook)} onOpen={openShift} busy={openBusy} error={openError} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--adm-bg)] text-gray-900 dark:text-gray-100">
      {header}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_400px]">
        {/* ── سبد ── */}
        <main className="flex min-h-0 flex-col gap-3 p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scan(q);
            }}
            className="relative"
          >
            <ScanLine className={`pointer-events-none absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 ${blind ? "text-rose-500" : "text-emerald-500"}`} aria-hidden />
            <input
              ref={scanRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder={blind ? "مرجوعی بی‌رسید: کالای برگشتی را اسکن کنید (Esc پایان)" : "بارکد را اسکن کنید، یا کد و نام کالا را بنویسید"}
              className={`w-full rounded-2xl border-2 bg-[var(--adm-surface)] py-4 pl-28 pr-14 text-lg font-bold shadow-[var(--adm-shadow)] outline-none transition placeholder:text-gray-400 ${blind ? "border-rose-300 focus:border-rose-500" : "border-transparent focus:border-emerald-500"}`}
            />
            <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-gray-400">
              {scanning ? "…" : <><Kbd>F2</Kbd> <Kbd>Enter</Kbd></>}
            </span>
          </form>

          {last && (
            <div className="adm-fade-in flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="flex-1 text-sm font-black text-emerald-700 dark:text-emerald-300">
                ✓ {TICKET_KIND[last.kind]} — رسید {faNum(last.number)} — {formatAmount(abs(last.net))} تومان{last.net < 0n ? " پس داده شد" : ""}
              </p>
              {last.change > 0n && <p className="rounded-xl bg-amber-100 px-3 py-1.5 text-lg font-black text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">باقی پول: {formatAmount(last.change)}</p>}
              <a href={`/admin/accounting/pos/tickets/${last.id}/print?auto=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                <Printer className="h-3.5 w-3.5" aria-hidden /> چاپ دوباره
              </a>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
            {!lines.length && !ret?.lines.length ? (
              <div className="flex h-full flex-col items-center justify-center p-10 text-center text-gray-400">
                <ShoppingBag className="mb-3 h-14 w-14 opacity-30" aria-hidden />
                <p className="text-base font-black">سبد خالی است</p>
                <p className="mt-1 text-xs">بارکد کالا یا برچسب قبلی را اسکن کنید.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--adm-border)]">
                {lines.map((l, i) => {
                  const lt = B(l.unitPrice) * BigInt(l.qty) - B(l.discount);
                  const short = l.qty > l.stock;
                  const priceEditable = !!boot.can.manage || B(l.basePrice) <= 0n;
                  return (
                    <div key={l.key} onClick={() => setSel(i)} className={`flex items-center gap-3 px-3 py-3 transition sm:px-4 ${sel === i ? "bg-emerald-500/[0.07]" : ""}`}>
                      <span className={`h-10 w-1 shrink-0 rounded-full ${sel === i ? "bg-emerald-500" : "bg-transparent"}`} />
                      {l.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[10px] font-black text-gray-400 dark:bg-white/5">{l.code.slice(-4)}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-black text-gray-900 dark:text-white">{l.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-gray-400">
                          <span className="tabular-nums">{l.code}</span>
                          {priceEditable ? (
                            <input
                              value={l.unitPrice ? formatAmount(l.unitPrice) : ""}
                              onChange={(e) => setLines((x) => x.map((y, k) => (k === i ? { ...y, unitPrice: parseAmountInput(e.target.value) } : y)))}
                              onKeyDown={(e) => e.key === "Enter" && focusScan()}
                              placeholder="قیمت"
                              className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-left text-xs font-black tabular-nums text-gray-800 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
                              dir="ltr"
                            />
                          ) : (
                            <span className="tabular-nums">{formatAmount(l.unitPrice)}</span>
                          )}
                          {B(l.discount) > 0n && <span className="rounded-md bg-rose-500/10 px-1.5 text-rose-600">تخفیف {formatAmount(l.discount)}</span>}
                          {short && <span className="rounded-md bg-amber-500/10 px-1.5 text-amber-600">موجودی {faNum(l.stock)}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setQty(i, l.qty - 1); }} className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 active:scale-95 dark:bg-white/5" aria-label="یکی کم">
                          {l.qty === 1 ? <Trash2 className="h-4 w-4 text-red-500" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
                        </button>
                        <span className="w-9 text-center text-lg font-black tabular-nums">{faNum(l.qty)}</span>
                        <button onClick={(e) => { e.stopPropagation(); setQty(i, l.qty + 1); }} className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 active:scale-95 dark:bg-white/5" aria-label="یکی بیشتر">
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <span className="hidden w-32 shrink-0 text-left text-base font-black tabular-nums sm:block">{formatAmount(lt)}</span>
                    </div>
                  );
                })}
                {ret?.lines.map((l) => (
                  <div key={l.key} className="flex items-center gap-3 bg-rose-500/[0.06] px-3 py-3 sm:px-4">
                    <span className="h-10 w-1 shrink-0 rounded-full bg-rose-500" />
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                      <RotateCcw className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-black text-rose-700 dark:text-rose-300">مرجوعی: {l.title}</p>
                      <p className="text-[11px] font-bold text-rose-500/80">
                        {ret.src ? `رسید ${faNum(ret.src.ticketNumber ?? ret.src.invoiceNumber ?? 0)}` : "بی‌رسید — قیمت امروز"} · هر عدد {formatAmount(l.each)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => setRet((r) => (r ? { ...r, lines: r.lines.flatMap((x) => (x.key === l.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])) } : r))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600"
                        aria-label="کم"
                      >
                        {l.qty === 1 ? <Trash2 className="h-4 w-4" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
                      </button>
                      <span className="w-9 text-center text-lg font-black tabular-nums text-rose-700 dark:text-rose-300">{faNum(l.qty)}</span>
                      <button
                        onClick={() => setRet((r) => (r ? { ...r, lines: r.lines.map((x) => (x.key === l.key ? { ...x, qty: Math.min(x.max, x.qty + 1) } : x)) } : r))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600"
                        aria-label="زیاد"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <span className="hidden w-32 shrink-0 text-left text-base font-black tabular-nums text-rose-600 sm:block">−{formatAmount(B(l.each) * BigInt(l.qty))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 lg:flex">
            <span><Kbd>↑</Kbd><Kbd>↓</Kbd> ردیف</span>
            <span><Kbd>+</Kbd><Kbd>−</Kbd> تعداد</span>
            <span>عدد <Kbd>*</Kbd> تعداد دقیق</span>
            <span><Kbd>Delete</Kbd> حذف</span>
            <span><Kbd>F4</Kbd> تخفیف</span>
            <span><Kbd>Esc</Kbd> خالی کردن</span>
          </p>
        </main>

        {/* ── جمع و پرداخت ── */}
        <aside className="flex flex-col gap-3 border-t border-[var(--adm-border)] p-3 sm:p-4 lg:border-r lg:border-t-0">
          <div className="rounded-3xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]">
            <div className="flex justify-between text-sm font-bold text-gray-500">
              <span>{faNum(itemCount)} کالا</span>
              <span className="tabular-nums">{formatAmount(sale.subtotal)}</span>
            </div>
            {sale.discount > 0n && (
              <div className="mt-1 flex justify-between text-sm font-bold text-rose-600">
                <span>تخفیف{sale.rounding > 0n ? " و گرد کردن" : ""}</span>
                <span className="tabular-nums">−{formatAmount(sale.discount)}</span>
              </div>
            )}
            {hasRet && (
              <div className="mt-1 flex justify-between text-sm font-bold text-rose-600">
                <span>مرجوعی {quoting && "…"}</span>
                <span className="tabular-nums">
                  −{!exact && "≈"}
                  {formatAmount(retTotal)}
                </span>
              </div>
            )}
            <button onClick={() => setModal("discount")} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
              <Percent className="h-3.5 w-3.5" aria-hidden /> تخفیف <Kbd>F4</Kbd>
            </button>
            <div className="mt-3 border-t border-[var(--adm-border)] pt-3">
              <p className="text-xs font-bold text-gray-500">{net < 0n ? "پس دادن به مشتری" : "قابل پرداخت"}</p>
              <p className={`mt-0.5 text-[2.6rem] font-black leading-tight tabular-nums tracking-tight ${net < 0n ? "text-rose-600" : "text-gray-900 dark:text-white"}`}>
                {!exact && <span className="text-2xl text-gray-400">≈ </span>}
                {formatAmount(abs(net))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openPay("cash")}
              className="flex flex-col items-center justify-center gap-1 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 py-5 text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.98]"
            >
              <Banknote className="h-7 w-7" aria-hidden />
              <span className="text-base font-black">{net < 0n ? "پس دادن" : "نقد / ترکیبی"}</span>
              <span className="opacity-80"><Kbd>F9</Kbd></span>
            </button>
            <button
              onClick={() => openPay("card")}
              disabled={!boot.terminal.card}
              className="flex flex-col items-center justify-center gap-1 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 py-5 text-white shadow-lg shadow-blue-600/25 transition active:scale-[0.98] disabled:opacity-40"
            >
              <CreditCard className="h-7 w-7" aria-hidden />
              <span className="text-base font-black">کارتخوان</span>
              <span className="opacity-80"><Kbd>F10</Kbd></span>
            </button>
          </div>

          <label className="flex items-center gap-2 px-1 text-xs font-bold text-gray-500">
            <input
              type="checkbox"
              checked={printOn}
              onChange={(e) => {
                setPrintOn(e.target.checked);
                local.set("pos:print", e.target.checked);
              }}
              className="h-4 w-4 accent-emerald-600"
            />
            چاپ خودکار رسید
          </label>
          {(lines.length > 0 || hasRet) && (
            <button onClick={() => window.confirm("سبد خالی شود؟") && clearCart()} className="inline-flex items-center justify-center gap-1 rounded-2xl py-2 text-xs font-bold text-gray-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" aria-hidden /> خالی کردن سبد <Kbd>Esc</Kbd>
            </button>
          )}
          <p className="mt-auto hidden text-center text-[11px] text-gray-400 lg:block">صندوقدار: {boot.cashier}</p>
        </aside>
      </div>

      {toast && (
        <div className={`adm-fade-in fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-2xl ${toast.tone === "err" ? "bg-red-600" : "bg-gray-900"}`}>{toast.text}</div>
      )}

      {/* ── پنجره‌ها ── */}
      {modal === "seller" && (
        <SellerPicker
          sellers={boot.sellers}
          current={sellerId}
          onPick={(id) => {
            setSellerId(id);
            local.set(`pos:seller:${terminalId}`, id);
            setModal(null);
          }}
          onClose={() => (sellerId || !boot.sellers.length ? setModal(null) : undefined)}
        />
      )}
      {modal === "party" && (
        <Overlay title="مشتری" onClose={() => setModal(null)}>
          <PartyPicker
            value={party}
            onChange={(p) => {
              setParty(p);
              if (p) setModal(null);
            }}
            canCreate
            role="customer"
            placeholder="نام یا موبایل مشتری"
          />
          <p className="mt-3 text-[11px] leading-6 text-gray-400">بی‌مشتری روی «مشتری حضوری» ثبت می‌شود؛ نسیه و برگشت روی حساب فقط با انتخاب مشتری.</p>
          {party && (
            <button onClick={() => { setParty(null); setModal(null); }} className="mt-2 text-xs font-bold text-red-600">
              برداشتن مشتری
            </button>
          )}
        </Overlay>
      )}
      {modal === "model" && pick && (
        <ModelPicker
          pick={pick}
          terminalId={terminalId}
          canCreate={boot.can.manage}
          onPick={(it) => {
            addItem(it);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "list" && <ListPicker items={list} onPick={(it) => { addItem(it); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "return" && (
        <ReturnSheet
          initialCode={returnCode}
          canBlind={boot.can.manage}
          onClose={() => setModal(null)}
          onBlind={() => {
            setBlind(true);
            setRet((r) => (r && !r.src ? r : { src: null, lines: [] }));
            setModal(null);
            flash("مرجوعی بی‌رسید: کالاهای برگشتی را اسکن کنید");
          }}
          onAdd={(src, picks) => {
            setBlind(false);
            setRet({
              src,
              lines: picks.map((p) => {
                const l = src.lines.find((x) => x.refLineId === p.refLineId)!;
                return { key: newKey(), refLineId: l.refLineId, productId: l.productId, title: l.title, qty: p.qty, max: l.left, each: l.each };
              }),
            });
            if (!src.walkIn) setParty({ id: src.partyId, code: 0, name: src.partyName, mobile: null });
            setModal(null);
          }}
        />
      )}
      {modal === "pay" && (
        <PaySheet
          net={net}
          exact={exact}
          hasCard={!!boot.terminal.card}
          canCredit={ret?.src ? !ret.src.walkIn : !!party}
          start={payStart}
          busy={busy || (hasRet && !quote)}
          error={payError}
          onSubmit={(p) => submit(p)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "discount" && (
        <DiscountSheet
          line={lines[sel] ?? null}
          subtotal={sale.subtotal}
          invoiceDiscount={discount}
          onLine={(v) => setLines((x) => x.map((l, k) => (k === sel ? { ...l, discount: v } : l)))}
          onInvoice={setDiscount}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "held" && (
        <Overlay title="سبدهای معلق" onClose={() => setModal(null)}>
          {!held.length ? (
            <p className="py-6 text-center text-sm text-gray-400">سبد معلقی نیست. با F7 سبد جاری کنار گذاشته می‌شود.</p>
          ) : (
            <div className="space-y-2">
              {held.map((h, i) => (
                <button key={h.at} onClick={() => unhold(i)} className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 p-3 text-right hover:border-emerald-400 dark:border-white/10">
                  <span className="text-sm font-black tabular-nums text-gray-500">{timeFa(h.at)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{h.lines.map((l) => l.title).join("، ") || "مرجوعی"}</span>
                  <span className="text-xs font-bold text-gray-400">{faNum(h.lines.reduce((s, l) => s + l.qty, 0))} کالا</span>
                </button>
              ))}
            </div>
          )}
        </Overlay>
      )}
      {modal === "tickets" && <TicketsSheet shiftId={boot.shift.shift.id} onClose={() => setModal(null)} />}
      {modal === "close" && (
        <Overlay title="بستن صندوق" wide onClose={() => setModal(null)}>
          <CloseShift
            shiftId={boot.shift.shift.id}
            onCancel={() => setModal(null)}
            onClosed={(id) => {
              window.open(`/admin/accounting/pos/shifts/${id}/print?auto=1`, "_blank");
              setModal(null);
              clearCart();
              load();
            }}
          />
        </Overlay>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-dvh items-center justify-center bg-[var(--adm-bg)] p-6 text-sm font-bold text-gray-500">{children}</div>;
}

function HeadBtn({ icon: I, label, k, onClick, tone }: { icon: typeof Lock; label: string; k?: string; onClick: () => void; tone?: "rose" }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition hover:bg-gray-100 dark:hover:bg-white/5 ${tone === "rose" ? "text-rose-600" : "text-gray-600 dark:text-gray-300"}`}
    >
      <I className="h-4 w-4" aria-hidden />
      <span className="hidden xl:inline">{label}</span>
      {k && <span className="hidden xl:inline"><Kbd>{k}</Kbd></span>}
    </button>
  );
}

function Overlay({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`adm-sheet-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111620] ${wide ? "max-w-4xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/5">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5" aria-label="بستن">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** فروشنده: دکمه‌ی بزرگ برای لمس، یا کد + Enter */
function SellerPicker({ sellers, current, onPick, onClose }: { sellers: Boot["sellers"]; current: string | null; onPick: (id: string) => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (/^[0-9۰-۹]$/.test(e.key)) {
        const d = "۰۱۲۳۴۵۶۷۸۹".indexOf(e.key);
        setCode((c) => (c + (d >= 0 ? String(d) : e.key)).slice(-2));
      }
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
      else if (e.key === "Enter") {
        const s = sellers.find((x) => x.code === Number(code));
        if (s) onPick(s.id);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [code, sellers, onPick, onClose]);
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="adm-sheet-in relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111620]">
        <h3 className="text-center text-xl font-black text-gray-900 dark:text-white">فروشنده کیست؟</h3>
        <p className="mt-1 text-center text-xs text-gray-400">روی نام بزنید یا کد را بنویسید و Enter {code && <b className="text-violet-600">— کد {faNum(Number(code))}</b>}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sellers.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-5 transition active:scale-95 ${
                s.id === current || String(s.code) === code ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-gray-200 hover:border-violet-300 dark:border-white/10"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 text-lg font-black text-white">{s.name.slice(0, 1)}</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{s.name}</span>
              <span className="text-[11px] font-bold text-gray-400">کد {faNum(s.code)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListPicker({ items, onPick, onClose }: { items: PosItem[]; onPick: (it: PosItem) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") setI((x) => Math.min(items.length - 1, x + 1));
      else if (e.key === "ArrowUp") setI((x) => Math.max(0, x - 1));
      else if (e.key === "Enter") onPick(items[i]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [i, items, onPick]);
  return (
    <Overlay title="کدام کالا؟" onClose={onClose}>
      <div className="space-y-1.5">
        {items.map((it, k) => (
          <button
            key={it.id}
            onClick={() => onPick(it)}
            onMouseEnter={() => setI(k)}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-right transition ${k === i ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-transparent"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black">{it.title}</span>
              <span className="text-[11px] font-bold text-gray-400">
                {it.code} · موجودی {faNum(it.stock)}
              </span>
            </span>
            <span className="text-sm font-black tabular-nums">{formatAmount(it.price)}</span>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function DiscountSheet({
  line,
  subtotal,
  invoiceDiscount,
  onLine,
  onInvoice,
  onClose,
}: {
  line: Line | null;
  subtotal: bigint;
  invoiceDiscount: string;
  onLine: (v: string) => void;
  onInvoice: (v: string) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<"line" | "invoice">(line ? "line" : "invoice");
  const [mode, setMode] = useState<"pct" | "amount">("pct");
  const [v, setV] = useState("");
  const base = target === "line" && line ? B(line.unitPrice) * BigInt(line.qty) : subtotal;
  const amount = mode === "pct" ? (base * BigInt(Math.min(100, Number(v) || 0) * 100)) / 10_000n : B(parseAmountInput(v));
  function apply() {
    const s = amount > 0n ? amount.toString() : "";
    if (target === "line") onLine(s);
    else onInvoice(s);
    onClose();
  }
  return (
    <Overlay title="تخفیف" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!line} onClick={() => setTarget("line")} className={`truncate rounded-2xl border-2 px-3 py-3 text-sm font-black disabled:opacity-40 ${target === "line" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-white/10"}`}>
            {line ? `ردیف: ${line.title}` : "ردیفی انتخاب نشده"}
          </button>
          <button onClick={() => setTarget("invoice")} className={`rounded-2xl border-2 px-3 py-3 text-sm font-black ${target === "invoice" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-white/10"}`}>
            کل خرید
          </button>
        </div>
        <div className="flex gap-2">
          {(["pct", "amount"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-xl py-2 text-xs font-black ${mode === m ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-500 dark:bg-white/5"}`}>
              {m === "pct" ? "درصد" : "مبلغ (تومان)"}
            </button>
          ))}
        </div>
        <input
          autoFocus
          inputMode="numeric"
          value={mode === "amount" && v ? formatAmount(parseAmountInput(v)) : v}
          onChange={(e) => setV(mode === "pct" ? e.target.value.replace(/[^\d.۰-۹]/g, "").replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))) : parseAmountInput(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder={mode === "pct" ? "مثلاً ۱۰" : "مبلغ تخفیف"}
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-left text-2xl font-black tabular-nums outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5"
          dir="ltr"
        />
        {mode === "pct" && <div className="flex gap-1.5">{[5, 10, 15, 20, 30].map((p) => <button key={p} onClick={() => setV(String(p))} className="flex-1 rounded-xl bg-gray-100 py-2 text-xs font-black dark:bg-white/5">{faNum(p)}٪</button>)}</div>}
        <p className="text-sm font-bold text-gray-500">
          تخفیف: <span className="text-lg font-black text-rose-600 tabular-nums">{formatAmount(amount)}</span> تومان
          {target === "invoice" && B(invoiceDiscount) > 0n && <span className="mr-2 text-xs">(فعلی {formatAmount(invoiceDiscount)})</span>}
        </p>
        <div className="flex gap-2">
          <button onClick={apply} className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white">
            اعمال
          </button>
          <button
            onClick={() => {
              if (target === "line") onLine("");
              else onInvoice("");
              onClose();
            }}
            className="rounded-2xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300"
          >
            بدون تخفیف
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function TicketsSheet({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const [rows, setRows] = useState<{ id: string; number: number; kind: string; createdAt: string; sellerName: string | null; partyName: string; saleTotal: string; returnTotal: string }[] | null>(null);
  useEffect(() => {
    api<{ tickets: NonNullable<typeof rows> }>(`/api/admin/accounting/pos/tickets?shiftId=${shiftId}`).then((d) => setRows(d.tickets)).catch(() => setRows([]));
  }, [shiftId]);
  return (
    <Overlay title="رسیدهای این شیفت" onClose={onClose}>
      {!rows ? (
        <p className="text-sm text-gray-400">…</p>
      ) : !rows.length ? (
        <p className="py-6 text-center text-sm text-gray-400">هنوز رسیدی ثبت نشده</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((t) => {
            const n = B(t.saleTotal) - B(t.returnTotal);
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="w-12 text-sm font-black tabular-nums">{faNum(t.number)}</span>
                <span className="min-w-0 flex-1 text-xs">
                  <span className="font-black">{TICKET_KIND[t.kind]}</span>
                  <span className="text-gray-400"> · {timeFa(t.createdAt)} · {t.sellerName ?? "—"} · {t.partyName}</span>
                </span>
                <span className={`text-sm font-black tabular-nums ${n < 0n ? "text-rose-600" : ""}`}>{formatAmount(n)}</span>
                <a href={`/admin/accounting/pos/tickets/${t.id}/print?auto=1`} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white" aria-label="چاپ">
                  <Printer className="h-4 w-4" aria-hidden />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}
