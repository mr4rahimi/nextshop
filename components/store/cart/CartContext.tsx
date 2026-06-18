"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

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
  qty: number;
  product: CartProduct;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: CartProduct, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  isLoggedIn: boolean;
}

const CartContext = createContext<CartCtx>({
  items: [], count: 0, total: 0,
  addItem: () => {}, removeItem: () => {}, updateQty: () => {}, clearCart: () => {},
  isLoggedIn: false,
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
          qty: i.qty,
          product: i.product,
        }));

        const lsItems = readLS();
        if (lsItems.length > 0) {
          await fetch("/api/cart/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: lsItems.map(i => ({ productId: i.productId, qty: i.qty })) }),
          });
          localStorage.removeItem(LS_KEY);
          const res2 = await fetch("/api/cart");
          const merged = await res2.json();
          setItems(merged.map((i: any) => ({ productId: i.productId, qty: i.qty, product: i.product })));
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

  const syncToServer = useCallback(async (productId: string, qty: number | null) => {
    if (!isLoggedIn) return;
    if (qty === null) {
      await fetch("/api/cart/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    } else {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, qty }),
      });
    }
  }, [isLoggedIn]);

  const addItem = useCallback((product: CartProduct, qty = 1) => {
    setItems(prev => {
      const exists = prev.find(i => i.productId === product.id);
      const next = exists
        ? prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + qty } : i)
        : [...prev, { productId: product.id, qty, product }];
      if (!isLoggedIn) writeLS(next);
      else syncToServer(product.id, exists ? exists.qty + qty : qty);
      return next;
    });
  }, [isLoggedIn, syncToServer]);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId);
      if (!isLoggedIn) writeLS(next);
      else syncToServer(productId, null);
      return next;
    });
  }, [isLoggedIn, syncToServer]);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty < 1) { removeItem(productId); return; }
    setItems(prev => {
      const next = prev.map(i => i.productId === productId ? { ...i, qty } : i);
      if (!isLoggedIn) writeLS(next);
      else syncToServer(productId, qty);
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
    <CartContext.Provider value={{ items, count, total, addItem, removeItem, updateQty, clearCart, isLoggedIn }}>
      {children}
    </CartContext.Provider>
  );
}
