import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { themeConfig: true },
  });
  return NextResponse.json(settings?.themeConfig ?? {});
}

export async function PUT(req: Request) {
  const data = await req.json();
  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { themeConfig: data },
    create: { id: "singleton", themeConfig: data },
    select: { themeConfig: true },
  });
  return NextResponse.json(settings.themeConfig);
}