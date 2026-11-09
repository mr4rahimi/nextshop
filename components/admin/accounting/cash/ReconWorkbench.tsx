"use client";

/**
 * میز تطبیق بانک: بالا اختلاف، راست صورت‌حساب واردشده، چپ ردیف‌های دفتر.
 * با انتخاب یک ردیف بانک، تیک‌های دفتر به همان ردیف وصل می‌شوند.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import { api, Badge, btn, Card, Chips, ErrorText, Field, inputCls, PageHeader, Sheet } from "../ui";

interface Line {
  id: string;
  date: string;
  amount: string;
  description: string;
  voucherId: string;
  voucherNumber: number;
  ticked: boolean;
  rowId: string | null;
  stale: boolean;
}
interface Row {
  id: string;
  seq: number;
  date: string;
  description: string | null;
  refNo: string | null;
  amount: string;
  matched: string;
  matchedCount: number;
}
interface Data {
  recon: {
    id: string;
    status: "OPEN" | "CLOSED";
    fromDate: string;
    statementDate: string;
    note: string | null;
    closedAt: string | null;
    closedByName: string | null;
    treasury: { id: string; name: string; bankName: string | null };
  };
  lockedOpening: boolean;
  lines: Line[];
  rows: Row[];
  stale: { id: string; date: string; amount: string; description: string; voucherId: string; voucherNumber: number }[];
  truncated: boolean;
  summary: Record<"openingBalance" | "deposits" | "withdrawals" | "reconciled" | "closingBalance" | "difference" | "ledgerBalance" | "openDeposits" | "openWithdrawals" | "expectedBank", string>;
}
type LineFilter = "open" | "done" | "all";

const LIST = "/admin/accounting/treasury/reconcile";
const day = (v: string) => formatJalali(new Date(v));
const signed = (v: string) => (BigInt(v) < 0n ? `−${formatAmount(-BigInt(v))}` : `+${formatAmount(v)}`);

export default function ReconWorkbench({ id }: { id: string }) {
  const router = useRouter();
  const url = `/api/admin/accounting/treasury/reconcile/${id}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<LineFilter>("open");
  const [selRow, setSelRow] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    return api<Data>(url)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [url]);

  useEffect(() => {
    load();
    // برگشت از تب ثبت هزینه یا دریافت
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const act = useCallback(
    async (json: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const r = await api<Record<string, unknown>>(url, { method: "POST", json });
        await load();
        return r;
      } catch (e) {
        setError(e instanceof Error ? e.message : "انجام نشد");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [url, load],
  );

  const lines = useMemo(() => {
    if (!data) return [];
    return data.lines.filter((l) => (filter === "all" ? true : filter === "open" ? !l.ticked : l.ticked));
  }, [data, filter]);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const { recon, summary: s } = data;
  const open = recon.status === "OPEN";
  const diff = BigInt(s.difference);
  const selected = data.rows.find((r) => r.id === selRow) ?? null;

  async function toggle(l: Line) {
    await act(l.ticked ? { action: "untick", lineIds: [l.id] } : { action: "tick", lineIds: [l.id], rowId: selRow });
  }
  async function auto() {
    const r = await act({ action: "auto", days: 3 });
    if (r) setInfo(`${faNum(Number(r.matched))} ردیف جفت شد`);
  }
  async function close() {
    if (await act({ action: "close" })) setInfo("تطبیق بسته شد");
  }
  async function remove() {
    if (!window.confirm("این تطبیق باز حذف شود؟ سندها دست نمی‌خورند.")) return;
    setBusy(true);
    try {
      await api(url, { method: "DELETE" });
      router.push(LIST);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف نشد");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`تطبیق ${recon.treasury.name}`}
        help="accountingBankRecon"
        desc={`از ${day(recon.fromDate)} تا ${day(recon.statementDate)}`}
        back={{ href: LIST, label: "تطبیق بانک" }}
        actions={
          open ? (
            <>
              <button onClick={() => setImporting(true)} disabled={busy} className={btn.soft}>
                📄 ورود صورت‌حساب
              </button>
              <button onClick={() => setEditing(true)} disabled={busy} className={btn.soft}>
                ویرایش مانده‌ها
              </button>
              <button onClick={remove} disabled={busy} className={btn.danger}>
                حذف
              </button>
            </>
          ) : (
            <button onClick={() => act({ action: "reopen" })} disabled={busy} className={btn.soft}>
              باز کردن دوباره
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Num label="مانده‌ی آغاز" value={s.openingBalance} />
        <Num label="واریز تطبیق‌شده" value={s.deposits} sub={`برداشت ${formatAmount(s.withdrawals)}`} />
        <Num label="مانده‌ی پایان بانک" value={s.closingBalance} />
        <Card className={`p-3 ${diff === 0n ? "ring-1 ring-emerald-400" : "ring-1 ring-red-300"}`}>
          <p className="text-[11px] text-gray-500">اختلاف</p>
          <p className={`text-lg font-black tabular-nums ${diff === 0n ? "text-emerald-600" : "text-red-600"}`}>{diff === 0n ? "✓ صفر" : formatAmount(diff < 0n ? -diff : diff)}</p>
          {open && (
            <button onClick={close} disabled={busy || diff !== 0n} className={`${btn.primary} mt-1.5 w-full`}>
              بستن تطبیق
            </button>
          )}
          {!open && <p className="text-[11px] text-gray-400 mt-1">بسته‌شده توسط {recon.closedByName}</p>}
        </Card>
      </div>

      {info && <p className="text-xs font-bold text-emerald-600">{info}</p>}
      <ErrorText>{error}</ErrorText>
      {data.truncated && <p className="text-xs text-amber-600">فقط ۳۰۰۰ ردیف اول نشان داده شده؛ تاریخ پایان را نزدیک‌تر کنید.</p>}

      {data.stale.length > 0 && (
        <Card className="p-3 space-y-1.5">
          <p className="text-xs font-bold text-red-600">{open ? "این ردیف‌ها بعد از تیک باطل یا ویرایش شدند و دیگر شمرده نمی‌شوند:" : "این ردیف‌ها بعد از بستن تطبیق باطل یا ویرایش شدند:"}</p>
          {data.stale.map((x) => (
            <Link key={x.id} href={`/admin/accounting/vouchers/${x.voucherId}`} className="flex justify-between gap-3 text-xs hover:underline">
              <span>سند {faNum(x.voucherNumber)} · {day(x.date)} · {x.description}</span>
              <span className="tabular-nums" dir="ltr">{signed(x.amount)}</span>
            </Link>
          ))}
        </Card>
      )}

      <div className={`grid gap-4 ${data.rows.length ? "lg:grid-cols-2" : ""}`}>
        {data.rows.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black">صورت‌حساب بانک ({faNum(data.rows.length)})</h2>
              {open && (
                <button onClick={auto} disabled={busy} className={btn.small}>
                  ⚡ جفت کردن خودکار
                </button>
              )}
            </div>
            {selected && <p className="text-[11px] text-blue-600">ردیف انتخاب شد؛ ردیف‌های دفتر را تیک بزنید تا به آن وصل شوند.</p>}
            <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
              {data.rows.map((r) => {
                const matched = r.matchedCount > 0;
                const full = matched && r.matched === r.amount;
                return (
                  <div key={r.id} className={`p-3 text-xs space-y-1.5 ${selRow === r.id ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{day(r.date)}{r.refNo ? ` · ${r.refNo}` : ""}</p>
                        {r.description && <p className="text-gray-500 break-words">{r.description}</p>}
                      </div>
                      <span dir="ltr" className={`tabular-nums font-black shrink-0 ${BigInt(r.amount) < 0n ? "text-rose-600" : "text-emerald-600"}`}>
                        {signed(r.amount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {full ? <Badge tone="green">جفت شد</Badge> : matched ? <Badge tone="amber">جفت ناقص: {formatAmount(r.matched)}</Badge> : <Badge tone="red">در دفتر پیدا نشد</Badge>}
                      {open && !full && (
                        <button onClick={() => setSelRow(selRow === r.id ? null : r.id)} className={btn.small}>
                          {selRow === r.id ? "لغو انتخاب" : "انتخاب"}
                        </button>
                      )}
                      {open && !matched && BigInt(r.amount) < 0n && (
                        <button onClick={() => act({ action: "fee", rowId: r.id })} disabled={busy} className={btn.small}>
                          ثبت کارمزد
                        </button>
                      )}
                      {open && !matched && (
                        <Link href={BigInt(r.amount) < 0n ? "/admin/accounting/expenses/new" : "/admin/accounting/income/new"} target="_blank" className={btn.small}>
                          {BigInt(r.amount) < 0n ? "ثبت هزینه" : "ثبت درآمد"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black">ردیف‌های دفتر</h2>
            <Chips<LineFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: "باز" },
                { value: "done", label: "تطبیق‌شده" },
                { value: "all", label: "همه" },
              ]}
            />
          </div>
          <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
            {lines.length === 0 && <p className="p-4 text-xs text-gray-400">ردیفی نیست.</p>}
            {lines.map((l) => (
              <label key={l.id} className={`flex items-start gap-2.5 p-3 text-xs ${open && !l.stale ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" : ""}`}>
                {open && <input type="checkbox" checked={l.ticked} disabled={busy || l.stale} onChange={() => toggle(l)} className="mt-0.5" aria-label="تطبیق ردیف" />}
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{day(l.date)}</span>{" "}
                  <Link href={`/admin/accounting/vouchers/${l.voucherId}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                    سند {faNum(l.voucherNumber)}
                  </Link>
                  <span className="block text-gray-500 break-words">{l.description}</span>
                </span>
                <span dir="ltr" className={`tabular-nums font-black shrink-0 ${BigInt(l.amount) < 0n ? "text-rose-600" : "text-emerald-600"}`}>
                  {signed(l.amount)}
                </span>
              </label>
            ))}
          </Card>
        </section>
      </div>

      <Card className="p-4 space-y-1.5 text-xs">
        <h2 className="text-sm font-black mb-1">صورت مغایرت</h2>
        <Rec label={`مانده‌ی دفتر تا ${day(recon.statementDate)}`} value={s.ledgerBalance} />
        <Rec label="منهای واریزهای دفتر که هنوز در بانک ننشسته" value={s.openDeposits} />
        <Rec label="به‌علاوه‌ی برداشت‌های دفتر که هنوز از بانک کم نشده" value={s.openWithdrawals} />
        <div className="border-t border-gray-100 dark:border-white/5 pt-1.5">
          <Rec label="مانده‌ی بانک طبق دفتر" value={s.expectedBank} bold />
        </div>
        <Rec label="مانده‌ی صورت‌حساب" value={s.closingBalance} bold />
      </Card>

      {importing && <ImportSheet onClose={() => setImporting(false)} act={act} onDone={setInfo} />}
      {editing && <EditSheet data={data} onClose={() => setEditing(false)} act={act} />}
    </div>
  );
}

function Num({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-black tabular-nums">{formatAmount(value)}</p>
      {sub && <p className="text-[11px] text-gray-400 tabular-nums">{sub}</p>}
    </Card>
  );
}

function Rec({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-black text-sm" : "text-gray-600 dark:text-gray-400"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatAmount(value)}</span>
    </div>
  );
}

function EditSheet({ data, onClose, act }: { data: Data; onClose: () => void; act: (j: Record<string, unknown>) => Promise<Record<string, unknown> | null> }) {
  const [statementDate, setStatementDate] = useState(dayValue(new Date(data.recon.statementDate)));
  const [fromDate, setFromDate] = useState(dayValue(new Date(data.recon.fromDate)));
  const [opening, setOpening] = useState(data.summary.openingBalance);
  const [closing, setClosing] = useState(data.summary.closingBalance);

  async function save() {
    const r = await act({ action: "update", statementDate, closingBalance: closing || "0", ...(data.lockedOpening ? {} : { fromDate, openingBalance: opening || "0" }) });
    if (r) onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="ویرایش مانده‌ها"
      footer={
        <button onClick={save} className={`${btn.primary} w-full`}>
          ذخیره
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="تاریخ پایان صورت‌حساب">
          <JalaliDatePicker value={statementDate} onChange={setStatementDate} />
        </Field>
        {!data.lockedOpening && (
          <>
            <Field label="شروع تطبیق از تاریخ">
              <JalaliDatePicker value={fromDate} onChange={setFromDate} />
            </Field>
            <Field label="مانده‌ی آغاز">
              <AmountInput value={opening} onChange={setOpening} />
            </Field>
          </>
        )}
        <Field label="مانده‌ی پایان">
          <AmountInput value={closing} onChange={setClosing} />
        </Field>
      </div>
    </Sheet>
  );
}

const COLS = ["date", "description", "refNo", "deposit", "withdrawal", "amount", "balance"] as const;
type Col = (typeof COLS)[number];
const COL_LABEL: Record<Col, string> = { date: "تاریخ", description: "شرح", refNo: "شماره پیگیری", deposit: "واریز (بستانکار)", withdrawal: "برداشت (بدهکار)", amount: "مبلغ علامت‌دار", balance: "مانده" };
// ترتیب مهم است: «مانده» پیش از شرح و مبلغ تا با آن‌ها اشتباه نشود
const DETECT: [Col, RegExp][] = [
  ["date", /تاریخ|date/i],
  ["balance", /مانده|موجودی|balance/i],
  ["deposit", /واریز|بستانکار|deposit|credit/i],
  ["withdrawal", /برداشت|بدهکار|withdraw|debit/i],
  ["refNo", /پیگیری|سند|مرجع|ref/i],
  ["description", /شرح|توضیح|desc/i],
  ["amount", /مبلغ|amount/i],
];

function ImportSheet({ onClose, act, onDone }: { onClose: () => void; act: (j: Record<string, unknown>) => Promise<Record<string, unknown> | null>; onDone: (s: string) => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [name, setName] = useState("");
  const [cols, setCols] = useState<Record<Col, number>>({ date: -1, description: -1, refNo: -1, deposit: -1, withdrawal: -1, amount: -1, balance: -1 });
  const [unit, setUnit] = useState("RIAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const head = rows?.[0] ?? [];

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فایل خوانده نشد");
      const all: string[][] = j.sheets?.[0]?.rows ?? [];
      // سرستون همیشه ردیف اول نیست؛ اولین ردیفی که «تاریخ» دارد
      const at = Math.max(0, all.findIndex((c) => c.some((x) => /تاریخ|date/i.test(String(x)))));
      const body = all.slice(at);
      setRows(body);
      setName(j.name);
      const h = (body[0] ?? []).map((x) => String(x).trim());
      const used = new Set<number>();
      const found = { date: -1, description: -1, refNo: -1, deposit: -1, withdrawal: -1, amount: -1, balance: -1 } as Record<Col, number>;
      for (const [c, re] of DETECT) {
        const k = h.findIndex((x, i) => !used.has(i) && re.test(x));
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

  async function submit() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    const cell = (c: string[], k: Col) => (cols[k] >= 0 ? String(c[cols[k]] ?? "") : "");
    const payload = rows
      .slice(1)
      .filter((c) => c.some(Boolean) && cell(c, "date").trim())
      .map((c) => Object.fromEntries(COLS.map((k) => [k, cell(c, k)])));
    const r = await act({ action: "import", rows: payload, unit });
    setBusy(false);
    if (r) {
      onDone(`${faNum(Number(r.count))} ردیف وارد شد؛ حالا «جفت کردن خودکار» را بزنید.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title="ورود صورت‌حساب بانک"
      help="accountingBankRecon"
      footer={
        <button onClick={submit} disabled={!rows || busy || cols.date < 0} className={`${btn.primary} w-full`}>
          {busy ? "در حال ورود…" : `ورود ${faNum(Math.max(0, (rows?.length ?? 1) - 1))} ردیف`}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs leading-6 text-gray-500">فایل xlsx یا csv صورت‌حساب را انتخاب کنید. ورود تازه جای ردیف‌های قبلی همین تطبیق را می‌گیرد؛ تیک‌های دفتر می‌مانند.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btn.soft} cursor-pointer`}>
            انتخاب فایل
            <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {name && <span className="text-xs text-gray-500">{name}</span>}
        </div>
        {rows && (
          <>
            <Field label="واحد مبلغ‌های فایل" hint="پنل با تومان کار می‌کند؛ صورت‌حساب بانک معمولاً ریال است">
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                <option value="RIAL">ریال</option>
                <option value="TOMAN">تومان</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COLS.map((c) => (
                <Field key={c} label={COL_LABEL[c]}>
                  <select value={cols[c]} onChange={(e) => setCols((x) => ({ ...x, [c]: Number(e.target.value) }))} className={inputCls.replace("py-2.5", "py-2")}>
                    <option value={-1}>—</option>
                    {head.map((h, i) => (
                      <option key={i} value={i}>
                        {String(h) || `ستون ${faNum(i + 1)}`}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-gray-400">در صورت‌حساب بانک «بستانکار» یعنی واریز به حساب شما و «بدهکار» یعنی برداشت. اگر یک ستون مبلغ با علامت دارید، «مبلغ علامت‌دار» را انتخاب کنید.</p>
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
