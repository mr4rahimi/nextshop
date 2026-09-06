import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { allChannels } from "@/lib/club/channels";
import type { ClubChannel } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * متن قالب برای هر کانال
 *
 * ⚠️ مسیر جداست و به `PATCH` خود قالب دست نمی‌زند: بدنه‌ی ناقصی که کل قالب را
 *    بازنویسی کند، همان الگوی خطرناکی است که در راهنمای پروژه هشدار داده شده.
 *
 * ⚠️ SMS اینجا ویرایش نمی‌شود — متن پیامک همان `SmsTemplate.body` است.
 *    داشتن دو جای ویرایش برای یک متن، یکی‌شان را همیشه کهنه نگه می‌دارد.
 */

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

type Ctx = { params: Promise<{ id: string }> };

/** کانال‌هایی که متن اختصاصی می‌خواهند — همه به‌جز پیامک */
function editableChannels(): { channel: ClubChannel; title: string }[] {
  return allChannels()
    .filter((c) => c.channel !== "SMS")
    .map((c) => ({ channel: c.channel, title: c.title }));
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  const bodies = await prisma.templateChannelBody.findMany({
    where: { templateId: id },
    select: { channel: true, body: true, isActive: true, extra: true },
  });

  return NextResponse.json({
    channels: editableChannels(),
    bodies,
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  const template = await prisma.smsTemplate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ error: "قالب یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const channel = String(body.channel ?? "") as ClubChannel;

  if (!editableChannels().some((c) => c.channel === channel)) {
    return NextResponse.json({ error: "کانال نامعتبر است" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";

  // متن خالی = «این قالب روی این کانال نرود». حذف رکورد، نه ذخیره‌ی رشته‌ی
  // خالی — وگرنه `getTemplateBody()` باید هم `null` هم `""` را بفهمد.
  if (!text) {
    await prisma.templateChannelBody.deleteMany({ where: { templateId: id, channel } });
    return NextResponse.json({ success: true, removed: true });
  }

  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  await prisma.templateChannelBody.upsert({
    where: { templateId_channel: { templateId: id, channel } },
    create: { templateId: id, channel, body: text, isActive },
    update: { body: text, isActive },
  });

  return NextResponse.json({ success: true });
}
