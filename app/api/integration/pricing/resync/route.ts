import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { platformCode?: string };

  const platformCode = body.platformCode ?? (
    await prisma.integPlatform.findFirst({ where: { type: "ACCOUNTING", isActive: true } })
  )?.code;

  if (!platformCode) {
    return NextResponse.json({ error: "پلتفرم حسابداری فعالی یافت نشد" }, { status: 400 });
  }

  const connection = await prisma.integConnection.findFirst({
    where: { platformCode, status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) {
    return NextResponse.json({ error: "ابتدا اتصال حسابداری را برقرار کنید" }, { status: 400 });
  }

  const existing = await prisma.integJob.findFirst({
    where: { platformCode, type: "SYNC_ALL_PRICE", status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (existing) return NextResponse.json({ jobId: existing.id, alreadyRunning: true });

  const job = await prisma.integJob.create({
    data: { platformCode, type: "SYNC_ALL_PRICE", payload: {}, priority: 1, status: "PENDING" },
  });

  return NextResponse.json({ jobId: job.id });
}