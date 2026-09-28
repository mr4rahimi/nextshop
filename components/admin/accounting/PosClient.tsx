"use client";

/**
 * فروش سریع حضوری (فاز ۱۰) — پیشخوان در یک صفحه: اسکن کالا، سبد، دریافت،
 * «ثبت و چاپ رسید». فاکتور فروش + دریافت تخصیص‌یافته با هم در یک تراکنش
 * (`/api/admin/accounting/pos`). میانبرها: F2 جستجو، F9 ثبت، Esc خالی کردن سبد.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { amountToWords, faNum, formatAmount } from "@/lib/accounting/money";
import { calcInvoice } from "@/lib/accounting/invoices/calc";
import AmountInput from "./AmountInput";
import PartyPicker, { type PartyOption } from "./PartyPicker";
import ProductPicker, { type ProductOption } from "./ProductPicker";
import { api, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, SectionTitle } from "./ui";

type Method = "CASH" | "POS" | "CARD_TRANSFER" | "GIFT_CARD";
const METHOD_LABEL: Record<Method, string> = { CASH: "نقد", POS: "کارتخوان", CARD_TRANSFER: "کارت‌به‌کارت", GIFT_CARD: "بن" };
const METHOD_KINDS: Record<Method, string[]> = { CASH: ["CASH"], POS: ["POS", "BANK"], CARD_TRANSFER: ["BANK"], GIFT_CARD: ["CASH", "BANK"] };

interface Cfg {
  mode: string;
  vatEnabled: boolean;
  vatRateBp: number;
  warehouses: { id: string; name: string; isDefault: boolean }[];
  treasuries: { id: string; name: string; kind: string; balance: string }[];
  can: { pay: boolean };
}
interface Line {
  productId: string;
  title: string;
  image: string | null;
  qty: number;
  unitPrice: string;
  vatRateBp: number;
  stock: number | null;
}
interface Pay {
  method: Method;
  treasuryId: string;
  amount: string;
}

export default function PosClient() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [party, setParty] = useState<PartyOption | null>(null);
  const [discount, setDiscount] = useState("");
  const [pays, setPays] = useState<Pay[]>([]);
  const [payTouched, setPayTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: string; number: number; total: string } | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const saveRef = useRef<(override?: boolean) => void>(() => {});

  useEffect(() => {
    api<Cfg>("/api/admin/accounting/pos")
      .then((c) => {
        setCfg(c);
        setWarehouseId((c.warehouses.find((w) => w.isDefault) ?? c.warehouses[0])?.id ?? "");
        const t = c.treasuries.find((x) => x.kind === "CASH");
        setPays([{ method: "CASH", treasuryId: t?.id ?? "", amount: "" }]);
      })
      .catch((e) => setError(e.message));
  }, []);

  const calc = useMemo(() => {
    try {
      return calcInvoice({
        lines: lines.map((l) => ({ qty: l.qty, unitPrice: BigInt(l.unitPrice || "0"), discount: 0n, vatRateBp: cfg?.vatEnabled ? l.vatRateBp : 0 })),
        invoiceDiscount: BigInt(discount || "0"),
        additions: 0n,
        pricesIncludeVat: true,
      });
    } catch {
      return null;
    }
  }, [lines, discount, cfg]);
  const total = calc?.total ?? 0n;
  const paid = pays.reduce((s, p) => s + BigInt(p.amount || "0"), 0n);
  const left = total - paid;

  // دریافت پیش‌فرض = کل سبد، تا وقتی کاربر دست نزده
  useEffect(() => {
    if (payTouched) return;
    setPays((x) => (x.length === 1 ? [{ ...x[0], amount: total > 0n ? total.toString() : "" }] : x));
  }, [total, payTouched]);

  function add(p: ProductOption) {
    setLast(null);
    setLines((x) => {
      const hit = x.find((l) => l.productId === p.id);
      if (hit) return x.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...x,
        {
          productId: p.id,
          title: p.title,
          image: p.image,
          qty: 1,
          unitPrice: p.price && p.price !== "0" ? p.price : "",
          vatRateBp: p.vatRateBp ?? cfg?.vatRateBp ?? 0,
          stock: warehouseId ? p.byWarehouse[warehouseId] ?? 0 : null,
        },
      ];
    });
  }
  const setQty = (id: string, q: number) => setLines((x) => (q <= 0 ? x.filter((l) => l.productId !== id) : x.map((l) => (l.productId === id ? { ...l, qty: q } : l))));

  function setMethod(i: number, m: Method) {
    const t = cfg?.treasuries.find((x) => METHOD_KINDS[m].includes(x.kind));
    setPays((x) => x.map((p, k) => (k === i ? { ...p, method: m, treasuryId: t?.id ?? "" } : p)));
  }
  function split() {
    setPayTouched(true);
    const t = cfg?.treasuries.find((x) => METHOD_KINDS.POS.includes(x.kind));
    setPays((x) => [...x, { method: "POS", treasuryId: t?.id ?? "", amount: left > 0n ? left.toString() : "" }]);
  }
  const reset = useCallback(() => {
    setLines([]);
    setDiscount("");
    setParty(null);
    setPayTouched(false);
    setError(null);
    const t = cfg?.treasuries.find((x) => x.kind === "CASH");
    setPays([{ method: "CASH", treasuryId: t?.id ?? "", amount: "" }]);
    setPickerKey((k) => k + 1);
  }, [cfg]);

  async function save(override = false) {
    if (!lines.length || busy) return;
    setBusy(true);
    setError(null);
    // پنجره‌ی رسید همین حالا (در لحظه‌ی کلیک) باز می‌شود — بعد از await مرورگر آن را پاپ‌آپ می‌داند و می‌بندد
    const win = window.open("about:blank", "_blank");
    try {
      const r = await api<{ id: string; number: number; total: string }>("/api/admin/accounting/pos", {
        method: "POST",
        json: {
          partyId: party?.id ?? null,
          warehouseId: warehouseId || null,
          invoiceDiscount: discount || "0",
          overrideCredit: override,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice || "0", vatRateBp: cfg?.vatEnabled ? l.vatRateBp : 0 })),
          payments: cfg?.can.pay ? pays.map((p) => ({ method: p.method, treasuryId: p.treasuryId, amount: p.amount || "0" })) : [],
        },
      });
      setLast(r);
      if (win) win.location.href = `/admin/accounting/invoices/${r.id}/print?tpl=receipt`;
      reset();
      setBusy(false);
    } catch (e) {
      win?.close();
      setBusy(false);
      const msg = e instanceof Error ? e.message : "ثبت نشد";
      if (msg.startsWith("OVER_CREDIT: ")) {
        if (window.confirm(`${msg.slice(13)}.\n\nبا این حال ثبت شود؟`)) return save(true);
        setError(msg.slice(13));
      } else setError(msg);
    }
  }
  saveRef.current = save;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        saveRef.current();
      } else if (e.key === "F2") {
        e.preventDefault();
        (document.querySelector("#pos-search input") as HTMLInputElement | null)?.focus();
      } else if (e.key === "Escape" && !(e.target as HTMLElement).closest("[role=dialog]")) {
        if (lines.length && window.confirm("سبد خالی شود؟")) reset();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lines.length, reset]);

  if (!cfg) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const walkIn = !party;

  return (
    <div className="space-y-4">
      <PageHeader title="فروش سریع حضوری" help="accountingPos" desc="اسکن کنید، مبلغ را بگیرید، رسید بدهید. F2 جستجو · F9 ثبت · Esc خالی کردن سبد" back={{ href: "/admin/accounting/sales", label: "فروش" }} />
      {cfg.mode !== "INTERNAL" && <ErrorText>حسابداری داخلی راه‌اندازی نشده است.</ErrorText>}
      {last && (
        <Card className="p-3 flex flex-wrap items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
          <p className="flex-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            ✓ فاکتور {faNum(last.number)} ثبت شد — {formatAmount(last.total)} تومان
          </p>
          <Link href={`/admin/accounting/invoices/${last.id}/print?tpl=receipt`} target="_blank" className={btn.small}>
            <Printer className="h-3.5 w-3.5" aria-hidden />
            رسید دوباره
          </Link>
          <Link href={`/admin/accounting/invoices/${last.id}`} className={btn.small}>
            فاکتور
          </Link>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-3">
          <Card className="p-3 space-y-2">
            <div id="pos-search">
              <ProductPicker key={pickerKey} onPick={add} warehouseId={warehouseId || undefined} priceFor="sales" autoFocus placeholder="اسکن بارکد یا جستجوی کالا (F2)" />
            </div>
            {cfg.warehouses.length > 1 && (
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={`${inputCls} !py-1.5 text-xs`}>
                {cfg.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    خروج از {w.name}
                  </option>
                ))}
              </select>
            )}
          </Card>

          <Card className="overflow-hidden">
            {!lines.length ? (
              <div className="py-16 text-center text-gray-400">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-40" aria-hidden />
                <p className="text-sm font-bold">سبد خالی است</p>
                <p className="text-xs mt-1">بارکد کالا را بزنید؛ هر اسکن یکی اضافه می‌کند.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {lines.map((l, i) => {
                  const lt = calc?.lines[i]?.lineTotal ?? 0n;
                  const short = l.stock !== null && l.qty > l.stock;
                  return (
                    <div key={l.productId} className="flex items-center gap-3 px-3 py-2.5">
                      {l.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                      ) : (
                        <span className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-white/5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{l.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-32">
                            <AmountInput value={l.unitPrice} onChange={(v) => setLines((x) => x.map((y) => (y.productId === l.productId ? { ...y, unitPrice: v } : y)))} compact />
                          </div>
                          {short && <span className="text-[10px] font-bold text-amber-600">موجودی {faNum(l.stock ?? 0)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setQty(l.productId, l.qty - 1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center" aria-label="یکی کم">
                          {l.qty === 1 ? <Trash2 className="h-3.5 w-3.5 text-red-500" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
                        </button>
                        <span className="w-8 text-center text-sm font-black tabular-nums">{faNum(l.qty)}</span>
                        <button onClick={() => setQty(l.productId, l.qty + 1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center" aria-label="یکی بیشتر">
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <Money value={lt} className="text-sm w-28 text-left shrink-0 hidden sm:block" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4">
          <Card className="p-4 space-y-3">
            <SectionTitle title="مشتری" />
            <PartyPicker value={party} onChange={setParty} canCreate role="customer" placeholder="اختیاری — نام یا موبایل" />
            {walkIn && <p className="text-[11px] text-gray-400">بی‌مشتری روی «مشتری حضوری» ثبت می‌شود؛ نسیه فقط با انتخاب مشتری.</p>}
          </Card>

          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{faNum(count)} قلم</span>
              <span className="tabular-nums">{formatAmount(calc?.subtotal ?? 0n)}</span>
            </div>
            <Field label="تخفیف">
              <AmountInput value={discount} onChange={setDiscount} compact />
            </Field>
            {calc && calc.vatTotal > 0n && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>مالیات (داخل قیمت)</span>
                <span className="tabular-nums">{formatAmount(calc.vatTotal)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 dark:border-white/10 pt-2">
              <p className="text-[11px] text-gray-500">مبلغ قابل پرداخت</p>
              <Money value={total} className="text-2xl" />
              {total > 0n && <p className="text-[10px] text-gray-400">{amountToWords(total)} تومان</p>}
            </div>
          </Card>

          {cfg.can.pay && (
            <Card className="p-4 space-y-3">
              <SectionTitle
                title="دریافت"
                actions={
                  <button onClick={split} className={btn.small}>
                    + روش دیگر
                  </button>
                }
              />
              {pays.map((p, i) => (
                <div key={i} className="rounded-xl bg-gray-50 dark:bg-white/5 p-2.5 space-y-2">
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(i, m)}
                        className={`px-1 py-1.5 rounded-lg text-[11px] font-bold ${p.method === m ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        {METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <AmountInput
                      value={p.amount}
                      onChange={(v) => {
                        setPayTouched(true);
                        setPays((x) => x.map((y, k) => (k === i ? { ...y, amount: v } : y)));
                      }}
                      compact
                    />
                    {pays.length > 1 && (
                      <button onClick={() => setPays((x) => x.filter((_, k) => k !== i))} className="text-gray-400 hover:text-red-600 px-1" aria-label="حذف">
                        ✕
                      </button>
                    )}
                  </div>
                  <select value={p.treasuryId} onChange={(e) => setPays((x) => x.map((y, k) => (k === i ? { ...y, treasuryId: e.target.value } : y)))} className={`${inputCls} !py-1.5 text-xs`}>
                    {cfg.treasuries
                      .filter((t) => METHOD_KINDS[p.method].includes(t.kind))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          به {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
              {total > 0n && left !== 0n && (
                <p className={`text-xs font-bold ${left < 0n ? "text-red-600" : "text-amber-600"}`}>
                  {left < 0n ? `${formatAmount(-left)} بیشتر از مبلغ — باقی پول مشتری را پس بدهید و مبلغ را درست کنید` : `${formatAmount(left)} نسیه${walkIn ? " — مشتری را انتخاب کنید" : ` به حساب ${party?.name}`}`}
                </p>
              )}
            </Card>
          )}

          <ErrorText>{error}</ErrorText>
          <div className="sticky bottom-20 lg:static z-20">
            <button onClick={() => save()} disabled={!lines.length || busy || total <= 0n || left < 0n || (walkIn && left > 0n && cfg.can.pay)} className={`${btn.primary} w-full !py-3.5 !text-base shadow-lg lg:shadow-none`}>
              <Printer className="h-5 w-5" aria-hidden />
              {busy ? "در حال ثبت…" : total > 0n ? `ثبت ${formatAmount(total)} و چاپ رسید` : "ثبت و چاپ رسید (F9)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
