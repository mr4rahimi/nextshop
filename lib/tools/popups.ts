/**
 * پاپ‌آپ سایت — ساخت و ویرایش در پنل، فهرست عمومی، شمارش و ثبت شماره.
 *
 * ⚠️ **UTM به لینک دکمه اضافه نمی‌شود:** بازدیدکننده از قبل روی سایت است و منبع
 * ورودش (کوکی `nx_src`) ثبت شده؛ UTM داخلی منبع واقعی (گوگل، اینستاگرام) را
 * با «پاپ‌آپ» بازنویسی می‌کرد. اثر پاپ‌آپ با نمایش/کلیک/ثبت شماره سنجیده می‌شود.
 *
 * ⚠️ شمارش از مرورگر می‌آید و احراز ندارد؛ عدد گزارش است نه حسابداری.
 *
 * مستندات: docs/features/tools.md بخش ۹
 */

import { prisma } from "@/lib/prisma";
import { upsertClubCustomer } from "@/lib/club/profile";
import type { Prisma, ToolPopup } from "@prisma/client";
import { ToolError } from "./common";
import {
  DEVICES, FREQUENCIES, PAGES, POSITIONS, TRIGGERS,
  cleanPaths, contentVersion, pick, safeAccent, sanitizeContent,
  type PopupPublic,
} from "./popup-rules";

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** «YYYY-MM-DDTHH:mm» به وقت تهران (خروجی `JalaliDatePicker` حالت datetime) */
function tehranDateTime(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+03:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toTehranInput(d: Date | null): string {
  if (!d) return "";
  const t = new Date(d.getTime() + 3.5 * 3_600_000);
  return t.toISOString().slice(0, 16);
}

export function serializePopup(p: ToolPopup) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    isActive: p.isActive,
    priority: p.priority,
    content: sanitizeContent(p.content),
    trigger: pick(p.trigger, TRIGGERS, "DELAY"),
    triggerValue: p.triggerValue,
    pages: pick(p.pages, PAGES, "ALL"),
    paths: p.paths,
    device: pick(p.device, DEVICES, "ALL"),
    frequency: pick(p.frequency, FREQUENCIES, "DAY"),
    position: pick(p.position, POSITIONS, "AUTO"),
    accent: safeAccent(p.accent),
    startsAt: toTehranInput(p.startsAt),
    endsAt: toTehranInput(p.endsAt),
    viewCount: p.viewCount,
    clickCount: p.clickCount,
    closeCount: p.closeCount,
    leadCount: p.leadCount,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type PopupAdmin = ReturnType<typeof serializePopup>;

async function parseInput(input: Record<string, unknown>) {
  const kind = input.kind === "LEAD" ? "LEAD" : "ANNOUNCE";
  const content = sanitizeContent(input.content);
  const trigger = pick(input.trigger, TRIGGERS, "DELAY");
  const startsAt = tehranDateTime(input.startsAt);
  const endsAt = tehranDateTime(input.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) throw new ToolError("پایان نمایش باید بعد از شروعش باشد");
  const pages = pick(input.pages, PAGES, "ALL");
  const paths = cleanPaths(input.paths);
  if (pages === "CUSTOM" && paths.length === 0) throw new ToolError("برای «صفحه‌های مشخص» دست‌کم یک مسیر بنویسید، مثل /products/iphone");

  const isActive = input.isActive === true;
  if (isActive) {
    if (!content.heading && !content.body && !content.imageUrl) throw new ToolError("پاپ‌آپ خالی است — عنوان، متن یا عکس بگذارید");
    if (kind === "ANNOUNCE" && content.buttonText && !content.buttonUrl) throw new ToolError("دکمه لینک ندارد — آدرس دکمه را بنویسید یا متن دکمه را خالی کنید");
  }
  if (kind === "LEAD" && content.couponCode) {
    const c = await prisma.coupon.findUnique({ where: { code: content.couponCode }, select: { isActive: true, userId: true, expiresAt: true } });
    if (!c) throw new ToolError(`کد تخفیف ${content.couponCode} در «کدهای تخفیف» باشگاه وجود ندارد`);
    if (c.userId) throw new ToolError("این کد شخصی است و برای همه کار نمی‌کند — یک کد عمومی بسازید");
    if (isActive && (!c.isActive || (c.expiresAt && c.expiresAt < new Date()))) throw new ToolError("کد تخفیف غیرفعال یا منقضی است");
  }

  return {
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 80) : "پاپ‌آپ بی‌نام",
    kind,
    isActive,
    priority: clampInt(input.priority, -100, 100, 0),
    content: content as unknown as Prisma.InputJsonValue,
    trigger,
    triggerValue: trigger === "SCROLL" ? clampInt(input.triggerValue, 5, 100, 40) : trigger === "DELAY" ? clampInt(input.triggerValue, 0, 600, 8) : 0,
    pages,
    paths,
    device: pick(input.device, DEVICES, "ALL"),
    frequency: pick(input.frequency, FREQUENCIES, "DAY"),
    position: pick(input.position, POSITIONS, "AUTO"),
    accent: safeAccent(input.accent),
    startsAt,
    endsAt,
  } as const;
}

export async function listPopups() {
  const rows = await prisma.toolPopup.findMany({ where: { deletedAt: null }, orderBy: [{ isActive: "desc" }, { priority: "desc" }, { updatedAt: "desc" }] });
  return rows.map(serializePopup);
}

export async function createPopup(input: Record<string, unknown>) {
  const data = await parseInput({ ...input, isActive: false });
  return serializePopup(await prisma.toolPopup.create({ data }));
}

export async function updatePopup(id: string, input: Record<string, unknown>) {
  const prev = await prisma.toolPopup.findFirst({ where: { id, deletedAt: null } });
  if (!prev) throw new ToolError("پاپ‌آپ پیدا نشد", 404);
  const data = await parseInput(input);
  return serializePopup(await prisma.toolPopup.update({ where: { id }, data }));
}

export async function deletePopup(id: string) {
  const r = await prisma.toolPopup.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
  if (r.count !== 1) throw new ToolError("پاپ‌آپ پیدا نشد", 404);
}

export async function popupLeads(id: string, take = 200) {
  const rows = await prisma.popupLead.findMany({ where: { popupId: id }, orderBy: { createdAt: "desc" }, take });
  return rows.map((l) => ({ id: l.id, phone: l.phone, consent: l.consent, createdAt: l.createdAt.toISOString() }));
}

// ─── عمومی ───────────────────────────────────────────────────────────────

/** پاپ‌آپ‌های روشنِ داخل بازه — تطبیق صفحه، دستگاه و دفعات در مرورگر */
export async function publicPopups(now = new Date()): Promise<PopupPublic[]> {
  const rows = await prisma.toolPopup.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: new Date(now.getTime() + 86_400_000) } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { priority: "desc" },
    take: 20,
  });
  return rows.map((p) => {
    const content = sanitizeContent(p.content);
    // کد تخفیف فقط بعد از ثبت شماره از سرور می‌آید، نه در فهرست عمومی
    const publicContent = { ...content, couponCode: content.couponCode ? "1" : "" };
    return {
      id: p.id,
      kind: p.kind,
      priority: p.priority,
      content: publicContent,
      trigger: pick(p.trigger, TRIGGERS, "DELAY"),
      triggerValue: p.triggerValue,
      pages: pick(p.pages, PAGES, "ALL"),
      paths: p.paths,
      device: pick(p.device, DEVICES, "ALL"),
      frequency: pick(p.frequency, FREQUENCIES, "DAY"),
      position: pick(p.position, POSITIONS, "AUTO"),
      accent: safeAccent(p.accent),
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      version: contentVersion(content, p.kind),
    };
  });
}

const EVENT_FIELD = { view: "viewCount", click: "clickCount", close: "closeCount" } as const;

export async function recordPopupEvent(id: unknown, type: unknown) {
  if (typeof id !== "string" || typeof type !== "string" || !(type in EVENT_FIELD)) return;
  const field = EVENT_FIELD[type as keyof typeof EVENT_FIELD];
  await prisma.toolPopup.updateMany({ where: { id, isActive: true, deletedAt: null }, data: { [field]: { increment: 1 } } });
}

const RATE_WINDOW_MS = 60 * 60_000;
const RATE_MAX = 5;
const rate = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rate.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rate.set(key, hits);
    return true;
  }
  hits.push(now);
  rate.set(key, hits);
  if (rate.size > 5000) rate.clear();
  return false;
}

/**
 * ثبت شماره در پاپ‌آپ LEAD. کد تخفیف همین‌جا برمی‌گردد (نه در فهرست عمومی).
 * عضویت باشگاه فقط وقتی باشگاه روشن است؛ رضایت پیامک فقط با تیک صریح.
 */
export async function submitPopupLead(
  input: { popupId?: unknown; phone?: unknown; consent?: unknown; website?: unknown },
  ctx: { ip: string | null },
): Promise<{ couponCode: string | null; successText: string }> {
  if (typeof input.website === "string" && input.website.trim()) return { couponCode: null, successText: "" };
  const id = typeof input.popupId === "string" ? input.popupId : "";
  const p = await prisma.toolPopup.findFirst({ where: { id, isActive: true, deletedAt: null, kind: "LEAD" } });
  if (!p) throw new ToolError("این فرم دیگر فعال نیست");
  const phone = (typeof input.phone === "string" ? input.phone : "")
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[^\d]/g, "")
    .replace(/^98/, "0");
  if (!/^09\d{9}$/.test(phone)) throw new ToolError("شماره موبایل معتبر نیست — مثل ۰۹۱۲۱۲۳۴۵۶۷");
  if (rateLimited(ctx.ip ?? "unknown")) throw new ToolError("درخواست‌های زیادی فرستاده‌اید؛ کمی بعد دوباره تلاش کنید");

  const content = sanitizeContent(p.content);
  const consent = input.consent === true && !!content.consentText;

  let userId: string | null = null;
  const store = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { clubEnabled: true } });
  if (store?.clubEnabled) {
    try {
      const r = await upsertClubCustomer({ phone, source: "ONLINE", sourcePlatform: "popup", smsConsent: consent, consentIp: ctx.ip });
      userId = r.userId;
    } catch (e) {
      console.error("[popup-lead] عضویت باشگاه ناموفق:", e);
    }
  }

  const existing = await prisma.popupLead.findUnique({ where: { popupId_phone: { popupId: p.id, phone } }, select: { id: true, consent: true } });
  if (existing) {
    if (consent && !existing.consent) await prisma.popupLead.update({ where: { id: existing.id }, data: { consent: true } });
  } else {
    await prisma.popupLead.create({ data: { popupId: p.id, phone, userId, consent } });
    await prisma.toolPopup.update({ where: { id: p.id }, data: { leadCount: { increment: 1 } } });
  }
  return { couponCode: content.couponCode || null, successText: content.successText };
}
