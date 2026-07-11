import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/integration/sync
// body: { platformCode, type: "SYNC_ALL_STOCK" | "SYNC_ALL_PRICE" | "FETCH_PRODUCTS" | "FETCH_ORDERS" }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    platformCode: string;
    type: "SYNC_ALL_STOCK" | "SYNC_ALL_PRICE" | "FETCH_PRODUCTS" | "FETCH_ORDERS" | "TEST_CONNECTION";
    priority?: number;
  };

  if (!body.platformCode || !body.type) {
    return NextResponse.json({ error: "platformCode و type الزامی هستند" }, { status: 400 });
  }

  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: body.platformCode },
  });

  if (!connection || (body.type !== "TEST_CONNECTION" && !["CONNECTED", "SYNCING"].includes(connection.status))) {
    return NextResponse.json({ error: "ابتدا اتصال را برقرار کنید" }, { status: 400 });
  }

  // بررسی اینکه job تکراری نداشته باشیم
  const existing = await prisma.integJob.findFirst({
    where: {
      platformCode: body.platformCode,
      type:         body.type,
      status:       { in: ["PENDING", "PROCESSING"] },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "یک عملیات مشابه در صف انتظار است", jobId: existing.id }, { status: 409 });
  }

  const job = await prisma.integJob.create({
    data: {
      platformCode: body.platformCode,
      type:         body.type,
      payload:      {},
      priority:     body.priority ?? 2,
      status:       "PENDING",
    },
  });

  return NextResponse.json({ jobId: job.id });
}