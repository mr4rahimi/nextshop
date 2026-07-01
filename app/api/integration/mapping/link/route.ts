import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — اضافه کردن لینک به mapping موجود
// body: { mappingId, platformCode, externalId, externalTitle? }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    mappingId:      string;
    platformCode:   string;
    externalId:     string;
    externalTitle?: string;
  };

  if (!body.mappingId || !body.platformCode || !body.externalId) {
    return NextResponse.json({ error: "فیلدهای الزامی وارد نشده" }, { status: 400 });
  }

  // بررسی تکراری
  const existing = await prisma.integMappingLink.findUnique({
    where: { platformCode_externalId: { platformCode: body.platformCode, externalId: body.externalId } },
  });
  if (existing) {
    return NextResponse.json({ error: "این محصول قبلاً در یک نگاشت دیگر استفاده شده" }, { status: 409 });
  }

  const existingInSameMapping = await prisma.integMappingLink.findUnique({
    where: { mappingId_platformCode: { mappingId: body.mappingId, platformCode: body.platformCode } },
  });
  if (existingInSameMapping) {
    // جایگزین کردن لینک موجود برای همین پلتفرم
    const link = await prisma.integMappingLink.update({
      where: { id: existingInSameMapping.id },
      data: {
        externalId:    body.externalId,
        externalTitle: body.externalTitle ?? null,
        isActive:      true,
        updatedAt:     new Date(),
      },
    });
    return NextResponse.json(link);
  }

  const link = await prisma.integMappingLink.create({
    data: {
      mappingId:     body.mappingId,
      platformCode:  body.platformCode,
      externalId:    body.externalId,
      externalTitle: body.externalTitle ?? null,
    },
  });

  return NextResponse.json(link, { status: 201 });
}

// DELETE — حذف یک لینک از mapping (بدون حذف کل mapping)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.integMappingLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
