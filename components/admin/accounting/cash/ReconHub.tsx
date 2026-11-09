"use client";

/** تطبیق بانک — حساب‌ها و تاریخچه (docs/plans/webhesab-parity.md بخش ۲۰) */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { formatAmount, faNum } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import { api, Badge, btn, Card, Empty, ErrorText, Field, Money, PageHeader, Sheet } from "../ui";

interface Bank {
  id: string;
  name: string;
  kind: string;
  bankName: string | null;
  balance: string;
  openId: string | null;
  lastClosed: { id: string; statementDate: string; closingBalance: string } | null;
}
interface Recon {
  id: string;
  status: "OPEN" | "CLOSED";
  statementDate: string;
  closingBalance: string;
  closedByName: string | null;
  stale: number;
  treasury: { id: string; name: string };
}

const BASE = "/admin/accounting/treasury/reconcile";

export default function ReconHub() {
  const router = useRouter();
  const [data, setData] = useState<{ treasuries: Bank[]; recons: Recon[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState<Bank | null>(null);
  const [statementDate, setStatementDate] = useState(dayValue(todayKey()));
  const [fromDate, setFromDate] = useState(dayValue(todayKey()));
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    api<{ treasuries: Bank[]; recons: Recon[] }>("/api/admin/accounting/treasury/reconcile")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  async function create() {
    if (!start) return;
    setBusy(true);
    setFormError(null);
    try {
      const d = await api<{ recon: { id: string } }>("/api/admin/accounting/treasury/reconcile", {
        method: "POST",
        json: { treasuryId: start.id, statementDate, fromDate, openingBalance: opening || "0", closingBalance: closing || "0" },
      });
      router.push(`${BASE}/${d.recon.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "ساخته نشد");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="تطبیق بانک"
        help="accountingBankRecon"
        desc="صورت‌حساب بانک را با دفتر مقایسه کنید و ببینید چه چیزی هنوز در بانک ننشسته یا در دفتر ثبت نشده."
        back={{ href: "/admin/accounting/treasury", label: "صندوق و بانک" }}
      />
      <ErrorText>{error}</ErrorText>
      {data?.treasuries.length === 0 && <Empty title="حساب بانکی فعالی نیست" desc="از «صندوق و بانک» یک حساب بانکی بسازید." />}

      <div className="grid gap-3 md:grid-cols-2">
        {data?.treasuries.map((t) => (
          <Card key={t.id} className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/admin/accounting/treasury/${t.id}`} className="font-bold text-sm hover:underline">
                  {t.name}
                </Link>
                {t.bankName && <div className="text-xs text-gray-500">{t.bankName}</div>}
              </div>
              <div className="text-sm font-bold">
                <Money value={t.balance} />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {t.lastClosed ? (
                <>
                  آخرین تطبیق تا{" "}
                  <Link href={`${BASE}/${t.lastClosed.id}`} className="text-blue-600 hover:underline">
                    {formatJalali(new Date(t.lastClosed.statementDate))}
                  </Link>{" "}
                  با مانده‌ی {formatAmount(t.lastClosed.closingBalance)}
                </>
              ) : (
                "هنوز تطبیق نشده"
              )}
            </p>
            {t.openId ? (
              <Link href={`${BASE}/${t.openId}`} className={btn.primary}>
                ادامه‌ی تطبیق باز
              </Link>
            ) : (
              <button onClick={() => { setStart(t); setClosing(""); setOpening(""); setFormError(null); }} className={btn.soft}>
                🏦 تطبیق تازه
              </button>
            )}
          </Card>
        ))}
      </div>

      {!!data?.recons.length && (
        <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
          {data.recons.map((r) => (
            <Link key={r.id} href={`${BASE}/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="font-bold">{r.treasury.name}</span>
              <span className="text-xs text-gray-500">تا {formatJalali(new Date(r.statementDate))}</span>
              {r.status === "OPEN" ? <Badge tone="amber">باز</Badge> : <Badge tone="green">بسته · {r.closedByName}</Badge>}
              {r.stale > 0 && <Badge tone="red">{faNum(r.stale)} سند بعد از تطبیق عوض شد</Badge>}
              <span className="mr-auto tabular-nums font-bold">{formatAmount(r.closingBalance)}</span>
            </Link>
          ))}
        </Card>
      )}

      <Sheet
        open={!!start}
        onClose={() => setStart(null)}
        title={`تطبیق ${start?.name ?? ""}`}
        help="accountingBankRecon"
        footer={
          <button onClick={create} disabled={busy} className={`${btn.primary} w-full`}>
            {busy ? "در حال ساخت…" : "شروع تطبیق"}
          </button>
        }
      >
        <div className="space-y-3">
          <Field label="تاریخ پایان صورت‌حساب">
            <JalaliDatePicker value={statementDate} onChange={setStatementDate} />
          </Field>
          {!start?.lastClosed && (
            <>
              <Field label="شروع تطبیق از تاریخ" hint="گردش قبل از این تاریخ بررسی نمی‌شود">
                <JalaliDatePicker value={fromDate} onChange={setFromDate} />
              </Field>
              <Field label="مانده‌ی بانک در شروع همان تاریخ (تومان)">
                <AmountInput value={opening} onChange={setOpening} />
              </Field>
            </>
          )}
          {start?.lastClosed && <p className="text-xs text-gray-500">مانده‌ی آغاز از تطبیق قبلی می‌آید: {formatAmount(start.lastClosed.closingBalance)}</p>}
          <Field label="مانده‌ی پایان طبق صورت‌حساب (تومان)" hint="اگر صورت‌حساب اکسل وارد کنید، از آخرین ردیفش پر می‌شود">
            <AmountInput value={closing} onChange={setClosing} />
          </Field>
          <ErrorText>{formError}</ErrorText>
        </div>
      </Sheet>
    </div>
  );
}
