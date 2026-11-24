import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStockSource } from "@/lib/integration/core/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/integration/inventory/resync
 *
 * منبع حسابان: موجودی از حسابان خوانده و به سایت و بازارگاه‌ها ارسال می‌شود.
 * منبع داخلی یا سایت: موجودی فعلی محصولات سایت به همه‌ی بازارگاه‌های متصل ارسال
 * می‌شود (یک کار SYNC_ALL_STOCK برای هر بازارگاه). docs/integrations/settings-and-guide.md
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { platformCode?: string };
  const source = await getStockSource();

  if (source === "hesaban" && !body.platformCode) body.platformCode = "hesaban";

  if (body.platformCode) {
    const platformCode = body.platformCode;
    const connection = await prisma.integConnection.findFirst({
      where: { platformCode, status: { in: ["CONNECTED", "SYNCING"] }, platform: { isActive: true } },
    });
    if (!connection) return NextResponse.json({ error: "اتصال این سرویس برقرار نیست" }, { status: 400 });

    const existing = await prisma.integJob.findFirst({
      where: { platformCode, type: "SYNC_ALL_STOCK", status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (existing) return NextResponse.json({ jobId: existing.id, alreadyRunning: true, jobs: 1 });

    const job = await prisma.integJob.create({
      data: { platformCode, type: "SYNC_ALL_STOCK", payload: {}, priority: 1, status: "PENDING" },
    });
    return NextResponse.json({ jobId: job.id, jobs: 1 });
  }

  // ارسال موجودی سایت به همه‌ی بازارگاه‌های متصل
  const conns = await prisma.integConnection.findMany({
    where: { status: { in: ["CONNECTED", "SYNCING"] }, platform: { isActive: true, type: "MARKETPLACE" } },
    select: { platformCode: true },
  });
  if (!conns.length) return NextResponse.json({ error: "هیچ بازارگاه متصلی نیست" }, { status: 400 });

  let jobs = 0;
  for (const c of conns) {
    const busy = await prisma.integJob.findFirst({
      where: { platformCode: c.platformCode, type: "SYNC_ALL_STOCK", status: { in: ["PENDING", "PROCESSING"] } },
      select: { id: true },
    });
    if (busy) continue;
    await prisma.integJob.create({
      data: { platformCode: c.platformCode, type: "SYNC_ALL_STOCK", payload: {}, priority: 1, status: "PENDING" },
    });
    jobs++;
  }
  return NextResponse.json({ jobs, alreadyRunning: jobs === 0 });
}
