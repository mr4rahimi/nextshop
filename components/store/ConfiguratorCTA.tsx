import Link from "next/link";
import { Sparkles, Wand2, ShieldCheck, Timer, ArrowLeft } from "lucide-react";

export default function ConfiguratorCTA() {
  return (
    <section className="w-full">
      <div className="container mx-auto pt-8">
        <div
          className="
            relative overflow-hidden rounded-3xl
            border border-emerald-200/50
            bg-gradient-to-br from-emerald-50/80 via-teal-100/55 to-emerald-200/30
            backdrop-blur-xl
            shadow-[0_18px_50px_-18px_rgba(16,185,129,0.35)]
          "
        >
          {/* glow blobs */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-300/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl" />

          <div className="relative p-5 md:p-8">
            <div className="md:flex md:items-center md:justify-between md:gap-8">
              {/* Right/Top content */}
              <div className="md:max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs font-bold text-emerald-800">
                  <Sparkles size={16} />
                  ویژگی منحصربه‌فرد mymonta
                </div>

                <h2 className="mt-3 text-xl md:text-3xl font-extrabold text-zinc-900 leading-relaxed">
                  محصول دلخواهت رو بساز —{" "}
                  <span className="text-emerald-700">ترکیب کن، ببین، قیمت بگیر، بخر</span>
                </h2>

                <p className="mt-3 text-sm md:text-base text-zinc-700 leading-7">
                  رنگ، متتومان و قطعات رو انتخاب کن. اگر ترکیب قبلاً وجود داشته باشه همون محصول رو می‌گیری؛
                  اگر جدید باشه، سیستم خودکار محصول رو می‌سازه و بلافاصله قابل خرید میشه.
                </p>

                {/* buttons */}
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/configurator"
                    className="
                      inline-flex items-center justify-center gap-2
                      rounded-2xl bg-emerald-700 px-5 py-3
                      text-sm font-extrabold text-white
                      shadow-[0_12px_25px_-12px_rgba(16,185,129,0.65)]
                      hover:bg-emerald-800 transition
                    "
                  >
                    <Wand2 size={18} />
                    ساخت محصول دلخواه
                    <ArrowLeft size={18} />
                  </Link>

                  <Link
                    href="/products"
                    className="
                      inline-flex items-center justify-center
                      rounded-2xl border bg-white/70 px-5 py-3
                      text-sm font-bold text-zinc-900
                      hover:bg-white transition
                    "
                  >
                    مشاهده محصولات آماده
                  </Link>
                </div>
              </div>

              {/* Left feature cards */}
              <div className="mt-6 md:mt-0 grid grid-cols-2 gap-3 md:w-[420px]">
                <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <ShieldCheck size={18} />
                    بدون تکرار
                  </div>
                  <p className="mt-2 text-xs text-zinc-700 leading-6">
                    هر ترکیب یک شناسه یکتا دارد؛ اگر قبلاً ساخته شده باشد، همان محصول استفاده می‌شود.
                  </p>
                </div>

                <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <Timer size={18} />
                    قیمت لحظه‌ای
                  </div>
                  <p className="mt-2 text-xs text-zinc-700 leading-6">
                    قیمت با انتخاب هر قطعه محاسبه می‌شود و نتیجه را همان لحظه می‌بینی.
                  </p>
                </div>

                <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <Sparkles size={18} />
                    پیش‌نمایش زنده
                  </div>
                  <p className="mt-2 text-xs text-zinc-700 leading-6">
                    انتخاب‌ها را سریع و ساده با نمایش مرحله‌ای مشاهده کن (بعداً: AR).
                  </p>
                </div>

                <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <ShieldCheck size={18} />
                    کنترل موجودی
                  </div>
                  <p className="mt-2 text-xs text-zinc-700 leading-6">
                    اگر قطعه‌ای موجود نباشد، سیستم اجازه مونتاژ/ثبت سفارش نمی‌دهد.
                  </p>
                </div>
              </div>
            </div>

            {/* bottom note */}
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-zinc-700">
              <span className="rounded-full bg-white/70 px-3 py-1 border">
                آماده برای AI و AR
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 border">
                ساخت ست/باندل خودکار
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 border">
                استقرار روی Liara
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
