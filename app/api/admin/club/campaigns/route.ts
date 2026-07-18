import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import { summarizeSegment, describeSegment, type Segment } from "@/lib/club/segment";
import { countSmsParts, previewTemplate, appendOptOut } from "@/lib/club/sms/render";
import { loadSmsConfig } from "@/lib/club/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

/** فهرست کمپین‌ها */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const [campaigns, config] = await Promise.all([
    prisma.smsCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        template: { select: { title: true, key: true, mode: true, kind: true } },
      },
    }),
    loadSmsConfig(),
  ]);

  return NextResponse.json(
    serialize({
      campaigns: campaigns.map((c) => ({
        ...c,
        segmentLabel: describeSegment(c.segment as Segment),
      })),
      marketingLineReady: !!config.marketingLine,
    })
  );
}

/** ساخت کمپین جدید (پیش‌نویس) */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: { title?: string; templateId?: string; segment?: Segment; scheduledAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "عنوان کمپین الزامی است" }, { status: 400 });
  }

  const template = await prisma.smsTemplate.findUnique({
    where: { id: body.templateId ?? "" },
  });
  if (!template) {
    return NextResponse.json({ error: "قالب انتخاب نشده یا یافت نشد" }, { status: 400 });
  }

  if (template.mode === "PATTERN") {
    return NextResponse.json(
      {
        error:
          "کمپین با قالب پترن ممکن نیست. پترن‌ها برای پیام‌های خودکار هستند و متن ثابت دارند.",
      },
      { status: 400 }
    );
  }

  let scheduledAt: Date | null = null;
  if (body.scheduledAt) {
    scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "زمان زمان‌بندی نامعتبر است" }, { status: 400 });
    }
    if (scheduledAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "زمان زمان‌بندی باید در آینده باشد" }, { status: 400 });
    }
  }

  const segment = body.segment ?? {};
  const summary = await summarizeSegment(segment);

  const campaign = await prisma.smsCampaign.create({
    data: {
      title: body.title.trim(),
      templateId: template.id,
      segment: segment as object,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
      totalCount: summary.reachable,
      createdById: admin.id,
    },
  });

  return NextResponse.json(serialize({ success: true, campaign, summary }));
}

/** پیش‌نمایش یک بخش بدون ساخت کمپین */
export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: { segment?: Segment; templateId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const segment = body.segment ?? {};
  const [summary, config] = await Promise.all([
    summarizeSegment(segment),
    loadSmsConfig(),
  ]);

  // تخمین هزینه بر اساس تعداد بخش پیامک
  let parts = 0;
  let preview: string | null = null;

  if (body.templateId) {
    const template = await prisma.smsTemplate.findUnique({
      where: { id: body.templateId },
      select: { body: true, kind: true },
    });

    if (template?.body) {
      preview = appendOptOut(
        previewTemplate(template.body, config.storeName),
        template.kind === "MARKETING" ? config.optOutText : null
      );
      parts = countSmsParts(preview).parts;
    }
  }

  return NextResponse.json({
    summary,
    label: describeSegment(segment),
    preview,
    parts,
    totalParts: parts * summary.reachable,
  });
}