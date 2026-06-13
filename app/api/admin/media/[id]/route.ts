import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updated = await prisma.mediaFile.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      altText: body.altText ?? undefined,
    },
  });
  return NextResponse.json(serialize(updated));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  try {
    await unlink(path.join(process.cwd(), "public", media.url));
  } catch {}

  await prisma.mediaFile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}