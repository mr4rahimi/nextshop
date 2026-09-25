/**
 * ثابت‌های لینک‌سازی خارجی — برچسب‌ها، رنگ‌ها، بازه‌ی انکر، گردش کار گره.
 *
 * بدون `use client` و بدون آیکن، تا هم سرور و هم کلاینت از آن استفاده کنند.
 * نگاشت آیکن‌های lucide در `components/admin/marketing/link-icons.ts` است.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۷
 */

import type {
  LinkAnchorKind,
  LinkCampaignStatus,
  LinkContentKind,
  LinkNodeStatus,
} from "@prisma/client";

export type { LinkAnchorKind, LinkCampaignStatus, LinkContentKind, LinkNodeStatus };

export const NODE_STATUS_LABELS: Record<LinkNodeStatus, string> = {
  PLANNED: "برنامه‌ریزی‌شده",
  ASSIGNED: "واگذارشده",
  IN_PROGRESS: "در حال انجام",
  SUBMITTED: "ثبت شد، منتظر تأیید",
  LIVE: "فعال",
  FAILED: "شکست‌خورده",
  LOST: "ازدست‌رفته",
};

export const NODE_STATUSES = Object.keys(NODE_STATUS_LABELS) as LinkNodeStatus[];

/**
 * رنگ وضعیت در جدول و کارت — کلاس Tailwind.
 *
 * ⚠️ تله‌ی ۷: همین تصمیم در `NODE_STATUS_SVG` برای بوم هم تعریف شده، چون
 * SVG رنگ مستقیم لازم دارد. **هر دو با هم عوض می‌شوند.**
 */
export const NODE_STATUS_TONES: Record<LinkNodeStatus, string> = {
  PLANNED: "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300",
  ASSIGNED: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  IN_PROGRESS: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  SUBMITTED: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LIVE: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  LOST: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
};

/** همان تصمیمِ `NODE_STATUS_TONES` برای SVG بوم — `fill` نیمه‌شفاف تا روی هر دو تم بنشیند */
export const NODE_STATUS_SVG: Record<LinkNodeStatus, { fill: string; stroke: string; key: string }> = {
  PLANNED: { fill: "rgba(148,163,184,0.16)", stroke: "#94a3b8", key: "planned" },
  ASSIGNED: { fill: "rgba(59,130,246,0.14)", stroke: "#3b82f6", key: "progress" },
  IN_PROGRESS: { fill: "rgba(59,130,246,0.14)", stroke: "#3b82f6", key: "progress" },
  SUBMITTED: { fill: "rgba(245,158,11,0.16)", stroke: "#f59e0b", key: "pending" },
  LIVE: { fill: "rgba(16,185,129,0.15)", stroke: "#10b981", key: "live" },
  FAILED: { fill: "rgba(239,68,68,0.14)", stroke: "#ef4444", key: "failed" },
  LOST: { fill: "rgba(239,68,68,0.14)", stroke: "#ef4444", key: "failed" },
};

export const CAMPAIGN_STATUS_LABELS: Record<LinkCampaignStatus, string> = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "فعال",
  PAUSED: "متوقف",
  DONE: "تمام‌شده",
};

export const CAMPAIGN_STATUS_TONES: Record<LinkCampaignStatus, string> = {
  DRAFT: "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300",
  ACTIVE: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PAUSED: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DONE: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export const ANCHOR_KIND_LABELS: Record<LinkAnchorKind, string> = {
  EXACT: "تطابق دقیق",
  PARTIAL: "تطابق جزئی",
  BRAND: "برند",
  BRAND_KEYWORD: "برند + کلمه",
  NAKED_URL: "آدرس خام",
  GENERIC: "عمومی",
  IMAGE: "تصویری",
};

export const ANCHOR_KIND_EXAMPLES: Record<LinkAnchorKind, string> = {
  EXACT: "خرید پرینتر لیزری",
  PARTIAL: "راهنمای خرید پرینتر لیزری برای دفتر",
  BRAND: "نام فروشگاه",
  BRAND_KEYWORD: "پرینترهای فروشگاه …",
  NAKED_URL: "example.com",
  GENERIC: "اینجا · بیشتر بخوانید",
  IMAGE: "لینک روی تصویر (انکر همان alt است)",
};

export const ANCHOR_KINDS = Object.keys(ANCHOR_KIND_LABELS) as LinkAnchorKind[];

export const CONTENT_KIND_LABELS: Record<LinkContentKind, string> = {
  NONE: "بدون محتوا",
  TEXT: "متن",
  IMAGE: "تصویر",
  VIDEO: "ویدئو",
  AUDIO: "صدا",
};

export const CONTENT_KINDS = Object.keys(CONTENT_KIND_LABELS) as LinkContentKind[];

/**
 * بازه‌ی سالم توزیع انکر — **فروشگاه اینترنتی** (بخش ۷.۴)، نه «خدمات محلی»
 * برتر. عدد تطابق دقیق خیلی کوچک‌تر از چیزی است که شهود می‌گوید.
 *
 * کلید `anchorProfile` کمپین به این جدول اشاره می‌کند تا روزی نوع کسب‌وکار
 * دیگری بازه‌ی خودش را بگیرد.
 */
export const ANCHOR_PROFILES: Record<string, Partial<Record<LinkAnchorKind, [number, number]>>> = {
  ECOMMERCE: {
    BRAND: [40, 55],
    GENERIC: [15, 20],
    NAKED_URL: [10, 15],
    PARTIAL: [10, 15],
    EXACT: [5, 10],
  },
  LOCAL_SERVICE: {
    BRAND: [45, 60],
    GENERIC: [15, 20],
    NAKED_URL: [10, 15],
    EXACT: [5, 10],
    PARTIAL: [5, 10],
  },
};

export const ANCHOR_PROFILE_LABELS: Record<string, string> = {
  ECOMMERCE: "فروشگاه اینترنتی",
  LOCAL_SERVICE: "خدمات محلی",
};

export function anchorRanges(profile: string | null | undefined) {
  return ANCHOR_PROFILES[profile ?? "ECOMMERCE"] ?? ANCHOR_PROFILES.ECOMMERCE;
}

/** rel همان‌طور که در تگ a می‌نشیند — کارمند باید دقیقاً همین را بگذارد */
export function relOf(node: { relFollow: boolean; relUgc: boolean; relSponsored: boolean }) {
  const parts: string[] = [];
  if (!node.relFollow) parts.push("nofollow");
  if (node.relUgc) parts.push("ugc");
  if (node.relSponsored) parts.push("sponsored");
  return parts.length > 0 ? parts.join(" ") : "follow";
}

// ─────────────────────────────────────────────────────────────────
// گردش کار گره — بخش ۷.۵
// ─────────────────────────────────────────────────────────────────

export const NODE_ACTIONS = [
  "assign",
  "start",
  "submit",
  "approve",
  "return",
  "fail",
  "lost",
  "reopen",
] as const;
export type NodeAction = (typeof NODE_ACTIONS)[number];

export const NODE_ALLOWED_FROM: Record<NodeAction, LinkNodeStatus[]> = {
  assign: ["PLANNED", "ASSIGNED", "IN_PROGRESS"],
  start: ["ASSIGNED"],
  submit: ["IN_PROGRESS"],
  approve: ["SUBMITTED"],
  return: ["SUBMITTED"],
  fail: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
  lost: ["LIVE"],
  reopen: ["FAILED", "LOST"],
};

/** کنش‌های مدیر لینک‌سازی (`LINK_MANAGE`) */
export const NODE_MANAGER_ACTIONS: NodeAction[] = ["assign", "approve", "return", "lost", "reopen"];
