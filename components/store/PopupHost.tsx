"use client";

/**
 * میزبان پاپ‌آپ‌های سایت — در layout فروشگاه. docs/features/tools.md بخش ۹
 *
 * فهرست را یک‌بار می‌گیرد و با هر تغییر مسیر دوباره انتخاب می‌کند: صفحه، دستگاه،
 * بازه‌ی زمانی و دفعات نمایش (همه در مرورگر)، بعد بیشترین اولویت. در هر صفحه حداکثر
 * یک پاپ‌آپ؛ روی سبد، تسویه و حساب کاربری هرگز (`isExcludedPath`).
 */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PopupView, { type LeadResult } from "@/components/tools/PopupView";
import { dueAgain, inWindow, matchesDevice, matchesPage, type PopupPublic } from "@/lib/tools/popup-rules";

const SEEN_KEY = "nx_popup";
const SESSION_KEY = "nx_popup_s";

type Seen = Record<string, { v: string; t: number }>;

function readSeen(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") as Seen;
  } catch {
    return {};
  }
}

function seenInSession(id: string, v: string): boolean {
  try {
    return (sessionStorage.getItem(SESSION_KEY) || "").split(",").includes(`${id}:${v}`);
  } catch {
    return false;
  }
}

function markSeen(p: PopupPublic) {
  try {
    const s = readSeen();
    s[p.id] = { v: p.version, t: Date.now() };
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    const cur = (sessionStorage.getItem(SESSION_KEY) || "").split(",").filter(Boolean);
    sessionStorage.setItem(SESSION_KEY, [...cur, `${p.id}:${p.version}`].slice(-30).join(","));
  } catch {}
}

function send(id: string, type: "view" | "click" | "close") {
  try {
    fetch("/api/store/popups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type }), keepalive: true });
  } catch {}
}

export default function PopupHost() {
  const pathname = usePathname() || "/";
  const list = useRef<PopupPublic[] | null>(null);
  const [active, setActive] = useState<PopupPublic | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/store/popups")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((x: { items: PopupPublic[] }) => { list.current = x.items ?? []; setReady(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const now = Date.now();
    const seen = readSeen();
    const candidate = (list.current ?? []).find((p) => {
      if (!matchesPage(p, pathname) || !matchesDevice(p.device, mobile) || !inWindow(p, now)) return false;
      if (p.trigger === "EXIT" && mobile) return false; // قصد خروج در لمسی معنا ندارد
      if (seenInSession(p.id, p.version)) return false;
      const last = seen[p.id]?.v === p.version ? seen[p.id].t : null;
      return dueAgain(p.frequency, last, now);
    });
    if (!candidate) return;

    let fired = false;
    const show = () => {
      if (fired) return;
      fired = true;
      cleanup();
      setIsMobile(mobile);
      setActive(candidate);
      markSeen(candidate);
      send(candidate.id, "view");
    };
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0 || (window.scrollY / h) * 100 >= candidate.triggerValue) show();
    };
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (candidate.trigger === "DELAY") timer = setTimeout(show, candidate.triggerValue * 1000);
    else if (candidate.trigger === "SCROLL") window.addEventListener("scroll", onScroll, { passive: true });
    else document.addEventListener("mouseout", onLeave);

    function cleanup() {
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onLeave);
    }
    return () => {
      cleanup();
      setActive(null);
    };
  }, [pathname, ready]);

  const close = useCallback(() => {
    setActive((a) => {
      if (a) send(a.id, "close");
      return null;
    });
  }, []);

  if (!active) return null;

  async function lead(phone: string, consent: boolean, trap: string): Promise<LeadResult> {
    try {
      const r = await fetch("/api/store/popups/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ popupId: active!.id, phone, consent, website: trap }),
      });
      const x = await r.json().catch(() => null);
      if (x?.ok) return { ok: true, couponCode: x.couponCode, successText: x.successText };
      return { ok: false, error: x?.error ?? "ثبت نشد؛ دوباره تلاش کنید" };
    } catch {
      return { ok: false, error: "ارتباط برقرار نشد" };
    }
  }

  return (
    <PopupView
      kind={active.kind}
      content={active.content}
      accent={active.accent}
      position={active.position}
      isMobile={isMobile}
      onClose={close}
      onButton={() => send(active.id, "click")}
      onLead={lead}
    />
  );
}
