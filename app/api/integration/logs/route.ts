import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/logs?platform=basalam&status=ERROR&type=SYNC_ALL_STOCK&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const platform = searchParams.get("platform") ?? undefined;
  const status   = searchParams.get("status")   ?? undefined;
  const type     = searchParams.get("type")     ?? undefined;
  const page     = Math.max(1, Number(searchParams.get("page") ?? 1));
  const take     = 40;

  const where = {
    ...(platform && { platformCode:   platform }),
    ...(status   && { status:         status   as "SUCCESS" | "ERROR" | "PARTIAL" }),
    ...(type     && { operationType:  type     as "SYNC_STOCK" | "SYNC_PRICE" | "SYNC_ALL_STOCK" | "SYNC_ALL_PRICE" | "FETCH_PRODUCTS" | "CREATE_PRODUCT" | "TEST_CONNECTION" }),
  };

  const [logs, total] = await Promise.all([
    prisma.integLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip:    (page - 1) * take,
      include: { platform: { select: { name: true } } },
    }),
    prisma.integLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / take) });
}
