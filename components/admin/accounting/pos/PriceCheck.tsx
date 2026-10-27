"use client";

/**
 * چک کردن قیمت (کیوسک) — docs/plans/webhesab-parity.md بخش ۹.
 *
 * تمام‌صفحه و بی‌قاب پنل، برای تبلت یا مانیتور کنار قفسه با بارکدخوان. کادر اسکن همیشه فوکوس
 * دارد؛ نتیجه: عکس، نام، قیمت فروشگاه، و جدول رنگ × سایز همان مدل در همین انبار (هر خانه ←
 * قیمت همان کالا). نمای مشتری فقط «هست/نیست» و بعد از ۳۰ ثانیه بی‌کاری به صفحه‌ی اول برمی‌گردد؛
 * نمای کارمند موجودی عددی، قیمت آنلاین و انبارهای دیگر را هم دارد.
 *
 * انبار: `?w=` یا انتخاب در چرخ‌دنده (روی همین دستگاه می‌ماند).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, PackageSearch, ScanLine, Settings, X } from "lucide-react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { api } from "../ui";
import { beep, faNum, formatAmount, local, type ModelPick, type PosItem } from "./shared";

interface Setup {
  warehouse: { id: string; name: string };
  warehouses: { id: string; name: string }[];
  staff: boolean;
}
interface Result {
  kind: "item" | "model" | "list" | "none";
  item: PosItem | null;
  pick: ModelPick | null;
  items: PosItem[];
  online: Record<string, string>;
  elsewhere: Record<string, { warehouseId: string; name: string; qty: number }[]>;
}

const IDLE_MS = 30_000;
const KEY_W = "price-check:warehouse";
const KEY_CUSTOMER = "price-check:customer";

export default function PriceCheck({ initialWarehouse }: { initialWarehouse: string | null }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(initialWarehouse);
  const [customerPref, setCustomerPref] = useState(false);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  /** کالای انتخاب‌شده از جدول یا فهرست (پیش‌فرض: کالای اسکن‌شده) */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // انبار ذخیره‌شده‌ی این دستگاه وقتی `?w=` نیامده
  useEffect(() => {
    if (!initialWarehouse) setWarehouseId(local.get<string | null>(KEY_W, null));
    setCustomerPref(local.get(KEY_CUSTOMER, false));
  }, [initialWarehouse]);

  useEffect(() => {
    api<Setup>(`/api/admin/accounting/price-check${warehouseId ? `?w=${warehouseId}` : ""}`)
      .then((s) => {
        setSetup(s);
        setFatal(null);
      })
      .catch((e: Error & { status?: number }) => {
        // انبار ذخیره‌شده پاک یا غیرفعال شده ← پیش‌فرض
        if (warehouseId && !initialWarehouse) {
          local.set(KEY_W, null);
          setWarehouseId(null);
        } else setFatal(e.message);
      });
  }, [warehouseId, initialWarehouse]);

  const customer = !setup?.staff || customerPref;

  const focus = useCallback(() => {
    if (!settings) input.current?.focus();
  }, [settings]);
  useEffect(() => {
    focus();
    const t = setInterval(focus, 1500);
    return () => clearInterval(t);
  }, [focus]);

  const reset = useCallback(() => {
    setResult(null);
    setSelectedId(null);
    setError(null);
    setTerm("");
  }, []);
  const touch = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    if (customer) idle.current = setTimeout(reset, IDLE_MS);
  }, [customer, reset]);
  useEffect(() => () => void (idle.current && clearTimeout(idle.current)), []);

  async function lookup(q: string) {
    if (!q.trim() || !setup) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ result: Result }>(`/api/admin/accounting/price-check?w=${setup.warehouse.id}&q=${encodeURIComponent(q.trim())}`);
      setResult(r.result);
      setSelectedId(r.result.item?.id ?? null);
      beep(r.result.kind !== "none");
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "پیدا نشد");
      beep(false);
    } finally {
      setBusy(false);
      setTerm("");
      touch();
    }
  }

  function chooseWarehouse(id: string) {
    local.set(KEY_W, id);
    setWarehouseId(id);
    reset();
  }

  const all = useMemo(() => (result ? [...(result.item ? [result.item] : []), ...(result.pick?.items ?? []), ...result.items] : []), [result]);
  const selected = all.find((i) => i.id === selectedId) ?? null;

  if (fatal) {
    return (
      <Screen>
        <div className="m-auto max-w-md p-6 text-center">
          <p className="text-lg font-black text-white">{fatal}</p>
          <Link href="/admin/login" className="mt-4 inline-block rounded-2xl bg-white/15 px-5 py-2.5 text-sm font-bold text-white">
            ورود به پنل
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen onPointerDown={touch}>
      <header className="flex items-center gap-3 px-5 pt-4">
        <p className="flex-1 truncate text-sm font-bold text-white/70">{setup ? setup.warehouse.name : "…"}</p>
        {!customer && <HelpButton topic="accountingPriceCheck" size="sm" />}
        <button onClick={() => setSettings(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-white/30 hover:bg-white/10 hover:text-white/80" aria-label="تنظیمات کیوسک">
          <Settings className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(term);
        }}
        className="mx-auto mt-4 w-full max-w-xl px-5"
      >
        <label className="flex items-center gap-3 rounded-3xl bg-white/15 px-5 py-3 ring-2 ring-white/20 focus-within:ring-white/60">
          <ScanLine className="h-6 w-6 shrink-0 text-white/80" aria-hidden />
          <input
            ref={input}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => setTimeout(focus, 50)}
            disabled={!setup}
            inputMode="search"
            autoComplete="off"
            placeholder="بارکد را اسکن کنید یا کد کالا را بنویسید"
            className="min-w-0 flex-1 bg-transparent text-center text-lg font-bold text-white outline-none placeholder:text-white/50"
          />
          {busy && <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />}
        </label>
      </form>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-6">
        {error ? (
          <Message icon={<PackageSearch className="h-14 w-14" aria-hidden />} title={error} sub="کد را دوباره اسکن کنید یا از فروشنده بپرسید" />
        ) : !result ? (
          <Message icon={<ScanLine className="h-20 w-20" aria-hidden />} title="قیمت کالا را اینجا ببینید" sub="بارکد روی برچسب کالا را جلوی اسکنر بگیرید" />
        ) : result.kind === "none" ? (
          <Message icon={<PackageSearch className="h-14 w-14" aria-hidden />} title="کالایی با این کد پیدا نشد" sub="کد را دوباره اسکن کنید یا از فروشنده بپرسید" />
        ) : result.kind === "list" && !selected ? (
          <div className="w-full max-w-3xl">
            <p className="mb-3 text-center text-sm font-bold text-white/70">کدام کالا؟</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.items.map((i) => (
                <button key={i.id} onClick={() => setSelectedId(i.id)} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-right hover:bg-white/20">
                  <Thumb src={i.image} className="h-14 w-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">{i.title}</span>
                    <span className="text-xs text-white/60">{i.price !== "0" ? `${formatAmount(i.price)} تومان` : "قیمت از فروشنده"}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl space-y-5">
            {selected ? (
              <ItemCard item={selected} customer={customer} online={result.online[selected.id]} elsewhere={result.elsewhere[selected.id]} />
            ) : (
              result.pick && <ModelHead pick={result.pick} />
            )}
            {result.pick && <Grid pick={result.pick} customer={customer} selectedId={selected?.id ?? null} onSelect={(id) => setSelectedId(id)} />}
            {result.kind === "list" && (
              <button onClick={() => setSelectedId(null)} className="mx-auto block text-sm font-bold text-white/70 underline">
                برگشت به فهرست
              </button>
            )}
          </div>
        )}
      </main>

      {settings && setup && (
        <SettingsSheet
          setup={setup}
          customerPref={customerPref}
          onCustomer={(v) => {
            local.set(KEY_CUSTOMER, v);
            setCustomerPref(v);
          }}
          onWarehouse={chooseWarehouse}
          onClose={() => setSettings(false)}
        />
      )}
    </Screen>
  );
}

function Screen({ children, onPointerDown }: { children: React.ReactNode; onPointerDown?: () => void }) {
  return (
    <div onPointerDown={onPointerDown} className="flex min-h-dvh flex-col bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white dark:from-emerald-900 dark:via-teal-900 dark:to-slate-900">
      {children}
    </div>
  );
}

function Message({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex justify-center text-white/50">{icon}</div>
      <p className="mt-4 text-2xl font-black sm:text-3xl">{title}</p>
      <p className="mt-2 text-sm text-white/70">{sub}</p>
    </div>
  );
}

function Thumb({ src, className }: { src: string | null; className: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${className} shrink-0 rounded-2xl bg-white object-contain`} />
  ) : (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/40`}>
      <PackageSearch className="h-1/2 w-1/2" aria-hidden />
    </span>
  );
}

function ItemCard({ item, customer, online, elsewhere }: { item: PosItem; customer: boolean; online?: string; elsewhere?: { warehouseId: string; name: string; qty: number }[] }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[2rem] bg-white/10 p-5 sm:flex-row sm:items-stretch">
      <Thumb src={item.image} className="h-48 w-48 sm:h-56 sm:w-56" />
      <div className="flex min-w-0 flex-1 flex-col justify-center text-center sm:text-right">
        <p className="text-xl font-black leading-8 sm:text-2xl">{item.title}</p>
        <p className="mt-1 text-xs text-white/60" dir="ltr">
          {item.code}
        </p>
        {item.price !== "0" ? (
          <p className="mt-4 text-5xl font-black tabular-nums sm:text-6xl">
            {formatAmount(item.price)} <span className="text-xl font-bold text-white/70">تومان</span>
          </p>
        ) : (
          <p className="mt-4 text-2xl font-black">قیمت را از فروشنده بپرسید</p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          {item.stock > 0 ? (
            <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">{customer ? "موجود در این فروشگاه" : `موجودی اینجا: ${faNum(item.stock)}`}</span>
          ) : (
            <span className="rounded-full bg-black/25 px-3 py-1 text-sm font-black text-white/80">در این فروشگاه تمام شده</span>
          )}
          {!customer && online && online !== item.price && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">قیمت آنلاین {formatAmount(online)}</span>
          )}
        </div>
        {!customer && !!elsewhere?.length && (
          <p className="mt-3 text-sm text-white/80">
            انبارهای دیگر:{" "}
            {elsewhere.map((e, i) => (
              <span key={e.warehouseId}>
                {i > 0 && "، "}
                {e.name} <b className="tabular-nums">{faNum(e.qty)}</b>
              </span>
            ))}
          </p>
        )}
        {!customer && (
          <Link href={`/admin/accounting/inventory/${item.id}`} className="mt-3 text-xs font-bold text-white/70 underline">
            کاردکس کالا
          </Link>
        )}
      </div>
    </div>
  );
}

function ModelHead({ pick }: { pick: ModelPick }) {
  const prices = pick.items.map((i) => BigInt(i.price)).filter((p) => p > 0n);
  const lo = prices.length ? prices.reduce((a, b) => (a < b ? a : b)) : 0n;
  const hi = prices.length ? prices.reduce((a, b) => (a > b ? a : b)) : 0n;
  return (
    <div className="text-center">
      <p className="text-2xl font-black">{pick.title}</p>
      {pick.fixed.length > 0 && <p className="mt-1 text-sm text-white/70">{pick.fixed.map((f) => `${f.axis}: ${f.value}`).join(" · ")}</p>}
      {lo > 0n && (
        <p className="mt-3 text-4xl font-black tabular-nums">
          {lo === hi ? formatAmount(lo) : `${formatAmount(lo)} تا ${formatAmount(hi)}`} <span className="text-lg text-white/70">تومان</span>
        </p>
      )}
      <p className="mt-2 text-sm text-white/70">رنگ و سایز را انتخاب کنید</p>
    </div>
  );
}

/** رنگ × سایزهای همان مدل در همین انبار — هر خانه ← همان کالا */
function Grid({ pick, customer, selectedId, onSelect }: { pick: ModelPick; customer: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  const [a0, a1] = pick.axes;
  const used = (axisId: string) => {
    const ids = new Set(pick.items.map((i) => i.attrs[axisId]).filter(Boolean));
    return pick.axes.find((a) => a.id === axisId)!.values.filter((v) => ids.has(v.id));
  };
  const samePrice = new Set(pick.items.map((i) => i.price)).size === 1;
  const cellText = (it: ModelPick["items"][number]) => (customer ? (it.stock > 0 ? "موجود" : "تمام") : faNum(it.stock));
  const cls = (it: ModelPick["items"][number]) =>
    `flex h-16 w-full flex-col items-center justify-center rounded-xl border-2 transition active:scale-95 ${
      it.id === selectedId ? "border-white bg-white text-emerald-700" : it.stock > 0 ? "border-white/30 bg-white/15 hover:bg-white/25" : "border-transparent bg-black/15 text-white/40"
    }`;

  if (pick.axes.length === 2) {
    const rows = used(a0.id);
    const cols = used(a1.id);
    return (
      <div className="overflow-x-auto rounded-[2rem] bg-white/10 p-4">
        <table className="w-full border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="text-xs font-bold text-white/60">
                {a0.name} \ {a1.name}
              </th>
              {cols.map((c) => (
                <th key={c.id} className="min-w-[64px] text-sm font-black">
                  {c.value}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th className="whitespace-nowrap pl-2 text-right text-sm font-black">{r.value}</th>
                {cols.map((c) => {
                  const it = pick.items.find((i) => i.attrs[a0.id] === r.id && i.attrs[a1.id] === c.id);
                  if (!it) return <td key={c.id} className="h-16 rounded-xl bg-black/10" />;
                  return (
                    <td key={c.id} className="p-0">
                      <button onClick={() => onSelect(it.id)} className={cls(it)}>
                        <span className="text-sm font-black tabular-nums">{cellText(it)}</span>
                        {!samePrice && it.price !== "0" && <span className="text-[10px] font-bold opacity-70">{formatAmount(it.price)}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const label = (i: ModelPick["items"][number]) => pick.axes.map((a) => a.values.find((v) => v.id === i.attrs[a.id])?.value).filter(Boolean).join(" · ") || i.title;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-[2rem] bg-white/10 p-4 sm:grid-cols-4">
      {pick.items.map((it) => (
        <button key={it.id} onClick={() => onSelect(it.id)} className={cls(it)}>
          <span className="text-sm font-black">{label(it)}</span>
          <span className="text-[11px] font-bold opacity-70">{cellText(it)}</span>
        </button>
      ))}
    </div>
  );
}

function SettingsSheet({
  setup,
  customerPref,
  onCustomer,
  onWarehouse,
  onClose,
}: {
  setup: Setup;
  customerPref: boolean;
  onCustomer: (v: boolean) => void;
  onWarehouse: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 text-gray-900 shadow-2xl dark:bg-[#111620] dark:text-gray-100">
        <div className="flex items-center justify-between">
          <p className="text-base font-black">تنظیمات کیوسک</p>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5" aria-label="بستن">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <label className="block text-xs font-bold text-gray-500">
          انبار این کیوسک
          <select
            value={setup.warehouse.id}
            onChange={(e) => onWarehouse(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
          >
            {setup.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] font-normal text-gray-400">موجودی و رنگ/سایزها از همین انبار. روی همین دستگاه می‌ماند.</span>
        </label>
        {setup.staff && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={customerPref} onChange={(e) => onCustomer(e.target.checked)} />
            <span>
              نمای مشتری
              <span className="block text-[11px] text-gray-400">فقط قیمت و «موجود/تمام»؛ بعد از ۳۰ ثانیه به صفحه‌ی اول برمی‌گردد. کاربر فقط-کیوسک همیشه همین را می‌بیند.</span>
            </span>
          </label>
        )}
        <button
          onClick={() => {
            document.documentElement.requestFullscreen?.().catch(() => {});
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
        >
          <Expand className="h-4 w-4" aria-hidden /> تمام‌صفحه
        </button>
        {setup.staff && (
          <Link href="/admin/accounting/pos" className="block text-center text-xs font-bold text-gray-500 underline">
            خروج به صندوق فروشگاه
          </Link>
        )}
      </div>
    </div>
  );
}
