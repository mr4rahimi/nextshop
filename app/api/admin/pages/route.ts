import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePageBlocks, normalizeTemplate } from "@/lib/pages";
import { resolvePageSlug } from "@/lib/pageSlug";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.page.findMany({
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true, slug: true, title: true, subtitle: true, template: true,
      isActive: true, isIndexable: true, sortOrder: true, updatedAt: true,
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ message: "عنوان برگه الزامی است" }, { status: 400 });

  const r = await resolvePageSlug(body.slug ?? "", title);
  if ("error" in r) return NextResponse.json({ message: r.error }, { status: 400 });

  const created = await prisma.page.create({
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
  return NextResponse.json(created, { status: 201 });
}
