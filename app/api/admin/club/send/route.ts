import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { enqueueMultiChannelBatch, makeJobId } from "@/lib/club/queue";
import { fetchSegmentRecipients, recipientVars, type Segment } from "@/lib/club/segment";
import { loadSmsConfig } from "@/lib/club/sms";
import {
  loadGuardSettings,
  isWithinAllowedHours,
  delayUntilAllowedHours,
} from "@/lib/club/sms/guards";
import { getChannelPriority, allChannels } from "@/lib/club/channels";
import { logActivityAsync } from "@/lib/activity";
import type { ClubChannel } from "@prisma/client";

export const runtime = "nodejs";

const BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE ?? 200);
const MAX_TEXT = 4000;

/**
 * ارسال انبوه یا انتخابی به اعضای باشگاه
 *
 * ⚠️ عمداً همان موتور کمپین را به کار می‌برد و کانال را نمی‌شناسد: نگهبان‌ها
 *    (رضایت، سقف ماهانه، ساعت مجاز، لغو عضویت) و انتخاب کانال هر عضو همه در
 *    `dispatchMultiChannel()` هستند. یک مسیر «ارسال بله» جدا یعنی این
 *    محافظت‌ها دو جا تکرار شوند و یکی از آن‌ها عقب بماند.
 *
 * ⚠️ متن هر کانال جدا گرفته می‌شود. اگر ادمین فقط یک متن بدهد، همان متن روی
 *    کانال‌های انتخاب‌شده می‌رود — ولی این تصمیم صریح اوست، نه پیش‌فرض خاموش.
 */
export async function POST(req: Request) {
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const kind: "TRANSACTIONAL" | "MARKETING" =
    body.kind === "TRANSACTIONAL" ? "TRANSACTIONAL" : "MARKETING";

  // ── متن هر کانال ────────────────────────────────────────────────
  const known = new Set(allChannels().map((c) => c.channel as string));
  const bodyByChannel: Record<string, string> = {};

  if (typeof body.text === "string" && body.text.trim()) {
    const text = body.text.trim().slice(0, MAX_TEXT);
    const targets: string[] = Array.isArray(body.channels)
      ? body.channels.map(String).filter((c: string) => known.has(c))
      : await getChannelPriority();

    for (const c of targets) bodyByChannel[c] = text;
  }

  // متن اختصاصی هر کانال، اگر داده شده باشد، جای متن مشترک را می‌گیرد
  if (body.bodyByChannel && typeof body.bodyByChannel === "object") {
    for (const [c, t] of Object.entries(body.bodyByChannel as Record<string, unknown>)) {
      if (!known.has(c)) continue;
      const text = String(t ?? "").trim();
      if (text) bodyByChannel[c] = text.slice(0, MAX_TEXT);
      else delete bodyByChannel[c];
    }
  }

  if (Object.keys(bodyByChannel).length === 0) {
    return NextResponse.json({ error: "متن پیام خالی است" }, { status: 400 });
  }

  // ── گیرندگان ────────────────────────────────────────────────────
  const segment: Segment = {
    ...(body.segment && typeof body.segment === "object" ? body.segment : {}),
    ...(Array.isArray(body.profileIds) && body.profileIds.length > 0
      ? { profileIds: body.profileIds.map(String) }
      : {}),
  };

  if (!segment.profileIds?.length && Object.keys(segment).length === 0) {
    return NextResponse.json(
      { error: "گیرنده مشخص نشده است — یا اعضا را انتخاب کنید یا فیلتر بدهید" },
      { status: 400 }
    );
  }

  const recipients = await fetchSegmentRecipients(segment, { requireConsent: true });

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "هیچ گیرنده‌ی قابل‌دسترسی پیدا نشد" },
      { status: 400 }
    );
  }

  // ── خط تبلیغاتی فقط وقتی پیامک هم در کار است ────────────────────
  const config = await loadSmsConfig();
  if (kind === "MARKETING" && bodyByChannel.SMS && !config.marketingLine) {
    return NextResponse.json(
      { error: "خط تبلیغاتی ثبت نشده است؛ یا آن را وارد کنید یا کانال پیامک را بردارید." },
      { status: 400 }
    );
  }

  // ── ساعت مجاز ───────────────────────────────────────────────────
  const guards = await loadGuardSettings();
  let baseDelay = 0;
  if (kind === "MARKETING" && !isWithinAllowedHours(guards)) {
    baseDelay = delayUntilAllowedHours(guards);
  }

  // ── صف ──────────────────────────────────────────────────────────
  const stamp = Date.now();
  let batchCount = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    await enqueueMultiChannelBatch(
      {
        kind,
        bodyByChannel,
        profileIds: batch.map((r) => r.profileId),
        varsByProfile: Object.fromEntries(
          batch.map((r) => [r.profileId, recipientVars(r, config.storeName)])
        ),
      },
      {
        jobId: makeJobId("manual", String(stamp), batchCount),
        delay: baseDelay + batchCount * 2_000,
      }
    );

    batchCount++;
  }

  logActivityAsync({
    action: "CREATE",
    entity: "OTHER",
    entityTitle: `ارسال دستی به ${recipients.length} عضو`,
    summary: `کانال‌ها: ${Object.keys(bodyByChannel).join("، ")} · نوع: ${
      kind === "MARKETING" ? "تبلیغاتی" : "خدماتی"
    }`,
  });

  return NextResponse.json({
    success: true,
    recipients: recipients.length,
    batches: batchCount,
    channels: Object.keys(bodyByChannel),
    delayedUntilAllowedHours: baseDelay > 0,
  });
}

/** پیش‌بینی گیرندگان پیش از ارسال — بدون فرستادن چیزی */
export async function PUT(req: Request) {
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const segment: Segment = {
    ...(body.segment && typeof body.segment === "object" ? body.segment : {}),
    ...(Array.isArray(body.profileIds) && body.profileIds.length > 0
      ? { profileIds: body.profileIds.map(String) }
      : {}),
  };

  const recipients = await fetchSegmentRecipients(segment, { requireConsent: true });
  const ids = recipients.map((r) => r.profileId);

  // تفکیک بر اساس کانالی که واقعاً به هرکس می‌رسد
  const identities = await prisma.clubChannelIdentity.groupBy({
    by: ["channel"],
    where: { profileId: { in: ids }, isActive: true, channel: { not: "SMS" } },
    _count: { _all: true },
  });

  return NextResponse.json({
    total: recipients.length,
    byChannel: Object.fromEntries(
      identities.map((r) => [r.channel as ClubChannel, r._count._all])
    ),
  });
}
