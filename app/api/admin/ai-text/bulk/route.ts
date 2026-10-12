import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getAiSettings } from "@/lib/ai/settings";
import { startBulkTextJob, runningTextJobs } from "@/lib/ai/text-jobs";
import { AI_TEXT_SECTIONS, type AiTextSection } from "@/lib/ai/text-presets";

export const runtime = "nodejs";

/**
 * تولید گروهی متن محصول — docs/features/ai-product-text.md
 *
 * GET  ?missing=any|expert|short|seo|faq&categoryId=&q=  → محصولاتی که متن ندارند
 * POST { productIds, sections, retitle } → کار گروهی؛ فقط بخش‌های خالی پر می‌شوند
 */

const MAX_BULK = 100;
const SECTION_VALUES = new Set(AI_TEXT_SECTIONS.map(s => s.value));
const blank = (f: "expertDescription" | "shortDescription" | "seoDescription"): Prisma.ProductWhereInput[] =>
  [{ [f]: null }, { [f]: "" }];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const missing = url.searchParams.get("missing") || "any";
  const categoryId = url.searchParams.get("categoryId") || "";
  const q = url.searchParams.get("q")?.trim() || "";

  const conds: Record<string, Prisma.ProductWhereInput[]> = {
    expert: blank("expertDescription"),
    short: blank("shortDescription"),
    seo: blank("seoDescription"),
    faq: [{ faq: { equals: [] } }],
  };
  const or = missing === "any" ? Object.values(conds).flat() : missing === "all" ? undefined : conds[missing];

  const where: Prisma.ProductWhereInput = {
    ...(or && { OR: or }),
    ...(categoryId && { categoryId }),
    ...(q && { title: { contains: q, mode: "insensitive" } }),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true, title: true, mainImage: true, isActive: true,
        shortDescription: true, expertDescription: true, seoDescription: true, faq: true,
        category: { select: { title: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return NextResponse.json({
    total,
    products: products.map(p => ({
      id: p.id, title: p.title, mainImage: p.mainImage, isActive: p.isActive, category: p.category?.title ?? "",
      has: {
        short: !!p.shortDescription?.trim(),
        expert: !!p.expertDescription?.trim(),
        seo: !!p.seoDescription?.trim(),
        faq: Array.isArray(p.faq) && p.faq.length > 0,
      },
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const s = await getAiSettings();
  if (!s.apiKey) return NextResponse.json({ error: "کلید GapGPT تنظیم نشده. از «تنظیمات هوش مصنوعی» کلید را وارد کنید." }, { status: 400 });

  let body: { productIds?: unknown; sections?: unknown; retitle?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const ids = [...new Set(Array.isArray(body.productIds) ? body.productIds.filter((x): x is string => typeof x === "string") : [])];
  if (!ids.length) return NextResponse.json({ error: "محصولی انتخاب نشده." }, { status: 400 });
  if (ids.length > MAX_BULK) return NextResponse.json({ error: `هر بار حداکثر ${MAX_BULK} محصول.` }, { status: 400 });
  const sections = (Array.isArray(body.sections) ? body.sections : []).filter((x): x is AiTextSection => SECTION_VALUES.has(x as AiTextSection));
  if (!sections.length) return NextResponse.json({ error: "دست‌کم یک بخش را انتخاب کنید." }, { status: 400 });

  // چند تا هم‌زمان: ساخت پشت‌سرهم چند محصول از انبار هر کدام یک کار تک‌محصولی می‌سازد
  if (runningTextJobs(user.id, "bulk") >= 3) {
    return NextResponse.json({ error: "چند تولید گروهی در جریان است. صبر کنید تمام شوند یا لغوشان کنید." }, { status: 429 });
  }
  const job = startBulkTextJob({
    userId: user.id,
    actor: { id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone || "بدون نام", phone: user.phone ?? null },
    productIds: ids,
    options: { sections, retitle: body.retitle === true },
  });
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
