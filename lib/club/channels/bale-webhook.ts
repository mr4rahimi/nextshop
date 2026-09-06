import { prisma } from "@/lib/prisma";
import { normalizePhone } from "../phone";
import { upsertClubCustomer, getPointsBalance } from "../profile";
import { setClubConsent } from "../consent";
import { loadPointRules } from "../points";
import { loadBaleConfig, sendBaleMessage, type BaleConfig } from "./bale";
import { contactKeyboard, type BotUpdate } from "./botapi";

/**
 * پردازش آپدیت‌های ربات بله
 *
 * ⚠️ **بدون گرفتن شماره‌ی موبایل، عضو ربات به هیچ دردی نمی‌خورد.** امتیاز،
 *    سطح و تاریخچه‌ی خرید همه روی `ClubProfile` نشسته‌اند که کلیدش شماره است.
 *    پس جریان اجباری این است: `/start` → دکمه‌ی «ارسال شماره» → ساخت
 *    `ClubChannelIdentity`. تا پیش از شماره، هیچ رکوردی ساخته نمی‌شود.
 *
 * ⚠️ این تابع هرگز throw نمی‌کند. وب‌هوکی که خطا برگرداند باعث می‌شود بله
 *    همان آپدیت را بارها بفرستد.
 */

const CMD_START = /^\/start\b/;
const CMD_STOP = /^\/stop\b|^لغو$/;
const CMD_POINTS = /^\/points\b|^امتیاز$/;

export async function handleBaleUpdate(update: BotUpdate): Promise<void> {
  try {
    const cfg = await loadBaleConfig();
    if (!cfg) return;

    const msg = update.message;
    if (!msg) return;

    const chatId = msg.chat.id;

    // ── شماره‌ی تلفن رسید ─────────────────────────────────────────
    if (msg.contact) {
      await handleContact(cfg, chatId, msg.contact, msg.from?.username ?? msg.chat.username ?? null);
      return;
    }

    const text = (msg.text ?? "").trim();

    if (CMD_START.test(text)) {
      await handleStart(cfg, chatId);
      return;
    }

    if (CMD_STOP.test(text)) {
      await handleStop(cfg, chatId);
      return;
    }

    if (CMD_POINTS.test(text)) {
      await handlePoints(cfg, chatId);
      return;
    }

    // پیام ناشناخته — راهنمای کوتاه، نه سکوت
    await sendBaleMessage(
      cfg,
      chatId,
      "برای عضویت در باشگاه دستور /start را بزنید.\nبرای دیدن امتیاز، «امتیاز» را بفرستید."
    ).catch(() => {});
  } catch (err) {
    console.error("[bale:webhook] پردازش آپدیت ناموفق:", err);
  }
}

// ─── دستورها ───────────────────────────────────────────────────────

async function handleStart(cfg: BaleConfig, chatId: number) {
  const identity = await findIdentity(chatId);

  if (identity?.isActive) {
    await sendBaleMessage(
      cfg,
      chatId,
      "شما از قبل عضو باشگاه هستید ✅\nبرای دیدن امتیازتان «امتیاز» را بفرستید."
    );
    return;
  }

  // ⚠️ عضوی که قبلاً لغو کرده با یک /start دوباره فعال می‌شود — رکورد پاک
  //    نشده بود، پس تاریخچه و امتیازش سر جایش است.
  if (identity) {
    // ⚠️ `isActive` را اینجا دست نمی‌زنیم. اگر پیش از `setClubConsent()` عوضش
    //    کنیم، آن تابع دیگر تغییری نمی‌بیند و بازگشت عضو در دفتر ثبت
    //    نمی‌شود — یعنی سند می‌گوید هنوز لغو است در حالی که پیام می‌گیرد.
    await prisma.clubChannelIdentity.update({
      where: { id: identity.id },
      data: { lastSeenAt: new Date() },
    });

    await setClubConsent({
      profileId: identity.profileId,
      channel: "BALE",
      granted: true,
      source: "MESSENGER",
    });

    await sendBaleMessage(cfg, chatId, "عضویت شما دوباره فعال شد ✅");
    return;
  }

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { clubName: true, storeName: true },
  });

  const rules = await loadPointRules();
  const bonus = rules.onSignup + rules.onConsent;

  const title =
    settings?.clubName || `باشگاه مشتریان${settings?.storeName ? ` ${settings.storeName}` : ""}`;

  const lines = [
    `به ${title} خوش آمدید.`,
    "",
    "برای عضویت، شماره‌ی موبایلتان را با دکمه‌ی پایین بفرستید.",
    bonus > 0 ? `همین حالا ${bonus.toLocaleString("fa-IR")} امتیاز می‌گیرید.` : "",
  ].filter(Boolean);

  await sendBaleMessage(cfg, chatId, lines.join("\n"), {
    reply_markup: contactKeyboard("ارسال شماره موبایل"),
  });
}

async function handleContact(
  cfg: BaleConfig,
  chatId: number,
  contact: { phone_number: string; first_name?: string; last_name?: string; user_id?: number },
  username: string | null
) {
  // ⚠️ فقط شماره‌ی خودِ فرستنده پذیرفته می‌شود. بله `user_id` مخاطب را
  //    می‌دهد؛ اگر با شناسه‌ی چت نخواند یعنی کاربر مخاطب شخص دیگری را
  //    فرستاده و ثبتش یعنی عضو کردن کسی بدون رضایت خودش.
  if (contact.user_id && contact.user_id !== chatId) {
    await sendBaleMessage(
      cfg,
      chatId,
      "لطفاً شماره‌ی خودتان را با دکمه‌ی «ارسال شماره موبایل» بفرستید، نه مخاطب دیگری."
    );
    return;
  }

  const phone = normalizePhone(contact.phone_number);
  if (!phone) {
    await sendBaleMessage(cfg, chatId, "شماره‌ی دریافتی معتبر نبود. دوباره تلاش کنید.");
    return;
  }

  const result = await upsertClubCustomer({
    phone,
    firstName: contact.first_name ?? null,
    lastName: contact.last_name ?? null,
    source: "MESSAGING",
    sourcePlatform: "bale",
  });

  await prisma.clubChannelIdentity.upsert({
    where: { channel_externalId: { channel: "BALE", externalId: String(chatId) } },
    create: {
      profileId: result.profileId,
      channel: "BALE",
      externalId: String(chatId),
      username,
      lastSeenAt: new Date(),
    },
    update: { isActive: true, username, lastSeenAt: new Date() },
  });

  // ⚠️ فرستادن شماره با دکمه، رضایت صریح برای همین کانال است — ولی رضایت
  //    پیامک نیست. آن کانال دیگری است و باید جدا گرفته شود.
  const consent = await setClubConsent({
    profileId: result.profileId,
    channel: "BALE",
    granted: true,
    source: "MESSENGER",
  });

  const balance = await getPointsBalance(result.profileId);

  const lines = [
    "عضویت شما ثبت شد ✅",
    consent.pointsGranted > 0
      ? `${consent.pointsGranted.toLocaleString("fa-IR")} امتیاز هدیه گرفتید.`
      : "",
    `امتیاز فعلی شما: ${balance.toLocaleString("fa-IR")}`,
    "",
    "برای دیدن امتیاز، «امتیاز» را بفرستید. برای لغو، /stop.",
  ].filter(Boolean);

  await sendBaleMessage(cfg, chatId, lines.join("\n"), {
    reply_markup: { remove_keyboard: true },
  });
}

async function handleStop(cfg: BaleConfig, chatId: number) {
  const identity = await findIdentity(chatId);

  if (!identity || !identity.isActive) {
    await sendBaleMessage(cfg, chatId, "شما عضو نیستید.");
    return;
  }

  await setClubConsent({
    profileId: identity.profileId,
    channel: "BALE",
    granted: false,
    source: "MESSENGER",
  });

  await sendBaleMessage(
    cfg,
    chatId,
    "دیگر پیامی برایتان نمی‌فرستیم. هر زمان خواستید با /start برگردید."
  );
}

async function handlePoints(cfg: BaleConfig, chatId: number) {
  const identity = await findIdentity(chatId);

  if (!identity) {
    await sendBaleMessage(cfg, chatId, "ابتدا با /start عضو شوید.");
    return;
  }

  const [balance, profile] = await Promise.all([
    getPointsBalance(identity.profileId),
    prisma.clubProfile.findUnique({
      where: { id: identity.profileId },
      select: { orderCount: true, tier: { select: { title: true } } },
    }),
  ]);

  const lines = [
    `امتیاز شما: ${balance.toLocaleString("fa-IR")}`,
    profile?.tier ? `سطح عضویت: ${profile.tier.title}` : "",
    `تعداد خرید: ${(profile?.orderCount ?? 0).toLocaleString("fa-IR")}`,
  ].filter(Boolean);

  await sendBaleMessage(cfg, chatId, lines.join("\n"));
}

function findIdentity(chatId: number) {
  return prisma.clubChannelIdentity.findUnique({
    where: { channel_externalId: { channel: "BALE", externalId: String(chatId) } },
    select: { id: true, profileId: true, isActive: true },
  });
}
