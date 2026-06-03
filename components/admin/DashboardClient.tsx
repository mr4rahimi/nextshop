"use client";

import Link from "next/link";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number;
  totalProducts: number;
  totalCategories: number;
  totalBrands: number;
  totalOrders: number;
  totalRevenue: number;
}
interface OrderStat {
  status: string;
  _count: { id: number };
  _sum: { grandTotal: string | null };
}
interface RecentOrder {
  id: string; orderNumber: string; status: string;
  grandTotal: string; createdAt: string;
  user: { firstName: string | null; lastName: string | null; phone: string };
}
interface TopProduct {
  id: string; title: string; price: string;
  salePrice: string | null; mainImage: string | null; slug: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fa(n: number) { return n.toLocaleString("fa-IR"); }
function faPrice(n: number) {
  if (n >= 1_000_000_000) return `${fa(Math.round(n / 1_000_000_000))} میلیارد`;
  if (n >= 1_000_000) return `${fa(Math.round(n / 1_000_000))} میلیون`;
  return `${fa(n)} تومان`;
}
function faDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT: { label: "انتظار پرداخت", color: "text-amber-500 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" },
  PAID:            { label: "پرداخت شده",    color: "text-blue-500 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" },
  PROCESSING:      { label: "در حال پردازش", color: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20" },
  SHIPPED:         { label: "ارسال شده",      color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20" },
  DELIVERED:       { label: "تحویل داده شده",color: "text-emerald-500 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" },
  CANCELLED:       { label: "لغو شده",        color: "text-red-500 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20" },
  REFUNDED:        { label: "مسترد شده",      color: "text-gray-500 dark:text-gray-400",     bg: "bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20" },
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent, href }: {
  label: string; value: string; sub?: string; icon: string; accent: string; href?: string;
}) {
  const content = (
    <div className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-[#0f1117] p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-none ${accent}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${accent}`}>
          {icon}
        </div>
        {href && (
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white mb-1">{value}</p>
      <p className="text-xs font-bold text-gray-500">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : <div>{content}</div>;
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-center text-gray-400 text-sm py-8">هنوز سفارشی ثبت نشده</div>;
  let offset = 0;
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  const segments = data.filter(d => d.value > 0).map(d => {
    const pct = d.value / total;
    const seg = { ...d, pct, offset, dash: pct * circ, gap: (1 - pct) * circ };
    offset += pct;
    return seg;
  });
  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="20" className="text-gray-100 dark:text-white/5" />
          {segments.map((seg, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="20"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-(seg.offset * circ - circ / 4)}
              className="transition-all duration-500" />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="900" fill="currentColor" className="fill-gray-900 dark:fill-white">{fa(total)}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" className="fill-gray-400">سفارش</text>
        </svg>
      </div>
      <div className="space-y-2 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{seg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-900 dark:text-white">{fa(seg.value)}</span>
              <span className="text-[10px] text-gray-400">{Math.round(seg.pct * 100)}٪</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LineChart — نمودار روزانه سفارشات (SVG برداری) ───────────────────────────
function DailyOrdersChart() {
  // داده نمونه ۳۰ روز — بعداً از API می‌گیریم
  const raw = [3,7,5,12,8,15,10,6,18,14,9,22,17,11,25,19,8,16,21,13,7,24,18,12,20,15,9,27,22,16];
  const days = raw.map((v, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return { v, day: d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" }) };
  });

  const W = 600, H = 140, PAD = { t: 20, r: 10, b: 30, l: 10 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const max = Math.max(...raw);
  const min = 0;

  const pts = days.map((d, i) => ({
    x: PAD.l + (i / (days.length - 1)) * innerW,
    y: PAD.t + (1 - (d.v - min) / (max - min)) * innerH,
    ...d,
  }));

  // path اصلی
  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `C${pts[i-1].x + (pts[i].x - pts[i-1].x)/2},${pts[i-1].y} ${pts[i-1].x + (pts[i].x - pts[i-1].x)/2},${p.y} ${p.x},${p.y}`)).join(" ");
  // fill برای gradient
  const fillPath = `${linePath} L${pts[pts.length-1].x},${PAD.t + innerH} L${pts[0].x},${PAD.t + innerH} Z`;

  const [hovered, setHovered] = useState<number | null>(null);
  const hovPt = hovered !== null ? pts[hovered] : null;

  // نقاط label (هر ۶ روز)
  const labelPts = pts.filter((_, i) => i % 6 === 0 || i === pts.length - 1);

  return (
    <div className="relative w-full overflow-hidden" style={{ direction: "ltr" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          {/* خطوط راهنما */}
          {[0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={i} x1={PAD.l} x2={W - PAD.r}
              y1={PAD.t + t * innerH} y2={PAD.t + t * innerH}
              stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
              className="text-gray-900 dark:text-white" />
          ))}
        </defs>

        {/* خطوط راهنما */}
        {[0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + t * innerH} y2={PAD.t + t * innerH}
            stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
            className="text-gray-900 dark:text-white" />
        ))}

        {/* fill */}
        <path d={fillPath} fill="url(#lineGrad)" />

        {/* line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* hover area */}
        {pts.map((p, i) => (
          <rect key={i} x={p.x - innerW / (days.length * 2)} y={PAD.t}
            width={innerW / days.length} height={innerH}
            fill="transparent" className="cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)} />
        ))}

        {/* hover indicator */}
        {hovPt && (
          <>
            <line x1={hovPt.x} x2={hovPt.x} y1={PAD.t} y2={PAD.t + innerH}
              stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.6" />
            <circle cx={hovPt.x} cy={hovPt.y} r="5" fill="#3b82f6" />
            <circle cx={hovPt.x} cy={hovPt.y} r="9" fill="#3b82f6" fillOpacity="0.2" />
            {/* tooltip */}
            <g transform={`translate(${Math.min(Math.max(hovPt.x - 35, 0), W - 80)}, ${hovPt.y - 36})`}>
              <rect rx="6" ry="6" width="70" height="26" fill="#1e40af" />
              <text x="35" y="11" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{hovPt.day}</text>
              <text x="35" y="22" textAnchor="middle" fill="white" fontSize="11" fontWeight="900">{fa(hovPt.v)} سفارش</text>
            </g>
          </>
        )}

        {/* نقاط */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 5 : 3}
            fill={hovered === i ? "#3b82f6" : "#60a5fa"}
            className="transition-all duration-150" />
        ))}

        {/* label‌های محور x */}
        {labelPts.map((p, i) => (
          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="8" className="fill-gray-400">{p.day}</text>
        ))}
      </svg>
    </div>
  );
}

// ── BarChart (استاتیک هفتگی) ─────────────────────────────────────────────────
function BarChart() {
  const days = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const values = [42, 78, 55, 91, 63, 87, 49];
  const max = Math.max(...values);
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1.5 h-24">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t-lg bg-blue-500/20 dark:bg-blue-500/30 hover:bg-blue-500/50 transition-all cursor-pointer relative group"
              style={{ height: `${(v / max) * 100}%` }}>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10">
                {fa(v * 12)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-gray-400">{d}</div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardClient({ stats, orderStats, recentOrders, topProducts }: {
  stats: Stats; orderStats: OrderStat[];
  recentOrders: RecentOrder[]; topProducts: TopProduct[];
}) {
  const [activeTab, setActiveTab] = useState<"orders" | "products">("orders");

  const donutData = [
    { label: "انتظار پرداخت", value: orderStats.find(s => s.status === "PENDING_PAYMENT")?._count.id ?? 0, color: "#f59e0b" },
    { label: "پرداخت شده",    value: orderStats.find(s => s.status === "PAID")?._count.id ?? 0,            color: "#3b82f6" },
    { label: "در پردازش",     value: orderStats.find(s => s.status === "PROCESSING")?._count.id ?? 0,      color: "#6366f1" },
    { label: "ارسال شده",     value: orderStats.find(s => s.status === "SHIPPED")?._count.id ?? 0,         color: "#a855f7" },
    { label: "تحویل داده شده",value: orderStats.find(s => s.status === "DELIVERED")?._count.id ?? 0,       color: "#10b981" },
    { label: "لغو شده",       value: orderStats.find(s => s.status === "CANCELLED")?._count.id ?? 0,       color: "#ef4444" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {/* عنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">داشبورد</h1>
          <p className="text-xs text-gray-500 mt-0.5">خلاصه وضعیت فروشگاه</p>
        </div>
        <div className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/[0.06] px-3 py-1.5 rounded-xl">
          {new Date().toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* کارت‌های آمار اصلی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="کاربران" value={fa(stats.totalUsers)} icon="👤"
          accent="border-blue-200 dark:border-blue-500/20" sub="کاربر ثبت‌نام‌شده" href="/admin/users" />
        <StatCard label="سفارشات" value={fa(stats.totalOrders)} icon="📦"
          accent="border-purple-200 dark:border-purple-500/20" sub="کل سفارشات" href="/admin/orders" />
        <StatCard label="محصولات فعال" value={fa(stats.totalProducts)} icon="🛍️"
          accent="border-emerald-200 dark:border-emerald-500/20" sub={`${fa(stats.totalCategories)} دسته‌بندی`} href="/admin/products" />
        <StatCard label="درآمد کل" value={faPrice(stats.totalRevenue)} icon="💰"
          accent="border-amber-200 dark:border-amber-500/20" sub="از سفارشات تأیید شده" />
      </div>

      {/* نمودار روزانه سفارشات */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">سفارشات ۳۰ روز گذشته</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">نمودار روزانه — داده نمونه</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-2 py-1 rounded-lg font-bold">استاتیک</span>
            <Link href="/admin/orders" className="text-[10px] text-blue-500 dark:text-blue-400 hover:underline font-bold">جزئیات ←</Link>
          </div>
        </div>
        <DailyOrdersChart />
      </div>

      {/* ردیف میانی */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* دونات */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">وضعیت سفارشات</h2>
            <Link href="/admin/orders" className="text-[10px] text-blue-500 dark:text-blue-400 hover:underline font-bold">همه ←</Link>
          </div>
          <DonutChart data={donutData} />
        </div>

        {/* بار چارت هفتگی */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white">بازدید هفتگی</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">نیاز به Analytics برای داده واقعی</p>
            </div>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-2 py-1 rounded-lg font-bold">استاتیک</span>
          </div>
          <BarChart />
        </div>
      </div>

      {/* ردیف پایین */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* لیست */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
              {(["orders", "products"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeTab === tab ? "bg-blue-600 text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>
                  {tab === "orders" ? "سفارشات اخیر" : "محصولات اخیر"}
                </button>
              ))}
            </div>
            <Link href={activeTab === "orders" ? "/admin/orders" : "/admin/products"}
              className="text-[10px] text-blue-500 dark:text-blue-400 hover:underline font-bold">همه ←</Link>
          </div>

          {activeTab === "orders" ? (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {recentOrders.length === 0
                ? <div className="p-8 text-center text-gray-400 text-sm">هنوز سفارشی ثبت نشده</div>
                : recentOrders.map(order => {
                  const s = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING_PAYMENT;
                  const name = [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.phone;
                  return (
                    <Link key={order.id} href={`/admin/orders/${order.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all">
                      <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs font-black text-gray-500 flex-shrink-0">
                        {name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-900 dark:text-white truncate">{name}</p>
                        <p className="text-[10px] text-gray-400">{order.orderNumber}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-gray-900 dark:text-white">{fa(Number(order.grandTotal))} ت</p>
                        <p className="text-[10px] text-gray-400">{faDate(order.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg border flex-shrink-0 ${s.bg} ${s.color}`}>
                        {s.label}
                      </span>
                    </Link>
                  );
                })}
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {topProducts.length === 0
                ? <div className="p-8 text-center text-gray-400 text-sm">هنوز محصولی ثبت نشده</div>
                : topProducts.map(p => (
                  <Link key={p.id} href={`/admin/products/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
                      {p.mainImage
                        ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">📦</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-900 dark:text-white truncate">{p.title}</p>
                      <p className="text-[10px] text-gray-400">{p.slug}</p>
                    </div>
                    <div className="text-left flex-shrink-0">
                      {p.salePrice ? (
                        <>
                          <p className="text-xs font-black text-emerald-500 dark:text-emerald-400">{fa(Number(p.salePrice))} ت</p>
                          <p className="text-[10px] text-gray-400 line-through">{fa(Number(p.price))}</p>
                        </>
                      ) : (
                        <p className="text-xs font-black text-gray-900 dark:text-white">{fa(Number(p.price))} ت</p>
                      )}
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* دسترسی سریع */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">دسترسی سریع</h2>
          <div className="space-y-2">
            {[
              { href: "/admin/products/create", label: "محصول جدید",       icon: "➕", color: "hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/5" },
              { href: "/admin/orders",          label: "بررسی سفارشات",    icon: "📋", color: "hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/5" },
              { href: "/admin/blog/create",     label: "مطلب جدید",         icon: "✍️", color: "hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/5" },
              { href: "/admin/widgets",         label: "ویرایش صفحه اصلی", icon: "🧩", color: "hover:border-amber-300 dark:hover:border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-500/5" },
              { href: "/admin/site-settings",   label: "تنظیمات سایت",     icon: "⚙️", color: "hover:border-gray-300 dark:hover:border-gray-500/30 hover:bg-gray-50 dark:hover:bg-gray-500/5" },
              { href: "/admin/users",           label: "مدیریت کاربران",    icon: "👥", color: "hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/5" },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.06] text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all ${item.color}`}>
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* کارت‌های ثانویه */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "دسته‌بندی‌ها", value: fa(stats.totalCategories), icon: "📂", href: "/admin/categories" },
          { label: "برندها",       value: fa(stats.totalBrands),      icon: "🏷️", href: "/admin/brands" },
          { label: "مطالب بلاگ",  value: "—", icon: "📝", href: "/admin/blog", sub: "به‌زودی" },
          { label: "بازدید امروز",value: "—", icon: "👁️", sub: "نیاز به Analytics" },
        ].map((item, i) => (
          <StatCard key={i} {...item} accent="border-gray-200 dark:border-white/[0.06]" />
        ))}
      </div>

    </div>
  );
}
