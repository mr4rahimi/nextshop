import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import { summarizeSegment, describeSegment, type Segment } from "@/lib/club/segment";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  const campaign = await prisma.smsCampaign.findUnique({
    where: { id },
    include: { template: true },
  });

  if (!campaign) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  const [summary, breakdown] = await Promise.all([
    summarizeSegment(campaign.segment as Segment),
    prisma.smsMessage.groupBy({
      by: ["status", "skipReason"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json(
    serialize({
      campaign: { ...campaign, segmentLabel: describeSegment(campaign.segment as Segment) },
      summary,
      breakdown: breakdown.map((b) => ({
        status: b.status,
        skipReason: b.skipReason,
        count: b._count._all,
      })),
    })
  );
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  const campaign = await prisma.smsCampaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  // کمپین در حال اجرا یا تمام‌شده قابل ویرایش نیست
  if (campaign.status === "RUNNING" || campaign.status === "DONE") {
    return NextResponse.json(
      { error: "کمپین در حال اجرا یا تمام‌شده قابل ویرایش نیست" },
      { status: 409 }
    );
  }

  let body: {
    title?: string;
    templateId?: string;
    segment?: Segment;
    scheduledAt?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.title?.trim()) data.title = body.title.trim();

  if (body.templateId) {
    const t = await prisma.smsTemplate.findUnique({ where: { id: body.templateId } });
    if (!t) return NextResponse.json({ error: "قالب یافت نشد" }, { status: 400 });
    if (t.mode === "PATTERN") {
      return NextResponse.json({ error: "کمپین با قالب پترن ممکن نیست" }, { status: 400 });
    }
    data.templateId = t.id;
  }

  if (body.segment) {
    data.segment = body.segment as object;
    const summary = await summarizeSegment(body.segment);
    data.totalCount = summary.reachable;
  }

  if (body.scheduledAt !== undefined) {
    if (body.scheduledAt === null) {
      data.scheduledAt = null;
      data.status = "DRAFT";
    } else {
      const at = new Date(body.scheduledAt);
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) {
        return NextResponse.json({ error: "زمان زمان‌بندی نامعتبر است" }, { status: 400 });
      }
      data.scheduledAt = at;
      data.status = "SCHEDULED";
    }
  }

  const updated = await prisma.smsCampaign.update({ where: { id }, data });
  return NextResponse.json(serialize({ success: true, campaign: updated }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  const campaign = await prisma.smsCampaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  if (campaign.status === "RUNNING") {
    return NextResponse.json(
      { error: "کمپین در حال اجرا را ابتدا متوقف کنید" },
      { status: 409 }
    );
  }

  // پیام‌های ارسال‌شده حفظ می‌شوند — فقط ارتباطشان با کمپین قطع می‌شود
  await prisma.smsMessage.updateMany({
    where: { campaignId: id },
    data: { campaignId: null },
  });

  await prisma.smsCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}