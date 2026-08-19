"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface MappingLink { platformCode: string; externalId: string; externalTitle: string | null }

interface OrderRow {
  id: string;
  mappingId: string | null;
  platformCode: string;
  platformOrderId: string;
  platformOrderNo: string | null;
  productTitle: string;
  qty: number;
  unitPrice: number | null;
  customerName: string | null;
  customerPhone: string | null;
  status: "PENDING" | "NEEDS_MAPPING" | "INVOICED" | "CANCELLED";
  blockedReason: string | null;
  invoicedAt: string | null;
  createdAt: string;
  mapping: { id: string; links: MappingLink[] } | null;
}

const STATUS_CFG: Record<OrderRow["status"], { label: string; cls: string }> = {
  PENDING:       { label: "در صف فاکتور", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
  NEEDS_MAPPING: { label: "نیازمند نگاشت", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" },
  INVOICED:      { label: "فاکتور شده",    cls: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" },
  CANCELLED:     { label: "لغو شده",       cls: "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400" },
};

const STATUS_ORDER: OrderRow["status"][] = ["NEEDS_MAPPING", "PENDING", "INVOICED", "CANCELLED"];

function toman(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("fa-IR") + " تومان";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function OrdersClient({ platforms }: { platforms: { code: string; name: string }[] }) {
  const [rows,     setRows]     = useState<OrderRow[]>([]);
  const [counts,   setCounts]   = useState<Record<string, number>>({});
  const [status,   setStatus]   = useState<string>("NEEDS_MAPPING");
  const [platform, setPlatform] = useState<string>("");
  const [q,        setQ]        = useState("");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status)   sp.set("status", status);
      if (platform) sp.set("platform", platform);
      if (q.trim()) sp.set("q", q.trim());
      const res  = await fetch(`/api/integration/orders?${sp}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setCounts(data.counts ?? {});
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [status, platform, q]);

  useEffect(() => { void load(); }, [load]);

  async function act(action: "retry" | "cancel" | "invoice") {
    if (!selected.size) return;
    if (action === "cancel" && !confirm(`${selected.size} ردیف لغو شود؟ دیگر فاکتور نمی‌خورند.`)) return;
    if (action === "invoice" && !confirm(`برای ${selected.size} ردیف انتخاب‌شده همین حالا فاکتور فروش در حسابداری ثبت شود؟`)) return;
    setBusy(true); setMsg(null);
    try {
      const res  = await fetch("/api/integration/orders", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: [...selected], action }),
      });
      const data = await res.json();
      setMsg(data.message ?? data.error ?? "انجام شد");
      await load();
    } catch {
      setMsg("خطای شبکه");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">سفارش‌های بازارگاه</h1>
          <p className="text-xs text-gray-500 mt-1">
            هر ردیف یک قلم از یک سفارش است. ردیف‌های «نیازمند نگاشت» فاکتور نخورده‌اند چون
            محصولشان به کالای حسابداری وصل نیست. شیوه‌ی ثبت فاکتور (خودکار یا دستی) را از
            تنظیمات اتصال حسابان انتخاب کنید.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
        >
          تازه‌سازی
        </button>
      </div>

      {/* شمارنده‌ها */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? "" : s)}
            className={`p-4 rounded-2xl border text-right transition-colors ${
              status === s
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0f1117] hover:border-gray-300"
            }`}
          >
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {(counts[s] ?? 0).toLocaleString("fa-IR")}
            </div>
            <div className="text-xs font-bold text-gray-500 mt-1">{STATUS_CFG[s].label}</div>
          </button>
        ))}
      </div>

      {/* فیلترها */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-sm text-gray-900 dark:text-white"
        >
          <option value="">همه پلتفرم‌ها</option>
          <option value="shop">سایت</option>
          {platforms.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="جستجو: نام محصول، مشتری، شماره سفارش…"
          className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />

        {selected.size > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => void act("invoice")}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50"
            >
              ثبت فاکتور ({selected.size.toLocaleString("fa-IR")})
            </button>
            <button
              onClick={() => void act("retry")}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              بازگرداندن به صف
            </button>
            <button
              onClick={() => void act("cancel")}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-50"
            >
              لغو
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 text-sm">
          {msg}
        </div>
      )}

      {/* جدول */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">در حال بارگذاری…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">سفارشی با این فیلتر پیدا نشد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.02] text-xs text-gray-500">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))}
                    />
                  </th>
                  <th className="p-3 text-right font-bold">پلتفرم</th>
                  <th className="p-3 text-right font-bold">شماره سفارش</th>
                  <th className="p-3 text-right font-bold">محصول</th>
                  <th className="p-3 text-right font-bold">تعداد</th>
                  <th className="p-3 text-right font-bold">قیمت واحد</th>
                  <th className="p-3 text-right font-bold">مشتری</th>
                  <th className="p-3 text-right font-bold">وضعیت</th>
                  <th className="p-3 text-right font-bold">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const cfg = STATUS_CFG[r.status];
                  const hesabanLink = r.mapping?.links.find(l => l.platformCode === "hesaban");
                  return (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-white/[0.04] align-top">
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        {platforms.find(p => p.code === r.platformCode)?.name ?? r.platformCode}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-xs text-gray-600 dark:text-gray-300" dir="ltr">
                        {r.platformOrderNo ?? r.platformOrderId.split(":")[0]}
                      </td>
                      <td className="p-3 max-w-[280px]">
                        <div className="text-gray-900 dark:text-white">{r.productTitle}</div>
                        {r.status === "NEEDS_MAPPING" && r.blockedReason && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            {r.blockedReason}
                            {" — "}
                            <Link href="/admin/integration/mapping" className="underline font-bold">
                              نگاشت کنید
                            </Link>
                          </div>
                        )}
                        {hesabanLink && (
                          <div className="text-[11px] text-gray-400 mt-1" dir="ltr">
                            حسابان: {hesabanLink.externalId}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-gray-700 dark:text-gray-200">{r.qty.toLocaleString("fa-IR")}</td>
                      <td className="p-3 whitespace-nowrap text-gray-700 dark:text-gray-200">{toman(r.unitPrice)}</td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-gray-900 dark:text-white">{r.customerName ?? "—"}</div>
                        {r.customerPhone && (
                          <div className="text-[11px] text-gray-400 font-mono" dir="ltr">{r.customerPhone}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-xs text-gray-400">{shortDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
