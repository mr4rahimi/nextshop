"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export interface CartProduct {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  mainImage: string | null;
  images: { url: string }[];
}

export interface CartItem {
  productId: string;
  /** تنوع (رنگ/سایز) — docs/plans/inventory-items.md فاز ۴. `product` همان تنوع را نشان می‌دهد */
  variantId?: string | null;
  qty: number;
  product: CartProduct;
}

/**
 * کلید ردیف سبد: محصول ساده = خودِ شناسه‌ی محصول (همه‌ی فراخوان‌های قبلی همان را
 * می‌فرستند)، تنوع = «محصول::تنوع».
 */
export const cartLineKey = (i: { productId: string; variantId?: string | null }) => (i.variantId ? `${i.productId}::${i.variantId}` : i.productId);
const splitKey = (key: string) => {
  const [productId, variantId] = key.split("::");
  return { productId, variantId: variantId || null };
};

interface CartCtx {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: CartProduct, qty?: number, variantId?: string | null) => void;
  /** `key` = `cartLineKey` (برای محصول ساده همان شناسه‌ی محصول) */
  removeItem: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  clearCart: () => void;
  isLoggedIn: boolean;
  /** سبد از سرور/localStorage خوانده شده — پیش از آن `addItem` اثری ندارد */
  ready: boolean;
}

const CartContext = createContext<CartCtx>({
  items: [], count: 0, total: 0,
  addItem: () => {}, removeItem: () => {}, updateQty: () => {}, clearCart: () => {},
  isLoggedIn: false, ready: false,
});

export function useCart() { return useContext(CartContext); }

const LS_KEY = "mymonta_cart";

function readLS(): CartItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeLS(items: CartItem[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

function calcTotal(items: CartItem[]): number {
  return items.reduce((s, i) => {
    const p = Number(i.product.salePrice ?? i.product.price);
    return s + p * i.qty;
  }, 0);
}

export function CartProvider({ children, isLoggedIn }: { children: ReactNode; isLoggedIn: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (isLoggedIn) {
        const res = await fetch("/api/cart");
        const dbItems = await res.json();
        const mapped: CartItem[] = dbItems.map((i: any) => ({
          productId: i.productId,
          variantId: i.variantId ?? null,
          qty: i.qty,
          product: i.product,
        }));

        const lsItems = readLS();
        if (lsItems.length > 0) {
          await fetch("/api/cart/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: lsItems.map(i => ({ productId: i.productId, variantId: i.variantId ?? null, qty: i.qty })) }),
          });
          localStorage.removeItem(LS_KEY);
          const res2 = await fetch("/api/cart");
          const merged = await res2.json();
          setItems(merged.map((i: any) => ({ productId: i.productId, variantId: i.variantId ?? null, qty: i.qty, product: i.product })));
        } else {
          setItems(mapped);
        }
      } else {
        setItems(readLS());
      }
      setReady(true);
    }
    init();
  }, [isLoggedIn]);

  const syncToServer = useCallback(async (key: string, qty: number | null) => {
    if (!isLoggedIn) return;
    const { productId, variantId } = splitKey(key);
    if (qty === null) {
      await fetch("/api/cart/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId }),
      });
    } else {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, qty }),
      });
    }
  }, [isLoggedIn]);

  const addItem = useCallback((product: CartProduct, qty = 1, variantId: string | null = null) => {
    track(EVENTS.addToCart);
    const key = cartLineKey({ productId: product.id, variantId });
    setItems(prev => {
      const exists = prev.find(i => cartLineKey(i) === key);
      const next = exists
        ? prev.map(i => cartLineKey(i) === key ? { ...i, qty: i.qty + qty } : i)
        : [...prev, { productId: product.id, variantId, qty, product }];
      if (!isLoggedIn) writeLS(next);
      else syncToServer(key, exists ? exists.qty + qty : qty);
      return next;
    });
  }, [isLoggedIn, syncToServer]);

  const removeItem = useCallback((key: string) => {
    setItems(prev => {
      const next = prev.filter(i => cartLineKey(i) !== key);
      if (!isLoggedIn) writeLS(next);
      else syncToServer(key, null);
      return next;
    });
  }, [isLoggedIn, syncToServer]);

  const updateQty = useCallback((key: string, qty: number) => {
    if (qty < 1) { removeItem(key); return; }
    setItems(prev => {
      const next = prev.map(i => cartLineKey(i) === key ? { ...i, qty } : i);
      if (!isLoggedIn) writeLS(next);
      else syncToServer(key, qty);
      return next;
    });
  }, [isLoggedIn, removeItem, syncToServer]);

  const clearCart = useCallback(() => {
    setItems([]);
    if (!isLoggedIn) localStorage.removeItem(LS_KEY);
    else fetch("/api/cart", { method: "DELETE" });
  }, [isLoggedIn]);

  if (!ready) return <>{children}</>;

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = calcTotal(items);

  return (
    <CartContext.Provider value={{ items, count, total, addItem, removeItem, updateQty, clearCart, isLoggedIn, ready }}>
      {children}
    </CartContext.Provider>
  );
}
