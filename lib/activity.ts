import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActivityAction, ActivityEntity } from "@prisma/client";

export type { ActivityAction, ActivityEntity };

/** یک فیلد تغییرکرده — همان چیزی که در گزارش «قبل ← بعد» نشان داده می‌شود */
export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  /** برای رندر درست در رابط کاربری: تصویر، فهرست تصاویر، قیمت، بولین یا متن */
  kind?: "image" | "images" | "price" | "bool" | "text";
}

interface LogInput {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  entityTitle?: string | null;
  summary?: string | null;
  changes?: FieldChange[] | null;
  /** وقتی کوکی هنوز خوانده نمی‌شود (مثلاً خودِ لحظه‌ی ورود) دستی پاس داده می‌شود */
  actor?: { id: string | null; name: string; phone?: string | null };
}

/** ادمینِ درخواست جاری — اگر پیدا نشد، رکورد با نام «نامشخص» ثبت می‌شود */
async function resolveActor() {
  try {
    const user = await getAuthUser();
    if (!user) return { actorId: null, actorName: "نامشخص", actorPhone: null };
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return {
      actorId: user.id,
      actorName: name || user.phone || "بدون نام",
      actorPhone: user.phone ?? null,
    };
  } catch {
    return { actorId: null, actorName: "نامشخص", actorPhone: null };
  }
}

async function resolveIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
  } catch {
    return null;
  }
}

/**
 * ثبت یک فعالیت ادمین.
 *
 * **هیچ‌وقت خطا پرتاب نمی‌کند.** گزارش‌گیری نباید بتواند عملیات اصلی
 * (ذخیره‌ی محصول، آپلود عکس) را بشکند؛ اگر ثبت لاگ شکست بخورد فقط در
 * کنسول گزارش می‌شود.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    const [resolved, ip] = await Promise.all([
      input.actor
        ? Promise.resolve({ actorId: input.actor.id, actorName: input.actor.name, actorPhone: input.actor.phone ?? null })
        : resolveActor(),
      resolveIp(),
    ]);
    const actor = resolved;
    await prisma.activityLog.create({
      data: {
        ...actor,
        ip,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        entityTitle: input.entityTitle ?? null,
        summary: input.summary ?? null,
        changes: (input.changes as never) ?? undefined,
      },
    });
  } catch (e: any) {
    console.error("[activity] ثبت فعالیت شکست خورد:", e?.message);
  }
}

/** نسخه‌ی fire-and-forget — پاسخ API را معطل نمی‌کند */
export function logActivityAsync(input: LogInput): void {
  void logActivity(input);
}

// ─── محاسبه‌ی تفاوت ──────────────────────────────────────────────────────────

type FieldSpec = { label: string; kind?: FieldChange["kind"] };

/** فیلدهایی از محصول که تغییرشان برای گزارش معنا دارد */
export const PRODUCT_FIELDS: Record<string, FieldSpec> = {
  title:            { label: "عنوان" },
  slug:             { label: "نشانی (slug)" },
  mainImage:        { label: "تصویر اصلی", kind: "image" },
  images:           { label: "گالری تصاویر", kind: "images" },
  price:            { label: "قیمت", kind: "price" },
  salePrice:        { label: "قیمت تخفیف‌خورده", kind: "price" },
  stock:            { label: "موجودی" },
  isActive:         { label: "وضعیت نمایش", kind: "bool" },
  categoryId:       { label: "دسته‌بندی" },
  brandId:          { label: "برند" },
  shortDescription: { label: "توضیح کوتاه" },
  expertDescription:{ label: "توضیح کارشناسی" },
  seoTitle:         { label: "عنوان سئو" },
  seoDescription:   { label: "توضیح سئو" },
  sku:              { label: "کد کالا (SKU)" },
  warranty:         { label: "گارانتی" },
  videoUrl:         { label: "لینک ویدیو" },
  specsCount:       { label: "تعداد مشخصات فنی" },
};

/** مقایسه‌ی امن دو مقدار — BigInt، آرایه و null را درست هندل می‌کند */
function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "bigint") return v.toString();
    if (Array.isArray(v)) return JSON.stringify(v);
    return v;
  };
  const na = norm(a), nb = norm(b);
  if (typeof na === "object" || typeof nb === "object") return JSON.stringify(na) === JSON.stringify(nb);
  return na === nb;
}

/** مقدار قابل ذخیره در JSON (BigInt سریالایز نمی‌شود) */
function jsonSafe(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v === undefined) return null;
  return v;
}

/**
 * فقط فیلدهایی را برمی‌گرداند که واقعاً عوض شده‌اند.
 * فیلدی که در `after` نیامده (undefined) تغییر حساب نمی‌شود.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  spec: Record<string, FieldSpec> = PRODUCT_FIELDS,
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of Object.keys(spec)) {
    if (!(field in after) || after[field] === undefined) continue;
    if (sameValue(before[field], after[field])) continue;
    out.push({
      field,
      label: spec[field].label,
      kind: spec[field].kind,
      before: jsonSafe(before[field]),
      after: jsonSafe(after[field]),
    });
  }
  return out;
}

/** خلاصه‌ی فارسی از فهرست تغییرات، برای ستون «شرح» در گزارش */
export function summarizeChanges(changes: FieldChange[]): string {
  if (changes.length === 0) return "بدون تغییر مؤثر";
  const labels = changes.map((c) => c.label);
  if (labels.length <= 3) return labels.join("، ") + " تغییر کرد";
  return `${labels.slice(0, 3).join("، ")} و ${labels.length - 3} مورد دیگر تغییر کرد`;
}
