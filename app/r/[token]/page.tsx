/**
 * صفحه‌ی ثبت نظر `/r/<token>` و لینک عمومی `/r/shop` — docs/features/tools.md بخش ۴.
 *
 * - هر دکمه از `/r/<token>/go/<platform>` می‌گذرد تا کلیکش شمرده شود.
 * - فقط یک سکو و بدون محصول: مستقیم ریدایرکت می‌شود، صفحه‌ی انتخاب لازم نیست.
 * - متن خنثی است، نه «اگر راضی بودید» — review gating ممنوع است.
 * - رنگ‌ها هگز ثابت؛ صفحه روی گوشی مشتری باز می‌شود و تم شب پنل/سایت ربطی ندارد.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";
import { loadReviewPage } from "@/lib/tools/reviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ثبت نظر", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

export default async function ReviewRequestPage({ params }: Props) {
  const { token } = await params;
  const d = await loadReviewPage(decodeURIComponent(token));
  if (!d) notFound();
  if (d.platforms.length === 1 && d.products.length === 0) redirect(d.platforms[0].url);

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb", color: "#1f2937" }} dir="rtl">
      <main className="mx-auto w-full max-w-[460px] px-4 py-8 space-y-4">
        <header className="rounded-3xl bg-white p-6 text-center shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)]">
          {d.storeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- لوگوی فروشگاه از تنظیمات
            <img src={d.storeLogo} alt={d.storeName} className="mx-auto h-16 w-16 rounded-2xl object-contain" />
          ) : (
            <Star className="mx-auto h-10 w-10" style={{ color: "#f59e0b" }} aria-hidden />
          )}
          <h1 className="mt-3 text-lg font-black text-gray-900">{d.title}</h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">{d.message}</p>
        </header>

        {d.platforms.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)]">
            <p className="mb-3 text-center text-sm font-bold text-gray-700">ثبت نظر روی نقشه</p>
            <div className="space-y-2.5">
              {d.platforms.map((p) => (
                <a
                  key={p.key}
                  href={p.url}
                  className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-white"
                  style={{ background: PLATFORM_COLOR[p.key] ?? "#2563eb" }}
                >
                  <Star className="h-4 w-4" aria-hidden />
                  نظر در {p.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {d.products.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)]">
            <p className="mb-3 text-center text-sm font-bold text-gray-700">نظر درباره‌ی محصولاتی که خریدید</p>
            <ul className="space-y-2">
              {d.products.map((p) => (
                <li key={p.id}>
                  <a href={p.url} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-2.5">
                    <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50">
                      {p.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-full w-full object-contain" />
                      )}
                    </span>
                    <span className="line-clamp-2 flex-1 text-sm font-bold leading-6 text-gray-800">{p.title}</span>
                    <span className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold text-white" style={{ background: "#2563eb" }}>
                      ثبت نظر
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.storeName && <p className="text-center text-xs text-gray-400">{d.storeName}</p>}
      </main>
    </div>
  );
}

/** رنگ برند هر سکو — هگز ثابت */
const PLATFORM_COLOR: Record<string, string> = {
  NESHAN: "#1a73e8",
  BALAD: "#0d9488",
  GOOGLE: "#ea4335",
};
