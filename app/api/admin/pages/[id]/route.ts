import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePageBlocks, normalizeTemplate } from "@/lib/pages";
import { resolvePageSlug } from "@/lib/pageSlug";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const row = await prisma.page.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ message: "برگه یافت نشد" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();

  const exists = await prisma.page.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!exists) return NextResponse.json({ message: "برگه یافت نشد" }, { status: 404 });

  // به‌روزرسانی جزئی: فقط وضعیت فعال/غیرفعال یا ترتیب (سوییچ‌های لیست ادمین)
  if (body.patch === true) {
    const updated = await prisma.page.update({
      where: { id },
      data: {
        ...(typeof body.isActive    === "boolean" ? { isActive: body.isActive } : {}),
        ...(typeof body.isIndexable === "boolean" ? { isIndexable: body.isIndexable } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
      },
    });
    return NextResponse.json(updated);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ message: "عنوان برگه الزامی است" }, { status: 400 });

  const r = await resolvePageSlug(body.slug ?? exists.slug, title, id);
  if ("error" in r) return NextResponse.json({ message: r.error }, { status: 400 });

  const updated = await prisma.page.update({
    where: { id },
    data: {
      slug:           r.slug,
      title,
      subtitle:       body.subtitle?.trim() || null,
      template:       normalizeTemplate(body.template),
      contentHtml:    body.contentHtml || null,
      coverImage:     body.coverImage || null,
      blocks:         normalizePageBlocks(body.blocks) as object,
      seoTitle:       body.seoTitle?.trim() || null,
      seoDescription: body.seoDescription?.trim() || null,
      isActive:       body.isActive    ?? true,
      isIndexable:    body.isIndexable ?? true,
      showToc:        body.showToc     ?? false,
      sortOrder:      Number(body.sortOrder) || 0,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await prisma.page.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
