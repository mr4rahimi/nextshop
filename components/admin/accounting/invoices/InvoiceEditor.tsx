"use client";

/**
 * فرم فاکتور — فروش، خرید، پیش‌فاکتور و برگشتی‌ها (docs/plans/accounting.md بخش ۱۰ و ۱۳).
 *
 * - کالا با جستجو یا بارکدخوان اضافه می‌شود (هر اسکن یک عدد)؛ قیمت پیش‌فرض
 *   فروش از سایت و خرید از آخرین خرید همین فروشنده.
 * - ردیف خدمت/هزینه کالا ندارد و روی یک حساب درآمد یا هزینه می‌نشیند.
 * - جمع‌ها با همان `calcInvoice` سرور حساب می‌شوند — عددی که دیده می‌شود همان
 *   است که ذخیره می‌شود.
 * - برگشتی از فاکتور مرجع ساخته می‌شود: فقط تعداد قابل تغییر است؛ مبلغ همان مبلغ فاکتور اصلی.
 * - میانبر: Ctrl+Enter صدور.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { amountToWords, faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";
import { calcInvoice, divRound, INVOICE_TYPE_LABELS, type CalcResult, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import ProductPicker, { type ProductOption } from "../ProductPicker";
import { api, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, SectionTitle } from "../ui";
import { Plus } from "lucide-react";

interface FormCfg {
  mode: string;
  vatEnabled: boolean;
  vatRateBp: number;
  pricesIncludeVat: boolean;
  warehouses: { id: string; name: string; isDefault: boolean; sellable: boolean }[];
  revenueAccounts: { id: string; code: string; name: string; systemKey: string | null }[];
  expenseAccounts: { id: string; code: string; name: string; systemKey: string | null }[];
  today: string;
  year: { id: string; title: string } | null;
}

interface Line {
  key: number;
  productId: string | null;
  title: string;
  qty: string;
  unitPrice: string;
  discount: string;
  vatPct: string;
  accountId: string;
  image?: string | null;
  sku?: string | null;
  stock?: Record<string, number>;
  /** برگشتی */
  refLineId?: string;
  maxQty?: number;
  refQty?: number;
  refDisc?: bigint;
}

interface DetailLine {
  id: string;
  productId: string | null;
  title: string;
  qty: number;
  unitPrice: string;
  discount: string;
  invoiceDiscountShare: string;
  vatRateBp: number;
  accountId: string | null;
  image: string | null;
  sku: string | null;
  returnedQty: number;
  refLineId: string | null;
}

interface Detail {
  invoice: {
    id: string;
    type: InvoiceTypeKey;
    number: number | null;
    status: "DRAFT" | "ISSUED" | "VOID";
    channel: string;
    date: string;
    dueDate: string | null;
    validUntil: string | null;
    partyId: string;
    partyName: string;
    party: { id: string; code: number; name: string; mobile: string | null };
    warehouseId: string | null;
    pricesIncludeVat: boolean;
    invoiceDiscount: string;
    additions: string;
    additionsTitle: string | null;
    note: string | null;
    refInvoiceId: string | null;
    lines: DetailLine[];
  };
}

let seq = 0;
const nextKey = () => ++seq;
const digits = (v: string) => toLatinDigits(v).replace(/[^\d.]/g, "");
const pctToBp = (v: string) => Math.round(Number(digits(v) || "0") * 100);
const bpToPct = (bp: number) => (bp ? String(bp / 100) : "");

const RETURN_OF: Partial<Record<InvoiceTypeKey, InvoiceTypeKey>> = { SALES: "SALES_RETURN", PURCHASE: "PURCHASE_RETURN" };

export default function InvoiceEditor({ type: typeProp, id, refId }: { type?: InvoiceTypeKey; id?: string; refId?: string }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<FormCfg | null>(null);
  const [type, setType] = useState<InvoiceTypeKey>(typeProp ?? "SALES");
  const [status, setStatus] = useState<"NEW" | "DRAFT" | "ISSUED">("NEW");
  const [number, setNumber] = useState<number | null>(null);
  const [channel, setChannel] = useState("MANUAL");
  const [party, setParty] = useState<PartyOption | null>(null);
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [inclVat, setInclVat] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [invDiscount, setInvDiscount] = useState("");
  const [additions, setAdditions] = useState("");
  const [additionsTitle, setAdditionsTitle] = useState("");
  const [note, setNote] = useState("");
  const [refInvoice, setRefInvoice] = useState<{ id: string; number: number | null; type: InvoiceTypeKey } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isReturn = type === "SALES_RETURN" || type === "PURCHASE_RETURN";
  const salesSide = type === "SALES" || type === "SALES_RETURN" || type === "PROFORMA";
  const hasRef = !!refInvoice;

  // ── بارگذاری ──
  useEffect(() => {
    (async () => {
      try {
        const c = await api<FormCfg>("/api/admin/accounting/invoices/form");
        setCfg(c);
        const def = c.warehouses.find((w) => w.isDefault) ?? c.warehouses[0];
        setWarehouseId(def?.id ?? "");
        setDate(c.today);
        setInclVat(c.vatEnabled && c.pricesIncludeVat);

        if (id) {
          const d = await api<Detail>(`/api/admin/accounting/invoices/${id}`);
          const inv = d.invoice;
          if (inv.status === "VOID") throw new Error("فاکتور باطل‌شده ویرایش نمی‌شود");
          setType(inv.type);
          setStatus(inv.status);
          setNumber(inv.number);
          setChannel(inv.channel);
          setParty({ id: inv.party.id, code: inv.party.code, name: inv.party.name, mobile: inv.party.mobile });
          setDate(inv.date.slice(0, 10));
          setDueDate(inv.dueDate?.slice(0, 10) ?? "");
          setValidUntil(inv.validUntil?.slice(0, 10) ?? "");
          if (inv.warehouseId) setWarehouseId(inv.warehouseId);
          setInclVat(inv.pricesIncludeVat);
          setInvDiscount(inv.invoiceDiscount === "0" ? "" : inv.invoiceDiscount);
          setAdditions(inv.additions === "0" ? "" : inv.additions);
          setAdditionsTitle(inv.additionsTitle ?? "");
          setNote(inv.note ?? "");
          if (inv.refInvoiceId) {
            const r = await api<Detail>(`/api/admin/accounting/invoices/${inv.refInvoiceId}`);
            setRefInvoice({ id: r.invoice.id, number: r.invoice.number, type: r.invoice.type });
            const mine = new Map(inv.lines.map((l) => [l.refLineId, l.qty]));
            setLines(r.invoice.lines.map((rl) => refLine(rl, mine.get(rl.id) ?? 0, mine.get(rl.id) ?? 0)));
          } else {
            setLines(inv.lines.map(fromDetail));
          }
        } else if (refId) {
          const r = await api<Detail>(`/api/admin/accounting/invoices/${refId}`);
          const rt = RETURN_OF[r.invoice.type];
          if (!rt) throw new Error("برای این نوع فاکتور برگشتی ثبت نمی‌شود");
          setType(rt);
          setRefInvoice({ id: r.invoice.id, number: r.invoice.number, type: r.invoice.type });
          setParty({ id: r.invoice.party.id, code: r.invoice.party.code, name: r.invoice.party.name, mobile: r.invoice.party.mobile });
          setInclVat(r.invoice.pricesIncludeVat);
          if (r.invoice.warehouseId) setWarehouseId(r.invoice.warehouseId);
          setLines(r.invoice.lines.map((rl) => refLine(rl, rl.qty - rl.returnedQty, 0)).filter((l) => (l.maxQty ?? 0) > 0));
        }
        setLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "بارگذاری نشد");
      }
    })();
  }, [id, refId]);

  function fromDetail(l: DetailLine): Line {
    return {
      key: nextKey(),
      productId: l.productId,
      title: l.title,
      qty: String(l.qty),
      unitPrice: l.unitPrice,
      discount: l.discount === "0" ? "" : l.discount,
      vatPct: bpToPct(l.vatRateBp),
      accountId: l.accountId ?? "",
      image: l.image,
      sku: l.sku,
    };
  }

  /** ردیف برگشتی از ردیف فاکتور مرجع — `own` تعدادی که همین برگشتی قبلاً داشته */
  function refLine(rl: DetailLine, qty: number, own: number): Line {
    return {
      key: nextKey(),
      productId: rl.productId,
      title: rl.title,
      qty: String(qty),
      unitPrice: rl.unitPrice,
      discount: "",
      vatPct: bpToPct(rl.vatRateBp),
      accountId: rl.accountId ?? "",
      image: rl.image,
      sku: rl.sku,
      refLineId: rl.id,
      maxQty: rl.qty - rl.returnedQty + own,
      refQty: rl.qty,
      refDisc: BigInt(rl.discount) + BigInt(rl.invoiceDiscountShare),
    };
  }

  const patch = (key: number, p: Partial<Line>) => setLines((x) => x.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const defaultVat = useCallback((p?: ProductOption) => (cfg?.vatEnabled ? bpToPct(p?.vatRateBp ?? cfg.vatRateBp) : ""), [cfg]);

  function addProduct(p: ProductOption) {
    setLines((x) => {
      const hit = x.find((l) => l.productId === p.id);
      if (hit) return x.map((l) => (l.key === hit.key ? { ...l, qty: String(Number(l.qty || 0) + 1) } : l));
      return [
        ...x,
        {
          key: nextKey(),
          productId: p.id,
          title: p.title,
          qty: "1",
          unitPrice: p.price && p.price !== "0" ? p.price : "",
          discount: "",
          vatPct: defaultVat(p),
          accountId: "",
          image: p.image,
          sku: p.sku,
          stock: p.byWarehouse,
        },
      ];
    });
  }

  function addService() {
    const accs = salesSide ? cfg?.revenueAccounts : cfg?.expenseAccounts;
    const def = salesSide ? accs?.find((a) => a.systemKey === "SERVICE_REVENUE") : undefined;
    setLines((x) => [...x, { key: nextKey(), productId: null, title: "", qty: "1", unitPrice: "", discount: "", vatPct: defaultVat(), accountId: def?.id ?? "" }]);
  }

  // ── محاسبه ──
  const active = useMemo(() => lines.filter((l) => !hasRef || Number(l.qty) > 0), [lines, hasRef]);
  const calc = useMemo((): { r: CalcResult | null; err: string | null } => {
    try {
      const r = calcInvoice({
        lines: active.map((l) => {
          const qty = Number(digits(l.qty) || "0");
          const discount =
            hasRef && l.refDisc !== undefined && l.refQty
              ? qty === l.refQty
                ? l.refDisc
                : divRound(l.refDisc * BigInt(qty), BigInt(l.refQty))
              : BigInt(l.discount || "0");
          return { qty, unitPrice: BigInt(l.unitPrice || "0"), discount, vatRateBp: cfg?.vatEnabled || hasRef || channel !== "MANUAL" ? pctToBp(l.vatPct) : 0 };
        }),
        invoiceDiscount: hasRef ? 0n : BigInt(invDiscount || "0"),
        additions: BigInt(additions || "0"),
        pricesIncludeVat: inclVat,
      });
      return { r, err: null };
    } catch (e) {
      return { r: null, err: e instanceof Error ? e.message : "محاسبه نشد" };
    }
  }, [active, invDiscount, additions, inclVat, hasRef, cfg, channel]);

  const save = useCallback(
    async (issue: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const body = {
          type,
          date,
          dueDate: dueDate || null,
          validUntil: validUntil || null,
          partyId: party?.id,
          warehouseId: warehouseId || null,
          pricesIncludeVat: inclVat,
          invoiceDiscount: hasRef ? "0" : invDiscount || "0",
          additions: additions || "0",
          additionsTitle: additionsTitle || null,
          note,
          refInvoiceId: refInvoice?.id ?? null,
          issue,
          lines: active.map((l) => ({
            productId: l.productId,
            title: l.title,
            qty: digits(l.qty),
            unitPrice: l.unitPrice || "0",
            discount: l.discount || "0",
            vatRateBp: pctToBp(l.vatPct),
            accountId: l.accountId || null,
            refLineId: l.refLineId ?? null,
          })),
        };
        const r = id
          ? await api<{ id: string }>(`/api/admin/accounting/invoices/${id}`, { method: "PUT", json: body })
          : await api<{ id: string }>("/api/admin/accounting/invoices", { method: "POST", json: body });
        router.push(`/admin/accounting/invoices/${r.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ذخیره نشد");
        setBusy(false);
      }
    },
    [type, date, dueDate, validUntil, party, warehouseId, inclVat, invDiscount, additions, additionsTitle, note, refInvoice, active, id, router, hasRef],
  );

  const canSubmit = !!party && active.length > 0 && !!calc.r && !busy;
  const issueRef = useRef(save);
  issueRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSubmit) {
        e.preventDefault();
        issueRef.current(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSubmit]);

  if (!loaded || !cfg) {
    return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  }

  const label = INVOICE_TYPE_LABELS[type];
  const title = id ? `ویرایش ${label}${number ? ` ${faNum(number)}` : ""}` : `${label} تازه`;
  const showWarehouse = type !== "PROFORMA" && cfg.warehouses.length > 1 && lines.some((l) => l.productId);
  const showVat = cfg.vatEnabled || lines.some((l) => pctToBp(l.vatPct) > 0);
  const accounts = salesSide ? cfg.revenueAccounts : cfg.expenseAccounts;
  const r = calc.r;

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        help="accountingInvoiceForm"
        back={{ href: salesSide ? `/admin/accounting/sales?type=${type}` : `/admin/accounting/purchases?type=${type}`, label: salesSide ? "فروش" : "خرید" }}
        desc={
          refInvoice
            ? `از ${INVOICE_TYPE_LABELS[refInvoice.type]} ${faNum(refInvoice.number ?? 0)} — تعداد برگشتی هر کالا را بنویسید؛ مبلغ همان مبلغ فاکتور اصلی است.`
            : undefined
        }
      />

      {status === "ISSUED" && (
        <p className="text-xs rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 leading-6">
          این فاکتور صادر شده است. با ذخیره، موجودی انبار و حساب‌ها از روی مبالغ تازه دوباره ساخته می‌شوند و شماره عوض نمی‌شود.
          {channel !== "MANUAL" && " این فاکتور خودکار از سفارش ساخته شده؛ فقط وقتی سفارش واقعاً فرق کرده ویرایشش کنید."}
        </p>
      )}
      {cfg.mode !== "INTERNAL" && (
        <p className="text-xs rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 px-3 py-2">حسابداری داخلی فعال نیست؛ فاکتور فقط وقتی حسابداری داخلی راه‌اندازی شده ثبت می‌شود.</p>
      )}

      <Card className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field label={salesSide ? "خریدار" : "فروشنده"} className="md:col-span-2">
          {hasRef ? (
            <p className={`${inputCls} font-bold`}>{party?.name}</p>
          ) : (
            <PartyPicker value={party} onChange={setParty} canCreate role={salesSide ? "customer" : "supplier"} />
          )}
        </Field>
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} clearable={false} />
        </Field>
        {type === "PROFORMA" ? (
          <Field label="اعتبار تا" hint="بعد از این روز «منقضی» نشان داده می‌شود">
            <JalaliDatePicker value={validUntil} onChange={setValidUntil} />
          </Field>
        ) : !isReturn ? (
          <Field label={salesSide ? "سررسید دریافت (اختیاری)" : "سررسید پرداخت (اختیاری)"}>
            <JalaliDatePicker value={dueDate} onChange={setDueDate} />
          </Field>
        ) : (
          <div />
        )}
        {showWarehouse && (
          <Field label={salesSide || type === "PURCHASE_RETURN" ? "خروج از انبار" : "ورود به انبار"}>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              {cfg.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {cfg.vatEnabled && !hasRef && (
          <label className="flex items-center gap-2 text-sm self-end pb-3">
            <input type="checkbox" checked={inclVat} onChange={(e) => setInclVat(e.target.checked)} />
            قیمت‌ها با مالیات‌اند
          </label>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <SectionTitle
          title={`اقلام (${faNum(active.length)})`}
          help="accountingInvoiceForm"
          actions={
            !hasRef && (
              <button type="button" onClick={addService} className={btn.small}>
                <Plus className="h-4 w-4" aria-hidden />
                {salesSide ? "ردیف خدمت" : "ردیف خدمت یا هزینه"}
              </button>
            )
          }
        />
        {!hasRef && (
          <ProductPicker
            onPick={addProduct}
            warehouseId={warehouseId || undefined}
            priceFor={salesSide ? "sales" : "purchase"}
            partyId={party?.id}
            autoFocus={!id}
            placeholder="افزودن کالا: نام، کد کالا یا اسکن بارکد"
          />
        )}

        {/* سرستون دسکتاپ */}
        {lines.length > 0 && (
          <div className="hidden lg:grid gap-2 px-2 text-[11px] font-bold text-gray-500" style={{ gridTemplateColumns: gridCols(showVat, hasRef) }}>
            <span>شرح</span>
            <span className="text-center">تعداد</span>
            <span>فی</span>
            {!hasRef && <span>تخفیف ردیف</span>}
            {showVat && <span className="text-center">مالیات٪</span>}
            <span className="text-left">جمع ردیف</span>
            <span />
          </div>
        )}

        <div className="space-y-2">
          {lines.map((l) => {
            const idx = active.indexOf(l);
            const cl = idx >= 0 && r ? r.lines[idx] : null;
            const avail = l.stock && warehouseId ? l.stock[warehouseId] ?? 0 : null;
            const short = salesSide && type !== "PROFORMA" && avail !== null && Number(l.qty || 0) > avail;
            return (
              <div key={l.key} className={`rounded-xl bg-gray-50 dark:bg-white/5 p-2.5 ${hasRef && !Number(l.qty) ? "opacity-50" : ""}`}>
                <LineGrid showVat={showVat} hasRef={hasRef}>
                  <div className="min-w-0 col-span-2 lg:col-span-1 flex items-center gap-2">
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <span className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm ${l.productId ? "bg-gray-200 dark:bg-white/10" : "bg-blue-500/10 text-blue-600"}`}>{l.productId ? "" : "✦"}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      {l.productId || hasRef ? (
                        <p className="text-sm font-bold truncate">{l.title}</p>
                      ) : (
                        <input value={l.title} onChange={(e) => patch(l.key, { title: e.target.value })} placeholder="شرح خدمت یا هزینه" className={`${inputCls} !py-1.5`} />
                      )}
                      <p className={`text-[10px] ${short ? "text-amber-600 font-bold" : "text-gray-400"}`}>
                        {hasRef
                          ? `حداکثر ${faNum(l.maxQty ?? 0)} از ${faNum(l.refQty ?? 0)}`
                          : l.productId
                            ? [l.sku && `کد ${faNum(l.sku)}`, avail !== null && `موجودی ${faNum(avail)}${short ? " — کمتر از تعداد؛ ثبت می‌شود ولی موجودی منفی می‌شود" : ""}`].filter(Boolean).join(" · ") || "کالا"
                            : null}
                      </p>
                      {!l.productId && !hasRef && (
                        <select value={l.accountId} onChange={(e) => patch(l.key, { accountId: e.target.value })} className="mt-1 w-full text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 px-2 py-1.5">
                          <option value="">— حساب {salesSide ? "درآمد" : "هزینه"} —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <Cell label="تعداد">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => patch(l.key, { qty: String(Math.max(hasRef ? 0 : 1, Number(l.qty || 0) - 1)) })} className="w-7 h-9 rounded-lg bg-white dark:bg-gray-800 text-gray-500 shrink-0">
                        −
                      </button>
                      <input
                        value={faNum(l.qty)}
                        onChange={(e) => {
                          let v = digits(e.target.value).replace(/\..*/, "");
                          if (hasRef && l.maxQty !== undefined && Number(v) > l.maxQty) v = String(l.maxQty);
                          patch(l.key, { qty: v });
                        }}
                        inputMode="numeric"
                        className="w-full min-w-0 px-1 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center font-bold text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => patch(l.key, { qty: String(Math.min(hasRef && l.maxQty !== undefined ? l.maxQty : Infinity, Number(l.qty || 0) + 1)) })}
                        className="w-7 h-9 rounded-lg bg-white dark:bg-gray-800 text-gray-500 shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </Cell>
                  <Cell label="فی">
                    {hasRef ? <span className="text-sm font-bold tabular-nums">{formatAmount(l.unitPrice)}</span> : <AmountInput compact value={l.unitPrice} onChange={(v) => patch(l.key, { unitPrice: v })} />}
                  </Cell>
                  {!hasRef && (
                    <Cell label="تخفیف ردیف">
                      <AmountInput compact value={l.discount} onChange={(v) => patch(l.key, { discount: v })} />
                    </Cell>
                  )}
                  {showVat && (
                    <Cell label="مالیات٪">
                      {hasRef ? (
                        <span className="text-sm tabular-nums">{faNum(l.vatPct || "0")}</span>
                      ) : (
                        <input value={faNum(l.vatPct)} onChange={(e) => patch(l.key, { vatPct: digits(e.target.value) })} inputMode="decimal" className="w-full px-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-center text-sm" />
                      )}
                    </Cell>
                  )}
                  <Cell label="جمع ردیف" end>
                    <span className="text-sm font-black tabular-nums">{cl ? formatAmount(cl.lineTotal) : "—"}</span>
                    {cl && (cl.share > 0n || cl.vatAmount > 0n) && (
                      <span className="block text-[10px] text-gray-400">
                        {cl.share > 0n && `سهم تخفیف ${formatAmount(cl.share)}`} {cl.vatAmount > 0n && `مالیات ${formatAmount(cl.vatAmount)}`}
                      </span>
                    )}
                  </Cell>
                  <div className="flex justify-end">
                    {!hasRef && (
                      <button type="button" onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} className="text-gray-400 hover:text-red-600 px-2 py-2" aria-label="حذف ردیف">
                        ✕
                      </button>
                    )}
                  </div>
                </LineGrid>
              </div>
            );
          })}
          {!lines.length && <p className="text-xs text-gray-400 text-center py-6">هنوز ردیفی اضافه نشده. کالا را جستجو یا بارکدش را اسکن کنید.</p>}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_320px] items-start">
        <Card className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {!hasRef && (
              <Field label="تخفیف کل فاکتور" hint="به نسبت مبلغ بین ردیف‌ها پخش می‌شود">
                <AmountInput value={invDiscount} onChange={setInvDiscount} />
              </Field>
            )}
            {type !== "PURCHASE_RETURN" && (
              <Field label={salesSide ? (isReturn ? "برگشت هزینه‌ی ارسال" : "هزینه‌ی ارسال و اضافات") : "کرایه‌ی حمل"} hint={salesSide ? undefined : "روی بهای خرید کالاها پخش می‌شود"}>
                <AmountInput value={additions} onChange={setAdditions} />
                {additions && additions !== "0" && (
                  <input value={additionsTitle} onChange={(e) => setAdditionsTitle(e.target.value)} placeholder={salesSide ? "هزینه‌ی ارسال" : "کرایه‌ی حمل"} className={`${inputCls} mt-2`} />
                )}
              </Field>
            )}
          </div>
          <Field label="توضیح (روی فاکتور چاپ می‌شود)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} />
          </Field>
        </Card>

        <Card className="p-4 space-y-2 text-sm">
          <Row k="جمع اقلام" v={r?.subtotal} />
          {r && r.lineDiscount + r.invoiceDiscount > 0n && <Row k="تخفیف" v={-(r.lineDiscount + r.invoiceDiscount)} />}
          {r && r.vatTotal > 0n && <Row k={inclVat ? "مالیات (داخل قیمت)" : "مالیات بر ارزش افزوده"} v={r.vatTotal} />}
          {r && r.additions > 0n && <Row k={additionsTitle || (salesSide ? "هزینه‌ی ارسال" : "کرایه‌ی حمل")} v={r.additions} />}
          <div className="border-t border-gray-100 dark:border-white/10 pt-2 flex items-center justify-between">
            <span className="font-black">جمع کل</span>
            <Money value={r?.total ?? null} className="text-lg" />
          </div>
          {r && r.total > 0n && <p className="text-[11px] text-gray-500 leading-5">{amountToWords(r.total)} تومان</p>}
          <ErrorText>{calc.err}</ErrorText>
        </Card>
      </div>

      <ErrorText>{error}</ErrorText>

      {/* نوار ثابت پایین — جمع و ذخیره (بخش ۱۳.۳) */}
      <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 lg:-mx-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-white/10">
        <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400">جمع کل</p>
            <Money value={r?.total ?? null} className="text-base" />
          </div>
          {status !== "ISSUED" && (
            <button onClick={() => save(false)} disabled={!canSubmit} className={btn.soft}>
              پیش‌نویس
            </button>
          )}
          <button onClick={() => save(true)} disabled={!canSubmit} className={btn.primary} title="Ctrl+Enter">
            {busy ? "در حال ثبت…" : status === "ISSUED" ? "ذخیره‌ی تغییرات" : type === "PROFORMA" ? "صدور پیش‌فاکتور" : `صدور ${label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function gridCols(showVat: boolean, hasRef: boolean) {
  return ["minmax(0,1fr)", "120px", "140px", ...(hasRef ? [] : ["120px"]), ...(showVat ? ["70px"] : []), "130px", "36px"].join(" ");
}

function LineGrid({ showVat, hasRef, children }: { showVat: boolean; hasRef: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 items-center lg:[grid-template-columns:var(--cols)]" style={{ ["--cols" as string]: gridCols(showVat, hasRef) }}>
      {children}
    </div>
  );
}

function Cell({ label, children, end }: { label: string; children: React.ReactNode; end?: boolean }) {
  return (
    <div className={end ? "lg:text-left" : ""}>
      <span className="lg:hidden block text-[10px] text-gray-400 mb-0.5">{label}</span>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: bigint | undefined | null }) {
  return (
    <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
      <span className="text-xs">{k}</span>
      <span className={`font-bold tabular-nums ${v !== undefined && v !== null && v < 0n ? "text-emerald-600" : ""}`}>{v === undefined || v === null ? "—" : formatAmount(v)}</span>
    </div>
  );
}
