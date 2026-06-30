import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredentials, decryptCredentials } from "@/lib/integration/core/crypto";

export const dynamic = "force-dynamic";

// GET /api/integration/connections?platform=hesaban
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform");

  const connections = await prisma.integConnection.findMany({
    where:   platform ? { platformCode: platform } : undefined,
    include: { platform: { select: { name: true, type: true } } },
    orderBy: { createdAt: "desc" },
  });

  // credentials رو حذف می‌کنیم — فقط وجود/نبود اون رو برمی‌گردونیم
  return NextResponse.json(
    connections.map((c) => ({
      ...c,
      credentials: undefined,
      hasCredentials: !!c.credentials,
    })),
  );
}

// POST /api/integration/connections — ذخیره یا آپدیت اتصال
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    platformCode: string;
    credentials:  Record<string, string>;
    config?:      Record<string, unknown>;
    syncStockEnabled?: boolean;
    syncPriceEnabled?: boolean;
    syncIntervalMin?:  number;
  };

  if (!body.platformCode || !body.credentials) {
    return NextResponse.json({ error: "platformCode و credentials الزامی هستند" }, { status: 400 });
  }

  const encrypted = encryptCredentials(body.credentials);

  const existing = await prisma.integConnection.findFirst({
    where: { platformCode: body.platformCode, siteId: null },
  });

  const connection = existing
    ? await prisma.integConnection.update({
        where: { id: existing.id },
        data: {
          credentials:      encrypted,
          syncStockEnabled: body.syncStockEnabled ?? true,
          syncPriceEnabled: body.syncPriceEnabled ?? false,
          syncIntervalMin:  body.syncIntervalMin  ?? 60,
          updatedAt:        new Date(),
        },
      })
    : await prisma.integConnection.create({
        data: {
          platformCode:     body.platformCode,
          credentials:      encrypted,
          status:           "DISCONNECTED",
          syncStockEnabled: body.syncStockEnabled ?? true,
          syncPriceEnabled: body.syncPriceEnabled ?? false,
          syncIntervalMin:  body.syncIntervalMin  ?? 60,
        },
      });

  return NextResponse.json({ id: connection.id, status: connection.status });
}

// DELETE /api/integration/connections?platform=hesaban
export async function DELETE(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform");
  if (!platform) return NextResponse.json({ error: "platform الزامی است" }, { status: 400 });

  await prisma.integConnection.deleteMany({ where: { platformCode: platform } });
  return NextResponse.json({ ok: true });
}
