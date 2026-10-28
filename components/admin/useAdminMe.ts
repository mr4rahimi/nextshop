"use client";

/**
 * کاربر جاری پنل — نام، عنوان نقش و مجوزها.
 *
 * سایدبار، هدر و جستجوی سریع هر سه این را لازم دارند؛ درخواست فقط یک بار
 * فرستاده می‌شود و بقیه همان را می‌گیرند.
 *
 * ⚠️ فقط برای ظاهر (پنهان‌کردن منو)؛ مرز واقعی proxy.ts و requirePermission است.
 */

import { useEffect, useState } from "react";
import type { PanelFeatures } from "@/lib/plan/features";
import type { LicenseStatus } from "@/lib/plan/license";

export interface AdminMe {
  userId: string;
  name: string | null;
  roleTitle: string | null;
  isUnrestricted: boolean;
  permissions: string[];
  /** بسته‌ی گردانوس — lib/plan. نبودِ لایسنس: status "none" و features "*" */
  plan?: {
    status: LicenseStatus;
    name: string | null;
    features: PanelFeatures;
    daysLeft: number | null;
    graceLeft: number | null;
  };
  /** دموی عمومی — docs/plans/demo.md */
  demo?: boolean;
}

let cache: Promise<AdminMe | null> | null = null;

export function loadAdminMe(): Promise<AdminMe | null> {
  if (!cache) {
    cache = fetch("/api/admin/me")
      .then((r) => (r.ok ? (r.json() as Promise<AdminMe>) : null))
      .catch(() => null);
  }
  return cache;
}

/** `undefined` یعنی هنوز نیامده؛ `null` یعنی نیامد (خطا یا بیرون‌رفته) */
export function useAdminMe(): AdminMe | null | undefined {
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadAdminMe().then((m) => alive && setMe(m));
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

/** حرف اول نام برای آواتار؛ بدون نام، «م» (مدیر) */
export function initialOf(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  return t ? t[0] : "م";
}
