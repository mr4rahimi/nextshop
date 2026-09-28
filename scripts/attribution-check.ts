/**
 * بررسی منبع ورود خریدار
 *
 *   pnpm tsx scripts/attribution-check.ts
 *
 * به دیتابیس وصل نمی‌شود — فقط توابع خالص `lib/analytics/attribution.ts`.
 * قبل و بعد از دست‌زدن به آن فایل اجرا کنید.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۵
 */

import {
  channelOf,
  touchFor,
  encodeTouch,
  decodeTouch,
  orderFieldsFromTouch,
  isDocumentNavigation,
} from "../lib/analytics/attribution";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const HOST = "shop.example.ir";
const u = (path: string) => new URL(`https://${HOST}${path}`);

// ── کانال ─────────────────────────────────────────────────────
const channels: [Parameters<typeof channelOf>[0], string][] = [
  [{ referrerHost: "www.google.com" }, "organicSearch"],
  [{ referrerHost: "google.co.uk" }, "organicSearch"],
  [{ referrerHost: "www.google.com", utmMedium: "cpc" }, "paidSearch"],
  [{ referrerHost: "l.instagram.com" }, "organicSocial"],
  [{ referrerHost: "t.me" }, "organicSocial"],
  [{ referrerHost: "torob.com" }, "comparison"],
  [{ referrerHost: "www.emalls.ir" }, "comparison"],
  [{ utmSource: "torob" }, "comparison"],
  [{ utmMedium: "sms" }, "sms"],
  [{ referrerHost: "chatgpt.com" }, "llm"],
  [{ referrerHost: "someblog.ir" }, "referral"],
  [{ utmSource: "partner", utmMedium: "banner" }, "referral"],
  [{ utmMedium: "cpc", utmSource: "yektanet" }, "paidAds"],
  [{}, "direct"],
];
for (const [input, want] of channels) {
  const got = channelOf(input);
  check(`کانال ${JSON.stringify(input)}`, got === want, `${got}`);
}

// ── لمس ───────────────────────────────────────────────────────
{
  const t = touchFor(u("/products/x?utm_source=instagram&utm_medium=story&utm_campaign=mehr"), null, HOST, true);
  check("utm حتی با کوکی موجود لمس تازه می‌سازد", !!t && t.ch === "organicSocial" && t.uc === "mehr" && t.lp === "/products/x");
}
{
  const t = touchFor(u("/"), "https://www.google.com/", HOST, true);
  check("ارجاع بیرونی با کوکی موجود بازنویسی می‌کند", t?.ch === "organicSearch" && t.rf === "google.com");
}
{
  const t = touchFor(u("/cart"), `https://www.${HOST}/products/x`, HOST, true);
  check("ارجاع از خود سایت (با www) کوکی را دست نمی‌زند", t === null);
}
{
  const t = touchFor(u("/cart"), `https://${HOST}/`, HOST, false);
  check("ارجاع از خود سایت بدون کوکی ← مستقیم", t?.ch === "direct" && t.rf === undefined);
}
{
  const t = touchFor(u("/"), null, HOST, true);
  check("بدون ارجاع با کوکی موجود دست نمی‌خورد", t === null);
}
{
  const t = touchFor(u("/"), null, HOST, false);
  check("بدون ارجاع و بدون کوکی ← مستقیم", t?.ch === "direct" && t.lp === "/");
}
{
  const t = touchFor(u("/checkout/success/1"), "https://sep.shaparak.ir/", HOST, true);
  check("بازگشت از شاپرک نادیده", t === null);
  const t2 = touchFor(u("/checkout/success/1"), "https://aghayepardakht.ir/pay", HOST, false);
  check("بازگشت از درگاه حتی بدون کوکی «مستقیم» هم نمی‌سازد", t2 === null);
}
{
  const t = touchFor(u("/%D9%85%D8%AD%D8%B5%D9%88%D9%84"), "https://torob.com/", HOST, false);
  check("آدرس فارسی باز می‌شود", t?.lp === "/محصول", t?.lp);
}
{
  const t = touchFor(u("/"), "not a url", HOST, false);
  check("ارجاع‌دهنده‌ی بدشکل = مستقیم", t?.ch === "direct");
}

// ── کوکی ─────────────────────────────────────────────────────
{
  const t = touchFor(u("/p?utm_source=sms"), null, HOST, false, 1_700_000_000_000)!;
  const back = decodeTouch(encodeTouch(t));
  check("رفت‌وبرگشت کوکی", JSON.stringify(back) === JSON.stringify({ ...t, rf: undefined, um: undefined, uc: undefined }));
  // همان چیزی که مرورگر برمی‌گرداند: Next مقدار را یک بار کدگذاری می‌کند
  const fromHeader = decodeTouch(encodeURIComponent(encodeTouch(t)));
  check("کوکی کدگذاری‌شده‌ی هدر خوانده می‌شود", fromHeader?.ch === "sms" && fromHeader.lp === "/p");
  check("کوکی خراب null می‌دهد نه خطا", decodeTouch("%7Bbad") === null && decodeTouch('{"ch":1}') === null);
  const f = orderFieldsFromTouch(back);
  check("ستون‌های سفارش", f.trafficChannel === "sms" && f.landingPath === "/p" && f.touchedAt?.getTime() === 1_700_000_000_000);
  check("بدون لمس، هیچ ستونی نوشته نمی‌شود", Object.keys(orderFieldsFromTouch(null)).length === 0);
}

// ── درخواست سند ───────────────────────────────────────────────
{
  const h = (o: Record<string, string>) => new Headers(o);
  check("ناوبری سند", isDocumentNavigation("GET", h({ "sec-fetch-dest": "document" }), "/"));
  check("درخواست RSC سند نیست", !isDocumentNavigation("GET", h({ rsc: "1", "sec-fetch-dest": "empty" }), "/"));
  check("prefetch سند نیست", !isDocumentNavigation("GET", h({ "next-router-prefetch": "1", accept: "text/html" }), "/"));
  check("پنل ادمین لمس نمی‌سازد", !isDocumentNavigation("GET", h({ "sec-fetch-dest": "document" }), "/admin/orders"));
  check("POST سند نیست", !isDocumentNavigation("POST", h({ accept: "text/html" }), "/"));
  check("مرورگر قدیمی بدون sec-fetch با accept html", isDocumentNavigation("GET", h({ accept: "text/html,*/*" }), "/mag"));
}

console.log(`\nنتیجه: ${pass} قبول · ${fail} رد`);
process.exit(fail === 0 ? 0 : 1);
