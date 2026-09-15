import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * دسته‌های مشتری (ارگانی، تهران، شهرستان…).
 *
 * خواندن برای هر کسی که مشتری می‌بیند؛ غیرفعال‌ها فقط با `all=1` برای مدیر دسته.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["CUSTOMER_VIEW_OWN", "CUSTOMER_VIEW_ALL", "CUSTOMER_CATEGORY_MANAGE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const manage = can(guard.access, "CUSTOMER_CATEGORY_MANAGE");
  const all = manage && new URL(req.url).searchParams.get("all") === "1";

  const categories = await prisma.clubCustomerCategory.findMany({
    where: all ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true, slug: true, title: true, color: true, sortOrder: true, isActive: true,
      _count: { select: { profiles: true } },
    },
  });
  return NextResponse.json({ categories, can: { manage } });
}

export async function POST(req: Request) {
  const guard = await requirePermission("CUSTOMER_CATEGORY_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 60) : "";
  if (!title) return NextResponse.json({ error: "عنوان دسته لازم است" }, { status: 400 });

  const base = slugify(title) || "category";
  const count = await prisma.clubCustomerCategory.count();
  try {
    const category = await prisma.clubCustomerCategory.create({
      data: {
        title,
        // نامک یکتا؛ برخورد با پسوند عددی حل می‌شود
        slug: (await prisma.clubCustomerCategory.findUnique({ where: { slug: base } })) ? `${base}-${Date.now().toString(36)}` : base,
        color: typeof body?.color === "string" ? body.color.slice(0, 20) : null,
        sortOrder: count,
      },
    });
    logActivityAsync({
      action: "CREATE",
      entity: "SETTINGS",
      entityId: category.id,
      entityTitle: category.title,
      summary: `ساخت دسته‌ی مشتری «${category.title}»`,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    console.error("[club] ساخت دسته شکست خورد:", e);
    return NextResponse.json({ error: "ساخت دسته ناموفق بود" }, { status: 500 });
  }
}
