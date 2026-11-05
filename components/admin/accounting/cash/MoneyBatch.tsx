"use client";

/**
 * دریافت/پرداخت گروهی — docs/plans/webhesab-parity.md بخش ۱۸.
 *
 * جدول ردیف‌ها (شخص، مبلغ، روش، صندوق/بانک، کد پیگیری، شرح، و برای چک شماره و سررسید)؛
 * ورود از اکسل یا چسباندن از اکسل. «بررسی» همه را روی سرور امتحان می‌کند و خطا/هشدار هر ردیف
 * و مانده‌ی هر شخص را نشان می‌دهد؛ «ثبت همه» فقط وقتی هیچ ردیفی خطا ندارد ثبت می‌کند.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { faNum, parseAmountInput } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api, BalanceLabel, btn, Card, ErrorText, inputCls, Money, PageHeader, Segmented } from "../ui";

type Kind = "RECEIPT" | "PAYMENT";
type Method = "CASH" | "CARD_TRANSFER" | "BANK_TRANSFER" | "POS" | "CHEQUE";
type TKind = "CASH" | "BANK" | "POS" | "GATEWAY";
interface Treasury {
  id: string;
  name: string;
  kind: TKind;
}
const METHODS: { value: Method; label: string }[] = [
  { value: "CASH", label: "نقد" },
  { value: "CARD_TRANSFER", label: "کارت‌به‌کارت" },
  { value: "BANK_TRANSFER", label: "واریز بانکی" },
  { value: "POS", label: "کارتخوان" },
  { value: "CHEQUE", label: "چک" },
];
const FITS: Record<Method, TKind[]> = { CASH: ["CASH"], CARD_TRANSFER: ["BANK"], BANK_TRANSFER: ["BANK"], POS: ["POS", "BANK"], CHEQUE: ["BANK"] };

interface Row {
  key: number;
  party: PartyOption | null;
  /** از اکسل: کد، موبایل، کد ملی یا نام — تا بررسی شخص را پیدا کند */
  partyKey: string;
  amount: string;
  method: "" | Method;
  /** روش متنی از اکسل («نقد»، «چک») — سرور می‌شناسد؛ انتخاب از فهرست جایش را می‌گیرد */
  methodText: string;
  treasuryId: string;
  treasuryKey: string;
  date: string;
  trackingCode: string;
  description: string;
  serialNo: string;
  dueDate: string;
  bankName: string;
}
interface Result {
  line: number;
  party: { id: string; code: number; name: string } | null;
  amount: string;
  method: string;
  treasury: string | null;
  balanceBefore: string | null;
  doc: { id: string; number: number } | null;
  error: string | null;
  warnings: string[];
}
interface BatchResponse {
  committed: boolean;
  batchId: string | null;
  rows: Result[];
  ok: number;
  failed: number;
  total: string;
}

let seq = 1;
const blank = (): Row => ({ key: seq++, party: null, partyKey: "", amount: "", method: "", methodText: "", treasuryId: "", treasuryKey: "", date: "", trackingCode: "", description: "", serialNo: "", dueDate: "", bankName: "" });

/** ستون‌های اکسل — سرستون با این الگوها شناخته می‌شود؛ چسباندن بی‌سرستون به همین ترتیب */
const COLS = ["party", "amount", "method", "treasury", "trackingCode", "description", "date", "serialNo", "dueDate", "bankName"] as const;
type Col = (typeof COLS)[number];
const COL_LABEL: Record<Col, string> = {
  party: "شخص (کد، موبایل یا نام)",
  amount: "مبلغ",
  method: "روش",
  treasury: "صندوق/بانک",
  trackingCode: "کد پیگیری",
  description: "شرح",
  date: "تاریخ",
  serialNo: "شماره چک",
  dueDate: "سررسید",
  bankName: "بانک چک",
};
const COL_RE: Record<Col, RegExp> = {
  party: /شخص|مشتری|طرف|نام|کد شخص|موبایل|party|name/i,
  amount: /مبلغ|amount|مقدار/i,
  method: /روش|نوع|method/i,
  treasury: /صندوق|بانک|حساب|treasury/i,
  trackingCode: /پیگیری|مرجع|tracking|ref/i,
  description: /شرح|توضیح|یادداشت|description|note/i,
  date: /^تاریخ$|^date$/i,
  serialNo: /شماره.?چک|سریال|serial/i,
  dueDate: /سررسید|due/i,
  bankName: /بانک.?چک|bank.?name/i,
};

function fromCells(at: (k: Col) => string): Row {
  return {
    ...blank(),
    partyKey: at("party"),
    amount: parseAmountInput(at("amount")),
    method: "",
    methodText: at("method"),
    treasuryKey: at("treasury"),
    trackingCode: at("trackingCode"),
    description: at("description"),
    date: at("date"),
    serialNo: at("serialNo"),
    dueDate: at("dueDate"),
    bankName: at("bankName"),
  };
}

export default function MoneyBatch() {
  const sp = useSearchParams();
  const [kind, setKind] = useState<Kind>(sp.get("kind")?.toUpperCase() === "PAYMENT" ? "PAYMENT" : "RECEIPT");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<Method>("CARD_TRANSFER");
  const [treasuryId, setTreasuryId] = useState("");
  const [allocate, setAllocate] = useState(true);
  const [description, setDescription] = useState("");
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, blank));
  const [results, setResults] = useState<Map<number, Result> | null>(null);
  const [summary, setSummary] = useState<{ ok: number; failed: number; total: string } | null>(null);
  const [done, setDone] = useState<BatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const label = kind === "RECEIPT" ? "دریافت" : "پرداخت";

  useEffect(() => {
    api<{ today: string; treasuries: Treasury[] }>(`/api/admin/accounting/money/form?kind=${kind}`)
      .then((d) => {
        setTreasuries(d.treasuries);
        setDate((x) => x || d.today);
      })
      .catch((e) => setError(e.message));
  }, [kind]);

  // صندوق سربرگ: اولین سازگار با روش پیش‌فرض
  useEffect(() => {
    if (!treasuries.length) return;
    if (method === "CHEQUE" && kind === "RECEIPT") return setTreasuryId("");
    setTreasuryId((cur) => (treasuries.some((t) => t.id === cur && FITS[method].includes(t.kind)) ? cur : treasuries.find((t) => FITS[method].includes(t.kind))?.id ?? ""));
  }, [method, treasuries, kind]);

  // هر تغییر، نتیجه‌ی بررسی قبلی را بی‌اعتبار می‌کند
  const touch = () => {
    setResults(null);
    setSummary(null);
  };
  const patch = (key: number, p: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
    touch();
  };
  const filled = rows.filter((r) => r.party || r.partyKey.trim() || r.amount);
  const sum = filled.reduce((s, r) => s + BigInt(r.amount || "0"), 0n);

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const body = {
        commit,
        kind,
        date,
        method,
        treasuryId: treasuryId || null,
        allocate,
        description,
        rows: rows
          .map((r, i) => ({ r, line: i + 1 }))
          .filter(({ r }) => r.party || r.partyKey.trim() || r.amount)
          .map(({ r, line }) => {
            const m = r.method || r.methodText || "";
            return {
              line,
              partyId: r.party?.id ?? null,
              partyKey: r.party ? null : r.partyKey,
              amount: r.amount,
              method: m || null,
              treasuryId: r.treasuryId || null,
              treasuryKey: r.treasuryId ? null : r.treasuryKey || null,
              date: r.date || null,
              trackingCode: r.trackingCode || null,
              description: r.description || null,
              cheque: m === "CHEQUE" || /چک|cheque|check/i.test(m) ? { serialNo: r.serialNo, dueDate: r.dueDate, bankName: r.bankName } : null,
            };
          }),
      };
      const res = await api<BatchResponse>("/api/admin/accounting/money/batch", { method: "POST", json: body });
      if (res.committed) {
        setDone(res);
        return;
      }
      const map = new Map(res.rows.map((x) => [x.line, x]));
      // شخصِ پیداشده از کلید اکسل در جدول هم بنشیند
      setRows((rs) =>
        rs.map((r, i) => {
          const hit = map.get(i + 1);
          return !r.party && hit?.party ? { ...r, party: { id: hit.party.id, code: hit.party.code, name: hit.party.name, mobile: null }, partyKey: "" } : r;
        }),
      );
      setResults(map);
      setSummary({ ok: res.ok, failed: res.failed, total: res.total });
      if (commit) setError(`${faNum(res.failed)} ردیف خطا دارد — هیچ سندی ثبت نشد. ردیف‌های قرمز را درست کنید.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <PageHeader title={`${label} گروهی`} help="accountingMoneyBatch" back={{ href: `/admin/accounting/money?kind=${kind}`, label: "دریافت و پرداخت" }} />
        <Card className="p-5 space-y-3">
          <p className="text-base font-black text-emerald-700 dark:text-emerald-300">
            ✅ {faNum(done.ok)} سند {label} ثبت شد — جمع <Money value={done.total} />
          </p>
          <ul className="text-sm divide-y divide-gray-100 dark:divide-white/5">
            {done.rows.map((r) => (
              <li key={r.line} className="flex items-center gap-2 py-1.5">
                {r.doc && (
                  <Link href={`/admin/accounting/money/${r.doc.id}`} className="font-bold text-blue-700 dark:text-blue-300 hover:underline">
                    {label} {faNum(r.doc.number)}
                  </Link>
                )}
                <span className="text-gray-600 dark:text-gray-300">{r.party?.name}</span>
                <Money value={r.amount} className="mr-auto text-sm" />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/accounting/money?kind=${kind}&batchId=${done.batchId}`} className={btn.soft}>
              دیدن در فهرست
            </Link>
            <button
              onClick={() => {
                setDone(null);
                setRows(Array.from({ length: 5 }, blank));
                touch();
              }}
              className={btn.primary}
            >
              ثبت گروهی تازه
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${label} گروهی`}
        help="accountingMoneyBatch"
        back={{ href: `/admin/accounting/money?kind=${kind}`, label: "دریافت و پرداخت" }}
        desc={`چند ${label} با یک فرم: هر ردیف یک سند جدا برای یک شخص. از اکسل هم می‌شود آورد.`}
        actions={
          <button onClick={() => setSheet((x) => !x)} className={btn.soft}>
            📄 ورود از اکسل
          </button>
        }
      />

      <Card className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="sm:col-span-2 lg:col-span-1">
          <Segmented<Kind>
            value={kind}
            onChange={(k) => {
              setKind(k);
              touch();
            }}
            options={[
              { value: "RECEIPT", label: "دریافت" },
              { value: "PAYMENT", label: "پرداخت" },
            ]}
          />
        </div>
        <label className="text-xs text-gray-500 space-y-1">
          <span>تاریخ (ردیف‌های بی‌تاریخ)</span>
          <JalaliDatePicker
            value={date}
            onChange={(v) => {
              setDate(v);
              touch();
            }}
            clearable={false}
          />
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          <span>روش پیش‌فرض</span>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as Method);
              touch();
            }}
            className={inputCls}
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          <span>{kind === "RECEIPT" ? "به حساب" : "از حساب"} (پیش‌فرض)</span>
          <select
            value={treasuryId}
            disabled={method === "CHEQUE" && kind === "RECEIPT"}
            onChange={(e) => {
              setTreasuryId(e.target.value);
              touch();
            }}
            className={inputCls}
          >
            {method === "CHEQUE" && kind === "RECEIPT" && <option value="">اسناد دریافتنی</option>}
            {treasuries
              .filter((t) => FITS[method].includes(t.kind))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            touch();
          }}
          placeholder="شرح مشترک همه‌ی سندها (اختیاری)"
          className={`${inputCls} sm:col-span-2 lg:col-span-3`}
        />
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={allocate}
            onChange={(e) => {
              setAllocate(e.target.checked);
              touch();
            }}
          />
          تسویه با قدیمی‌ترین فاکتورهای باز
        </label>
      </Card>

      {sheet && (
        <SheetImport
          onRows={(rs) => {
            setRows(rs.length ? rs : [blank()]);
            setSheet(false);
            touch();
          }}
        />
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[920px]">
          <thead className="bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">
            <tr>
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2 text-right w-56">{kind === "RECEIPT" ? "از چه کسی" : "به چه کسی"}</th>
              <th className="px-2 py-2 text-right w-36">مبلغ</th>
              <th className="px-2 py-2 text-right w-28">روش</th>
              <th className="px-2 py-2 text-right w-36">صندوق/بانک</th>
              <th className="px-2 py-2 text-right">پیگیری و شرح</th>
              <th className="px-2 py-2 text-right w-48">وضعیت</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5 align-top">
            {rows.map((r, i) => {
              const res = results?.get(i + 1);
              const m = r.method || method;
              const isCheque = r.method ? r.method === "CHEQUE" : r.methodText ? /چک|cheque|check/i.test(r.methodText) : m === "CHEQUE";
              return (
                <tr key={r.key} className={res?.error ? "bg-red-50/60 dark:bg-red-500/5" : ""}>
                  <td className="px-2 py-2 text-center text-xs text-gray-400">{faNum(i + 1)}</td>
                  <td className="px-2 py-2">
                    {!r.party && r.partyKey ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="flex-1 truncate rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-2">{r.partyKey}</span>
                        <button onClick={() => patch(r.key, { partyKey: "" })} className="text-gray-400" aria-label="پاک کردن">
                          ×
                        </button>
                      </div>
                    ) : (
                      <PartyPicker compact value={r.party} onChange={(p) => patch(r.key, { party: p })} />
                    )}
                    {r.party?.balance != null && BigInt(r.party.balance) !== 0n && (
                      <button
                        type="button"
                        onClick={() => {
                          const b = BigInt(r.party!.balance!);
                          const v = kind === "RECEIPT" ? b : -b;
                          if (v > 0n) patch(r.key, { amount: v.toString() });
                        }}
                        className="mt-1 text-[10px] text-blue-600"
                        title="مبلغ = کل مانده"
                      >
                        مانده: <BalanceLabel balance={r.party.balance} />
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <AmountInput compact value={r.amount} onChange={(v) => patch(r.key, { amount: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <select value={r.method} onChange={(e) => patch(r.key, { method: e.target.value as Row["method"], treasuryId: "" })} className={inputCls.replace("py-2.5", "py-2")}>
                      <option value="">{r.methodText || `پیش‌فرض (${METHODS.find((x) => x.value === method)?.label})`}</option>
                      {METHODS.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {isCheque && kind === "RECEIPT" ? (
                      <span className="block px-2 py-2 text-[11px] text-gray-400">اسناد دریافتنی</span>
                    ) : (
                      <select value={r.treasuryId} onChange={(e) => patch(r.key, { treasuryId: e.target.value })} className={inputCls.replace("py-2.5", "py-2")}>
                        <option value="">{r.treasuryKey || "پیش‌فرض"}</option>
                        {treasuries
                          .filter((t) => FITS[(r.method || method) as Method].includes(t.kind))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-2 space-y-1">
                    <div className="flex gap-1">
                      <input value={r.trackingCode} onChange={(e) => patch(r.key, { trackingCode: e.target.value })} placeholder="کد پیگیری" className={`${inputCls.replace("py-2.5", "py-2")} w-28`} dir="ltr" />
                      <input value={r.description} onChange={(e) => patch(r.key, { description: e.target.value })} placeholder="شرح" className={inputCls.replace("py-2.5", "py-2")} />
                    </div>
                    {isCheque && (
                      <div className="flex flex-wrap gap-1">
                        <input value={r.serialNo} onChange={(e) => patch(r.key, { serialNo: e.target.value })} placeholder="شماره چک" className={`${inputCls.replace("py-2.5", "py-2")} w-28`} dir="ltr" />
                        <div className="w-36">
                          <JalaliDatePicker value={/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate) ? r.dueDate : ""} onChange={(v) => patch(r.key, { dueDate: v })} placeholder={r.dueDate || "سررسید"} />
                        </div>
                        {kind === "RECEIPT" && (
                          <input value={r.bankName} onChange={(e) => patch(r.key, { bankName: e.target.value })} placeholder="بانک" className={`${inputCls.replace("py-2.5", "py-2")} w-24`} />
                        )}
                      </div>
                    )}
                    {r.date && <p className="text-[10px] text-gray-400">تاریخ این ردیف: {faNum(r.date)}</p>}
                  </td>
                  <td className="px-2 py-2 text-[11px] leading-5">
                    {res ? (
                      res.error ? (
                        <span className="text-red-700 dark:text-red-300">⛔ {res.error}</span>
                      ) : (
                        <>
                          <span className="text-emerald-700 dark:text-emerald-300">✓ آماده</span>
                          {res.balanceBefore != null && (
                            <span className="block text-gray-500">
                              مانده بعد:{" "}
                              <BalanceLabel balance={String(BigInt(res.balanceBefore) + (kind === "RECEIPT" ? -1n : 1n) * BigInt(res.amount))} />
                            </span>
                          )}
                          {res.warnings.map((w) => (
                            <span key={w} className="block text-amber-700 dark:text-amber-300">
                              ⚠️ {w}
                            </span>
                          ))}
                        </>
                      )
                    ) : null}
                  </td>
                  <td className="px-1 py-2">
                    <button
                      onClick={() => {
                        setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blank()]));
                        touch();
                      }}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="حذف ردیف"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/5">
          <button
            onClick={() => {
              setRows((rs) => [...rs, ...Array.from({ length: 5 }, blank)]);
            }}
            className={btn.small}
          >
            + ۵ ردیف
          </button>
          <span className="text-xs text-gray-500 mr-auto">
            {faNum(filled.length)} ردیف · جمع <Money value={sum.toString()} />
          </span>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>
      {summary && (
        <p className={`text-xs font-bold ${summary.failed ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {summary.failed ? `${faNum(summary.failed)} ردیف خطا دارد؛ ${faNum(summary.ok)} ردیف آماده` : `همه‌ی ${faNum(summary.ok)} ردیف آماده‌ی ثبت‌اند — جمع `}
          {!summary.failed && <Money value={summary.total} />}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => send(false)} disabled={busy || !filled.length} className={btn.soft}>
          {busy ? "…" : "🔍 بررسی"}
        </button>
        <button onClick={() => send(true)} disabled={busy || !summary || summary.failed > 0} className={btn.primary} title={!summary ? "اول «بررسی» را بزنید" : undefined}>
          {busy ? "در حال ثبت…" : `ثبت همه‌ی ${label}‌ها`}
        </button>
      </div>
    </div>
  );
}

function SheetImport({ onRows }: { onRows: (rows: Row[]) => void }) {
  const [paste, setPaste] = useState("");
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [cols, setCols] = useState<Record<Col, number>>(() => Object.fromEntries(COLS.map((c, i) => [c, i])) as Record<Col, number>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const head = file?.rows[0] ?? [];

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فایل خوانده نشد");
      const rows: string[][] = j.sheets?.[0]?.rows ?? [];
      setFile({ name: j.name, rows });
      setPaste("");
      const h = rows[0] ?? [];
      const used = new Set<number>();
      // «بانک چک» پیش از «صندوق/بانک» تا ستون بانک چک با حساب اشتباه نشود
      const order: Col[] = ["bankName", "serialNo", "dueDate", "trackingCode", "amount", "method", "treasury", "description", "date", "party"];
      const found = {} as Record<Col, number>;
      for (const c of order) {
        const k = h.findIndex((x, idx) => !used.has(idx) && COL_RE[c].test(String(x).trim()));
        found[c] = k;
        if (k >= 0) used.add(k);
      }
      setCols(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد");
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => {
    if (paste.trim()) {
      return paste
        .split(/\r?\n/)
        .map((l) => l.split("\t").map((x) => x.trim()))
        .filter((c) => c.some(Boolean))
        .map((c) => fromCells((k) => c[COLS.indexOf(k)] ?? ""));
    }
    if (!file) return [];
    return file.rows
      .slice(1)
      .filter((c) => c.some(Boolean))
      .map((c) => fromCells((k) => (cols[k] >= 0 ? String(c[cols[k]] ?? "").trim() : "")));
  }, [paste, file, cols]);

  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs leading-6 text-gray-500">
        فایل xlsx یا csv انتخاب کنید یا ردیف‌ها را از اکسل کپی کنید و اینجا بچسبانید. ستون‌ها به این ترتیب (فقط دو ستون اول لازم است):{" "}
        {COLS.map((c) => COL_LABEL[c]).join("، ")}. شخص با کد، موبایل، کد ملی یا نام دقیقش پیدا می‌شود؛ روش «نقد، کارت، واریز، کارتخوان، چک» و تاریخ
        شمسی مثل ۱۴۰۵/۰۸/۱۴.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <label className={`${btn.soft} cursor-pointer`}>
          {busy ? "در حال خواندن…" : "انتخاب فایل (xlsx یا csv)"}
          <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {file && <span className="text-xs text-gray-500">{file.name}</span>}
      </div>
      {file && (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
          {COLS.map((c) => (
            <label key={c} className="text-[11px] text-gray-500 space-y-0.5">
              <span>{COL_LABEL[c]}</span>
              <select value={cols[c]} onChange={(e) => setCols((x) => ({ ...x, [c]: Number(e.target.value) }))} className={inputCls.replace("py-2.5", "py-1.5")}>
                <option value={-1}>—</option>
                {head.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `ستون ${faNum(i + 1)}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <textarea
        value={paste}
        onChange={(e) => {
          setPaste(e.target.value);
          setFile(null);
        }}
        rows={4}
        placeholder={"یا اینجا بچسبانید — مثلاً:\n1003\t2500000\tکارت\n09121110002\t1200000\tنقد"}
        className={inputCls}
        dir="auto"
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-2">
        <button onClick={() => onRows(rows)} disabled={!rows.length} className={btn.primary}>
          آوردن {faNum(rows.length)} ردیف به جدول
        </button>
        <span className="text-[11px] text-gray-400">ردیف‌های فعلی جدول جایگزین می‌شوند</span>
      </div>
    </Card>
  );
}
