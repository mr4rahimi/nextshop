"use client";

/**
 * دسترسی کاربر جاری برای پنهان کردن دکمه‌ها و منوها.
 * ⚠️ فقط برای ظاهر؛ مرز واقعی `requirePermission` در هر route است.
 */

import { useEffect, useState } from "react";

interface Me {
  isUnrestricted: boolean;
  permissions: string[];
}

let cache: Promise<Me | null> | null = null;

function loadMe(): Promise<Me | null> {
  if (!cache) {
    cache = fetch("/api/admin/me")
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .catch(() => null);
  }
  return cache;
}

export function useAccess(): { ready: boolean; can: (perm: string | string[]) => boolean } {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadMe().then((m) => alive && setMe(m));
    return () => {
      alive = false;
    };
  }, []);
  return {
    ready: me !== undefined,
    can: (perm) => {
      if (!me) return false;
      if (me.isUnrestricted) return true;
      const list = Array.isArray(perm) ? perm : [perm];
      return list.some((p) => me.permissions.includes(p));
    },
  };
}
