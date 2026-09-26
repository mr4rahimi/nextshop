"use client";

/**
 * دسترسی کاربر جاری برای پنهان کردن دکمه‌ها و منوها.
 * ⚠️ فقط برای ظاهر؛ مرز واقعی `requirePermission` در هر route است.
 */

import { useEffect, useState } from "react";
import { loadAdminMe, type AdminMe } from "../useAdminMe";

export function useAccess(): { ready: boolean; can: (perm: string | string[]) => boolean } {
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadAdminMe().then((m) => alive && setMe(m));
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
