import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Compass, MessageCircle, Plug, ReceiptText,
  RefreshCw, Settings2, Sparkles, Unlink, type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getQueueStats } from "@/lib/integration/core/queue";
import { getHiddenSections, getStockSource, listPlatforms } from "@/lib/integration/core/config";
import { OP_LABELS, STOCK_SOURCE_LABEL } from "@/lib/integration/core/sections";
import HomeTiles from "@/components/admin/integration/HomeTiles";
import { Card, PageHeader, btn } from "@/components/admin/accounting/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  CONNECTED: { label: "متصل", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  SYNCING: { label: "در حال همگام‌سازی", dot: "bg-blue-500 animate-pulse", text: "text-blue-600 dark:text-blue-400" },
  ERROR: { label: "خطا", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  DISCONNECTED: { label: "وصل نشده", dot: "bg-gray-300 dark:bg-gray-600", text: "text-gray-400" },
};

const fa = (n: number) => n.toLocaleString("fa-IR");
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const when = (d: Date) => new Date(d).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

interface Todo {
  tone: "red" | "amber" | "blue";
  icon: LucideIcon;
  text: string;
  href: string;
  cta: string;
}

/**
 * خانه‌ی یکپارچه‌سازی — docs/integrations/settings-and-guide.md
 * بالا: وضعیت کلی و منبع موجودی. بعد: کارهای مانده، کانال‌ها، کاشی بخش‌ها، فعالیت اخیر.
 */
export default async function IntegrationHomePage() {
  const since24h = hoursAgo(24);
  const [platforms, hidden, source] = await Promise.all([listPlatforms(), getHiddenSections(), getStockSource()]);
  const visible = platforms.filter((p) => p.isActive && p.supported);
  const codes = visible.map((p) => p.code);

  const [
    connections, queueStats, suggestionCount, errorCount24h, ordersNeedingMapping, unseen,
    linkCounts, productCounts, recentLogs,
  ] = await Promise.all([
    prisma.integConnection.findMany({ where: { platformCode: { in: codes } } }),
    getQueueStats(),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING", platformCode: { in: codes } } }),
    prisma.integLog.count({ where: { status: "ERROR", createdAt: { gte: since24h }, platformCode: { in: codes } } }),
    prisma.integOrder.count({ where: { status: "NEEDS_MAPPING", platformCode: { in: codes } } }),
    prisma.integChat.aggregate({ where: { chatType: "private", platformCode: { in: codes } }, _sum: { unseenCount: true } }),
    prisma.integMappingLink.groupBy({ by: ["platformCode"], where: { isActive: true }, _count: { _all: true } }),
    prisma.integPlatformProduct.groupBy({ by: ["platformCode"], where: { platformCode: { in: codes } }, _count: { _all: true } }),
    hidden.has("logs")
      ? Promise.resolve([])
      : prisma.integLog.findMany({
          where: { platformCode: { in: codes } },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { platform: { select: { name: true } } },
        }),
  ]);

  const conn = new Map(connections.map((c) => [c.platformCode, c]));
  const linked = new Map(linkCounts.map((l) => [l.platformCode, l._count._all]));
  const fetched = new Map(productCounts.map((l) => [l.platformCode, l._count._all]));
  const connected = visible.filter((p) => ["CONNECTED", "SYNCING"].includes(conn.get(p.code)?.status ?? ""));
  const marketplacesConnected = connected.filter((p) => p.type === "MARKETPLACE");
  const unseenCount = unseen._sum.unseenCount ?? 0;

  // ── کارهای مانده ────────────────────────────────────────────────────
  const todos: Todo[] = [];
  if (ordersNeedingMapping > 0) {
    todos.push({ tone: "red", icon: ReceiptText, text: `${fa(ordersNeedingMapping)} قلم سفارش بازارگاه فاکتور نخورده؛ محصولشان نگاشت ندارد`, href: "/admin/integration/orders?status=NEEDS_MAPPING", cta: "رسیدگی" });
  }
  for (const p of visible) {
    const c = conn.get(p.code);
    if (c?.status === "ERROR") {
      todos.push({ tone: "red", icon: Unlink, text: `اتصال ${p.name} خطا دارد${c.lastError ? `: ${c.lastError.slice(0, 90)}` : ""}`, href: `/admin/integration/connections/${p.code}`, cta: "بررسی اتصال" });
    }
  }
  if (errorCount24h > 0) {
    todos.push({
      tone: "red", icon: AlertTriangle, text: `${fa(errorCount24h)} عملیات ناموفق در ۲۴ ساعت گذشته`,
      href: hidden.has("logs") ? "/admin/integration/settings" : "/admin/integration/logs?status=ERROR",
      cta: hidden.has("logs") ? "روشن کردن گزارش" : "دیدن خطاها",
    });
  }
  if (unseenCount > 0 && !hidden.has("messages")) {
    todos.push({ tone: "amber", icon: MessageCircle, text: `${fa(unseenCount)} پیام خوانده‌نشده از مشتریان بازارگاه`, href: "/admin/integration/messages", cta: "پاسخ" });
  }
  if (suggestionCount > 0) {
    todos.push({ tone: "amber", icon: Sparkles, text: `${fa(suggestionCount)} پیشنهاد نگاشت منتظر تأیید شماست`, href: "/admin/integration/mapping?tab=suggestions", cta: "تأیید" });
  }
  for (const p of marketplacesConnected) {
    const notMapped = (fetched.get(p.code) ?? 0) - (linked.get(p.code) ?? 0);
    if (notMapped > 0) {
      todos.push({ tone: "blue", icon: Unlink, text: `${fa(notMapped)} محصول ${p.name} هنوز به محصول سایت وصل نیست`, href: `/admin/integration/mapping?platform=${p.code}`, cta: "نگاشت" });
    }
  }
  if (queueStats.failed > 0 && !hidden.has("queue")) {
    todos.push({ tone: "amber", icon: RefreshCw, text: `${fa(queueStats.failed)} عملیات در صف شکست خورده`, href: "/admin/integration/queue?status=FAILED", cta: "تلاش دوباره" });
  }

  const healthy = todos.every((t) => t.tone === "blue");
  const src = STOCK_SOURCE_LABEL[source];

  return (
    <div className="space-y-6">
      <PageHeader
        title="یکپارچه‌سازی"
        help="integration"
        desc="سایت، بازارگاه‌ها و حسابداری در یک جریان: یک موجودی، یک قیمت، همه‌ی سفارش‌ها یک‌جا."
        actions={
          <>
            <Link href="/admin/integration/guide" className={btn.soft}>
              <Compass className="h-4 w-4" aria-hidden />
              راهنمای نگاشت
            </Link>
            <Link href="/admin/integration/settings" className={btn.soft}>
              <Settings2 className="h-4 w-4" aria-hidden />
              تنظیمات
            </Link>
          </>
        }
      />

      {/* وضعیت کلی */}
      <section
        className={`rounded-3xl p-5 text-white sm:p-6 ${
          marketplacesConnected.length === 0
            ? "bg-gradient-to-br from-teal-600 to-cyan-700"
            : healthy
              ? "bg-gradient-to-br from-emerald-600 to-teal-700"
              : "bg-gradient-to-br from-amber-500 to-orange-600"
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            {marketplacesConnected.length === 0 ? <Plug className="h-7 w-7" aria-hidden /> : healthy ? <CheckCircle2 className="h-7 w-7" aria-hidden /> : <AlertTriangle className="h-7 w-7" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black">
              {marketplacesConnected.length === 0
                ? "هنوز بازارگاهی وصل نیست"
                : healthy
                  ? `همه‌چیز روبه‌راه است — ${fa(marketplacesConnected.length)} بازارگاه متصل`
                  : `${fa(todos.filter((t) => t.tone !== "blue").length)} مورد نیاز به رسیدگی دارد`}
            </p>
            <p className="mt-1 text-xs leading-6 text-white/85">
              منبع موجودی: <b>{src.title}</b> — {src.short}.{" "}
              <Link href="/admin/integration/guide" className="font-bold underline underline-offset-4">نگاشت در این حالت چطور است؟</Link>
            </p>
          </div>
          {marketplacesConnected.length === 0 && (
            <Link href="/admin/integration/connections" className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/30">
              وصل کردن بازارگاه
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>

        {marketplacesConnected.length === 0 && (
          <ol className="mt-5 grid gap-2 text-xs sm:grid-cols-4">
            {["بازارگاه را در «اتصالات» وصل کنید", "«دریافت محصولات» را بزنید", "محصولات را در «نگاشت» به سایت وصل کنید", "موجودی و قیمت خودکار همگام می‌شود"].map((s, i) => (
              <li key={s} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/25 text-[11px] font-black">{fa(i + 1)}</span>
                {s}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* کارهای مانده */}
      {todos.length > 0 && (
        <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
          {todos.map((t, i) => (
            <Link key={i} href={t.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--adm-hover)]">
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  t.tone === "red" ? "bg-red-500/10 text-red-600" : t.tone === "amber" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"
                }`}
              >
                <t.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-200">{t.text}</span>
              <span className="flex flex-shrink-0 items-center gap-1 text-xs font-bold text-gray-500">
                {t.cta}
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </Card>
      )}

      {/* کانال‌ها */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">کانال‌های فروش و حسابداری</h2>
          <Link href="/admin/integration/settings" className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            روشن و خاموش کردن سرویس‌ها
          </Link>
        </div>
        {visible.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            هیچ سرویسی روشن نیست. از <Link href="/admin/integration/settings" className="font-bold text-teal-600">تنظیمات</Link> بازارگاه‌هایی را که با آن‌ها کار می‌کنید روشن کنید.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const c = conn.get(p.code);
              const st = STATUS[c?.status ?? "DISCONNECTED"] ?? STATUS.DISCONNECTED;
              const total = fetched.get(p.code) ?? 0;
              const map = linked.get(p.code) ?? 0;
              const pct = total ? Math.min(100, Math.round((map / total) * 100)) : 0;
              return (
                <Link key={p.code} href={`/admin/integration/connections/${p.code}`}>
                  <Card className="h-full p-4 transition-colors hover:border-teal-300 dark:hover:border-teal-500/30">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-base font-black text-gray-500 dark:bg-white/5">{p.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-[11px] text-gray-400">{p.type === "ACCOUNTING" ? "حسابداری" : p.canCreateProduct ? "بازارگاه · ساخت خودکار محصول" : "بازارگاه"}</p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-[11px] font-bold ${st.text}`}>
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                    {c && p.type === "MARKETPLACE" && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>نگاشت‌شده: {fa(map)} از {fa(total)}</span>
                          <span>{fa(pct)}٪</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-gray-400">
                      {c ? (c.lastSyncAt ? `آخرین همگام‌سازی: ${when(c.lastSyncAt)}` : "هنوز همگام نشده") : "برای وصل کردن بزنید"}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* بخش‌ها */}
      <Card className="space-y-5 px-2 py-4 sm:px-4">
        <HomeTiles
          hidden={[...hidden]}
          badges={{
            ...(unseenCount ? { "/admin/integration/messages": unseenCount } : {}),
            ...(ordersNeedingMapping ? { "/admin/integration/orders": ordersNeedingMapping } : {}),
            ...(queueStats.failed ? { "/admin/integration/queue": queueStats.failed } : {}),
          }}
        />
      </Card>

      {/* فعالیت اخیر */}
      {recentLogs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">فعالیت اخیر</h2>
            <Link href="/admin/integration/logs" className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              همه‌ی گزارش‌ها
            </Link>
          </div>
          <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${log.status === "SUCCESS" ? "bg-emerald-500" : log.status === "ERROR" ? "bg-red-500" : "bg-amber-400"}`} />
                <span className="flex-shrink-0 font-bold text-gray-700 dark:text-gray-300">{log.platform.name}</span>
                <span className="flex-shrink-0 text-gray-500">{OP_LABELS[log.operationType] ?? log.operationType}</span>
                <span className="min-w-0 flex-1 truncate text-red-500">{log.errorMessage ?? ""}</span>
                <span className="flex-shrink-0 text-gray-400">{when(log.createdAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
