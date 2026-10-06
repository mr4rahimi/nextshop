/**
 * بازگشت به سبد از پیامک یادآوری `/c/<token>` — docs/plans/store-tools-2.md بخش ۱.
 *
 * زیر `(shop)` است تا هدر، فوتر و `CartProvider` فروشگاه را داشته باشد: دکمه‌ی
 * «بازگرداندن سبد» اقلام را با همان `addItem` اضافه می‌کند، پس روی گوشی‌ای که
 * مشتری وارد نشده هم کار می‌کند. قیمت و موجودی فعلی نشان داده می‌شود، نه عکس لحظه‌ی رها شدن.
 */

import { notFound } from "next/navigation";
import CartRecoveryView from "@/components/store/cart/CartRecoveryView";
import { noIndexMetadata } from "@/lib/seo";
import { loadRecoveryPage } from "@/lib/tools/cart-recovery";

export const dynamic = "force-dynamic";
export const metadata = noIndexMetadata("سبد خرید شما");

type Props = { params: Promise<{ token: string }> };

export default async function CartRecoveryPage({ params }: Props) {
  const { token } = await params;
  const d = await loadRecoveryPage(decodeURIComponent(token));
  if (!d) notFound();
  return <CartRecoveryView data={d} />;
}
