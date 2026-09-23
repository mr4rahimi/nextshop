"use client";

/**
 * سود معاملات — چهار تب، مثل «تماس‌های ثبت‌نشده»ی فاز ۴.
 *
 * «ثبت‌نشده» پررنگ‌ترین است: یعنی «یک عدد از تو مانده». فرم هزینه یک عدد
 * می‌گیرد و راه ردیف‌به‌ردیف پشت یک لینک است (بخش ۲۲.۶).
 */

import { useCallback, useEffect, useState } from "react";
import { formatJalaliShort } from "@/lib/club/jalali";
import { CONDITION_LABELS } from "@/lib/worklist/commission-rules";
import SupplierPicker, { type SupplierOption } from "./SupplierPicker";

interface DealItem {
  id: string;
  title: string;
  qty: number;
  condition: string;
  revenue: string;
  cost: string | null;
  profit: string | null;
  percent: number | null;
  commission: string | null;
  ruleLabel: string | null;
}

interface Deal {
  id: string;
  orderId: string | null;
  customerName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  title: string;
  revenue: string;
  cost: string | null;
  profit: string | null;
  commission: string | null;
  costPerItem: boolean;
  isManual: boolean;
  noCommission: boolean;
  isReferral: boolean;
  supplierId: string | null;
  supplierName: string | null;
  note: string | null;
  status: "PENDING" | "CONFIRMED" | "VOID";
  occurredAt: string;
  confirmedByName: string | null;
  payoutId: string | null;
  order: { orderNumber: string; status: string } | null;
  items: DealItem[];
}

type Tab = "pending" | "open" | "paid" | "unowned" | "void";

const TAB_LABELS: Record<Tab, string> = {
  pending: "قیمت خرید ثبت‌نشده",
  open: "تسویه‌نشده",
  paid: "تسویه‌شده",
  unowned: "بی‌صاحب",
  void: "لغو و مرجوعی",
};

function money(v: string | null | undefined) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("fa-IR");
}

const inputCls =
  "w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400";

export default function DealsClient() {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<Deal[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, open: 0, unowned: 0 });
  const [can, setCan] = useState({ viewAll: false, log: false, manage: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Deal | null>(null);
  const [manual, setManual] = useState(false);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [reload, setReload] = useState(0);

  const fetchPage = useCallback(
    async (after: string | null) => {
      const p = new URLSearchParams({ tab });
      if (q.trim()) p.set("q", q.trim());
      if (after) p.set("cursor", after);
      const res = await fetch(`/api/admin/worklist/deals?${p}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
      return d;
    },
    [tab, q],
  );

  useEffect(() => {
    let ignore = false;
    const t = setTimeout(() => {
      fetchPage(null)
        .then((d) => {
          if (ignore) return;
          setItems(d.items);
          setCursor(d.nextCursor);
          setCounts(d.counts);
          setCan(d.can);
          setError(null);
        })
        .catch((e) => !ignore && setError(e.message))
        .finally(() => !ignore && setLoading(false));
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [fetchPage, reload]);

  // فهرست کارکنان فقط برای تخصیص معامله‌ی بی‌صاحب
  useEffect(() => {
    if (!can.manage) return;
    fetch("/api/admin/worklist/commission/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStaff(d.staff))
      .catch(() => {});
  }, [can.manage]);

  const tabs: Tab[] = can.viewAll ? ["pending", "open", "paid", "unowned", "void"] : ["pending", "open", "paid", "void"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const n = t === "pending" ? counts.pending : t === "open" ? counts.open : t === "unowned" ? counts.unowned : 0;
          return (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setLoading(true);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                tab === t
                  ? t === "pending"
                    ? "bg-amber-500 text-white"
                    : "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
              }`}
            >
              {TAB_LABELS[t]}
              {n > 0 && <span className="mr-1.5 px-1.5 rounded-full bg-white/30">{n.toLocaleString("fa-IR")}</span>}
            </button>
          );
        })}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو: سفارش، مشتری، تأمین‌کننده"
          className={`${inputCls} max-w-xs mr-auto`}
        />
        {can.log && (
          <button
            onClick={() => setManual(true)}
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            + معامله‌ی بدون سفارش
          </button>
        )}
      </div>

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-xs text-gray-500">در حال بارگذاری...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-xs text-gray-500">
            {tab === "pending" ? "همه‌ی قیمت‌های خرید ثبت شده‌اند" : "معامله‌ای نیست"}
          </p>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
              <tr>
                <th className="px-4 py-2.5">معامله</th>
                {can.viewAll && <th className="px-3 py-2.5">صاحب</th>}
                <th className="px-3 py-2.5 text-center">فروش (تومان)</th>
                <th className="px-3 py-2.5 text-center">قیمت خرید</th>
                <th className="px-3 py-2.5 text-center">سود</th>
                <th className="px-3 py-2.5 text-center">پورسانت</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {d.title}
                      {d.isManual && (
                        <span className="mr-1.5 text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">دستی</span>
                      )}
                      {d.isReferral && (
                        <span className="mr-1.5 text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">ریفری</span>
                      )}
                      {/* بدون این نشان، کارمند عدد صفرِ پورسانت را اشتباه حساب می‌داند */}
                      {d.noCommission && (
                        <span className="mr-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                          بدون پورسانت
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {d.customerName ?? "—"} · {formatJalaliShort(new Date(d.occurredAt))}
                      {d.supplierName && ` · ${d.supplierName}`}
                    </p>
                  </td>
                  {can.viewAll && (
                    <td className={`px-3 py-2.5 ${d.ownerName ? "text-gray-700 dark:text-gray-300" : "text-amber-600 font-bold"}`}>
                      {d.ownerName ?? "بی‌صاحب"}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center tabular-nums">{money(d.revenue)}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{money(d.cost)}</td>
                  <td
                    className={`px-3 py-2.5 text-center tabular-nums font-bold ${
                      d.profit && Number(d.profit) < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {money(d.profit)}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{money(d.commission)}</td>
                  <td className="px-4 py-2.5 text-left">
                    <button
                      onClick={() => setOpen(d)}
                      className={`px-3 py-1 rounded-lg font-bold ${
                        d.status === "PENDING" && !d.payoutId
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white"
                      }`}
                    >
                      {d.status === "PENDING" ? "ثبت قیمت خرید" : "جزئیات"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cursor && (
        <button
          onClick={async () => {
            const d = await fetchPage(cursor);
            setItems((prev) => [...prev, ...d.items]);
            setCursor(d.nextCursor);
          }}
          className="w-full py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300"
        >
          بیشتر
        </button>
      )}

      {open && (
        <DealDialog
          deal={open}
          canManage={can.manage}
          staff={staff}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            setReload((k) => k + 1);
          }}
        />
      )}
      {manual && (
        <ManualDealDialog
          onClose={() => setManual(false)}
          onSaved={() => {
            setManual(false);
            setReload((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="بستن">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DealDialog({
  deal,
  canManage,
  staff,
  onClose,
  onSaved,
}: {
  deal: Deal;
  canManage: boolean;
  staff: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const locked = !!deal.payoutId || deal.status === "VOID";
  const [perItem, setPerItem] = useState(deal.costPerItem);
  const [cost, setCost] = useState(deal.cost ?? "");
  const [itemCosts, setItemCosts] = useState<Record<string, string>>(
    Object.fromEntries(deal.items.map((i) => [i.id, i.cost ?? ""])),
  );
  const [supplier, setSupplier] = useState<SupplierOption | null>(
    deal.supplierId ? { id: deal.supplierId, name: deal.supplierName ?? "" } : null,
  );
  const [note, setNote] = useState(deal.note ?? "");
  const [ownerId, setOwnerId] = useState(deal.ownerId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/worklist/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={deal.title} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="فروش (تومان)" value={money(deal.revenue)} />
        <Stat label="سود" value={money(deal.profit)} />
        <Stat label="پورسانت" value={money(deal.commission)} />
      </div>

      {locked && (
        <p className="text-[11px] font-bold rounded-xl px-3 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
          {deal.status === "VOID"
            ? "سفارش این معامله لغو یا مرجوع شده است."
            : "این معامله تسویه شده و دیگر قابل ویرایش نیست."}
        </p>
      )}

      <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
            <tr>
              <th className="px-3 py-2">کالا</th>
              <th className="px-2 py-2 text-center">فروش</th>
              <th className="px-2 py-2 text-center">قیمت خرید</th>
              <th className="px-2 py-2 text-center">درصد</th>
              <th className="px-2 py-2 text-center">پورسانت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {deal.items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2">
                  <p className="font-bold text-gray-800 dark:text-gray-200">
                    {i.title} {i.qty > 1 && `×${i.qty.toLocaleString("fa-IR")}`}
                  </p>
                  <p className="text-gray-400">
                    {CONDITION_LABELS[i.condition]}
                    {i.ruleLabel && ` · ${i.ruleLabel}`}
                  </p>
                </td>
                <td className="px-2 py-2 text-center tabular-nums">{money(i.revenue)}</td>
                <td className="px-2 py-2 text-center">
                  {perItem && !locked ? (
                    <input
                      inputMode="numeric"
                      dir="ltr"
                      value={itemCosts[i.id] ?? ""}
                      onChange={(e) => setItemCosts({ ...itemCosts, [i.id]: e.target.value.replace(/\D/g, "") })}
                      className="w-28 px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                    />
                  ) : (
                    <span className="tabular-nums">{money(i.cost)}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{i.percent !== null ? `${i.percent.toLocaleString("fa-IR")}٪` : "—"}</td>
                <td className="px-2 py-2 text-center tabular-nums">{money(i.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!locked && (
        <div className="space-y-3">
          {!perItem && (
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">
              کل قیمت خرید از تأمین‌کننده (تومان)
              <input
                autoFocus
                inputMode="numeric"
                dir="ltr"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} mt-1 text-lg font-black`}
              />
            </label>
          )}
          {deal.items.length > 1 && (
            <button onClick={() => setPerItem(!perItem)} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
              {perItem ? "یک عدد برای کل سفارش وارد می‌کنم" : "قیمت خرید هر کالا را جدا وارد می‌کنم"}
            </button>
          )}
          <div>
            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">تأمین‌کننده</p>
            <SupplierPicker value={supplier} onChange={setSupplier} />
          </div>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="یادداشت (اختیاری)"
            className={`${inputCls} resize-none`}
          />
          <button
            disabled={saving}
            onClick={() =>
              send({
                ...(perItem ? { itemCosts } : { cost }),
                supplierId: supplier?.id ?? null,
                note,
              })
            }
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold disabled:opacity-40"
          >
            {saving ? "در حال ثبت..." : deal.status === "PENDING" ? "ثبت قیمت خرید" : "ذخیره‌ی تغییرات"}
          </button>
        </div>
      )}

      {canManage && !deal.payoutId && (
        <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">صاحب معامله:</span>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={`${inputCls} max-w-[200px]`}>
            <option value="">بی‌صاحب</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button
            disabled={saving || ownerId === (deal.ownerId ?? "")}
            onClick={() => send({ ownerId: ownerId || null })}
            className="px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold disabled:opacity-40"
          >
            ذخیره‌ی صاحب
          </button>
        </div>
      )}

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
}

function ManualDealDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, revenue, cost, supplierId: supplier?.id, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ثبت نشد");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="معامله‌ی بدون سفارش" onClose={onClose}>
      <p className="text-[11px] text-gray-500">
        فقط برای فروشی که بیرون از سایت و بدون سفارش انجام شده. این معامله با نشان «دستی» دیده می‌شود.
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان، مثلاً «چاپ کاتالوگ شرکت الف»" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <input inputMode="numeric" dir="ltr" value={revenue} onChange={(e) => setRevenue(e.target.value.replace(/\D/g, ""))} placeholder="مبلغ فروش (تومان)" className={inputCls} />
        <input inputMode="numeric" dir="ltr" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} placeholder="قیمت خرید (تومان)" className={inputCls} />
      </div>
      <SupplierPicker value={supplier} onChange={setSupplier} />
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت" className={`${inputCls} resize-none`} />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <button
        disabled={saving || !title.trim() || !revenue}
        onClick={submit}
        className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold disabled:opacity-40"
      >
        {saving ? "در حال ثبت..." : "ثبت معامله"}
      </button>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}
