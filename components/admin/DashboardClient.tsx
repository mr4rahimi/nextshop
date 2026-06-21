"use client";

import Link from "next/link";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number; totalProducts: number; totalCategories: number;
  totalBrands: number; totalOrders: number; totalRevenue: number;
  totalBlogPosts: number; totalChatConversations: number;
  todayChatConversations: number; totalStock: number;
}
interface OrderStat { status: string; count: number; total: number; }
interface RecentOrder {
  id: string; orderNumber: string; status: string;
  grandTotal: number; createdAt: string; userName: string;
}
interface TopProduct {
  id: string; title: string; price: number;
  salePrice: number | null; mainImage: string | null; slug: string; stock: number;
}
interface TopBuyer { name: string; orders: number; total: number; }
interface StockProduct { id: string; title: string; stock: number; }
interface RecentChat {
  id: string; userId: string | null; sessionId: string | null;
  lastMessageAt: string; lastMessage: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");
function faShort(v: number) {
  if (v >= 1e9) return fa(v / 1e9) + "م";
  if (v >= 1e6) return (+(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)).toLocaleString("fa-IR") + "م";
  if (v >= 1e3) return fa(v / 1e3) + "ه";
  return fa(v);
}
function faPrice(n: number) {
  if (n >= 1e9) return `${fa(n / 1e9)} میلیارد ت`;
  if (n >= 1e6) return `${fa(n / 1e6)} میلیون ت`;
  return `${fa(n)} ت`;
}
function faDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function faDateAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m.toLocaleString("fa-IR")} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h.toLocaleString("fa-IR")} ساعت پیش`;
  return new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "انتظار پرداخت", color: "#d97706" },
  PAID:            { label: "پرداخت شده",     color: "#2563eb" },
  CONFIRMED:       { label: "تأیید شده",      color: "#4f46e5" },
  PROCESSING:      { label: "در آماده‌سازی",  color: "#7c3aed" },
  PACKAGING:       { label: "بسته‌بندی",      color: "#0891b2" },
  SHIPPED:         { label: "ارسال شده",       color: "#0d9488" },
  DELIVERED:       { label: "تحویل داده شده", color: "#16a34a" },
  COMPLETED:       { label: "تکمیل شده",      color: "#059669" },
  CANCELED:        { label: "لغو شده",         color: "#e11d48" },
  REFUNDED:        { label: "مسترد شده",       color: "#6b7280" },
};

// ── SVG Icon (multi-path) ──────────────────────────────────────────────────────
function Icon({ d, size = 16, color = "currentColor" }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── SegmentControl ─────────────────────────────────────────────────────────────
function SegmentControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex gap-0.5 p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/[0.08] rounded-lg">
      {[{ v: 7, l: "۷ روز" }, { v: 30, l: "۳۰ روز" }, { v: 90, l: "۹۰ روز" }].map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
            value === o.v
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ── SparkLine ──────────────────────────────────────────────────────────────────
function SparkLine({ data, id }: { data: number[]; id: string }) {
  const n = data.length;
  if (n < 2) return null;
  const W = 150, H = 40, p = 4;
  const mx = Math.max(...data), mn = Math.min(...data), sp = (mx - mn) || 1;
  const xs = (i: number) => p + i * (W - 2 * p) / (n - 1);
  const ys = (v: number) => H - p - ((v - mn) / sp) * (H - 2 * p);
  const d = "M " + data.map((v, i) => `${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" L ");
  const area = `${d} L ${(W - p).toFixed(1)} ${H - p} L ${p} ${H - p} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="40"
      preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-${id})`} />
      <path d={d} fill="none" stroke="#6366f1" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── LineChart ──────────────────────────────────────────────────────────────────
function LineChart({
  id, data, range, fmt, height = 200,
}: {
  id: string; data: number[]; range: number;
  fmt?: (v: number) => string; height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values = data.slice(Math.max(0, data.length - range));
  const n = values.length;
  if (!n) return null;

  const W = 720, H = height;
  const PL = 50, PR = 14, PT = 16, PB = 28;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const max = Math.max(...values, 0), min = Math.min(...values, 0);
  const rng = (max - min) || 1;
  const top = max + rng * 0.18, bot = Math.max(0, min - rng * 0.12);
  const span = (top - bot) || 1;

  const X = (i: number) => PL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const Y = (v: number) => PT + plotH - ((v - bot) / span) * plotH;
  const pts = values.map((v, i) => [X(i), Y(v)] as [number, number]);

  const smooth = (p: [number, number][]) => {
    if (p.length < 2) return `M ${p[0]?.[0] ?? 0} ${p[0]?.[1] ?? 0}`;
    let d = `M ${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i];
      const p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };

  const line = smooth(pts);
  const area = `${line} L ${X(n - 1).toFixed(1)} ${(PT + plotH).toFixed(1)} L ${X(0).toFixed(1)} ${(PT + plotH).toFixed(1)} Z`;
  const gridVals = [0, 1, 2, 3, 4].map(g => ({ val: bot + span * (g / 4), yy: Y(bot + span * (g / 4)) }));
  const step = Math.max(1, Math.round((n - 1) / 5));
  const xLabels: { i: number; label: string }[] = [];
  for (let i = 0; i < n; i += step) {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    xLabels.push({ i, label: d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" }) });
  }
  const fmtFn = fmt ?? ((v: number) => fa(v));
  const bw = n <= 1 ? plotW : plotW / (n - 1);

  return (
    <div style={{ direction: "ltr" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}
        onMouseLeave={() => setHovered(null)}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridVals.map(({ val, yy }, g) => (
          <g key={g}>
            <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#94a3b8" strokeOpacity="0.12"
              strokeWidth="1" strokeDasharray={g === 0 ? "0" : "3 5"} />
            <text x={PL - 6} y={yy + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
              {faShort(val)}
            </text>
          </g>
        ))}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {label}
          </text>
        ))}
        <path d={area} fill={`url(#grad-${id})`} />
        <path d={line} fill="none" stroke="#6366f1" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {values.map((_, i) => (
          <rect key={i} x={X(i) - bw / 2} y={PT} width={bw} height={plotH}
            fill="transparent" style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHovered(i)} />
        ))}
        {hovered !== null && (() => {
          const hx = X(hovered), hy = Y(values[hovered]);
          const tw = 155, th = 48;
          const tx = Math.max(PL, Math.min(W - PR - tw, hx - tw / 2));
          const ty = Math.max(2, hy - th - 14);
          const d = new Date(); d.setDate(d.getDate() - (n - 1 - hovered));
          const label = d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
          return (
            <g>
              <line x1={hx} y1={PT} x2={hx} y2={PT + plotH}
                stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              <circle cx={hx} cy={hy} r="5" fill="#6366f1" stroke="white" strokeWidth="2.5" />
              <rect x={tx} y={ty} width={tw} height={th} rx="9"
                fill="#1e293b" stroke="#334155" strokeWidth="1" />
              <text x={tx + tw / 2} y={ty + 18} textAnchor="middle" fontSize="10.5" fill="#94a3b8">
                {label}
              </text>
              <text x={tx + tw / 2} y={ty + 36} textAnchor="middle" fontSize="13"
                fontWeight="700" fill="white">
                {fmtFn(values[hovered])}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ── StatusBars ─────────────────────────────────────────────────────────────────
function StatusBars({ stats }: { stats: OrderStat[] }) {
  const [filter, setFilter] = useState("all");
  const total = stats.reduce((s, x) => s + x.count, 0);
  const maxCount = Math.max(...stats.map(x => x.count), 1);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[{ k: "all", l: "همه" }, ...stats.map(s => ({ k: s.status, l: STATUS[s.status]?.label ?? s.status }))].map(({ k, l }) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
              filter === k
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:border-indigo-400"
            }`}>
            {l}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {stats.map(s => {
          const cfg = STATUS[s.status] ?? { label: s.status, color: "#6b7280" };
          const pct = total > 0 ? (s.count / total * 100) : 0;
          const active = filter === "all" || filter === s.status;
          return (
            <div key={s.status} style={{ opacity: active ? 1 : 0.28, transition: "opacity .2s" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{cfg.label}</span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {fa(s.count)} <span className="text-gray-400 dark:text-gray-600">({(+pct.toFixed(1)).toLocaleString("fa-IR")}٪)</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, s.count / maxCount * 100).toFixed(1)}%`, background: cfg.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────────
export default function DashboardClient({
  stats, orderStats, recentOrders, topProducts,
  topBuyers, stockHigh, stockLow, recentChats,
  dailySales, dailyOrders, dailyUsers,
}: {
  stats: Stats;
  orderStats: OrderStat[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  topBuyers: TopBuyer[];
  stockHigh: StockProduct[];
  stockLow: StockProduct[];
  recentChats: RecentChat[];
  dailySales: number[];
  dailyOrders: number[];
  dailyUsers: number[];
}) {
  const [salesRange, setSalesRange] = useState(30);
  const [ordersRange, setOrdersRange] = useState(30);
  const [usersRange, setUsersRange] = useState(30);

  const totalOrdersAll = orderStats.reduce((s, x) => s + x.count, 0);
  const avgOrder = totalOrdersAll > 0 ? Math.round(stats.totalRevenue / totalOrdersAll) : 0;
  const salesSum = dailySales.slice(-salesRange).reduce((a, b) => a + b, 0);
  const stockMax = Math.max(...stockHigh.map(x => x.stock), 1);
  const stockLowRef = Math.max(...stockLow.map(x => x.stock), 1);

  const QUICK_LINKS = [
    { href: "/admin/products/create", label: "محصول جدید",       d: "M12 5v14 M5 12h14" },
    { href: "/admin/products",        label: "همه محصولات",      d: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" },
    { href: "/admin/orders",          label: "بررسی سفارشات",    d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 14l2 2 4-4" },
    { href: "/admin/blog/create",     label: "مطلب جدید",         d: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
    { href: "/admin/widgets",         label: "صفحه اصلی",         d: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" },
    { href: "/admin/categories",      label: "دسته‌بندی‌ها",     d: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z" },
    { href: "/admin/brands",          label: "برندها",            d: "M20.6 13.6 13 21a1.6 1.6 0 0 1-2.3 0l-7-7a1.6 1.6 0 0 1-.5-1.1V4.5A1.5 1.5 0 0 1 4.7 3h8.3c.4 0 .8.2 1.1.5l6.5 6.5a1.6 1.6 0 0 1 0 2.3z M7.5 7.5h.01" },
    { href: "/admin/users",           label: "کاربران",           d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    { href: "/admin/site-settings",   label: "تنظیمات",           d: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M3 12h2 M19 12h2 M12 3v2 M12 19v2 M5.5 5.5l1.4 1.4 M17.1 17.1l1.4 1.4 M18.5 5.5l-1.4 1.4 M6.9 17.1l-1.4 1.4" },
  ];

  const PRIMARY_CARDS = [
    {
      label: "کاربران ثبت‌نام‌شده", value: fa(stats.totalUsers),
      d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
      spark: dailyUsers.slice(-14), sparkId: "su", href: "/admin/users",
    },
    {
      label: "محصولات فعال", value: fa(stats.totalProducts),
      d: "M21 16V8l-9-5-9 5v8l9 5 9-5z M3.3 7L12 12l8.7-5 M12 12v9",
      spark: dailyOrders.slice(-14), sparkId: "sp", href: "/admin/products",
    },
    {
      label: "کل سفارشات", value: fa(stats.totalOrders),
      d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
      spark: dailyOrders.slice(-14), sparkId: "so", href: "/admin/orders",
    },
    {
      label: "درآمد کل", value: faPrice(stats.totalRevenue),
      d: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
      spark: dailySales.slice(-14), sparkId: "sr",
    },
  ];

  const SECONDARY_CARDS = [
    { label: "مطالب بلاگ",      value: fa(stats.totalBlogPosts),          d: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",                        href: "/admin/blog" },
    { label: "دسته‌بندی‌ها",    value: fa(stats.totalCategories),         d: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",       href: "/admin/categories" },
    { label: "برندها",           value: fa(stats.totalBrands),             d: "M20.6 13.6 13 21a1.6 1.6 0 0 1-2.3 0l-7-7 M7.5 7.5h.01",      href: "/admin/brands" },
    { label: "کل گفتگوها",      value: fa(stats.totalChatConversations),  d: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 21 11.5z" },
    { label: "موجودی کل کالا",  value: fa(stats.totalStock),              d: "M21 16V8l-9-5-9 5v8l9 5 9-5z M3.3 7L12 12l8.7-5 M12 12v9" },
    { label: "میانگین سبد خرید", value: avgOrder > 0 ? faPrice(avgOrder) : "—", d: "M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-gray-900 dark:text-white">پیشخوان</h1>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 rounded-full">نمای کلی</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            خلاصه‌ی عملکرد فروشگاه — {new Date().toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="flex flex-wrap gap-2">
        {QUICK_LINKS.map(ql => (
          <Link key={ql.href} href={ql.href}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all shadow-sm">
            <Icon d={ql.d} size={14} color="#6366f1" />
            {ql.label}
          </Link>
        ))}
      </div>

      {/* ── Primary cards — 2 per row ── */}
      <div className="grid grid-cols-2 gap-4">
        {PRIMARY_CARDS.map((card, i) => {
          const inner = (
            <Card className="p-5 hover:-translate-y-0.5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <Icon d={card.d} size={20} color="#6366f1" />
                </div>
                <span className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-full">فعال</span>
              </div>
              <div className="mt-4 text-2xl font-black text-gray-900 dark:text-white tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</div>
              <div className="mt-3"><SparkLine data={card.spark} id={card.sparkId} /></div>
            </Card>
          );
          return card.href
            ? <Link key={i} href={card.href}>{inner}</Link>
            : <div key={i}>{inner}</div>;
        })}
      </div>

      {/* ── Secondary cards — 3 per row ── */}
      <div className="grid grid-cols-3 gap-3">
        {SECONDARY_CARDS.map((m, i) => {
          const inner = (
            <Card className="p-4 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2.5">
                <Icon d={m.d} size={14} />
                <span className="text-xs font-semibold">{m.label}</span>
              </div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{m.value}</div>
            </Card>
          );
          return m.href
            ? <Link key={i} href={m.href}>{inner}</Link>
            : <div key={i}>{inner}</div>;
        })}
      </div>

      {/* ── Daily Sales — full width ── */}
      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="text-sm font-black text-gray-900 dark:text-white">نمودار فروش روزانه</div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-black text-gray-900 dark:text-white">{faPrice(salesSum)}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">در بازه انتخابی</span>
            </div>
          </div>
          <SegmentControl value={salesRange} onChange={setSalesRange} />
        </div>
        <LineChart id="sales" data={dailySales} range={salesRange} fmt={faPrice} height={230} />
      </Card>

      {/* ── Order status + Completed orders ── */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-black text-gray-900 dark:text-white">وضعیت سفارشات</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">مجموع {fa(totalOrdersAll)}</span>
          </div>
          <StatusBars stats={orderStats} />
        </Card>
        <Card className="col-span-3 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="text-sm font-black text-gray-900 dark:text-white">سفارشات تکمیل‌شده</div>
            <SegmentControl value={ordersRange} onChange={setOrdersRange} />
          </div>
          <LineChart id="orders" data={dailyOrders} range={ordersRange}
            fmt={v => `${fa(v)} سفارش`} height={200} />
        </Card>
      </div>

      {/* ── Users chart + Stock high/low ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="text-sm font-black text-gray-900 dark:text-white">کاربران ثبت‌نام‌شده</div>
            <SegmentControl value={usersRange} onChange={setUsersRange} />
          </div>
          <LineChart id="users" data={dailyUsers} range={usersRange}
            fmt={v => `${fa(v)} کاربر`} height={200} />
        </Card>
        <Card className="p-5">
          <div className="text-sm font-black text-gray-900 dark:text-white mb-1">موجودی کالاها</div>
          {stockHigh.length > 0 ? (
            <>
              <div className="text-xs font-semibold text-green-500 dark:text-green-400 mb-4">▲ بیشترین موجودی</div>
              <div className="space-y-3">
                {stockHigh.map(h => (
                  <div key={h.id}>
                    <div className="flex justify-between mb-1.5 text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[70%]">{h.title}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-semibold">{fa(h.stock)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(h.stock / stockMax * 100).toFixed(0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {stockLow.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-red-500 dark:text-red-400 mt-5 mb-4">▼ کمترین موجودی</div>
                  <div className="space-y-3">
                    {stockLow.map(l => (
                      <div key={l.id}>
                        <div className="flex justify-between mb-1.5 text-xs">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[70%]">{l.title}</span>
                          <span className="font-bold text-red-500 dark:text-red-400">{fa(l.stock)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full"
                            style={{ width: `${Math.max(8, l.stock / stockLowRef * 100).toFixed(0)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-400 text-center py-8">هنوز موجودی ثبت نشده</div>
          )}
        </Card>
      </div>

      {/* ── Latest orders — full width ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
          <div className="text-sm font-black text-gray-900 dark:text-white">آخرین سفارشات</div>
          <Link href="/admin/orders" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">مشاهده همه ←</Link>
        </div>
        <div className="grid grid-cols-5 gap-2 px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]">
          <span>شناسه</span><span>مشتری</span><span>مبلغ</span><span>زمان</span><span>وضعیت</span>
        </div>
        {recentOrders.length === 0
          ? <div className="p-8 text-center text-sm text-gray-400">هنوز سفارشی ثبت نشده</div>
          : recentOrders.map(o => {
            const s = STATUS[o.status] ?? { label: o.status, color: "#6b7280" };
            return (
              <Link key={o.id} href={`/admin/orders/${o.id}`}
                className="grid grid-cols-5 gap-2 items-center px-5 py-3 border-b border-gray-50 dark:border-white/[0.03] text-xs hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all last:border-0">
                <span className="font-semibold text-gray-500 dark:text-gray-400 truncate">#{o.orderNumber}</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate">{o.userName}</span>
                <span className="font-bold text-gray-900 dark:text-white">{faPrice(o.grandTotal)}</span>
                <span className="text-gray-500 dark:text-gray-400 text-[11px]">{faDate(o.createdAt)}</span>
                <span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ color: s.color, background: s.color + "22" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    {s.label}
                  </span>
                </span>
              </Link>
            );
          })}
      </Card>

      {/* ── Top buyers + Latest products ── */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-4 p-5">
          <div className="text-sm font-black text-gray-900 dark:text-white mb-4">کاربران با بیشترین خرید</div>
          {topBuyers.length === 0
            ? <div className="text-sm text-gray-400 text-center py-8">داده‌ای موجود نیست</div>
            : topBuyers.map((b, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-white/[0.04] last:border-0">
                <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {b.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{b.name}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{fa(b.orders)} سفارش</div>
                </div>
                <div className="text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">{faPrice(b.total)}</div>
              </div>
            ))}
        </Card>
        <Card className="col-span-8 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-black text-gray-900 dark:text-white">آخرین محصولات</div>
            <Link href="/admin/products" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">همه ←</Link>
          </div>
          {topProducts.length === 0
            ? <div className="text-sm text-gray-400 text-center py-8">داده‌ای موجود نیست</div>
            : topProducts.map(p => (
              <Link key={p.id} href={`/admin/products/${p.id}`}
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-white/[0.04] last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition-all">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.05] overflow-hidden flex-shrink-0">
                  {p.mainImage
                    ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📦</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{p.title}</div>
                  <div className="text-[11px] text-gray-400">{p.slug}</div>
                </div>
                <div className="text-left flex-shrink-0">
                  {p.salePrice ? (
                    <>
                      <div className="text-xs font-black text-green-500 dark:text-green-400">{faPrice(p.salePrice)}</div>
                      <div className="text-[10px] text-gray-400 line-through">{faPrice(p.price)}</div>
                    </>
                  ) : (
                    <div className="text-xs font-bold text-gray-900 dark:text-white">{faPrice(p.price)}</div>
                  )}
                </div>
                <div className={`text-[11px] font-semibold flex-shrink-0 w-14 text-left ${p.stock <= 5 ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}>
                  موجودی {fa(p.stock)}
                </div>
              </Link>
            ))}
        </Card>
      </div>

      {/* ── Latest chats ── */}
      {recentChats.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
            <div>
              <div className="text-sm font-black text-gray-900 dark:text-white">آخرین گفتگوها</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {fa(stats.totalChatConversations)} گفتگو — امروز {fa(stats.todayChatConversations)} گفتگوی جدید
              </div>
            </div>
          </div>
          {recentChats.map(c => {
            const isUser = !!c.userId;
            const initial = isUser ? "ک" : "م";
            const name = isUser
              ? `کاربر #${c.userId!.slice(-6)}`
              : `مهمان #${(c.sessionId ?? "").slice(-6)}`;
            return (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">{name}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{c.lastMessage ?? "…"}</div>
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-600 flex-shrink-0">{faDateAgo(c.lastMessageAt)}</div>
              </div>
            );
          })}
        </Card>
      )}

    </div>
  );
}
