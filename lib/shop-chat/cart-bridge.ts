/**
 * پل سبد خرید بین ویجت چت و `CartProvider` — docs/plans/storefront-chat.md فاز ۲
 *
 * ویجت چت در layout ریشه است و بیرون از `CartProvider` (که فقط در `(shop)` است)، پس
 * `useCart()` در آن کار نمی‌کند. چت رویداد مرورگر می‌فرستد و سبد گوش می‌دهد. وقتی صفحه
 * سبد ندارد (مثلاً `/user/*`) نشانه‌ی `window` خالی است و چت دکمه‌ی افزودن را نشان نمی‌دهد.
 *
 * بدون Prisma — در هر دو کامپوننت کلاینتی import می‌شود.
 */

export const CART_ADD_EVENT = "shop:cart-add";

export type CartAddDetail = {
  product: {
    id: string;
    title: string;
    slug: string;
    price: string;
    salePrice: string | null;
    mainImage: string | null;
    images: { url: string }[];
  };
  qty: number;
};

type BridgeWindow = Window & { __shopCartReady?: boolean };

export function setCartBridgeReady(ready: boolean) {
  if (typeof window !== "undefined") (window as BridgeWindow).__shopCartReady = ready;
}

export function cartBridgeReady(): boolean {
  return typeof window !== "undefined" && !!(window as BridgeWindow).__shopCartReady;
}

export function sendToCart(detail: CartAddDetail): boolean {
  if (!cartBridgeReady()) return false;
  window.dispatchEvent(new CustomEvent<CartAddDetail>(CART_ADD_EVENT, { detail }));
  return true;
}
