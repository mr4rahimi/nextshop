import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivityAsync, diffFields, summarizeChanges } from "@/lib/activity";

/** فیلدهای برند که تغییرشان در گزارش ثبت می‌شود */
const BRAND_FIELDS = {
  title:          { label: "عنوان" },
  slug:           { label: "نشانی (slug)" },
  logoUrl:        { label: "لوگو", kind: "image" as const },
  description:    { label: "توضیحات" },
  seoTitle:       { label: "عنوان سئو" },
  seoDescription: { label: "توضیح سئو" },
  isActive:       { label: "وضعیت نمایش", kind: "bool" as const },
};



// GET
export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(brands);
}

// POST
export async function POST(req: Request) {
  const data = await req.json();

  const brand = await prisma.brand.create({
    data,
  });

  logActivityAsync({
    action: "CREATE",
    entity: "BRAND",
    entityId: brand.id,
    entityTitle: brand.title,
    summary: `برند «${brand.title}» ایجاد شد`,
    changes: [{ field: "logoUrl", label: "لوگو", kind: "image", before: null, after: brand.logoUrl }],
  });

  return NextResponse.json(brand);
}

// PUT
export async function PUT(req: Request) {
  const data = await req.json();

  const before = await prisma.brand.findUnique({ where: { id: data.id } });

  const brand = await prisma.brand.update({
    where: { id: data.id },
    data: {
      title: data.title,
      slug: data.slug,
      logoUrl: data.logoUrl || null,
      description: data.description || null,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      seoKeywords: data.seoKeywords || null,
      isActive: data.isActive,
    },
  });

  if (before) {
    const changes = diffFields(before as never, data, BRAND_FIELDS);
    if (changes.length > 0) {
      logActivityAsync({
        action: "UPDATE",
        entity: "BRAND",
        entityId: brand.id,
        entityTitle: brand.title,
        summary: summarizeChanges(changes),
        changes,
      });
    }
  }

  return NextResponse.json(brand);
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();

  const before = await prisma.brand.findUnique({ where: { id } });

  await prisma.brand.delete({
    where: { id },
  });

  logActivityAsync({
    action: "DELETE",
    entity: "BRAND",
    entityId: id,
    entityTitle: before?.title ?? id,
    summary: `برند «${before?.title ?? id}» حذف شد`,
    changes: [{ field: "logoUrl", label: "لوگو", kind: "image", before: before?.logoUrl ?? null, after: null }],
  });

  return NextResponse.json({ success: true });
}