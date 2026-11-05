"use client";

/**
 * پنجره‌ی ادغام دو شخص — docs/plans/webhesab-parity.md بخش ۱۷.
 * دو طرف کنار هم با گردش و مانده؛ کاربر انتخاب می‌کند کدام بماند (پیشنهاد سرور پیش‌فرض است)؛
 * تأیید صریح؛ بعد از ادغام به صفحه‌ی ماندنی می‌رود.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import PartyPicker, { type PartyOption } from "./PartyPicker";
import { api, Badge, BalanceLabel, btn, ErrorText, Sheet } from "./ui";

interface Side {
  id: string;
  code: number;
  name: string;
  mobile: string | null;
  nationalId: string | null;
  personType: string;
  roles: string[];
  links: string[];
  isActive: boolean;
  createdAt: string;
  balance: string;
  counts: Record<string, number>;
  total: number;
}
interface Preview {
  a: Side;
  b: Side;
  suggestKeep: string;
  blockers: string[];
  labels: Record<string, string>;
  can: { merge: boolean };
}

export default function PartyMerge({
  baseId,
  otherId,
  onClose,
  onDone,
}: {
  baseId: string;
  otherId?: string | null;
  onClose: () => void;
  onDone: (keepId: string) => void;
}) {
  const [other, setOther] = useState<PartyOption | null>(null);
  const [pick, setPick] = useState<string | null>(otherId ?? null);
  const [data, setData] = useState<Preview | null>(null);
  const [keep, setKeep] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (other) setPick(other.id);
  }, [other]);

  useEffect(() => {
    if (!pick) return;
    setData(null);
    setSure(false);
    setError(null);
    api<Preview>(`/api/admin/accounting/parties/merge?a=${baseId}&b=${pick}`)
      .then((d) => {
        setData(d);
        setKeep(d.suggestKeep);
      })
      .catch((e) => setError(e.message));
  }, [baseId, pick]);

  const keepSide = data && (keep === data.a.id ? data.a : data.b);
  const dropSide = data && (keep === data.a.id ? data.b : data.a);
  const ok = !!data && !data.blockers.length && data.can.merge && sure && !busy;

  async function run() {
    if (!keepSide || !dropSide) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/parties/merge`, { method: "POST", json: { keepId: keepSide.id, dropId: dropSide.id } });
      onDone(keepSide.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title="ادغام شخص تکراری"
      help="accountingPartyMerge"
      footer={
        data && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={run} disabled={!ok} className={btn.primary}>
              {busy ? "در حال ادغام…" : "🔀 ادغام کن"}
            </button>
            <button onClick={onClose} className={btn.soft}>
              انصراف
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {!otherId && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">شخص تکراری را پیدا کنید:</p>
            <PartyPicker value={other} onChange={setOther} placeholder="نام، موبایل یا کد شخص تکراری" />
          </div>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        {pick && !data && !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>}

        {data && (
          <>
            <p className="text-xs text-gray-500 leading-6">
              کدام بماند؟ همه‌ی فاکتورها، دریافت و پرداخت‌ها، چک‌ها و ردیف‌های سند دیگری به آن منتقل می‌شود و صورت‌حسابش یکی می‌شود. دیگری غیرفعال
              می‌ماند و صفحه‌اش به ماندنی اشاره می‌کند.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[data.a, data.b].map((s) => (
                <SideCard key={s.id} s={s} labels={data.labels} keep={keep === s.id} onPick={() => setKeep(s.id)} suggested={data.suggestKeep === s.id} />
              ))}
            </div>

            {data.blockers.length > 0 ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
                {data.blockers.map((b) => (
                  <p key={b}>⛔ {b}</p>
                ))}
              </div>
            ) : !data.can.merge ? (
              <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                ادغام ردیف‌های سندهای ثبت‌شده را جابه‌جا می‌کند و مجوز «نمای حسابدار» هم می‌خواهد. از مدیر بخواهید.
              </p>
            ) : (
              keepSide &&
              dropSide && (
                <label className="flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 p-3 text-xs leading-6 cursor-pointer">
                  <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1" />
                  <span>
                    «{dropSide.name}» (کد {faNum(dropSide.code)}، {faNum(dropSide.total)} مورد) در «{keepSide.name}» (کد {faNum(keepSide.code)}) ادغام شود. مانده‌ی
                    بعد از ادغام: <BalanceLabel balance={String(BigInt(keepSide.balance) + BigInt(dropSide.balance))} />. این کار برگشت خودکار ندارد.
                  </span>
                </label>
              )
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function SideCard({ s, labels, keep, onPick, suggested }: { s: Side; labels: Record<string, string>; keep: boolean; onPick: () => void; suggested: boolean }) {
  const counts = Object.entries(s.counts);
  return (
    <div
      className={`rounded-2xl border-2 p-3 space-y-2 transition ${keep ? "border-blue-500 bg-blue-50/40 dark:bg-blue-500/5" : "border-gray-200 dark:border-white/10 opacity-80"}`}
    >
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" checked={keep} onChange={onPick} />
        <span className="text-xs font-bold">{keep ? "می‌ماند" : "ادغام می‌شود"}</span>
        {suggested && <Badge tone="blue">پیشنهاد</Badge>}
      </label>
      <div>
        <Link href={`/admin/accounting/parties/${s.id}`} target="_blank" className="text-sm font-black text-blue-700 dark:text-blue-300 hover:underline">
          {s.name}
        </Link>
        <p className="text-[11px] text-gray-500">
          کد {faNum(s.code)}
          {s.mobile && (
            <>
              {" · "}
              <span dir="ltr">{faNum(s.mobile)}</span>
            </>
          )}
          {s.nationalId && ` · کد ملی ${faNum(s.nationalId)}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {s.roles.map((r) => (
          <Badge key={r}>{r}</Badge>
        ))}
        {s.links.map((r) => (
          <Badge key={r} tone="green">
            {r}
          </Badge>
        ))}
        {!s.isActive && <Badge tone="red">غیرفعال</Badge>}
      </div>
      <div className="text-xs">
        <span className="text-gray-500">مانده: </span>
        <BalanceLabel balance={s.balance} />
      </div>
      {counts.length ? (
        <ul className="text-[11px] text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-x-2">
          {counts.map(([k, n]) => (
            <li key={k}>
              {labels[k] ?? k}: <b>{faNum(n)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-gray-400">هیچ گردشی ندارد</p>
      )}
    </div>
  );
}
