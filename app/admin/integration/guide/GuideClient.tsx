"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, Building2, Calculator, Check, Globe, Store, X } from "lucide-react";
import { Card, PageHeader } from "@/components/admin/accounting/ui";

/**
 * راهنمای نگاشت — سه حالت: حسابداری داخلی، بدون حسابداری، حسابان وب.
 * docs/integrations/settings-and-guide.md — متن باید با رفتار واقعی کد یکی بماند
 * (lib/integration/core/inventory.ts، pricing.ts، config.ts → getStockSource).
 */

type Mode = "internal" | "site" | "hesaban";

const TABS: { key: Mode; label: string; hint: string }[] = [
  { key: "internal", label: "با حسابداری داخلی", hint: "انبار و فاکتور در همین پنل" },
  { key: "site", label: "بدون حسابداری", hint: "موجودی و قیمت را خودتان وارد می‌کنید" },
  { key: "hesaban", label: "با حسابان وب", hint: "حسابداری بیرونی متصل" },
];

function Box({ icon: I, title, sub, tone }: { icon: typeof Globe; title: string; sub: string; tone: string }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-3 ${tone}`}>
      <I className="h-6 w-6 flex-shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-black">{title}</p>
        <p className="text-[11px] leading-5 opacity-80">{sub}</p>
      </div>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-shrink-0 flex-col items-center justify-center px-1 text-[10px] font-bold text-gray-400 sm:flex-row sm:gap-1">
      <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
      <span className="max-w-24 text-center leading-4">{label}</span>
      <ArrowLeft className="hidden h-4 w-4 sm:block" aria-hidden />
    </div>
  );
}

const T = {
  acc: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
  site: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
  market: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
};

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm leading-7 text-gray-700 dark:text-gray-200">
          <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-[11px] font-black text-teal-700 dark:text-teal-300">
            {(i + 1).toLocaleString("fa-IR")}
          </span>
          <span className="min-w-0 flex-1">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="divide-y divide-[var(--adm-border)]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
          <p className="text-xs font-black text-gray-500">{k}</p>
          <div className="text-sm leading-7 text-gray-700 dark:text-gray-200">{v}</div>
        </div>
      ))}
    </div>
  );
}

const L = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-bold text-teal-600 hover:underline dark:text-teal-400">{children}</Link>
);

export default function GuideClient({ current, hesabanOn }: { current: Mode; hesabanOn: boolean }) {
  const tabs = TABS.filter((t) => t.key !== "hesaban" || hesabanOn || current === "hesaban");
  const [tab, setTab] = useState<Mode>(current);

  return (
    <div className="space-y-6">
      <PageHeader
        title="راهنمای نگاشت"
        help="integrationGuide"
        desc="نگاشت یعنی به پنل بگویید «این محصول سایت» همان «این محصول در باسلام» و «این محصول در اسنپ‌شاپ» است، تا یک موجودی و یک قیمت همه‌جا بماند."
      />

      {/* مفهوم مشترک */}
      <Card className="p-5">
        <p className="text-sm font-black text-gray-900 dark:text-white">نگاشت در یک نگاه</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Box icon={Globe} title="محصول سایت" sub="مرکز هر نگاشت؛ صفحه، عکس و قیمت سایت" tone={T.site} />
          <Arrow label="نگاشت" />
          <Box icon={Store} title="همان محصول در بازارگاه‌ها" sub="باسلام، اسنپ‌شاپ، تپسی‌شاپ، دیجی‌کالا — هر کدام یکی" tone={T.market} />
        </div>
        <ul className="mt-4 grid gap-2 text-xs leading-6 text-gray-600 sm:grid-cols-3 dark:text-gray-300">
          <li className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><b>یک موجودی:</b> فروش در هر کانال، موجودی سایت و بقیه‌ی بازارگاه‌ها را کم می‌کند؛ لغو سفارش برش می‌گرداند.</li>
          <li className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><b>قیمت هر بازارگاه:</b> از «قیمت خرید» و «قوانین قیمت» (کارمزد، ارسال، سود) ساخته و ارسال می‌شود.</li>
          <li className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><b>سفارش‌ها یک‌جا:</b> سفارش بازارگاه در «سفارش بازارگاه» می‌آید و فاکتورش روی کالای همان محصول می‌خورد.</li>
        </ul>
        <p className="mt-4 text-xs leading-6 text-gray-500">
          <b>سه راه نگاشت:</b> ۱) خودکار — محصولی که کد کالا یا بارکدش با سایت یکی است یا نامش تقریباً یکسان است، بعد از «دریافت محصولات» خودش وصل می‌شود؛
          ۲) پیشنهاد — شباهت کمتر، در <L href="/admin/integration/mapping?tab=suggestions">پیشنهادهای نگاشت</L> منتظر تأیید شما؛
          ۳) دستی — در <L href="/admin/integration/mapping">نگاشت محصولات</L>. محصولی هم که از سایت در باسلام <L href="/admin/integration/product-suggestions">ساخته شود</L> خودکار نگاشت می‌شود.
        </p>
      </Card>

      {/* انتخاب حالت */}
      <div>
        <p className="mb-2 text-sm font-black text-gray-900 dark:text-white">نگاشت در حالت کسب‌وکار شما</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-2xl border p-3 text-right transition ${
                  on ? "border-teal-400 bg-teal-50 ring-2 ring-teal-400/30 dark:bg-teal-500/10" : "border-[var(--adm-border)] bg-[var(--adm-surface)] hover:border-teal-300"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                  {t.label}
                  {current === t.key && <span className="rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] text-teal-700 dark:text-teal-300">حالت فعلی شما</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">{t.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "internal" && <Internal />}
      {tab === "site" && <SiteOnly />}
      {tab === "hesaban" && <Hesaban />}

      {/* مقایسه */}
      <Card className="overflow-x-auto p-5">
        <p className="mb-3 text-sm font-black text-gray-900 dark:text-white">مقایسه‌ی سه حالت</p>
        <table className="w-full min-w-[560px] text-right text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="py-2 font-bold" />
              <th className="py-2 font-bold">حسابداری داخلی</th>
              <th className="py-2 font-bold">بدون حسابداری</th>
              <th className="py-2 font-bold">حسابان وب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--adm-border)] text-gray-700 dark:text-gray-200">
            {[
              ["موجودی کجا تغییر می‌کند؟", "فاکتور خرید، اول دوره، انبارگردانی", "صفحه‌ی «موجودی» یا صفحه‌ی محصول", "خود حسابان"],
              ["قیمت خرید از کجا؟", "آخرین بهای خرید کالا، یا دستی", "دستی", "حسابان، یا دستی"],
              ["چه چیزی نگاشت می‌شود؟", "سایت ↔ بازارگاه", "سایت ↔ بازارگاه", "سایت ↔ حسابان ↔ بازارگاه"],
              ["فاکتور سفارش بازارگاه", "خودکار در همین پنل", "—", "در حسابان (خودکار یا انتخابی)"],
              ["گزارش سود و انبار", "کامل در پنل", "—", "در حسابان"],
            ].map((r) => (
              <tr key={r[0]}>
                <td className="py-2.5 font-black text-gray-500">{r[0]}</td>
                <td className="py-2.5">{r[1]}</td>
                <td className="py-2.5">{r[2]}</td>
                <td className="py-2.5">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-gray-400">
          حالت حسابداری در <L href="/admin/accounting/settings?tab=mode">حسابداری ← تنظیمات ← حسابداری کسب‌وکار</L> انتخاب می‌شود؛ سرویس‌ها در <L href="/admin/integration/settings">تنظیمات یکپارچه‌سازی</L> روشن و خاموش می‌شوند.
        </p>
      </Card>
    </div>
  );
}

function Internal() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-black text-gray-900 dark:text-white">سه دنیا، یک زنجیره</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Box icon={Calculator} title="کالای حسابداری" sub="موجودی انبار، بهای خرید، فاکتور، کاردکس" tone={T.acc} />
          <Arrow label="خودکار — کاری لازم نیست" />
          <Box icon={Globe} title="محصول سایت" sub="هر محصول (و هر تنوع) یک کالای هم‌شناسه دارد" tone={T.site} />
          <Arrow label="نگاشت — کار شما" />
          <Box icon={Store} title="محصول بازارگاه" sub="باسلام، اسنپ‌شاپ، …" tone={T.market} />
        </div>
        <p className="mt-4 text-sm leading-7 text-gray-700 dark:text-gray-200">
          در حسابداری داخلی <b>کالا</b> و <b>محصول سایت</b> از قبل به هم وصل‌اند: با ساختن هر محصول، کالای هم‌نامش در حسابداری ساخته می‌شود و
          هر تنوع (رنگ/سایز) هم کالای خودش را دارد. پس در یکپارچه‌سازی <b>فقط محصول سایت را به محصول بازارگاه</b> نگاشت می‌کنید؛ کالای حسابداری خودش پشت محصول سایت هست.
          کالایی که هنوز محصول سایت ندارد (مثلاً از «ورود سریع کالا» آمده) اول باید در سایت محصول شود — از <L href="/admin/accounting/inventory/to-product">کالا و انبار ← ساخت محصول</L>؛
          محصول ساخته‌شده خودکار به کالا وصل است و بعد از فعال شدن در <L href="/admin/integration/product-suggestions">قرار دادن محصول</L> برای بازارگاه‌ها پیشنهاد می‌شود.
        </p>
        <p className="mt-2 text-sm leading-7 text-gray-700 dark:text-gray-200">
          <b>کالا جدا ساخته شده و محصولش در سایت هم هست؟</b> (مثلاً کالا را در فاکتور خرید تعریف کرده‌اید و محصول از قبل در سایت بوده) در{" "}
          <L href="/admin/integration/mapping?tab=items">نگاشت محصولات ← کالای حسابداری</L> «وصل کن» بزنید. کالای هم‌کد، هم‌بارکد یا هم‌نام پیشنهاد می‌شود؛
          بعد از تأیید، کاردکس، فاکتورها، موجودی و بهای خرید کالا مال همان محصول سایت می‌شود.
        </p>
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm font-black text-gray-900 dark:text-white">قدم‌به‌قدم</p>
        <Steps
          items={[
            <>موجودی اول دوره را در <L href="/admin/accounting/opening">مانده‌های اول دوره</L> یا با فاکتور خرید وارد کنید. موجودی سایت = جمع انبارهای فروش.</>,
            <>بازارگاه را در <L href="/admin/integration/connections">اتصالات</L> وصل کنید و «دریافت محصولات» را بزنید.</>,
            <>محصولات بازارگاه را در <L href="/admin/integration/mapping">نگاشت محصولات</L> به محصول سایت وصل کنید (یا پیشنهادها را تأیید کنید).</>,
            <>در <L href="/admin/integration/pricing">قیمت خرید</L> منبع را «آخرین بهای خرید (حسابداری)» بگذارید و «خواندن بهای خرید از حسابداری» را بزنید؛ با <L href="/admin/integration/price-rules">قوانین قیمت</L> قیمت هر بازارگاه ساخته می‌شود.</>,
            <>از این به بعد هر خرید، فروش، مرجوعی و انبارگردانی موجودی سایت را عوض می‌کند و همان عدد به بازارگاه‌ها می‌رود.</>,
          ]}
        />
      </Card>

      <Card className="p-5">
        <p className="mb-1 text-sm font-black text-gray-900 dark:text-white">چه اتفاقی می‌افتد وقتی…</p>
        <Rows
          rows={[
            ["فاکتور خرید ثبت می‌کنید", "موجودی کالا در انبار بالا می‌رود ← موجودی سایت ← بازارگاه‌ها در همگام‌سازی بعدی."],
            ["در بازارگاه سفارش می‌آید", "موجودی سایت و بقیه‌ی بازارگاه‌ها همان لحظه کم می‌شود و فاکتور فروش با کانال «بازارگاه» در حسابداری صادر می‌شود. اگر محصول نگاشت نداشته باشد، سفارش در «سفارش بازارگاه» با وضعیت «نیاز به نگاشت» می‌ماند."],
            ["در سایت سفارش پرداخت می‌شود", "موجودی سایت کم می‌شود و عدد تازه به همه‌ی بازارگاه‌های نگاشت‌شده می‌رود."],
            ["موجودی را دستی عوض کنید", <>اینجا دستی نمی‌شود؛ از <L href="/admin/accounting/inventory/adjustments">ورود و خروج کالا</L> یا انبارگردانی — تا دفتر انبار درست بماند.</>],
          ]}
        />
      </Card>
    </div>
  );
}

function SiteOnly() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-black text-gray-900 dark:text-white">محصول سایت، مرجع همه‌چیز</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Box icon={Globe} title="محصول سایت" sub="موجودی و قیمت خرید را همین‌جا وارد می‌کنید" tone={T.site} />
          <Arrow label="نگاشت" />
          <Box icon={Store} title="محصول بازارگاه" sub="موجودی و قیمت از سایت می‌گیرد" tone={T.market} />
        </div>
        <p className="mt-4 text-sm leading-7 text-gray-700 dark:text-gray-200">
          حسابداری (نه داخلی، نه بیرونی) ندارید. موجودی <b>محصول سایت</b> مرجع است و قیمت خرید را دستی می‌دهید. صفحه‌ی <L href="/admin/integration/inventory">موجودی</L> در این حالت
          برای هر محصول نگاشت‌شده دو خانه دارد: <b>موجودی</b> و <b>قیمت خرید</b>. هر عددی بنویسید همان لحظه در سایت و همه‌ی بازارگاه‌ها می‌نشیند.
        </p>
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm font-black text-gray-900 dark:text-white">قدم‌به‌قدم</p>
        <Steps
          items={[
            <>اگر حسابان وب ندارید، در <L href="/admin/integration/settings">تنظیمات</L> خاموشش کنید تا نامش هیچ‌جا نیاید.</>,
            <>بازارگاه را در <L href="/admin/integration/connections">اتصالات</L> وصل کنید و «دریافت محصولات» را بزنید.</>,
            <>در <L href="/admin/integration/mapping">نگاشت محصولات</L> هر محصول بازارگاه را به محصول سایت وصل کنید. موجودی اولیه‌ی نگاشت همان موجودی فعلی محصول سایت است.</>,
            <>در <L href="/admin/integration/inventory">موجودی</L> موجودی و قیمت خرید هر محصول را وارد یا اصلاح کنید.</>,
            <>(اختیاری) در <L href="/admin/integration/price-rules">قوانین قیمت</L> کارمزد و سود هر بازارگاه را بدهید تا قیمت فروش از قیمت خرید ساخته شود. بی قانون، قیمتی برای بازارگاه ارسال نمی‌شود.</>,
          ]}
        />
      </Card>

      <Card className="p-5">
        <p className="mb-1 text-sm font-black text-gray-900 dark:text-white">چه اتفاقی می‌افتد وقتی…</p>
        <Rows
          rows={[
            ["در بازارگاه سفارش می‌آید", "از موجودی سایت کم می‌شود و عدد تازه به بقیه‌ی بازارگاه‌ها می‌رود. لغو سفارش برش می‌گرداند."],
            ["در سایت سفارش پرداخت می‌شود", "موجودی سایت کم می‌شود و به بازارگاه‌ها می‌رود."],
            ["موجودی را در صفحه‌ی محصول عوض کنید", "در همگام‌سازی دوره‌ای بعدی به بازارگاه‌ها می‌رسد؛ برای ارسال فوری از صفحه‌ی «موجودی» عوض کنید یا «ارسال دوباره» را بزنید."],
            ["محصول تنوع (رنگ/سایز) دارد", "موجودی هر تنوع در صفحه‌ی محصول وارد می‌شود؛ صفحه‌ی موجودی برای این محصول فقط نمایش می‌دهد."],
          ]}
        />
      </Card>
    </div>
  );
}

function Hesaban() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-black text-gray-900 dark:text-white">یک گروه، سه عضو</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Box icon={Building2} title="کالای حسابان وب" sub="منبع موجودی و قیمت خرید" tone={T.acc} />
          <Arrow label="نگاشت" />
          <Box icon={Globe} title="محصول سایت" sub="موجودی را از حسابان می‌گیرد" tone={T.site} />
          <Arrow label="نگاشت" />
          <Box icon={Store} title="محصول بازارگاه" sub="موجودی و قیمت از همان گروه" tone={T.market} />
        </div>
        <p className="mt-4 text-sm leading-7 text-gray-700 dark:text-gray-200">
          هر نگاشت سه عضو دارد: کالای حسابان، محصول سایت و محصول هر بازارگاه. موجودی و قیمت خرید <b>از حسابان خوانده</b> و به سایت و بازارگاه‌ها ارسال می‌شود
          (هر چند وقت یک‌بار، طبق بازه‌ی صفحه‌ی اتصال حسابان). فاکتور سفارش‌های سایت و بازارگاه در حسابان ثبت می‌شود و برای این کار <b>عضو حسابان در نگاشت لازم است</b>.
        </p>
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm font-black text-gray-900 dark:text-white">قدم‌به‌قدم</p>
        <Steps
          items={[
            <>در <L href="/admin/accounting/settings?tab=mode">حسابداری کسب‌وکار</L> حالت «حسابان وب» را انتخاب کنید.</>,
            <>حسابان را در <L href="/admin/integration/connections/hesaban">اتصال حسابان</L> وصل کنید و «دریافت محصولات» را بزنید؛ کالاهایی که کد یا بارکدشان با سایت یکی است خودکار نگاشت می‌شوند.</>,
            <>بازارگاه‌ها را وصل کنید، محصولاتشان را دریافت و در <L href="/admin/integration/mapping">نگاشت محصولات</L> به همان گروه اضافه کنید.</>,
            <>در <L href="/admin/integration/pricing">قیمت خرید</L> منبع را «از حسابان» بگذارید و با <L href="/admin/integration/price-rules">قوانین قیمت</L> قیمت هر بازارگاه را بسازید.</>,
            <>در صفحه‌ی اتصال حسابان «ثبت فاکتور فروش» و انبار فاکتور را تنظیم کنید.</>,
          ]}
        />
      </Card>

      <Card className="p-5">
        <p className="mb-1 text-sm font-black text-gray-900 dark:text-white">چه اتفاقی می‌افتد وقتی…</p>
        <Rows
          rows={[
            ["موجودی را در حسابان عوض کنید", "در دریافت بعدی به سایت و بازارگاه‌ها می‌رسد؛ برای فوری، در «موجودی» «دریافت موجودی از حسابان» را بزنید."],
            ["در بازارگاه سفارش می‌آید", "موجودی سایت و بقیه‌ی بازارگاه‌ها کم می‌شود و فاکتور در حسابان ثبت می‌شود. بی عضو حسابان در نگاشت، سفارش «نیاز به نگاشت» می‌ماند."],
            ["موجودی را در سایت عوض کنید", <><X className="inline h-3.5 w-3.5 text-red-500" aria-hidden /> با دریافت بعدی از حسابان بازنویسی می‌شود؛ همیشه در حسابان تغییر دهید.</>],
            ["حسابان را کنار بگذارید", <><Check className="inline h-3.5 w-3.5 text-emerald-500" aria-hidden /> حالت حسابداری را عوض و در <L href="/admin/integration/settings">تنظیمات</L> حسابان را خاموش کنید؛ نگاشت‌های سایت و بازارگاه سر جایشان می‌مانند.</>],
          ]}
        />
      </Card>
    </div>
  );
}
