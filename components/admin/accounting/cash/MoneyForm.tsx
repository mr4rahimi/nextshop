"use client";

/**
 * فرم دریافت، پرداخت و انتقال وجه — docs/plans/accounting.md بخش ۹.۱ و ۱۳.۲.
 *
 * - چند روش در یک ثبت: «بخشی نقد، بخشی کارت‌به‌کارت، بخشی چک».
 * - پرداخت با چک: چک تازه‌ی ما (شماره‌ی بعدی دسته‌چک پیشنهاد می‌شود) یا خرج یک
 *   چک دریافتیِ نزد ما.
 * - بعد از انتخاب شخص فاکتورهای بازش می‌آید و مبلغ خودکار از قدیمی‌ترین تخصیص
 *   می‌یابد (قابل تغییر). مازاد = پیش‌دریافت/پیش‌پرداخت.
 * - یک جمله‌ی خلاصه به زبان کسب‌وکار بالای دکمه‌ی ثبت.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { INVOICE_TYPE_LABELS, type InvoiceTypeKey } from "@/lib/accounting/invoices/calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api, BalanceLabel, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, Segmented, SectionTitle } from "../ui";

type Kind = "RECEIPT" | "PAYMENT" | "TRANSFER";
type Method = "CASH" | "CARD_TRANSFER" | "BANK_TRANSFER" | "POS" | "GATEWAY" | "CHEQUE" | "ENDORSE";
type TKind = "CASH" | "BANK" | "POS" | "GATEWAY";

interface Treasury {
  id: string;
  name: string;
  kind: TKind;
  bankName: string | null;
  settleToId: string | null;
  balance: string;
}
interface OpenInv {
  id: string;
  type: InvoiceTypeKey;
  number: number | null;
  date: string;
  dueDate: string | null;
  total: string;
  returned: string;
  paid: string;
  open: string;
}
interface InHandCheque {
  id: string;
  serialNo: string;
  bankName: string;
  amount: string;
  dueDate: string;
  party: { name: string };
}
interface FormData {
  today: string;
  treasuries: Treasury[];
  open: OpenInv[];
  cheques: InHandCheque[];
  partyBalance: string | null;
  nextSerial: Record<string, { serial: string; bookId: string } | null>;
}

interface Item {
  key: number;
  method: Method;
  treasuryId: string;
  amount: string;
  trackingCode: string;
  serialNo: string;
  sayadId: string;
  bankName: string;
  branch: string;
  ownerName: string;
  dueDate: string;
  chequeBookId: string;
  endorseChequeId: string;
}

export const KIND_LABELS: Record<Kind, string> = { RECEIPT: "دریافت", PAYMENT: "پرداخت", TRANSFER: "انتقال وجه" };
const METHOD_LABEL: Record<Method, string> = {
  CASH: "نقد",
  CARD_TRANSFER: "کارت‌به‌کارت",
  BANK_TRANSFER: "واریز بانکی",
  POS: "کارتخوان",
  GATEWAY: "درگاه",
  CHEQUE: "چک",
  ENDORSE: "خرج چک دریافتی",
};
const METHOD_TREASURY: Record<Exclude<Method, "CHEQUE" | "ENDORSE">, TKind[]> = {
  CASH: ["CASH"],
  CARD_TRANSFER: ["BANK"],
  BANK_TRANSFER: ["BANK"],
  POS: ["POS", "BANK"],
  GATEWAY: ["GATEWAY", "BANK"],
};

let seq = 0;
const blank = (method: Method = "CASH"): Item => ({
  key: ++seq,
  method,
  treasuryId: "",
  amount: "",
  trackingCode: "",
  serialNo: "",
  sayadId: "",
  bankName: "",
  branch: "",
  ownerName: "",
  dueDate: "",
  chequeBookId: "",
  endorseChequeId: "",
});

export default function MoneyForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialKind = (["RECEIPT", "PAYMENT", "TRANSFER"].includes(sp.get("kind")?.toUpperCase() ?? "") ? sp.get("kind")!.toUpperCase() : "RECEIPT") as Kind;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [party, setParty] = useState<PartyOption | null>(null);
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Item[]>([blank()]);
  const [description, setDescription] = useState("");
  const [data, setData] = useState<FormData | null>(null);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [allocTouched, setAllocTouched] = useState(false);
  // انتقال
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusInvoice = sp.get("invoiceId");

  // شخص از آدرس (دکمه‌ی «دریافت» صفحه‌ی شخص یا فاکتور)
  useEffect(() => {
    const pid = sp.get("partyId");
    if (!pid) return;
    api<{ party: PartyOption }>(`/api/admin/accounting/parties/${pid}`)
      .then((d) => setParty({ id: d.party.id, code: d.party.code, name: d.party.name, mobile: d.party.mobile }))
      .catch(() => {});
  }, [sp]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ kind });
    if (party && kind !== "TRANSFER") p.set("partyId", party.id);
    api<FormData>(`/api/admin/accounting/money/form?${p}`)
      .then((d) => {
        setData(d);
        setDate((x) => x || d.today);
      })
      .catch((e) => setError(e.message));
  }, [kind, party]);
  useEffect(load, [load]);

  // مبلغ پیش‌فرض از فاکتوری که از رویش آمده‌ایم
  useEffect(() => {
    if (!data || !focusInvoice) return;
    const inv = data.open.find((o) => o.id === focusInvoice);
    if (inv) setItems((x) => (x.length === 1 && !x[0].amount ? [{ ...x[0], amount: inv.open }] : x));
  }, [data, focusInvoice]);

  const patch = (key: number, p: Partial<Item>) => setItems((x) => x.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const treasuries = useMemo(() => data?.treasuries ?? [], [data]);

  // ردیفی که هنوز صندوق ندارد، اولین گزینه‌ی مناسب روشش را می‌گیرد
  useEffect(() => {
    if (!data) return;
    setItems((x) =>
      x.map((i) => {
        if (i.treasuryId || i.method === "ENDORSE" || (i.method === "CHEQUE" && kind === "RECEIPT")) return i;
        const t = data.treasuries.find((t) => (i.method === "CHEQUE" ? t.kind === "BANK" : METHOD_TREASURY[i.method as keyof typeof METHOD_TREASURY].includes(t.kind)));
        const next = t && i.method === "CHEQUE" ? data.nextSerial[t.id] : null;
        return t ? { ...i, treasuryId: t.id, ...(next ? { serialNo: next.serial, chequeBookId: next.bookId } : {}) } : i;
      }),
    );
  }, [data, kind, items.length]);
  const total = useMemo(() => (kind === "TRANSFER" ? BigInt(items[0]?.amount || "0") : items.reduce((s, i) => s + BigInt(i.amount || "0"), 0n)), [items, kind]);

  // تخصیص خودکار از قدیمی‌ترین — تا وقتی کاربر خودش دست نزده
  useEffect(() => {
    if (!data || allocTouched || kind === "TRANSFER") return;
    let left = total;
    const next: Record<string, string> = {};
    const ordered = focusInvoice ? [...data.open].sort((a, b) => (a.id === focusInvoice ? -1 : b.id === focusInvoice ? 1 : 0)) : data.open;
    for (const o of ordered) {
      const open = BigInt(o.open);
      const a = open < left ? open : left;
      if (a > 0n) next[o.id] = a.toString();
      left -= a;
    }
    setAlloc(next);
  }, [data, total, allocTouched, kind, focusInvoice]);

  const allocSum = Object.values(alloc).reduce((s, v) => s + BigInt(v || "0"), 0n);
  const excess = total - allocSum;

  function methodOptions(): Method[] {
    const base: Method[] = ["CASH", "CARD_TRANSFER", "BANK_TRANSFER", "POS", "GATEWAY", "CHEQUE"];
    return kind === "PAYMENT" ? [...base.filter((m) => m !== "POS" && m !== "GATEWAY"), "ENDORSE"] : base;
  }
  function treasuriesFor(m: Method) {
    if (m === "CHEQUE") return treasuries.filter((t) => t.kind === "BANK");
    if (m === "ENDORSE") return [];
    return treasuries.filter((t) => METHOD_TREASURY[m].includes(t.kind));
  }
  function setMethod(it: Item, m: Method) {
    const opts = m === "CHEQUE" && kind === "RECEIPT" ? [] : treasuriesFor(m);
    const tId = opts.some((t) => t.id === it.treasuryId) ? it.treasuryId : opts[0]?.id ?? "";
    const next = data?.nextSerial[tId];
    patch(it.key, { method: m, treasuryId: tId, endorseChequeId: "", ...(m === "CHEQUE" && kind === "PAYMENT" && next ? { serialNo: next.serial, chequeBookId: next.bookId } : {}) });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body =
        kind === "TRANSFER"
          ? { kind, date, description, items: [{ method: "BANK_TRANSFER", treasuryId: fromId, toTreasuryId: toId, amount: items[0].amount || "0", fee: fee || "0" }] }
          : {
              kind,
              date,
              description,
              partyId: party?.id,
              items: items.map((i) => ({
                method: i.method === "ENDORSE" ? "CHEQUE" : i.method,
                treasuryId: i.method === "CHEQUE" && kind === "RECEIPT" ? null : i.treasuryId || null,
                amount: i.amount || "0",
                trackingCode: i.trackingCode || null,
                endorseChequeId: i.method === "ENDORSE" ? i.endorseChequeId : null,
                cheque:
                  i.method === "CHEQUE"
                    ? { serialNo: i.serialNo, sayadId: i.sayadId, bankName: i.bankName, branch: i.branch, ownerName: i.ownerName, dueDate: i.dueDate, chequeBookId: i.chequeBookId || null }
                    : null,
              })),
              allocations: Object.entries(alloc)
                .filter(([, v]) => v && v !== "0")
                .map(([invoiceId, amount]) => ({ invoiceId, amount })),
            };
      const r = await api<{ id: string }>("/api/admin/accounting/money", { method: "POST", json: body });
      router.push(`/admin/accounting/money/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  // جمله‌ی خلاصه (اصل ۱ بخش ۱۳.۲)
  const sentence = useMemo(() => {
    if (total <= 0n) return "";
    if (kind === "TRANSFER") {
      const f = treasuries.find((t) => t.id === fromId)?.name;
      const t = treasuries.find((x) => x.id === toId)?.name;
      return f && t ? `${formatAmount(total)} تومان از ${f} به ${t}${fee && fee !== "0" ? ` با ${formatAmount(fee)} کارمزد` : ""}` : "";
    }
    if (!party) return "";
    const ways = items
      .filter((i) => i.amount)
      .map((i) => {
        const t = treasuries.find((x) => x.id === i.treasuryId)?.name;
        return `${METHOD_LABEL[i.method]}${t && i.method !== "CHEQUE" ? ` ${kind === "RECEIPT" ? "به" : "از"} ${t}` : ""}`;
      })
      .join(" + ");
    return `${formatAmount(total)} تومان ${kind === "RECEIPT" ? "از" : "به"} ${party.name} — ${ways}`;
  }, [total, kind, party, items, treasuries, fromId, toId, fee]);

  const canSave = !busy && total > 0n && (kind === "TRANSFER" ? !!fromId && !!toId : !!party);
  const fixedKind = !!sp.get("kind");

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${KIND_LABELS[kind]} تازه`}
        help="accountingMoneyForm"
        back={{ href: `/admin/accounting/money?kind=${kind}`, label: "دریافت و پرداخت" }}
      />
      {!fixedKind && (
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setItems([blank()]);
            setAlloc({});
            setAllocTouched(false);
          }}
          options={[
            { value: "RECEIPT", label: "دریافت" },
            { value: "PAYMENT", label: "پرداخت" },
            { value: "TRANSFER", label: "انتقال وجه" },
          ]}
        />
      )}

      <Card className="p-4 grid gap-4 md:grid-cols-[1fr_220px]">
        {kind !== "TRANSFER" ? (
          <Field label={kind === "RECEIPT" ? "از چه کسی" : "به چه کسی"}>
            <PartyPicker value={party} onChange={(p) => { setParty(p); setAllocTouched(false); }} canCreate />
            {party && data?.partyBalance !== null && data?.partyBalance !== undefined && (
              <div className="mt-2 text-xs flex items-center gap-2">
                <span className="text-gray-500">مانده‌ی فعلی:</span>
                <BalanceLabel balance={data.partyBalance} />
              </div>
            )}
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="از">
              <select
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  const s = treasuries.find((t) => t.id === e.target.value)?.settleToId;
                  if (s && !toId) setToId(s);
                }}
                className={inputCls}
              >
                <option value="">— انتخاب —</option>
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatAmount(t.balance)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="به">
              <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputCls}>
                <option value="">— انتخاب —</option>
                {treasuries.filter((t) => t.id !== fromId).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} clearable={false} />
        </Field>
      </Card>

      {kind === "TRANSFER" ? (
        <Card className="p-4 grid gap-4 sm:grid-cols-2">
          <Field label="مبلغ">
            <AmountInput value={items[0].amount} onChange={(v) => patch(items[0].key, { amount: v })} />
          </Field>
          <Field label="کارمزد بانکی (اختیاری)" hint="از مبدأ کم و به «کارمزد بانکی» زده می‌شود — مثلاً کارمزد تسویه‌ی درگاه">
            <AmountInput value={fee} onChange={setFee} />
          </Field>
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          <SectionTitle
            title="روش‌ها"
            help="accountingMoneyForm"
            actions={
              <button type="button" onClick={() => setItems((x) => [...x, blank(kind === "RECEIPT" ? "CHEQUE" : "CASH")])} className={btn.small}>
                ➕ روش دیگر
              </button>
            }
          />
          {items.map((it) => {
            const opts = treasuriesFor(it.method);
            const ch = data?.cheques.find((c) => c.id === it.endorseChequeId);
            return (
              <div key={it.key} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {methodOptions().map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(it, m)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${it.method === m ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                    >
                      {METHOD_LABEL[m]}
                    </button>
                  ))}
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((x) => x.filter((y) => y.key !== it.key))} className="mr-auto shrink-0 text-gray-400 hover:text-red-600 px-2" aria-label="حذف">
                      ✕
                    </button>
                  )}
                </div>

                {it.method === "ENDORSE" ? (
                  <Field label="کدام چک" hint="چک‌های دریافتیِ نزد شما؛ مبلغ همان مبلغ چک است">
                    <select
                      value={it.endorseChequeId}
                      onChange={(e) => {
                        const c = data?.cheques.find((x) => x.id === e.target.value);
                        patch(it.key, { endorseChequeId: e.target.value, amount: c?.amount ?? "" });
                      }}
                      className={inputCls}
                    >
                      <option value="">— انتخاب چک —</option>
                      {data?.cheques.map((c) => (
                        <option key={c.id} value={c.id}>
                          {faNum(c.serialNo)} · {c.bankName} · {formatAmount(c.amount)} · سررسید {formatJalali(new Date(c.dueDate))} · از {c.party.name}
                        </option>
                      ))}
                    </select>
                    {!data?.cheques.length && <span className="block text-[11px] text-amber-600 mt-1">چک دریافتی نزد شما نیست.</span>}
                    {ch && <span className="block text-xs font-bold mt-1">{formatAmount(ch.amount)} تومان</span>}
                  </Field>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="مبلغ">
                      <AmountInput value={it.amount} onChange={(v) => patch(it.key, { amount: v })} />
                    </Field>
                    {(it.method !== "CHEQUE" || kind === "PAYMENT") && (
                      <Field label={it.method === "CHEQUE" ? "از حساب بانکی" : kind === "RECEIPT" ? "به" : "از"}>
                        <select
                          value={it.treasuryId}
                          onChange={(e) => {
                            const next = data?.nextSerial[e.target.value];
                            patch(it.key, { treasuryId: e.target.value, ...(it.method === "CHEQUE" && next ? { serialNo: next.serial, chequeBookId: next.bookId } : {}) });
                          }}
                          className={inputCls}
                        >
                          <option value="">— انتخاب —</option>
                          {opts.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({formatAmount(t.balance)})
                            </option>
                          ))}
                        </select>
                        {!opts.length && <span className="block text-[11px] text-amber-600 mt-1">اول در «صندوق و بانک» یکی از این نوع بسازید.</span>}
                      </Field>
                    )}
                  </div>
                )}

                {["CARD_TRANSFER", "BANK_TRANSFER", "POS", "GATEWAY"].includes(it.method) && (
                  <Field label="کد پیگیری (اختیاری)">
                    <input value={it.trackingCode} onChange={(e) => patch(it.key, { trackingCode: e.target.value })} className={inputCls} dir="ltr" />
                  </Field>
                )}

                {it.method === "CHEQUE" && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="شماره‌ی چک" hint={kind === "PAYMENT" && it.chequeBookId ? "شماره‌ی بعدی دسته‌چک" : undefined}>
                      <input value={it.serialNo} onChange={(e) => patch(it.key, { serialNo: e.target.value })} className={inputCls} inputMode="numeric" dir="ltr" />
                    </Field>
                    <Field label="سررسید">
                      <JalaliDatePicker value={it.dueDate} onChange={(v) => patch(it.key, { dueDate: v })} />
                    </Field>
                    <Field label="شناسه‌ی صیادی (۱۶ رقم)">
                      <input value={it.sayadId} onChange={(e) => patch(it.key, { sayadId: e.target.value })} className={inputCls} inputMode="numeric" dir="ltr" />
                    </Field>
                    {kind === "RECEIPT" && (
                      <>
                        <Field label="بانک">
                          <input value={it.bankName} onChange={(e) => patch(it.key, { bankName: e.target.value })} className={inputCls} placeholder="ملت، صادرات، …" />
                        </Field>
                        <Field label="شعبه (اختیاری)">
                          <input value={it.branch} onChange={(e) => patch(it.key, { branch: e.target.value })} className={inputCls} />
                        </Field>
                        <Field label="صاحب حساب (اگر غیر از خود شخص است)">
                          <input value={it.ownerName} onChange={(e) => patch(it.key, { ownerName: e.target.value })} className={inputCls} />
                        </Field>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {kind !== "TRANSFER" && party && data && (
        <Card className="p-4 space-y-3">
          <SectionTitle
            title={kind === "RECEIPT" ? "بابت کدام فاکتورها" : "بابت کدام فاکتورهای خرید"}
            help="accountingMoneyForm"
            actions={
              data.open.length > 0 && (
                <button type="button" onClick={() => setAllocTouched(false)} className={btn.small}>
                  خودکار از قدیمی‌ترین
                </button>
              )
            }
          />
          {data.open.length === 0 ? (
            <p className="text-xs text-gray-400">فاکتور باز ندارد؛ کل مبلغ {kind === "RECEIPT" ? "پیش‌دریافت" : "پیش‌پرداخت"} روی حساب شخص می‌ماند.</p>
          ) : (
            <div className="space-y-2">
              {data.open.map((o) => (
                <div key={o.id} className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 ${o.id === focusInvoice ? "bg-blue-50 dark:bg-blue-500/10" : "bg-gray-50 dark:bg-white/5"}`}>
                  <div className="flex-1 min-w-[10rem]">
                    <p className="text-sm font-bold">
                      {INVOICE_TYPE_LABELS[o.type]} {faNum(o.number ?? 0)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {formatJalali(new Date(o.date))} · مانده {formatAmount(o.open)} از {formatAmount(o.total)}
                      {o.dueDate && o.dueDate.slice(0, 10) < data.today && <span className="text-red-600 font-bold"> · سررسید گذشته</span>}
                    </p>
                  </div>
                  <div className="w-44">
                    <AmountInput
                      compact
                      value={alloc[o.id] ?? ""}
                      onChange={(v) => {
                        setAllocTouched(true);
                        setAlloc((x) => ({ ...x, [o.id]: v }));
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className={`text-xs ${excess < 0n ? "text-red-600 font-bold" : "text-gray-500"}`}>
                تخصیص‌یافته {formatAmount(allocSum)} ·{" "}
                {total === 0n
                  ? "اول مبلغ را بنویسید"
                  : excess < 0n
                    ? `${formatAmount(-excess)} بیشتر از مبلغ`
                    : excess > 0n
                      ? `${formatAmount(excess)} ${kind === "RECEIPT" ? "پیش‌دریافت" : "پیش‌پرداخت"} روی حساب شخص می‌ماند`
                      : "کل مبلغ تخصیص یافت"}
              </p>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <Field label="توضیح (اختیاری)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
      </Card>

      <ErrorText>{error}</ErrorText>

      <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 lg:-mx-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-white/10">
        <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 truncate">{sentence || "جمع"}</p>
            <Money value={total} className="text-base" />
          </div>
          <button onClick={save} disabled={!canSave} className={btn.primary}>
            {busy ? "در حال ثبت…" : `ثبت ${KIND_LABELS[kind]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
