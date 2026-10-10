"use client";

/**
 * نمای صفحه‌ی بازگشت به سبد — docs/plans/store-tools-2.md بخش ۱.
 * کد تخفیف در `localStorage` (`nx_coupon`) می‌ماند و صفحه‌ی تسویه فیلد کد را با آن پر می‌کند.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart, cartLineKey } from "@/components/store/cart/CartContext";
import type { RecoveryPageData } from "@/lib/tools/cart-recovery";

export const COUPON_HANDOFF_KEY = "nx_coupon";

const toFa = (n: number | string) => Number(n).toLocaleString("fa-IR");

function expiryText(iso: string | null): string | null {
  if (!iso) return null;
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (h <= 0) return null;
  return h < 48 ? `تا ${toFa(h)} ساعت دیگر` : `تا ${toFa(Math.round(h / 24))} روز دیگر`;
}

export default function CartRecoveryView({ data }: { data: RecoveryPageData }) {
  const { items, addItem, ready } = useCart();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = data.products.filter((p) => p.inStock);
  const total = available.reduce((s, p) => s + Number(p.salePrice ?? p.price) * p.qty, 0);
  const coupon = data.coupon?.usable ? data.coupon : null;
  const expiry = coupon ? expiryText(coupon.expiresAt) : null;

  function restore() {
    setBusy(true);
    const inCart = new Set(items.map((i) => cartLineKey(i)));
    for (const p of available) {
      if (inCart.has(cartLineKey({ productId: p.id, variantId: p.variantId }))) continue;
      addItem({ id: p.id, title: p.title, slug: p.slug, price: p.price, salePrice: p.salePrice, mainImage: p.mainImage, images: [] }, p.qty, p.variantId);
    }
    if (coupon) {
      try {
        localStorage.setItem(COUPON_HANDOFF_KEY, JSON.stringify({ code: coupon.code, expiresAt: coupon.expiresAt }));
      } catch {}
    }
    router.push("/cart?utm_source=sms&utm_medium=sms&utm_campaign=cart-recovery");
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10" dir="rtl">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03] sm:p-8">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">
          {data.name ? `${data.name} عزیز، ` : ""}سبد خریدتان منتظر شماست
        </h1>
        <p className="mt-2 text-sm leading-7 text-gray-500 dark:text-gray-400">
          کالاهایی که انتخاب کرده بودید را با یک دکمه به سبد برگردانید و خرید را تمام کنید.
        </p>

        {coupon && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/60 p-4 dark:border-primary-500/40 dark:bg-primary-500/10">
            <div>
              <p className="text-xs font-bold text-primary-700 dark:text-primary-300">کد تخفیف اختصاصی شما{expiry ? ` · ${expiry}` : ""}</p>
              <p className="mt-1 text-lg font-black tracking-widest text-gray-900 dark:text-white" dir="ltr">{coupon.code}</p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-primary-700 shadow-sm dark:bg-white/10 dark:text-primary-200"
              onClick={() => { navigator.clipboard?.writeText(coupon.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              {copied ? "کپی شد ✓" : "کپی کد"}
            </button>
          </div>
        )}

        {data.products.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">کالاهای این سبد دیگر در فروشگاه نیستند.</p>
        ) : (
          <ul className="mt-6 divide-y divide-gray-100 dark:divide-white/[0.06]">
            {data.products.map((p) => (
              <li key={`${p.id}:${p.variantId ?? ""}`} className={`flex items-center gap-3 py-3 ${p.inStock ? "" : "opacity-50"}`}>
                {p.mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- تصویر محصول از کتابخانه‌ی رسانه
                  <img src={p.mainImage} alt={p.title} className="h-16 w-16 shrink-0 rounded-xl bg-gray-50 object-contain dark:bg-white/5" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-gray-100 dark:bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${p.slug}`} className="line-clamp-2 text-sm font-bold text-gray-800 dark:text-gray-100">{p.title}</Link>
                  <p className="mt-1 text-xs text-gray-500">
                    {toFa(p.qty)} عدد · {p.inStock ? `${toFa(Number(p.salePrice ?? p.price) * p.qty)} تومان` : "فعلاً ناموجود"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm dark:border-white/[0.06]">
              <span className="font-bold text-gray-500">جمع{coupon ? " پیش از تخفیف" : ""}</span>
              <span className="font-black text-gray-900 dark:text-white">{toFa(total)} تومان</span>
            </div>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={restore}
              className="mt-6 w-full rounded-2xl bg-primary-600 py-4 text-base font-black text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-700 disabled:opacity-60"
            >
              {busy ? "در حال انتقال…" : "بازگرداندن سبد و ادامه‌ی خرید"}
            </button>
          </>
        )}
        <Link href="/products" className="mt-3 block text-center text-xs font-bold text-gray-400 hover:text-gray-600">
          دیدن کالاهای دیگر
        </Link>
      </div>
    </section>
  );
}
