import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidSlug, slugify } from "@/lib/slug";
import { validateFilters } from "@/lib/landing-pages";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.landingPage.findMany({
    include: { category: { select: { title: true, slug: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { categoryId, filters, title, h1, description, intro, bodyHtml, isActive, isIndexable, sortOrder } = body;

  if (!categoryId || !title || !h1 || !description) {
    return NextResponse.json({ message: "دسته‌بندی، عنوان، H1 و توضیحات الزامی است" }, { status: 400 });
  }

  const f = (filters ?? {}) as Record<string, string>;
  if (Object.keys(f).length === 0) {
    return NextResponse.json({ message: "حداقل یک فیلتر لازم است" }, { status: 400 });
  }

  const check = await validateFilters(f);
  if (!check.ok) return NextResponse.json({ message: check.errors.join("، ") }, { status: 400 });

  const slug = body.slug ? slugify(body.slug) : slugify(h1);
  if (!isValidSlug(slug)) {
    return NextResponse.json({ message: "نشانی صفحه نامعتبر است" }, { status: 400 });
  }

  let final = slug, n = 2;
  while (await prisma.landingPage.findUnique({ where: { slug: final } })) final = `${slug}-${n++}`;

  const created = await prisma.landingPage.create({
    data: {
      slug: final, categoryId, filters: f, title, h1, description,
      intro: intro || null, bodyHtml: bodyHtml || null,
      isActive: isActive ?? true, isIndexable: isIndexable ?? true,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json(created);
}