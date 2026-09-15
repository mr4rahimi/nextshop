"use client";

/**
 * پورسانت — کارمند مانده‌ی خودش، مدیر جدول همه با «ثبت پرداخت».
 *
 * عدد خام همیشه کنار مبلغ نهایی است: تعداد معامله، جمع سود، درصد مؤثر، کسری و
 * انتقالی (بخش ۲۲.۸، قاعده‌ی ۳). «چرا این عدد» فقط با صورت و مخرج جواب می‌گیرد.
 */

import { useCallback, useEffect, useState } from "react";
import { formatJalaliShort } from "@/lib/club/jalali";

interface StatementRow {
  userId: string;
  userName: string;
  planTitle: string | null;
  dealCount: number;
  adjustmentCount: number;
  totalProfit: string;
  grossCommission: string;
  adjustment: string;
  carriedIn: string;
  due: string;
  pendingCount: number;
  lastPaidAt: string | null;
  percent: number;
}

interface Payout {
  id: string;
  userName: string;
  dealCount: number;
  totalProfit: string;
  grossCommission: string;
  adjustment: string;
  carriedIn: string;
  due: string;
  amount: string;
  remaining: string;
  paidAt: string;
  paidByName: string;
  note: string | null;
}

function money(v: string | number) {
  return Number(v).toLocaleString("fa-IR");
}

export default function PayoutsClient() {
  const [data, setData] = useState<{
    statement: StatementRow;
    team: StatementRow[];
    history: Payout[];
    can: { viewAll: boolean; manage: boolean };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<StatementRow | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/worklist/payouts")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        if (!ignore) setData(d);
      })
      .catch((e) => !ignore && setError(e.message));
    return () => {
      ignore = true;
    };
  }, [reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (error) return <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>;
  if (!data) return <p className="text-xs text-gray-500">در حال محاسبه...</p>;

  const s = data.statement;

  return (
    <div className="space-y-6">
      {!data.can.viewAll && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-5 space-y-4">
          <div>
            <p className="text-[11px] text-gray-500">قابل پرداخت به شما</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{money(s.due)} <span className="text-sm">تومان</span></p>
            <p className="text-[11px] text-gray-400 mt-1">
              {s.planTitle ? `طرح: ${s.planTitle}` : "طرح پورسانتی برایتان تعیین نشده است"}
              {s.lastPaidAt && ` · آخرین تسویه ${formatJalaliShort(new Date(s.lastPaidAt))}`}
            </p>
          </div>
          <Breakdown row={s} />
          {s.pendingCount > 0 && <PendingWarning count={s.pendingCount} />}
        </div>
      )}

      {data.can.viewAll && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
              <tr>
                <th className="px-4 py-2.5">کارمند</th>
                <th className="px-3 py-2.5 text-center">معامله</th>
                <th className="px-3 py-2.5 text-center">سود</th>
                <th className="px-3 py-2.5 text-center">پورسانت دوره</th>
                <th className="px-3 py-2.5 text-center">کسری / انتقالی</th>
                <th className="px-3 py-2.5 text-center">قابل پرداخت</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {data.team.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    هنوز به هیچ کارمندی طرح پورسانت داده نشده و معامله‌ی صاحب‌داری نیست.
                  </td>
                </tr>
              )}
              {data.team.map((r) => (
                <tr key={r.userId}>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-gray-900 dark:text-white">{r.userName}</p>
                    <p className="text-[11px] text-gray-400">
                      {r.planTitle ?? "بدون طرح"}
                      {r.pendingCount > 0 && (
                        <span className="text-amber-600"> · {r.pendingCount.toLocaleString("fa-IR")} معامله بی‌قیمت خرید</span>
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{r.dealCount.toLocaleString("fa-IR")}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{money(r.totalProfit)}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {money(r.grossCommission)}
                    {r.percent > 0 && <span className="block text-[10px] text-gray-400">مؤثر {r.percent.toLocaleString("fa-IR")}٪</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[11px]">
                    {r.adjustment !== "0" && <span className="block text-red-600">{money(r.adjustment)}</span>}
                    {r.carriedIn !== "0" && <span className="block text-blue-600">+{money(r.carriedIn)}</span>}
                    {r.adjustment === "0" && r.carriedIn === "0" && "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums font-black text-gray-900 dark:text-white">{money(r.due)}</td>
                  <td className="px-4 py-2.5 text-left">
                    {data.can.manage && (r.dealCount > 0 || r.adjustmentCount > 0 || r.carriedIn !== "0") && (
                      <button
                        onClick={() => setPaying(r)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        ثبت پرداخت
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="text-xs font-black text-gray-900 dark:text-white mb-2">تسویه‌های قبلی</h2>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-x-auto">
          {data.history.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-500">هنوز تسویه‌ای ثبت نشده است</p>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">تاریخ</th>
                  {data.can.viewAll && <th className="px-3 py-2.5">کارمند</th>}
                  <th className="px-3 py-2.5 text-center">معامله</th>
                  <th className="px-3 py-2.5 text-center">قابل پرداخت</th>
                  <th className="px-3 py-2.5 text-center">پرداخت‌شده</th>
                  <th className="px-3 py-2.5 text-center">باقی</th>
                  <th className="px-4 py-2.5">ثبت‌کننده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.history.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      {formatJalaliShort(new Date(p.paidAt))}
                      {p.note && <span className="block text-[10px] text-gray-400">{p.note}</span>}
                    </td>
                    {data.can.viewAll && <td className="px-3 py-2.5 font-bold">{p.userName}</td>}
                    <td className="px-3 py-2.5 text-center tabular-nums">{p.dealCount.toLocaleString("fa-IR")}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{money(p.due)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-bold text-emerald-600">{money(p.amount)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{p.remaining === "0" ? "—" : money(p.remaining)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.paidByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {paying && (
        <PayDialog
          row={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Breakdown({ row }: { row: StatementRow }) {
  const items = [
    { label: "معامله‌ی قطعی", value: row.dealCount.toLocaleString("fa-IR") },
    { label: "جمع سود", value: money(row.totalProfit) },
    { label: "پورسانت این دوره", value: money(row.grossCommission) },
    { label: "درصد مؤثر", value: `${row.percent.toLocaleString("fa-IR")}٪` },
    ...(row.adjustment !== "0" ? [{ label: "کسری مرجوعی", value: money(row.adjustment) }] : []),
    ...(row.carriedIn !== "0" ? [{ label: "باقی تسویه‌ی قبل", value: money(row.carriedIn) }] : []),
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
          <p className="text-[10px] text-gray-500">{i.label}</p>
          <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

function PendingWarning({ count }: { count: number }) {
  return (
    <p className="text-[11px] font-bold rounded-xl px-3 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
      {count.toLocaleString("fa-IR")} معامله هنوز قیمت خریدشان ثبت نشده و در این عدد نیستند.
    </p>
  );
}

function PayDialog({ row, onClose, onDone }: { row: StatementRow; onClose: () => void; onDone: () => void }) {
  const due = BigInt(row.due);
  const [amount, setAmount] = useState(due > 0n ? row.due : "0");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = amount ? BigInt(amount) : 0n;
  const remaining = due - value;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId, amount, expectedDue: row.due, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ثبت نشد");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl p-5 space-y-4">
        <h2 className="text-sm font-black text-gray-900 dark:text-white">ثبت پرداخت پورسانت — {row.userName}</h2>
        <Breakdown row={row} />
        <p className="text-sm font-black text-gray-900 dark:text-white">قابل پرداخت: {money(row.due)} تومان</p>
        {row.pendingCount > 0 && <PendingWarning count={row.pendingCount} />}

        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">
          مبلغی که واقعاً پرداخت شد (تومان)
          <input
            inputMode="numeric"
            dir="ltr"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/\D/g, ""));
              setConfirm(false);
            }}
            className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-lg font-black text-gray-900 dark:text-white"
          />
        </label>
        {remaining > 0n && (
          <p className="text-[11px] text-blue-600 dark:text-blue-400">
            پرداخت جزئی: {money(remaining.toString())} تومان به تسویه‌ی بعدی منتقل می‌شود.
          </p>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="یادداشت، مثلاً شماره‌ی فیش"
          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
        />
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        {!confirm ? (
          <button
            disabled={value > (due > 0n ? due : 0n)}
            onClick={() => setConfirm(true)}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40"
          >
            {value > (due > 0n ? due : 0n) ? "مبلغ از قابل پرداخت بیشتر است" : "ثبت پرداخت"}
          </button>
        ) : (
          <div className="rounded-xl border border-red-200 dark:border-red-500/20 p-3 space-y-2">
            <p className="text-xs font-bold text-red-600 dark:text-red-400">
              پرداخت {money(amount || "0")} تومان به {row.userName} برای {row.dealCount.toLocaleString("fa-IR")} معامله ثبت شود؟ این کار برگشت‌ناپذیر است و معامله‌های این دوره قفل می‌شوند.
            </p>
            <div className="flex gap-2">
              <button disabled={saving} onClick={submit} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40">
                {saving ? "در حال ثبت..." : "بله، ثبت شود"}
              </button>
              <button onClick={() => setConfirm(false)} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold">
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
