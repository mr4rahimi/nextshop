"use client";

/**
 * اقساط سازمانی روی صفحه‌ی فاکتور فروش: قراردادهای همین فاکتور و دکمه‌ی «اقساط سازمانی» برای مانده‌ی باز.
 * docs/plans/org-installments.md
 */

import { useCallback, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { faNum, formatAmount, parseAmountInput } from "@/lib/accounting/money";
import { api, Badge, btn, Card, ErrorText, Field, inputCls, Sheet } from "../ui";
import { B, ContractSheet, STATUS_LABEL, orgColor } from "./shared";

interface Opt {
  id: string;
  name: string;
  months: number;
  commissionBp: number;
  requireRef: boolean;
  color: string | null;
}
interface Mine {
  id: string;
  number: number;
  org: { id: string; name: string; color: string | null };
  total: string;
  remaining: string;
  monthly: string;
  status: "ACTIVE" | "DONE" | "VOID";
}
interface Quote {
  commission: string;
  net: string;
  monthly: string;
  cap: { available: string | null };
  problems: string[];
}

export default function OrgInvoicePanel({ invoiceId, partyId, open, canSell, onChange }: { invoiceId: string; partyId: string; open: bigint; canSell: boolean; onChange: () => void }) {
  const [orgs, setOrgs] = useState<Opt[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [sheet, setSheet] = useState(false);
  const [contract, setContract] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ orgs: Opt[] }>("/api/admin/accounting/installment-orgs?active=1")
      .then((r) => setOrgs(r.orgs))
      .catch(() => setOrgs([]));
    api<{ contracts: Mine[] }>(`/api/admin/accounting/installment-orgs/contracts?invoiceId=${invoiceId}`)
      .then((r) => setMine(r.contracts))
      .catch(() => setMine([]));
  }, [invoiceId]);
  useEffect(() => {
    load();
  }, [load]);
  if (!mine.length && (!orgs.length || !canSell || open <= 0n)) return null;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-black">
          <Building2 className="h-4 w-4 text-indigo-600" aria-hidden /> اقساط سازمانی
        </p>
        {canSell && open > 0n && orgs.length > 0 && (
          <button onClick={() => setSheet(true)} className={btn.primary}>
            قسطی کردن {formatAmount(open)} تومان
          </button>
        )}
      </div>
      {mine.map((c) => (
        <button key={c.id} onClick={() => setContract(c.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 text-right text-sm hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5">
          <span>
            <span className="font-black" style={{ color: orgColor(c.org.color) }}>
              {c.org.name}
            </span>{" "}
            · قرارداد {faNum(c.number)} · ماهانه {formatAmount(B(c.monthly))}
          </span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{formatAmount(B(c.total))}</span>
            <Badge tone={c.status === "DONE" ? "green" : c.status === "VOID" ? "red" : "blue"}>{STATUS_LABEL[c.status]}</Badge>
          </span>
        </button>
      ))}
      {sheet && (
        <SellSheet
          invoiceId={invoiceId}
          partyId={partyId}
          open={open}
          orgs={orgs}
          onClose={() => setSheet(false)}
          onDone={() => {
            setSheet(false);
            load();
            onChange();
          }}
        />
      )}
      {contract && (
        <ContractSheet
          id={contract}
          onClose={() => setContract(null)}
          onChanged={() => {
            load();
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function SellSheet({ invoiceId, partyId, open, orgs, onClose, onDone }: { invoiceId: string; partyId: string; open: bigint; orgs: Opt[]; onClose: () => void; onDone: () => void }) {
  const [orgId, setOrgId] = useState(orgs.length === 1 ? orgs[0].id : "");
  const [amount, setAmount] = useState(open.toString());
  const [emp, setEmp] = useState("");
  const [letter, setLetter] = useState("");
  const [q, setQ] = useState<{ key: string; q: Quote | null; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const org = orgs.find((o) => o.id === orgId);
  const amt = B(amount);
  const key = `${orgId}:${amt}`;
  useEffect(() => {
    if (!orgId || amt <= 0n) return;
    let live = true;
    const t = setTimeout(() => {
      api<{ quote: Quote }>(`/api/admin/accounting/installment-orgs/quote?orgId=${orgId}&partyId=${partyId}&amount=${amt}`)
        .then((r) => live && setQ({ key: `${orgId}:${amt}`, q: r.quote }))
        .catch((e) => live && setQ({ key: `${orgId}:${amt}`, q: null, error: e.message }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [orgId, amt, partyId]);
  const cur = q?.key === key ? q : null;
  const problem = !org ? null : amt > open ? `بیشتر از مانده‌ی فاکتور (${formatAmount(open)})` : org.requireRef && !emp.trim() && !letter.trim() ? "کد پرسنلی یا شماره‌ی معرفی‌نامه را بنویسید" : cur?.error ?? cur?.q?.problems[0] ?? null;
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/accounting/installment-orgs/sell", { method: "POST", json: { invoiceId, orgId, amount: amt.toString(), employeeCode: emp, letterNo: letter } });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title="فروش اقساطی سازمانی"
      help="accountingOrgInstallments"
      footer={
        <button onClick={save} disabled={busy || !org || amt <= 0n || !!problem || !cur?.q} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ثبت اقساط"}
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {orgs.map((o) => (
            <button key={o.id} onClick={() => setOrgId(o.id)} className={`rounded-xl border-2 px-3 py-2 text-sm font-black ${orgId === o.id ? "bg-white dark:bg-white/10" : "border-gray-200 dark:border-white/10"}`} style={orgId === o.id ? { borderColor: orgColor(o.color), color: orgColor(o.color) } : undefined}>
              {o.name} <span className="text-[11px] opacity-70">{o.months} قسط{o.commissionBp ? ` · ${o.commissionBp / 100}٪` : ""}</span>
            </button>
          ))}
        </div>
        <Field label="مبلغ اقساطی (تومان)" hint="بقیه‌ی فاکتور با دریافت عادی">
          <input value={amount ? formatAmount(B(amount)) : ""} onChange={(e) => setAmount(parseAmountInput(e.target.value))} inputMode="numeric" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="کد پرسنلی">
            <input value={emp} onChange={(e) => setEmp(e.target.value)} className={inputCls} />
          </Field>
          <Field label="شماره‌ی معرفی‌نامه">
            <input value={letter} onChange={(e) => setLetter(e.target.value)} className={inputCls} />
          </Field>
        </div>
        {cur?.q && !problem && (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-500/10">
            <div>
              <p className="text-[11px] font-bold text-gray-500">قسط ماهانه</p>
              <p className="font-black tabular-nums text-indigo-700 dark:text-indigo-300">{formatAmount(B(cur.q.monthly))}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500">پورسانت سازمان</p>
              <p className="font-black tabular-nums text-amber-600">{formatAmount(B(cur.q.commission))}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500">باقی سقف</p>
              <p className="font-black tabular-nums">{cur.q.cap.available === null ? "بی‌سقف" : formatAmount(B(cur.q.cap.available))}</p>
            </div>
          </div>
        )}
        {problem && <p className="text-xs font-bold text-red-600">{problem}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
