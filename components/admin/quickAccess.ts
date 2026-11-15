"use client";

/**
 * دسترسی سریع — بخش‌هایی که هر مدیر بیشتر و تازه‌تر باز می‌کند، اول.
 *
 * | چیز | کجا |
 * |-----|-----|
 * | ثبت بازدید | `useRecordVisit` در `app/admin/layout.tsx` — با هر جابه‌جایی |
 * | فهرست | پیشخوان (`DesktopClient`، ردیف «دسترسی سریع») و سایدبار (گروه بالای منو) |
 *
 * **امتیاز (frecency):** هر بار ورود به یک بخش، امتیاز آن بخش با نیمه‌عمر
 * ۷ روز کم می‌شود و یک واحد اضافه می‌گیرد: `s = s·½^(Δt/۷روز) + 1`. پس هم
 * پرکاربرد و هم تازه‌باز‌شده بالا می‌آید و بخشی که مدتی باز نشده آرام پایین
 * می‌رود. رفرش یا جابه‌جایی داخل همان بخش دوباره شمرده نمی‌شود.
 *
 * **ترتیب:** سنجاق‌شده‌ها (به ترتیب سنجاق) ← بقیه به امتیاز ← پیش‌فرض
 * `DEFAULT_QUICK` برای پر کردن جای خالی. پس کاربر تازه همان پیش‌فرض را می‌بیند و
 * کم‌کم ترتیب مال خودش می‌شود.
 *
 * ذخیره در `localStorage` با کلید شناسه‌ی کاربر (`admin:usage:<userId>`)؛ دو مدیر
 * روی یک مرورگر فهرست جدا دارند. فقط راحتی است؛ نبودنش پیش‌فرض را نشان می‌دهد.
 *
 * مستندات: docs/features/admin-ui.md بخش «دسترسی سریع»
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DESKTOP_CATEGORIES, DEFAULT_QUICK, type DesktopApp } from "./desktop/registry";

const HALF_LIFE = 7 * 24 * 3600 * 1000;
const MAX_ENTRIES = 120;
const EVENT = "admin:quick-change";

interface Entry { s: number; t: number; n: number }
interface Store {
  usage: Record<string, Entry>;
  pins: string[];
  hidden: string[];
  /** آخرین بخش ثبت‌شده — رفرش و جابه‌جایی داخل همان بخش دوباره شمرده نمی‌شود */
  last?: string;
}

const key = (uid: string) => `admin:usage:${uid}`;

function read(uid: string): Store {
  try {
    const v = JSON.parse(localStorage.getItem(key(uid)) ?? "null");
    if (v && typeof v === "object") {
      return {
        usage: v.usage && typeof v.usage === "object" ? v.usage : {},
        pins: Array.isArray(v.pins) ? v.pins.filter((x: unknown) => typeof x === "string") : [],
        hidden: Array.isArray(v.hidden) ? v.hidden.filter((x: unknown) => typeof x === "string") : [],
        last: typeof v.last === "string" ? v.last : undefined,
      };
    }
  } catch {
    /* حالت خصوصی یا دادهٔ خراب — از صفر */
  }
  return { usage: {}, pins: [], hidden: [] };
}

function write(uid: string, s: Store) {
  try {
    localStorage.setItem(key(uid), JSON.stringify(s));
  } catch {
    /* مسدود — بی‌صدا */
  }
  window.dispatchEvent(new Event(EVENT));
}

const decayed = (e: Entry, now: number) => e.s * Math.pow(0.5, (now - e.t) / HALF_LIFE);

// ── همه‌ی اپ‌ها، یک بار ─────────────────────────────────────────────────

const ALL_APPS: DesktopApp[] = (() => {
  const seen = new Map<string, DesktopApp>();
  DESKTOP_CATEGORIES.forEach((c) => c.apps.forEach((a) => !seen.has(a.href) && seen.set(a.href, a)));
  return [...seen.values()];
})();
const BY_HREF = new Map(ALL_APPS.map((a) => [a.href, a]));

export function appByHref(href: string): DesktopApp | undefined {
  return BY_HREF.get(href);
}

/** آیکن سه‌بعدی یک مسیر، اگر در پیشخوان باشد — کاشی‌های ماژول‌ها هم همین را نشان می‌دهند */
export function fluentIconFor(href: string): string | undefined {
  return BY_HREF.get(href)?.icon;
}

/**
 * اپ پیشخوانِ صفحه‌ی جاری — طولانی‌ترین پیشوند. اپ با کوئری
 * (`/admin/accounting/expenses?kind=INCOME`) فقط وقتی می‌خورد که همان کوئری
 * در آدرس باشد. خود پیشخوان شمرده نمی‌شود.
 */
export function appForLocation(pathname: string, search: string): string | null {
  if (pathname === "/admin") return null;
  const params = new URLSearchParams(search);
  let best: string | null = null;
  let bestLen = -1;
  for (const a of ALL_APPS) {
    const [p, q] = a.href.split("?");
    if (!(pathname === p || pathname.startsWith(`${p}/`))) continue;
    let len = p.length;
    if (q) {
      const want = new URLSearchParams(q);
      let ok = true;
      want.forEach((v, k) => { if (params.get(k) !== v) ok = false; });
      if (!ok) continue;
      len += q.length;
    }
    if (len > bestLen) { best = a.href; bestLen = len; }
  }
  return best;
}

// ── ثبت بازدید ─────────────────────────────────────────────────────────

export function recordVisit(uid: string, href: string) {
  const s = read(uid);
  if (s.last === href) return;
  const now = Date.now();
  const e = s.usage[href];
  s.usage[href] = e ? { s: decayed(e, now) + 1, t: now, n: e.n + 1 } : { s: 1, t: now, n: 1 };
  s.last = href;
  // سقف اندازه: کم‌امتیازترین‌ها کنار می‌روند
  const keys = Object.keys(s.usage);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => decayed(s.usage[a], now) - decayed(s.usage[b], now))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete s.usage[k]);
  }
  write(uid, s);
}

/** در layout پنل: هر جابه‌جایی به یک بخش پیشخوان یک بازدید است */
export function useRecordVisit(uid: string | undefined) {
  const pathname = usePathname();
  useEffect(() => {
    if (!uid) return;
    const href = appForLocation(pathname, window.location.search);
    if (href) recordVisit(uid, href);
    else {
      // بیرون از بخش‌ها (مثلاً پیشخوان) — ورود دوباره به همان بخش شمرده شود
      const s = read(uid);
      if (s.last) { s.last = undefined; try { localStorage.setItem(key(uid), JSON.stringify(s)); } catch {} }
    }
  }, [uid, pathname]);
}

// ── فهرست ──────────────────────────────────────────────────────────────

export interface QuickItem extends DesktopApp {
  pinned: boolean;
  /** چند بار باز شده — برای راهنمای کوچک زیر آیکن */
  visits: number;
}

/**
 * دسترسی سریع کاربر جاری.
 * `allowed`: hrefهایی که کاربر اجازه دارد (پیشخوان از سرور می‌گیرد)؛ نبودنش = همه
 * (سایدبار خودش فیلتر دسترسی دارد و این را می‌دهد).
 */
export function useQuickAccess(uid: string | undefined, allowed?: (href: string) => boolean, limit = 12) {
  // `at`: لحظه‌ی خواندن — امتیازها نسبت به آن کم می‌شوند (رندر خالص بماند)
  const [store, setStore] = useState<Store & { at: number }>({ usage: {}, pins: [], hidden: [], at: 0 });

  useEffect(() => {
    if (!uid) return;
    const load = () => setStore({ ...read(uid), at: Date.now() });
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [uid]);

  const items = useMemo<QuickItem[]>(() => {
    const now = store.at;
    const ok = (h: string) => BY_HREF.has(h) && !store.hidden.includes(h) && (!allowed || allowed(h));
    const ranked = Object.keys(store.usage)
      .filter((h) => !store.pins.includes(h))
      .sort((a, b) => decayed(store.usage[b], now) - decayed(store.usage[a], now));
    const order = [...new Set([...store.pins, ...ranked, ...DEFAULT_QUICK])].filter(ok).slice(0, limit);
    return order.map((h) => ({
      ...BY_HREF.get(h)!,
      pinned: store.pins.includes(h),
      visits: store.usage[h]?.n ?? 0,
    }));
  }, [store, allowed, limit]);

  const update = (fn: (s: Store) => void) => {
    if (!uid) return;
    const s = read(uid);
    fn(s);
    write(uid, s);
  };

  return {
    items,
    isPinned: (h: string) => store.pins.includes(h),
    togglePin: (h: string) =>
      update((s) => {
        s.pins = s.pins.includes(h) ? s.pins.filter((x) => x !== h) : [...s.pins, h];
        s.hidden = s.hidden.filter((x) => x !== h);
      }),
    hide: (h: string) =>
      update((s) => {
        s.pins = s.pins.filter((x) => x !== h);
        if (!s.hidden.includes(h)) s.hidden.push(h);
      }),
    /** برگشت به پیش‌فرض: سنجاق‌ها، پنهان‌ها و سابقه پاک می‌شوند */
    reset: () => update((s) => { s.usage = {}; s.pins = []; s.hidden = []; s.last = undefined; }),
  };
}
