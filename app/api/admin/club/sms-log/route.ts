import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import { normalizePhone } from "@/lib/club/phone";
import { addOptOut, removeOptOut } from "@/lib/club/sms/sync";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const where: Prisma.SmsMessageWhereInput = {};
  const and: Prisma.SmsMessageWhereInput[] = [];

  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const phone = normalizePhone(q);
    and.push({ phone: { contains: phone ?? q } });
  }

  const status = url.searchParams.get("status");
  if (status) and.push({ status: status as Prisma.EnumSmsStatusFilter["equals"] });

  const kind = url.searchParams.get("kind");
  if (kind) and.push({ kind: kind as Prisma.EnumSmsKindFilter["equals"] });

  const campaignId = url.searchParams.get("campaignId");
  if (campaignId) and.push({ campaignId });

  const templateKey = url.searchParams.get("templateKey");
  if (templateKey) and.push({ templateKey });

  const days = Number(url.searchParams.get("days"));
  if (days > 0) {
    and.push({ queuedAt: { gte: new Date(Date.now() - days * 24 * 3600 * 1000) } });
  }

  if (and.length > 0) where.AND = and;

  const [items, total, byStatus, bySkip, optOutCount, last30] = await Promise.all([
    prisma.smsMessage.findMany({
      where,
      orderBy: { queuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { campaign: { select: { title: true } } },
    }),
    prisma.smsMessage.count({ where }),
    prisma.smsMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.smsMessage.groupBy({
      by: ["skipReason"],
      where: { status: "SKIPPED" },
      _count: { _all: true },
    }),
    prisma.smsOptOut.count(),
    prisma.smsMessage.count({
      where: {
        queuedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
        status: { in: ["SENT", "DELIVERED"] },
      },
    }),
  ]);

  return NextResponse.json(
    serialize({
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      stats: {
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
        bySkipReason: Object.fromEntries(
          bySkip.map((r) => [r.skipReason ?? "UNKNOWN", r._count._all])
        ),
        optOutCount,
        last30Days: last30,
      },
    })
  );
}

/** مدیریت دستی لیست لغو */
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: { action?: "optout" | "remove-optout"; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
  }

  if (body.action === "optout") {
    const created = await addOptOut(phone, "admin", "افزوده‌شده توسط ادمین");
    return NextResponse.json({
      success: true,
      created,
      message: created ? "به لیست لغو اضافه شد" : "از قبل در لیست لغو بود",
    });
  }

  if (body.action === "remove-optout") {
    const removed = await removeOptOut(phone);
    return NextResponse.json({
      success: true,
      removed,
      message: removed
        ? "از لیست لغو حذف شد — رضایت پیامک باید جداگانه فعال شود"
        : "در لیست لغو نبود",
    });
  }

  return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
}