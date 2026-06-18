"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface WishlistContextType {
  ids: Set<string>;
  loading: boolean;
  toggle: (productId: string) => Promise<void>;
  has: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType>({
  ids: new Set(), loading: false,
  toggle: async () => {}, has: () => false,
});

export function WishlistProvider({ children, isLoggedIn }: { children: React.ReactNode; isLoggedIn: boolean }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/user/wishlist")
      .then(r => r.ok ? r.json() : [])
      .then((items: { productId: string }[]) => {
        setIds(new Set(items.map(i => i.productId)));
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const toggle = useCallback(async (productId: string) => {
    if (!isLoggedIn) {
      window.location.href = "/auth?redirect=" + window.location.pathname;
      return;
    }
    const isIn = ids.has(productId);

    // optimistic update
    setIds(prev => {
      const next = new Set(prev);
      isIn ? next.delete(productId) : next.add(productId);
      return next;
    });

    try {
      const res = await fetch("/api/user/wishlist", {
        method: isIn ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // rollback
      setIds(prev => {
        const next = new Set(prev);
        isIn ? next.add(productId) : next.delete(productId);
        return next;
      });
    }
  }, [ids, isLoggedIn]);

  const has = useCallback((productId: string) => ids.has(productId), [ids]);

  return (
    <WishlistContext.Provider value={{ ids, loading, toggle, has }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
