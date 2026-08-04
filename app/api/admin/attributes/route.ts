import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isValidSlug } from "@/lib/slug";

export async function GET() {
  const attributes = await prisma.attribute.findMany({
    include: {
      values: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      group: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json(attributes);
}

export async function POST(req: Request) {
  const body = await req.json();

  const attribute = await prisma.attribute.create({
    data: {
      groupId: body.groupId,
      title: body.title,
      slug: body.slug,
      isFilterable: body.isFilterable ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  return NextResponse.json(attribute);
}

export async function PUT(req: Request) {
  const { id, force, ...data } = await req.json();

  if (data.slug !== undefined) {
    if (!isValidSlug(data.slug)) {
      return NextResponse.json(
        { message: "نشانی نامعتبر است — باید انگلیسی، حروف کوچک و خط تیره باشد" },
        { status: 400 }
      );
    }

    const current = await prisma.attribute.findUnique({
      where: { id },
      select: { slug: true },
    });

    if (current && current.slug !== data.slug && !force) {
      const all = await prisma.landingPage.findMany({
        select: { slug: true, h1: true, filters: true },
      });
      const affected = all.filter(lp =>
        Object.keys((lp.filters ?? {}) as Record<string, string>).includes(current.slug)
      );
      if (affected.length > 0) {
        return NextResponse.json({
          message:
            `این ویژگی در ${affected.length} صفحه فرود استفاده شده و تغییر نشانی، آن‌ها را می‌شکند: ` +
            affected.map(a => a.h1).join("، "),
          affected: affected.map(a => ({ slug: a.slug, h1: a.h1 })),
          needsForce: true,
        }, { status: 409 });
      }
    }
  }

  const attribute = await prisma.attribute.update({ where: { id }, data });
  return NextResponse.json(attribute);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  await prisma.attribute.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
  });
}