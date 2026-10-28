"use client";

/**
 * لایه‌ی دموی عمومی در پنل — docs/plans/demo.md
 *
 * - نوار «نسخه‌ی نمایشی» بالای هر صفحه
 * - پاپ‌آپ خوش‌آمد بار اول (هوش مصنوعی خاموش است و چه چیزهایی بسته‌اند)
 * - پیام هر درخواستی که proxy در دمو بسته (`x-demo-blocked`)، حتی وقتی صفحه‌ی
 *   مربوط متن خطا را نشان نمی‌دهد
 *
 * بیرون از دمو هیچ چیزی رندر نمی‌کند و fetch را هم دست نمی‌زند.
 */

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useAdminMe } from "@/components/admin/useAdminMe";

const WELCOME_KEY = "gardanos-demo-welcome-v1";
const BLOCKED_EVENT = "demo-blocked";

let fetchPatched = false;

/** هر پاسخ مسدود دمو یک رویداد با متن پیام می‌فرستد */
function patchFetch() {
  if (fetchPatched) return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await original(...args);
    if (res.headers.get("x-demo-blocked")) {
      res
        .clone()
        .json()
        .then((d: { error?: string }) => window.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: d.error })))
        .catch(() => {});
    }
    return res;
  };
}

const AI_OFF = [
  "پاسخ‌گویی خودکار چت فروشگاه",
  "ساخت متن، عنوان و توضیح محصول",
  "ساخت و ویرایش عکس محصول",
  "تولید محتوای وبلاگ و سئو",
  "تحلیل‌ها و دستیار هوشمند پنل",
];

export default function DemoShell() {
  const me = useAdminMe();
  const demo = !!me?.demo;
  const [welcome, setWelcome] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!demo) return;
    patchFetch();
    let seen = false;
    try {
      seen = localStorage.getItem(WELCOME_KEY) === "1";
    } catch {
      /* حالت خصوصی */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage فقط بعد از mount در دسترس است
    if (!seen) setWelcome(true);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onBlocked = (e: Event) => {
      setNotice((e as CustomEvent<string | undefined>).detail || "این کار در نسخه‌ی نمایشی غیرفعال است.");
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(null), 6000);
    };
    window.addEventListener(BLOCKED_EVENT, onBlocked);
    return () => {
      window.removeEventListener(BLOCKED_EVENT, onBlocked);
      clearTimeout(timer);
    };
  }, [demo]);

  if (!demo) return null;

  const closeWelcome = () => {
    setWelcome(false);
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* هیچ */
    }
  };

  return (
    <>
      <div className="mx-4 mt-4 lg:mx-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
        <span>
          نسخه‌ی نمایشی گردانوس — داده‌ها نمایشی‌اند و هر شب به حالت اول برمی‌گردند. اطلاعات واقعی وارد نکنید.
        </span>
        <span className="flex items-center gap-3">
          <button onClick={() => setWelcome(true)} className="underline">
            راهنمای دمو
          </button>
          <a href="https://gardanos.ir/pricing" target="_blank" rel="noopener" className="underline">
            تعرفه‌ها و خرید
          </a>
        </span>
      </div>

      {notice && (
        <div
          role="status"
          className="adm-pop-in fixed bottom-5 left-1/2 z-[70] flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-900 shadow-lg dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-200"
        >
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="بستن" className="flex-shrink-0">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {welcome && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={closeWelcome}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-welcome-title"
            onClick={(e) => e.stopPropagation()}
            className="adm-pop-in max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-sm leading-7 text-gray-700 shadow-2xl dark:text-gray-300"
          >
            <h2 id="demo-welcome-title" className="text-lg font-black text-gray-900 dark:text-white">
              به نسخه‌ی نمایشی گردانوس خوش آمدید
            </h2>
            <p className="mt-2 font-bold">
              شما مدیر کامل این فروشگاه نمایشی لوازم جانبی موبایل هستید. هر بخشی را باز کنید و هر کاری را امتحان کنید؛
              داده‌ها هر شب به حالت اول برمی‌گردند.
            </p>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-200">
                <Sparkles className="h-4 w-4" aria-hidden />
                هوش مصنوعی در دمو خاموش است
              </p>
              <p className="mt-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                این قابلیت‌ها در نسخه‌ی شما فعال‌اند ولی اینجا کار نمی‌کنند:
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pr-5 text-xs font-bold text-amber-900 dark:text-amber-200">
                {AI_OFF.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            <ul className="mt-4 list-disc space-y-1 pr-5 text-xs font-bold">
              <li>اتصال باسلام، اسنپ‌شاپ و تپسی‌شاپ نمایشی است؛ هیچ اطلاعاتی به بازارگاه واقعی نمی‌رود.</li>
              <li>پیامک (جز کد ورود) و پنل پیامک فرستاده نمی‌شود.</li>
              <li>فقط عکس تا ۱ مگابایت آپلود می‌شود؛ ویدئو، فایل و کد HTML بسته است.</li>
              <li>همه با یک حساب مشترک وارد می‌شوند؛ آنچه شما می‌سازید را دیگران هم می‌بینند.</li>
            </ul>

            <button
              onClick={closeWelcome}
              className="mt-6 w-full rounded-2xl bg-gradient-to-l from-blue-600 to-indigo-600 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/30"
            >
              شروع کنیم
            </button>
          </div>
        </div>
      )}
    </>
  );
}
