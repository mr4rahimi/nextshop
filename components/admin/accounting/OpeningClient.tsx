"use client";

/**
 * مانده‌های اول دوره — docs/plans/accounting.md بخش ۱۷.
 * هر ذخیره همان سند افتتاحیه را بازسازی می‌کند؛ فرم از روی همان سند پر می‌شود.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import AmountInput from "./AmountInput";
import PartyPicker, { type PartyOption } from "./PartyPicker";
import { KIND_META, type TreasuryRecord } from "./TreasuryForm";
import { api, btn, Card, ErrorText, Money, PageHeader, Segmented, SectionTitle } from "./ui";

interface OpeningData {
  year: { id: string; title: string; startDate: string };
  voucher: { id: string; number: number } | null;
  treasuries: { treasuryId: string; amount: string }[];
  parties: { partyId: string; amount: string }[];
  partyInfo: PartyOption[];
  /** کیف پول‌ها در سند فعلی (null = نیامده) و عددی که ذخیره‌ی دوباره می‌سازد */
  wallets: string | null;
  walletPreview: { count: number; total: string };
  can: { manage: boolean };
}

interface PartyRow {
  key: number;
  party: PartyOption | null;
  dir: "owesUs" | "weOwe";
  amount: string;
}

let rowKey = 0;

export default function OpeningClient() {
  const sp = useSearchParams();
  const [data, setData] = useState<OpeningData | null>(null);
  const [treasuries, setTreasuries] = useState<TreasuryRecord[]>([]);
  const [tAmounts, setTAmounts] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [wallets, setWallets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<OpeningData>("/api/admin/accounting/opening"),
      api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury"),
    ])
      .then(([o, t]) => {
        setData(o);
        // پیش‌فرض: اگر سند هنوز نیست و مشتری‌ها کیف پول پر دارند، بیاید
        setWallets(o.voucher ? o.wallets !== null : o.walletPreview.count > 0);
        setTreasuries(t.items);
        setTAmounts(Object.fromEntries(o.treasuries.map((x) => [x.treasuryId, x.amount])));
        const info = new Map(o.partyInfo.map((p) => [p.id, p]));
        const r = o.parties.map((p) => {
          const n = BigInt(p.amount);
          return { key: ++rowKey, party: info.get(p.partyId) ?? null, dir: n >= 0n ? ("owesUs" as const) : ("weOwe" as const), amount: (n < 0n ? -n : n).toString() };
        });
        setRows(r.length ? r : [{ key: ++rowKey, party: null, dir: "owesUs", amount: "" }]);
      })
      .catch((e) => setError(e.message));
  }, []);

  const totals = useMemo(() => {
    let cash = 0n;
    for (const v of Object.values(tAmounts)) cash += BigInt(v || "0");
    let rec = 0n;
    let pay = 0n;
    for (const r of rows) {
      if (!r.party || !r.amount) continue;
      if (r.dir === "owesUs") rec += BigInt(r.amount);
      else pay += BigInt(r.amount);
    }
    if (wallets && data) pay += BigInt(data.walletPreview.total);
    return { cash, rec, pay, capital: cash + rec - pay };
  }, [tAmounts, rows, wallets, data]);

  async function save() {
    if (!data) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const d = await api<{ voucher: { number: number } | null }>("/api/admin/accounting/opening", {
        method: "PUT",
        json: {
          yearId: data.year.id,
          treasuries: Object.entries(tAmounts).map(([treasuryId, amount]) => ({ treasuryId, amount: amount || "0" })),
          parties: rows
            .filter((r) => r.party && r.amount)
            .map((r) => ({ partyId: r.party!.id, amount: r.dir === "owesUs" ? r.amount : `-${r.amount}` })),
          wallets,
        },
      });
      setSaved(d.voucher ? `ذخیره شد — سند شماره‌ی ${faNum(d.voucher.number)}` : "مانده‌ها پاک شد");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const readOnly = !data.can.manage;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مانده‌های اول دوره"
        help="accountingOpening"
        desc={`وضعیت مالی در روز اول سال مالی ${faNum(data.year.title)} — ${formatJalali(new Date(data.year.startDate))}`}
        back={{ href: "/admin/accounting", label: "حسابداری" }}
      />

      {sp.get("welcome") && (
        <Card className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">🎉 حسابداری داخلی راه‌اندازی شد.</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1 leading-6">
            قدم بعدی: موجودی صندوق و بانک و طلب و بدهی اشخاص در اول سال را وارد کنید. اگر حساب بانکی تعریف نکرده‌اید، اول{" "}
            <Link href="/admin/accounting/treasury?new=1" className="font-bold underline">
              یک حساب بانکی اضافه کنید
            </Link>
            .
          </p>
        </Card>
      )}

      <section>
        <SectionTitle title="موجودی صندوق و بانک" />
        <Card className="divide-y divide-gray-100 dark:divide-white/5">
          {treasuries.map((t) => (
            <div key={t.id} className="grid sm:grid-cols-[1fr_240px] gap-2 items-center px-4 py-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {KIND_META[t.kind].icon} {t.name}
              </p>
              <AmountInput value={tAmounts[t.id] ?? ""} onChange={(v) => setTAmounts((x) => ({ ...x, [t.id]: v }))} compact disabled={readOnly} />
            </div>
          ))}
          <div className="px-4 py-2.5">
            <Link href="/admin/accounting/treasury?new=1" className="text-xs font-bold text-blue-600">
              ➕ حساب بانکی تازه
            </Link>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle title="طلب و بدهی اشخاص" />
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <Card key={r.key} className="p-3 grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto] items-start">
              <PartyPicker
                value={r.party}
                onChange={(p) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, party: p } : y)))}
                canCreate={!readOnly}
                compact
              />
              <Segmented
                value={r.dir}
                onChange={(v) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, dir: v } : y)))}
                options={[
                  { value: "owesUs", label: "طلب از او" },
                  { value: "weOwe", label: "بدهی به او" },
                ]}
              />
              <AmountInput value={r.amount} onChange={(v) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, amount: v } : y)))} compact disabled={readOnly} />
              <button
                onClick={() => setRows((x) => (x.length > 1 ? x.filter((y) => y.key !== r.key) : [{ key: ++rowKey, party: null, dir: "owesUs", amount: "" }]))}
                className="h-10 px-3 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                aria-label={`حذف ردیف ${i + 1}`}
              >
                ✕
              </button>
            </Card>
          ))}
          {!readOnly && (
            <button onClick={() => setRows((x) => [...x, { key: ++rowKey, party: null, dir: "owesUs", amount: "" }])} className={btn.soft}>
              ➕ شخص دیگر
            </button>
          )}
        </div>
      </section>

      {(data.walletPreview.count > 0 || data.wallets !== null) && (
        <section>
          <SectionTitle title="کیف پول مشتریان سایت" help="accountingOpening" />
          <Card className="p-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={wallets} onChange={(e) => setWallets(e.target.checked)} disabled={readOnly} />
              <span>
                موجودی کیف پول‌ها بدهی شما به مشتریان است و در اول دوره بیاید
                <span className="block text-xs text-gray-500 mt-1">
                  {faNum(data.walletPreview.count)} مشتری · جمع <Money value={data.walletPreview.total} tone="red" /> تومان
                </span>
                <span className="block text-[11px] text-gray-400 leading-5 mt-1">
                  عدد خودکار است: موجودی امروز کیف پول‌ها منهای شارژ و خرجی که بعد از راه‌اندازی در حسابداری ثبت شده. ذخیره‌ی دوباره آن را دو بار حساب نمی‌کند.
                </span>
              </span>
            </label>
          </Card>
        </section>
      )}

      <Card className="p-3 md:p-4 sticky bottom-20 md:bottom-4 z-20 shadow-lg">
        <div className="hidden md:grid grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-500">نقد و بانک</p>
            <Money value={totals.cash} />
          </div>
          <div>
            <p className="text-gray-500">طلب از اشخاص</p>
            <Money value={totals.rec} tone="green" />
          </div>
          <div>
            <p className="text-gray-500">بدهی به اشخاص</p>
            <Money value={totals.pay} tone="red" />
          </div>
          <div>
            <p className="text-gray-500">سرمایه‌ی اول دوره</p>
            <Money value={totals.capital} tone={totals.capital < 0n ? "red" : "blue"} />
          </div>
        </div>
        {/* موبایل: فقط نتیجه، تا ردیف‌ها زیر نوار گم نشوند */}
        <div className="md:hidden flex items-center justify-between text-xs">
          <span className="text-gray-500">سرمایه‌ی اول دوره</span>
          <Money value={totals.capital} tone={totals.capital < 0n ? "red" : "blue"} />
        </div>
        <ErrorText>{error}</ErrorText>
        {saved && <p className="text-xs font-bold text-emerald-600 mt-2">{saved}</p>}
        {!readOnly && (
          <div className="flex gap-2 mt-2 md:mt-3">
            <button onClick={save} disabled={busy} className={`${btn.primary} flex-1 sm:flex-none`}>
              {busy ? "در حال ذخیره…" : "ذخیره‌ی مانده‌ها"}
            </button>
            {data.voucher && (
              <Link href={`/admin/accounting/vouchers/${data.voucher.id}`} className={btn.soft}>
                دیدن سند
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
