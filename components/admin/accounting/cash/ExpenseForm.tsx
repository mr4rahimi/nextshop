"use client";

/**
 * فرم ثبت هزینه — docs/plans/accounting.md بخش ۵ («هزینه») و ۱۳.۲.
 *
 * - «بابت چه»: یک یا چند ردیف، هر کدام یک سرفصل هزینه (اجاره، قبض، …)؛
 *   پرکاربردها به‌صورت دکمه‌ی سریع بالای فرم.
 * - «پرداخت»: همین حالا (نقد، کارت‌به‌کارت، واریز، چک — چند روش با هم) یا
 *   نسیه. هر مقدار پرداخت‌نشده بدهی به «به چه کسی» می‌شود.
 * - مبلغ پرداخت تا وقتی کاربر دست نزده، همان جمع هزینه است.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, Segmented, SectionTitle } from "../ui";
import { Plus } from "lucide-react";

type Method = "CASH" | "CARD_TRANSFER" | "BANK_TRANSFER" | "CHEQUE";
interface Account {
  id: string;
  code: string;
  name: string;
  group: string;
  needsParty: boolean;
  uses: number;
}
interface Treasury {
  id: string;
  name: string;
  kind: "CASH" | "BANK";
  balance: string;
}
interface FormData {
  today: string;
  accounts: Account[];
  treasuries: Treasury[];
  nextSerial: Record<string, { serial: string; bookId: string } | null>;
  vatEnabled: boolean;
}
interface Line {
  key: number;
  accountId: string;
  amount: string;
  description: string;
}
interface Pay {
  key: number;
  method: Method;
  treasuryId: string;
  amount: string;
  trackingCode: string;
  serialNo: string;
  sayadId: string;
  dueDate: string;
  chequeBookId: string;
}

const METHOD_LABEL: Record<Method, string> = { CASH: "نقد", CARD_TRANSFER: "کارت‌به‌کارت", BANK_TRANSFER: "واریز بانکی", CHEQUE: "چک" };
const METHOD_KIND: Record<Method, Treasury["kind"]> = { CASH: "CASH", CARD_TRANSFER: "BANK", BANK_TRANSFER: "BANK", CHEQUE: "BANK" };

let seq = 0;
const blankLine = (accountId = ""): Line => ({ key: ++seq, accountId, amount: "", description: "" });
const blankPay = (method: Method = "CASH"): Pay => ({ key: ++seq, method, treasuryId: "", amount: "", trackingCode: "", serialNo: "", sayadId: "", dueDate: "", chequeBookId: "" });

export default function ExpenseForm() {
  const router = useRouter();
  const [data, setData] = useState<FormData | null>(null);
  const [date, setDate] = useState("");
  const [party, setParty] = useState<PartyOption | null>(null);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [vat, setVat] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [pays, setPays] = useState<Pay[]>([blankPay()]);
  const [payTouched, setPayTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<FormData>("/api/admin/accounting/expenses/form")
      .then((d) => {
        setData(d);
        setDate((x) => x || d.today);
      })
      .catch((e) => setError(e.message));
  }, []);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const treasuries = useMemo(() => data?.treasuries ?? [], [data]);
  // سرورِ فرم سرفصل‌ها را پرکاربرد اول مرتب کرده
  const quickChips = accounts.slice(0, 6);
  const groups = useMemo(() => {
    const m = new Map<string, Account[]>();
    for (const a of [...accounts].sort((x, y) => x.code.localeCompare(y.code))) m.set(a.group, [...(m.get(a.group) ?? []), a]);
    return [...m.entries()];
  }, [accounts]);

  const linesTotal = lines.reduce((s, l) => s + BigInt(l.amount || "0"), 0n);
  const total = linesTotal + BigInt(vat || "0");
  const paid = paidNow ? pays.reduce((s, p) => s + BigInt(p.amount || "0"), 0n) : 0n;
  const payable = total - paid;
  const needsParty = payable > 0n || lines.some((l) => accounts.find((a) => a.id === l.accountId)?.needsParty) || (paidNow && pays.some((p) => p.method === "CHEQUE"));

  // هر روش بی‌صندوق، اولین صندوق/بانک مناسب را می‌گیرد
  useEffect(() => {
    if (!data) return;
    setPays((x) =>
      x.map((p) => {
        if (p.treasuryId) return p;
        const t = data.treasuries.find((t) => t.kind === METHOD_KIND[p.method]);
        const next = t && p.method === "CHEQUE" ? data.nextSerial[t.id] : null;
        return t ? { ...p, treasuryId: t.id, ...(next ? { serialNo: next.serial, chequeBookId: next.bookId } : {}) } : p;
      }),
    );
  }, [data, pays.length]);

  // پرداخت پیش‌فرض = کل هزینه، تا وقتی کاربر خودش مبلغ را عوض نکرده
  useEffect(() => {
    if (payTouched) return;
    setPays((x) => (x.length === 1 ? [{ ...x[0], amount: total > 0n ? total.toString() : "" }] : x));
  }, [total, payTouched]);

  const patchLine = (key: number, p: Partial<Line>) => setLines((x) => x.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const patchPay = (key: number, p: Partial<Pay>) => setPays((x) => x.map((l) => (l.key === key ? { ...l, ...p } : l)));

  function pickQuick(accountId: string) {
    setLines((x) => {
      const empty = x.find((l) => !l.accountId);
      return empty ? x.map((l) => (l.key === empty.key ? { ...l, accountId } : l)) : [...x, blankLine(accountId)];
    });
  }
  function setMethod(p: Pay, method: Method) {
    const opts = treasuries.filter((t) => t.kind === METHOD_KIND[method]);
    const tId = opts.some((t) => t.id === p.treasuryId) ? p.treasuryId : opts[0]?.id ?? "";
    const next = method === "CHEQUE" ? data?.nextSerial[tId] : null;
    patchPay(p.key, { method, treasuryId: tId, ...(next ? { serialNo: next.serial, chequeBookId: next.bookId } : {}) });
  }

  const names = [...new Set(lines.map((l) => accounts.find((a) => a.id === l.accountId)?.name).filter(Boolean))].join(" + ");
  const sentence =
    total > 0n && names
      ? `${formatAmount(total)} تومان ${names}` +
        (paid > 0n ? ` — ${pays.filter((p) => p.amount).map((p) => `${METHOD_LABEL[p.method]}${p.method !== "CHEQUE" ? ` از ${treasuries.find((t) => t.id === p.treasuryId)?.name ?? ""}` : ""}`).join(" + ")}` : "") +
        (payable > 0n ? ` — ${formatAmount(payable)} نسیه${party ? ` به ${party.name}` : ""}` : "")
      : "";
  const canSave = !busy && total > 0n && lines.every((l) => l.accountId && l.amount) && payable >= 0n && (!needsParty || !!party);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/admin/accounting/expenses", {
        method: "POST",
        json: {
          date,
          partyId: party?.id ?? null,
          description,
          vatAmount: vat || "0",
          lines: lines.map((l) => ({ accountId: l.accountId, amount: l.amount || "0", description: l.description || null })),
          items: paidNow
            ? pays
                .filter((p) => p.amount && p.amount !== "0")
                .map((p) => ({
                  method: p.method,
                  treasuryId: p.treasuryId || null,
                  amount: p.amount,
                  trackingCode: p.trackingCode || null,
                  cheque: p.method === "CHEQUE" ? { serialNo: p.serialNo, sayadId: p.sayadId, dueDate: p.dueDate, chequeBookId: p.chequeBookId || null } : null,
                }))
            : [],
        },
      });
      router.push(`/admin/accounting/money/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="space-y-4">
      <PageHeader title="ثبت هزینه" help="accountingExpenseForm" back={{ href: "/admin/accounting/expenses", label: "هزینه‌ها" }} />

      <Card className="p-4 space-y-3">
        <SectionTitle title="بابت چه" help="accountingExpenseForm" />
        {quickChips.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {quickChips.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pickQuick(a.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  lines.some((l) => l.accountId === a.id) ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
        {lines.map((l) => {
          const a = accounts.find((x) => x.id === l.accountId);
          return (
            <div key={l.key} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 grid gap-3 sm:grid-cols-[1fr_11rem] items-start">
              <Field label="سرفصل">
                <select value={l.accountId} onChange={(e) => patchLine(l.key, { accountId: e.target.value })} className={inputCls}>
                  <option value="">— انتخاب —</option>
                  {groups.map(([g, list]) => (
                    <optgroup key={g} label={g}>
                      {list.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {a?.needsParty && <span className="block text-[11px] text-amber-600 mt-1">به نام یک شخص ثبت می‌شود — «به چه کسی» را انتخاب کنید.</span>}
              </Field>
              <Field label="مبلغ">
                <AmountInput value={l.amount} onChange={(v) => patchLine(l.key, { amount: v })} />
              </Field>
              <div className="sm:col-span-2 flex gap-2 items-center">
                <input value={l.description} onChange={(e) => patchLine(l.key, { description: e.target.value })} placeholder="شرح (اختیاری) — مثلاً «قبض برق شهریور»" className={inputCls} />
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} className="shrink-0 text-gray-400 hover:text-red-600 px-2" aria-label="حذف">
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" onClick={() => setLines((x) => [...x, blankLine()])} className={btn.small}>
            <Plus className="h-4 w-4" aria-hidden />
            ردیف دیگر
          </button>
          {data?.vatEnabled && (
            <div className="w-48 mr-auto">
              <Field label="مالیات بر ارزش افزوده (اختیاری)" hint="اگر در قبض یا فاکتور هزینه آمده">
                <AmountInput compact value={vat} onChange={setVat} />
              </Field>
            </div>
          )}
        </div>
        {!accounts.length && data && <p className="text-xs text-amber-600">سرفصل هزینه‌ای فعال نیست؛ در «سرفصل حساب‌ها» زیر «هزینه‌ها» یکی بسازید.</p>}
      </Card>

      <Card className="p-4 grid gap-4 md:grid-cols-[1fr_220px]">
        <Field label={needsParty ? "به چه کسی" : "به چه کسی (اختیاری)"} hint={payable > 0n ? "بخش پرداخت‌نشده بدهی شما به این شخص می‌شود" : "صاحب‌خانه، شرکت خدماتی، کارمند …"}>
          <PartyPicker value={party} onChange={setParty} canCreate />
        </Field>
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} clearable={false} />
        </Field>
      </Card>

      <Card className="p-4 space-y-3">
        <SectionTitle
          title="پرداخت"
          actions={
            paidNow && (
              <button type="button" onClick={() => { setPayTouched(true); setPays((x) => [...x, blankPay("BANK_TRANSFER")]); }} className={btn.small}>
                <Plus className="h-4 w-4" aria-hidden />
                روش دیگر
              </button>
            )
          }
        />
        <Segmented
          value={paidNow ? "now" : "later"}
          onChange={(v) => setPaidNow(v === "now")}
          options={[
            { value: "now", label: "پرداخت شد" },
            { value: "later", label: "نسیه — بعداً پرداخت می‌کنم" },
          ]}
        />
        {paidNow &&
          pays.map((p) => {
            const opts = treasuries.filter((t) => t.kind === METHOD_KIND[p.method]);
            return (
              <div key={p.key} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(p, m)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${p.method === m ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                    >
                      {METHOD_LABEL[m]}
                    </button>
                  ))}
                  {pays.length > 1 && (
                    <button type="button" onClick={() => setPays((x) => x.filter((y) => y.key !== p.key))} className="mr-auto shrink-0 text-gray-400 hover:text-red-600 px-2" aria-label="حذف">
                      ✕
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="مبلغ">
                    <AmountInput value={p.amount} onChange={(v) => { setPayTouched(true); patchPay(p.key, { amount: v }); }} />
                  </Field>
                  <Field label={p.method === "CHEQUE" ? "از حساب بانکی" : "از"}>
                    <select
                      value={p.treasuryId}
                      onChange={(e) => {
                        const next = p.method === "CHEQUE" ? data?.nextSerial[e.target.value] : null;
                        patchPay(p.key, { treasuryId: e.target.value, ...(next ? { serialNo: next.serial, chequeBookId: next.bookId } : {}) });
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
                </div>
                {(p.method === "CARD_TRANSFER" || p.method === "BANK_TRANSFER") && (
                  <Field label="کد پیگیری (اختیاری)">
                    <input value={p.trackingCode} onChange={(e) => patchPay(p.key, { trackingCode: e.target.value })} className={inputCls} dir="ltr" />
                  </Field>
                )}
                {p.method === "CHEQUE" && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="شماره‌ی چک" hint={p.chequeBookId ? "شماره‌ی بعدی دسته‌چک" : undefined}>
                      <input value={p.serialNo} onChange={(e) => patchPay(p.key, { serialNo: e.target.value })} className={inputCls} inputMode="numeric" dir="ltr" />
                    </Field>
                    <Field label="سررسید">
                      <JalaliDatePicker value={p.dueDate} onChange={(v) => patchPay(p.key, { dueDate: v })} />
                    </Field>
                    <Field label="شناسه‌ی صیادی (۱۶ رقم)">
                      <input value={p.sayadId} onChange={(e) => patchPay(p.key, { sayadId: e.target.value })} className={inputCls} inputMode="numeric" dir="ltr" />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        {total > 0n && (
          <p className={`text-xs ${payable < 0n ? "text-red-600 font-bold" : "text-gray-500"}`}>
            {payable < 0n
              ? `${formatAmount(-payable)} بیشتر از مبلغ هزینه پرداخت شده`
              : payable > 0n
                ? `${formatAmount(payable)} تومان نسیه — بدهی شما ${party ? `به ${party.name}` : "به شخصی که انتخاب می‌کنید"}`
                : "کل هزینه پرداخت شد"}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <Field label="توضیح (اختیاری)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
      </Card>

      <ErrorText>{error}</ErrorText>

      <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 lg:-mx-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-white/10">
        <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 truncate">{sentence || "جمع هزینه"}</p>
            <Money value={total} className="text-base" />
          </div>
          <button onClick={save} disabled={!canSave} className={btn.primary} title="Ctrl+Enter">
            {busy ? "در حال ثبت…" : "ثبت هزینه"}
          </button>
        </div>
      </div>
    </div>
  );
}
