import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { enqueueMultiChannelBatch, makeJobId } from "@/lib/club/queue";
import { loadSmsConfig } from "@/lib/club/sms";
import {
  loadGuardSettings,
  isWithinAllowedHours,
  delayUntilAllowedHours,
} from "@/lib/club/sms/guards";
import { fetchSegmentRecipients, recipientVars, type Segment } from "@/lib/club/segment";
import { getTemplateBody, getChannelPriority } from "@/lib/club/channels";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; action: string }> };

const BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE ?? 200);

/**
 * اجرای عملیات روی کمپین: start | pause | cancel
 *
 * نکته کلیدی: ارسال اینجا انجام نمی‌شود. فقط دسته‌ها وارد صف می‌شوند و
 * Worker آن‌ها را می‌فرستد. پس این درخواست حتی برای ۵۰٬۰۰۰ گیرنده هم
 * سریع پاسخ می‌دهد.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id, action } = await params;

  const campaign = await prisma.smsCampaign.findUnique({
    where: { id },
    include: { template: true },
  });

  if (!campaign) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  // ── توقف ─────────────────────────────────────────────────────────
  if (action === "pause") {
    if (campaign.status !== "RUNNING") {
      return NextResponse.json({ error: "کمپین در حال اجرا نیست" }, { status: 409 });
    }
    await prisma.smsCampaign.update({ where: { id }, data: { status: "PAUSED" } });
    return NextResponse.json({
      success: true,
      note: "دسته‌هایی که از قبل در صف هستند ارسال می‌شوند",
    });
  }

  // ── لغو ──────────────────────────────────────────────────────────
  if (action === "cancel") {
    if (campaign.status === "DONE") {
      return NextResponse.json({ error: "کمپین تمام شده است" }, { status: 409 });
    }
    await prisma.smsCampaign.update({
      where: { id },
      data: { status: "CANCELED", finishedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (action !== "start") {
    return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
  }

  // ── شروع ─────────────────────────────────────────────────────────
  if (campaign.status === "RUNNING") {
    return NextResponse.json({ error: "کمپین از قبل در حال اجراست" }, { status: 409 });
  }
  if (campaign.status === "DONE") {
    return NextResponse.json({ error: "این کمپین قبلاً اجرا شده است" }, { status: 409 });
  }

  const template = campaign.template;

  if (!template.isActive) {
    return NextResponse.json({ error: "قالب این کمپین غیرفعال است" }, { status: 400 });
  }
  if (template.mode === "PATTERN") {
    return NextResponse.json({ error: "کمپین با قالب پترن ممکن نیست" }, { status: 400 });
  }
  if (!template.body) {
    return NextResponse.json({ error: "متن قالب خالی است" }, { status: 400 });
  }

  const config = await loadSmsConfig();

  // ── متن هر کانال ────────────────────────────────────────────────
  // ⚠️ کانالی که متن ندارد اصلاً در فهرست نمی‌آید. متن پیامک روی بله بد
  //    خوانده می‌شود، پس نبودِ متن یعنی «این قالب روی این کانال نرود» —
  //    نه «همان متن پیامک را بفرست».
  const priority = await getChannelPriority();
  const bodyByChannel: Record<string, string> = {};

  for (const channel of priority) {
    const body = await getTemplateBody(template.id, channel);
    if (body?.body) bodyByChannel[channel] = body.body;
  }

  if (Object.keys(bodyByChannel).length === 0) {
    return NextResponse.json(
      { error: "برای هیچ کانالی متن تعریف نشده است" },
      { status: 400 }
    );
  }

  // خط تبلیغاتی فقط وقتی لازم است که پیامک واقعاً یکی از کانال‌ها باشد
  if (template.kind === "MARKETING" && bodyByChannel.SMS && !config.marketingLine) {
    return NextResponse.json(
      {
        error:
          "خط تبلیغاتی ثبت نشده است. از تنظیمات باشگاه آن را وارد کنید. ارسال تبلیغاتی با خط خدماتی انجام نمی‌شود.",
      },
      { status: 400 }
    );
  }

  // ── گیرندگان ────────────────────────────────────────────────────
  const recipients = await fetchSegmentRecipients(campaign.segment as Segment, {
    requireConsent: template.kind === "MARKETING",
  });

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "هیچ گیرنده‌ای در این بخش وجود ندارد" },
      { status: 400 }
    );
  }

  // ── تعیین تأخیر بر اساس ساعت مجاز ───────────────────────────────
  const guards = await loadGuardSettings();
  let baseDelay = 0;

  if (template.kind === "MARKETING" && !isWithinAllowedHours(guards)) {
    baseDelay = delayUntilAllowedHours(guards);
  }

  // ── ورود دسته‌ها به صف ──────────────────────────────────────────
  const batches: typeof recipients[] = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    batches.push(recipients.slice(i, i + BATCH_SIZE));
  }

  await prisma.smsCampaign.update({
    where: { id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      totalCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
  });

  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];

    await enqueueMultiChannelBatch(
      {
        templateKey: template.key,
        kind: template.kind,
        campaignId: campaign.id,
        bodyByChannel,
        // ⚠️ فقط شناسه‌ی پروفایل می‌رود؛ انتخاب کانال در لحظه‌ی ارسال انجام
        //    می‌شود، نه حالا. عضوی که تا آن موقع در بله عضو شده باید از بله
        //    پیام بگیرد.
        profileIds: batch.map((r) => r.profileId),
        varsByProfile: Object.fromEntries(
          batch.map((r) => [r.profileId, recipientVars(r, config.storeName)])
        ),
      },
      {
        // jobId یکتا — اجرای دوباره کمپین پیام تکراری نمی‌فرستد
        jobId: makeJobId("campaign", campaign.id, index),
        // فاصله بین دسته‌ها تا فشار روی ارائه‌دهنده نیاید
        delay: baseDelay + index * 2_000,
      }
    );
  }

  return NextResponse.json({
    success: true,
    recipients: recipients.length,
    batches: batches.length,
    channels: Object.keys(bodyByChannel),
    delayedUntilAllowedHours: baseDelay > 0,
    note:
      baseDelay > 0
        ? `خارج از ساعت مجاز است — ارسال حدود ${Math.round(baseDelay / 60000)} دقیقه دیگر آغاز می‌شود`
        : undefined,
  });
}