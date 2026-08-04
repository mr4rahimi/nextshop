import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidSlug, slugify } from "@/lib/slug";
import { validateFilters } from "@/lib/landing-pages";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await prisma.landingPage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: "یافت نشد" }, { status: 404 });

  const data: any = {};
  for (const k of ["title", "h1", "description", "intro", "bodyHtml", "isActive", "isIndexable", "sortOrder", "categoryId"]) {
    if (body[k] !== undefined) data[k] = body[k];
  }

  if (body.filters !== undefined) {
    const check = await validateFilters(body.filters);
    if (!check.ok) return NextResponse.json({ message: check.errors.join("، ") }, { status: 400 });
    data.filters = body.filters;
  }

  if (body.slug !== undefined && body.slug !== existing.slug) {
    const s = slugify(body.slug);
    if (!isValidSlug(s)) return NextResponse.json({ message: "نشانی نامعتبر" }, { status: 400 });
    const clash = await prisma.landingPage.findUnique({ where: { slug: s } });
    if (clash) return NextResponse.json({ message: "این نشانی قبلاً استفاده شده" }, { status: 400 });
    data.slug = s;
  }

  const updated = await prisma.landingPage.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.landingPage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}