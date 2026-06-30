import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelJob, retryJob } from "@/lib/integration/core/queue";

// GET /api/integration/queue?status=FAILED&platform=hesaban&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status   = searchParams.get("status") ?? undefined;
  const platform = searchParams.get("platform") ?? undefined;
  const page     = Math.max(1, Number(searchParams.get("page") ?? 1));
  const take     = 30;

  const where = {
    ...(status   && { status:       status   as "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "CANCELLED" }),
    ...(platform && { platformCode: platform }),
  };

  const [jobs, total] = await Promise.all([
    prisma.integJob.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take,
      skip:    (page - 1) * take,
      include: { platform: { select: { name: true } } },
    }),
    prisma.integJob.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, pages: Math.ceil(total / take) });
}

// POST /api/integration/queue — retry / cancel
export async function POST(req: NextRequest) {
  const { action, jobId } = await req.json() as { action: "retry" | "cancel"; jobId: string };

  if (!jobId) return NextResponse.json({ error: "jobId الزامی است" }, { status: 400 });

  if (action === "retry") {
    const result = await retryJob(jobId);
    if (result.count === 0) {
      return NextResponse.json({ error: "فقط job‌های FAILED قابل retry هستند" }, { status: 400 });
    }
  } else if (action === "cancel") {
    const result = await cancelJob(jobId);
    if (result.count === 0) {
      return NextResponse.json({ error: "فقط job‌های PENDING قابل لغو هستند" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "action نامعتبر" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
