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