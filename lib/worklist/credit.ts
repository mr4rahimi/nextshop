/**
 * خرید اعتباری — موعدهای پرداخت، یادآوری و پیگیری (فاز ۱۰، بخش ۲۴ مستندات).
 *
 * ⚠️⚠️ **این فایل هنوز به هیچ‌جا وصل نیست — زیرساختِ نیمه‌کاره.**
 * نه مسیر API دارد، نه صفحه، نه فراخوانی از زمان‌بند، نه قالب پیامک.
 * `runCreditCycle` را هیچ‌کس صدا نمی‌زند، پس روی سایت هیچ رفتاری عوض نمی‌کند.
 *
 * برای تمام‌کردنش، چک‌لیست بخش ۲۴.۵ مستندات را دنبال کنید. مانده:
 *   - مسیرهای API و صفحه‌ی `/admin/worklist/credit`
 *   - فرم موعدها در سفارش تلفنی و ویرایش سفارش
 *   - قالب `credit-due-reminder` در `seed-club-templates.ts` و سه متغیر تازه
 *   - فراخوانی `runCreditCycle` از زمان‌بند ده‌دقیقه‌ای کارتابل
 *   - بدهی باز در پرونده‌ی مشتری باشگاه
 *
 * ⚠️ **وضعیت تازه‌ی سفارش ساخته نشد.** تصمیم بخش ۲۴.۳: زنجیره‌ی ارسال و
 * بسته‌بندی به وضعیت‌های فعلی وصل است. به‌جایش، سفارشِ اعتباری «بدهی باز»
 * دارد و هرکس بخواهد بداند پول رسیده یا نه، `hasOpenCredit` را می‌پرسد.
 *
 * ⚠️ سه محافظ که بدون هرکدام این قابلیت خطرناک می‌شود:
 *
 * **۱. جمع موعدها = مبلغ سفارش.** `validateInstallments` تا نخواند ذخیره
 * نمی‌کند. بدون این، «مانده‌ی بدهی» هیچ‌وقت با فاکتور نمی‌خواند.
 *
 * **۲. یادآوری دو بار نمی‌رود.** `reminderSentAt` با `updateMany` شرط‌دار
 * **پیش از** صف‌کردن نوشته می‌شود — همان الگوی تصاحب اتمی فاز ۸. دو پروسه یا
 * دو چرخه‌ی هم‌زمان، یکی برنده می‌شود.
 *
 * **۳. هر موعد حداکثر یک کار پیگیری.** `runKey = credit:{id}` روی
 * `StaffTask` ایندکس یکتا دارد، مثل قواعد تکرارشونده.
 *
 * «امروز» و «فردا» همیشه به وقت تهران و از `dayKeyOf` می‌آیند، نه ساعت سرور
 * (تله‌ی ۲۷).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { dayKeyOf } from "./attendance";
import { formatJalali } from "@/lib/club/jalali";
import { enqueueMultiChannelBatch, makeJobId } from "@/lib/club/queue";
import { renderTemplate } from "@/lib/club/sms/render";
import { logActivityAsync } from "@/lib/activity";
import { can, type StaffAccess } from "@/lib/permissions";

const DAY_MS = 86_400_000;

/** کلید قالب پیامک یادآوری — در `scripts/seed-club-templates.ts` ساخته می‌شود */
export const REMINDER_TEMPLATE_KEY = "credit-due-reminder";

/** نوع کار پیگیری واریز — از `seed-task-types.ts` */
export const FOLLOW_UP_TYPE_SLUG = "payment-followup";

export interface InstallmentInput {
  /** «1405-07-12» یا ISO — هر چیزی که `new Date` بفهمد */
  dueDate: string | Date;
  amount: string | number | bigint;
}

function toMoney(v: unknown): bigint | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "bigint") return v;
  const s = String(v).replace(/[^\d]/g, "");
  if (!s || s.length > 15) return null;
  return BigInt(s);
}

function toDay(v: string | Date): Date | null {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return dayKeyOf(d);
}

export interface ValidatedInstallments {
  rows: { seq: number; dueDate: Date; amount: bigint }[];
}

/**
 * اعتبارسنجی موعدها. خطا **متن فارسی** برمی‌گرداند تا مستقیم به فرم برود.
 *
 * `expectedTotal` مبلغ سفارش است. اگر جمع موعدها با آن نخواند، ذخیره
 * نمی‌شود — این تنها جایی است که این قابلیت سخت‌گیر است و باید باشد.
 */
export function validateInstallments(
  input: unknown,
  expectedTotal: bigint,
): ValidatedInstallments | { error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "برای سفارش اعتباری دست‌کم یک موعد پرداخت لازم است" };
  }
  if (input.length > 60) {
    return { error: "بیشتر از ۶۰ قسط پذیرفته نمی‌شود" };
  }

  const rows: { seq: number; dueDate: Date; amount: bigint }[] = [];
  let sum = 0n;
  const seenDays = new Set<number>();

  for (const [i, raw] of input.entries()) {
    const item = raw as InstallmentInput;
    const dueDate = toDay(item?.dueDate);
    if (!dueDate) return { error: `تاریخ موعد ${i + 1} نامعتبر است` };
    const amount = toMoney(item?.amount);
    if (amount === null || amount <= 0n) return { error: `مبلغ موعد ${i + 1} را وارد کنید` };

    // دو قسط در یک روز یعنی یکی از آن‌ها اشتباه وارد شده
    if (seenDays.has(dueDate.getTime())) {
      return { error: "دو موعد در یک روز ثبت شده است" };
    }
    seenDays.add(dueDate.getTime());

    sum += amount;
    rows.push({ seq: i + 1, dueDate, amount });
  }

  if (sum !== expectedTotal) {
    const diff = sum - expectedTotal;
    return {
      error:
        `جمع موعدها ${sum.toLocaleString("fa-IR")} تومان است ولی مبلغ سفارش ` +
        `${expectedTotal.toLocaleString("fa-IR")} تومان. ` +
        (diff > 0n
          ? `${diff.toLocaleString("fa-IR")} تومان بیشتر است.`
          : `${(-diff).toLocaleString("fa-IR")} تومان کم است.`),
    };
  }

  // ترتیب تاریخ — «قسط دوم قبل از اول» در فهرست و گزارش گیج‌کننده است
  rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  rows.forEach((r, i) => { r.seq = i + 1; });

  return { rows };
}

/**
 * جایگزینی کاملِ موعدهای یک سفارش.
 *
 * ⚠️ موعدِ **پرداخت‌شده** بازنویسی نمی‌شود. اگر مشتری دو قسط داده و بعد
 * بخواهیم برنامه را عوض کنیم، تاریخچه‌ی واریز نباید پاک شود — همان قاعده‌ای
 * که برای تسویه‌ی پورسانت هم هست.
 */
export async function setInstallments(
  orderId: string,
  input: unknown,
  access: StaffAccess,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, grandTotal: true,
      installments: { select: { id: true, status: true } },
    },
  });
  if (!order) throw new Error("سفارش پیدا نشد");

  if (order.installments.some((i) => i.status === "PAID")) {
    throw new Error("این سفارش موعد پرداخت‌شده دارد و برنامه‌اش عوض نمی‌شود");
  }

  const v = validateInstallments(input, order.grandTotal);
  if ("error" in v) throw new Error(v.error);

  await prisma.$transaction([
    prisma.orderCreditInstallment.deleteMany({ where: { orderId } }),
    prisma.orderCreditInstallment.createMany({
      data: v.rows.map((r) => ({ orderId, seq: r.seq, dueDate: r.dueDate, amount: r.amount })),
    }),
    prisma.order.update({ where: { id: orderId }, data: { paymentTerm: "CREDIT" } }),
  ]);

  logActivityAsync({
    action: "UPDATE",
    entity: "ORDER",
    entityId: orderId,
    entityTitle: `سفارش ${order.orderNumber}`,
    summary: `برنامه‌ی پرداخت اعتباری: ${v.rows.length} موعد`,
    actor: { id: access.userId, name: access.name },
  });

  return v.rows.length;
}

/** برگرداندن سفارش به نقدی — فقط وقتی هیچ واریزی ثبت نشده */
export async function clearInstallments(orderId: string) {
  const paid = await prisma.orderCreditInstallment.count({
    where: { orderId, status: "PAID" },
  });
  if (paid > 0) throw new Error("این سفارش واریز ثبت‌شده دارد و نقدی نمی‌شود");

  await prisma.$transaction([
    prisma.orderCreditInstallment.deleteMany({ where: { orderId } }),
    prisma.order.update({ where: { id: orderId }, data: { paymentTerm: "CASH" } }),
  ]);
}

/** آیا این سفارش هنوز بدهی باز دارد — مبنای «پول نرسیده» در بقیه‌ی سیستم */
export async function hasOpenCredit(orderId: string): Promise<boolean> {
  const open = await prisma.orderCreditInstallment.count({
    where: { orderId, status: "DUE" },
  });
  return open > 0;
}

/**
 * ثبت واریز یک موعد.
 *
 * وقتی آخرین موعدِ باز بسته شد، سفارش از «در انتظار پرداخت» به `PAID` می‌رود
 * و از همان مسیر عادی، معامله‌ی سود فاز ۹ ساخته می‌شود.
 */
export async function payInstallment(
  installmentId: string,
  input: { amount?: unknown; note?: unknown },
  access: StaffAccess,
) {
  const inst = await prisma.orderCreditInstallment.findUnique({
    where: { id: installmentId },
    select: {
      id: true, orderId: true, amount: true, status: true, seq: true,
      order: { select: { orderNumber: true, status: true } },
    },
  });
  if (!inst) throw new Error("موعد پیدا نشد");
  if (inst.status === "PAID") throw new Error("این موعد قبلاً پرداخت شده است");
  if (inst.status === "CANCELED") throw new Error("این موعد لغو شده است");

  // مبلغ خالی یعنی «همان مبلغ موعد» — حالت رایج
  const paidAmount = toMoney(input.amount) ?? inst.amount;

  await prisma.orderCreditInstallment.update({
    where: { id: installmentId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidAmount,
      paidNote: typeof input.note === "string" ? input.note.trim().slice(0, 500) || null : null,
      confirmedById: access.userId,
      confirmedByName: access.name,
    },
  });

  const stillOpen = await prisma.orderCreditInstallment.count({
    where: { orderId: inst.orderId, status: "DUE" },
  });

  let orderClosed = false;
  if (stillOpen === 0 && inst.order.status === "PENDING_PAYMENT") {
    await prisma.order.update({ where: { id: inst.orderId }, data: { status: "PAID" } });
    orderClosed = true;
    // معامله‌ی سود از همان مسیر عادی ساخته می‌شود — import چرخه‌ای نشود
    const { syncDealSafe } = await import("./deals");
    syncDealSafe(inst.orderId);
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "ORDER",
    entityId: inst.orderId,
    entityTitle: `سفارش ${inst.order.orderNumber}`,
    summary:
      `واریز قسط ${inst.seq}: ${paidAmount.toLocaleString("fa-IR")} تومان` +
      (orderClosed ? " — بدهی سفارش تسویه شد" : ` — ${stillOpen} موعد باز مانده`),
    actor: { id: access.userId, name: access.name },
  });

  return { orderClosed, stillOpen };
}

/** تمدید موعد — تاریخ عوض می‌شود و یادآوری از نو فرستاده می‌شود */
export async function postponeInstallment(installmentId: string, newDate: string | Date) {
  const day = toDay(newDate);
  if (!day) throw new Error("تاریخ نامعتبر است");

  const inst = await prisma.orderCreditInstallment.findUnique({
    where: { id: installmentId },
    select: { status: true },
  });
  if (!inst) throw new Error("موعد پیدا نشد");
  if (inst.status !== "DUE") throw new Error("فقط موعد پرداخت‌نشده تمدید می‌شود");

  // ⚠️ `reminderSentAt` پاک می‌شود وگرنه یادآوریِ تاریخ تازه هرگز نمی‌رود
  await prisma.orderCreditInstallment.update({
    where: { id: installmentId },
    data: { dueDate: day, reminderSentAt: null },
  });
}

// ─────────────────────────────────────────────────────────────────
// چرخه‌ی زمان‌بند
// ─────────────────────────────────────────────────────────────────

export interface CreditCycleResult {
  remindersQueued: number;
  tasksCreated: number;
  unowned: number;
}

/**
 * یک چرخه: یادآوری فردا + کار پیگیری امروز.
 *
 * هر دو بخش مستقل‌اند و خطای یکی دیگری را متوقف نمی‌کند.
 */
export async function runCreditCycle(): Promise<CreditCycleResult> {
  const today = dayKeyOf(new Date());
  const tomorrow = new Date(today.getTime() + DAY_MS);

  const remindersQueued = await sendReminders(tomorrow).catch((e) => {
    console.error("[credit] یادآوری موعد شکست خورد:", e);
    return 0;
  });
  const followUps = await createFollowUpTasks(today).catch((e) => {
    console.error("[credit] ساخت کار پیگیری شکست خورد:", e);
    return { created: 0, unowned: 0 };
  });

  return {
    remindersQueued,
    tasksCreated: followUps.created,
    unowned: followUps.unowned,
  };
}

/**
 * پیامک یادآوری ۲۴ساعته.
 *
 * روز تعطیل عقب نمی‌افتد — موعدِ پول است نه کار. ساعت مجاز ارسال هم روی
 * پیام خدماتی اعمال نمی‌شود و همان رفتار موتور پیامک باشگاه حاکم است.
 */
async function sendReminders(tomorrow: Date): Promise<number> {
  const template = await prisma.smsTemplate.findUnique({
    where: { key: REMINDER_TEMPLATE_KEY },
    select: { id: true, body: true, isActive: true, channelBodies: { select: { channel: true, body: true } } },
  });
  // قالب نبود یا خاموش است: یادآوری نمی‌رود و `reminderSentAt` هم دست نمی‌خورد،
  // پس روشن‌کردن قالب، یادآوری‌های عقب‌مانده را از دست نمی‌دهد
  if (!template?.isActive || !template.body) return 0;

  const due = await prisma.orderCreditInstallment.findMany({
    where: { status: "DUE", dueDate: tomorrow, reminderSentAt: null },
    select: {
      id: true, amount: true, dueDate: true,
      order: {
        select: {
          orderNumber: true,
          user: { select: { firstName: true, lastName: true, phone: true, clubProfile: { select: { id: true } } } },
        },
      },
    },
    take: 200,
  });
  if (due.length === 0) return 0;

  const store = (await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { storeName: true },
  }))?.storeName ?? "";

  let queued = 0;
  for (const inst of due) {
    const profileId = inst.order.user.clubProfile?.id;
    // بدون پروفایل باشگاه کانالی برای ارسال نیست. `reminderSentAt` را
    // **نمی‌نویسیم** تا اگر بعداً پروفایل ساخته شد، یادآوری برود.
    if (!profileId) continue;

    // ⚠️ تصاحب اتمی **قبل از** صف. اگر دو چرخه هم‌زمان اجرا شوند، فقط یکی
    // `count = 1` می‌گیرد و فقط همان صف می‌کند.
    const claimed = await prisma.orderCreditInstallment.updateMany({
      where: { id: inst.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (claimed.count === 0) continue;

    const vars = {
      name: [inst.order.user.firstName, inst.order.user.lastName].filter(Boolean).join(" ").trim()
        || inst.order.user.phone,
      store,
      order: inst.order.orderNumber,
      amount: inst.amount.toLocaleString("fa-IR"),
      due: formatJalali(inst.dueDate),
    };

    const bodyByChannel: Record<string, string> = { SMS: renderTemplate(template.body, vars) };
    for (const cb of template.channelBodies) {
      if (cb.body) bodyByChannel[cb.channel] = renderTemplate(cb.body, vars);
    }

    try {
      await enqueueMultiChannelBatch(
        {
          kind: "TRANSACTIONAL",
          bodyByChannel,
          profileIds: [profileId],
          varsByProfile: { [profileId]: vars },
          templateKey: REMINDER_TEMPLATE_KEY,
        },
        { jobId: makeJobId("credit-due", inst.id) },
      );
      queued++;
    } catch (e) {
      // صف نگرفت: نشانه را پس می‌دهیم تا چرخه‌ی بعد دوباره تلاش کند
      await prisma.orderCreditInstallment.updateMany({
        where: { id: inst.id },
        data: { reminderSentAt: null },
      });
      console.error("[credit] صف یادآوری شکست خورد:", e);
    }
  }

  return queued;
}

/**
 * کار پیگیری برای موعدی که امروز رسیده یا گذشته و پرداخت نشده.
 *
 * مسئول: صاحب مشتری در باشگاه؛ اگر بی‌صاحب بود، ثبت‌کننده‌ی سفارش؛ اگر
 * هیچ‌کدام، کاری ساخته نمی‌شود و موعد در فهرست «بی‌مسئول» مدیر می‌ماند.
 */
async function createFollowUpTasks(today: Date): Promise<{ created: number; unowned: number }> {
  const type = await prisma.staffTaskType.findUnique({
    where: { slug: FOLLOW_UP_TYPE_SLUG },
    select: { id: true, title: true, domain: true, channel: true },
  });
  if (!type) return { created: 0, unowned: 0 };

  const due = await prisma.orderCreditInstallment.findMany({
    where: { status: "DUE", dueDate: { lte: today }, followUpTaskId: null },
    select: {
      id: true, amount: true, dueDate: true, seq: true, orderId: true,
      order: {
        select: {
          orderNumber: true,
          userId: true,
          createdByStaffId: true,
          createdByStaff: { select: { firstName: true, lastName: true, phone: true } },
          user: {
            select: {
              firstName: true, lastName: true, phone: true,
              clubProfile: { select: { ownerId: true, ownerName: true } },
            },
          },
        },
      },
    },
    take: 100,
  });

  const name = (u: { firstName: string | null; lastName: string | null; phone: string } | null) =>
    u ? [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone : null;

  let created = 0;
  let unowned = 0;

  for (const inst of due) {
    const ownerId = inst.order.user.clubProfile?.ownerId ?? inst.order.createdByStaffId ?? null;
    const ownerName =
      inst.order.user.clubProfile?.ownerName ?? name(inst.order.createdByStaff) ?? null;

    if (!ownerId || !ownerName) {
      unowned++;
      continue;
    }

    // مهلت: پایان همان روزِ موعد. تا آخر روز بسته نشود، فردا قرمز است.
    const dueAt = new Date(inst.dueDate.getTime() + DAY_MS - 1);

    try {
      const task = await prisma.staffTask.create({
        data: {
          typeId: type.id,
          domain: type.domain,
          channel: type.channel,
          source: "RECURRING",
          title: `پیگیری واریز قسط ${inst.seq} — سفارش ${inst.order.orderNumber}`,
          ownerId,
          ownerName,
          createdByName: "سیستم",
          status: "OPEN",
          // موعدِ گذشته فوری است؛ موعد امروز عادی
          priority: inst.dueDate.getTime() < today.getTime() ? "URGENT" : "NORMAL",
          customerId: inst.order.userId,
          contactName: name(inst.order.user),
          contactPhone: inst.order.user.phone,
          entity: "ORDER",
          entityId: inst.orderId,
          amount: inst.amount,
          dueAt,
          occurredAt: new Date(),
          // یکتایی مثل قواعد تکرارشونده — هر موعد حداکثر یک کار
          runKey: `credit:${inst.id}`,
        },
        select: { id: true },
      });

      await prisma.orderCreditInstallment.update({
        where: { id: inst.id },
        data: { followUpTaskId: task.id },
      });
      created++;
    } catch (e) {
      // کارِ همین موعد از چرخه‌ی قبلی هست — ایندکس یکتا جلویش را گرفت
      if ((e as { code?: string }).code !== "P2002") {
        console.error("[credit] ساخت کار پیگیری شکست خورد:", e);
      }
    }
  }

  return { created, unowned };
}

// ─────────────────────────────────────────────────────────────────
// خواندن
// ─────────────────────────────────────────────────────────────────

export type CreditTab = "today" | "tomorrow" | "overdue" | "week" | "paid" | "all";

export function creditTabWhere(tab: CreditTab): Prisma.OrderCreditInstallmentWhereInput {
  const today = dayKeyOf(new Date());
  switch (tab) {
    case "today":
      return { status: "DUE", dueDate: today };
    case "tomorrow":
      return { status: "DUE", dueDate: new Date(today.getTime() + DAY_MS) };
    case "overdue":
      return { status: "DUE", dueDate: { lt: today } };
    case "week":
      return { status: "DUE", dueDate: { gte: today, lte: new Date(today.getTime() + 7 * DAY_MS) } };
    case "paid":
      return { status: "PAID" };
    case "all":
    default:
      return {};
  }
}

/**
 * مرز دسترسی: بدون `CREDIT_VIEW_ALL` فقط موعدهای مشتریانِ خودِ کارمند.
 *
 * «مشتری من» یعنی صاحبِ پروفایل باشگاه، یا سفارشی که خودش ثبت کرده — همان
 * دو مسیری که کار پیگیری هم از آن‌ها مسئول پیدا می‌کند.
 */
export function creditScope(access: StaffAccess): Prisma.OrderCreditInstallmentWhereInput | null {
  if (can(access, "CREDIT_VIEW_ALL")) return null;
  return {
    order: {
      OR: [
        { user: { clubProfile: { ownerId: access.userId } } },
        { createdByStaffId: access.userId },
      ],
    },
  };
}

export const INSTALLMENT_SELECT = {
  id: true,
  orderId: true,
  seq: true,
  dueDate: true,
  amount: true,
  status: true,
  paidAt: true,
  paidAmount: true,
  paidNote: true,
  confirmedByName: true,
  reminderSentAt: true,
  followUpTaskId: true,
  order: {
    select: {
      orderNumber: true,
      status: true,
      grandTotal: true,
      user: {
        select: {
          id: true, firstName: true, lastName: true, phone: true,
          clubProfile: { select: { ownerId: true, ownerName: true } },
        },
      },
    },
  },
} satisfies Prisma.OrderCreditInstallmentSelect;
