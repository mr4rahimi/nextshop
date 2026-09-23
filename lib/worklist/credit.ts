/**
 * خرید اعتباری — موعدهای پرداخت، یادآوری و پیگیری (فاز ۱۰، بخش ۲۴ مستندات).
 *
 * چرخه: سفارش تلفنی «اعتباری» با موعدها ثبت می‌شود (`setInstallments` یا
 * مسیر ساخت سفارش) ← روز قبل از هر موعد پیامک یادآوری ← روز موعد کار «پیگیری
 * پرداخت» در کارتابل صاحب مشتری ← واریز با `payInstallment` (از صفحه‌ی موعدها
 * یا با بستن همان کار با «پرداخت شد») ← آخرین واریز، سود و امتیاز سفارش را آزاد
 * می‌کند.
 *
 * ⚠️ **وضعیت تازه‌ی سفارش ساخته نشد.** تصمیم بخش ۲۴.۳: سفارش اعتباری
 * `CONFIRMED` ثبت می‌شود (کالا رفته، موجودی کسر شده، زنجیره‌ی ارسال عادی کار
 * می‌کند). هرکس بخواهد بداند پول رسیده یا نه، `hasOpenCredit` را می‌پرسد —
 * امروز معامله‌ی سود (`deals.ts`) و امتیاز باشگاه (`club/rewards.ts`).
 *
 * ⚠️ سه محافظ که بدون هرکدام این قابلیت خطرناک می‌شود:
 *
 * **۱. جمع موعدها = مبلغ سفارش.** `validateInstallments` تا نخواند ذخیره
 * نمی‌کند. بدون این، «مانده‌ی بدهی» هیچ‌وقت با فاکتور نمی‌خواند.
 *
 * **۲. یادآوری دو بار نمی‌رود.** `reminderSentAt` با `updateMany` شرط‌دار
 * **پیش از** ارسال نوشته می‌شود — همان الگوی تصاحب اتمی فاز ۸. دو پروسه یا
 * دو چرخه‌ی هم‌زمان، یکی برنده می‌شود.
 *
 * **۳. هر موعد در هر تاریخ حداکثر یک کار پیگیری.** `runKey = credit:{id}:{روز}`
 * روی `StaffTask` ایندکس یکتا دارد. روز در کلید است تا موعدِ تمدیدشده در
 * تاریخ تازه‌اش دوباره کار بگیرد.
 *
 * «امروز» و «فردا» همیشه به وقت تهران و از `dayKeyOf` می‌آیند، نه ساعت سرور
 * (تله‌ی ۲۷).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { dayKeyOf } from "./attendance";
import { formatJalali } from "@/lib/club/jalali";
import { dispatchBatch, getProvider, loadSmsConfig, pickLine } from "@/lib/club/sms";
import { applyGuards, isWithinAllowedHours, loadGuardSettings } from "@/lib/club/sms/guards";
import { logActivityAsync } from "@/lib/activity";
import { can, type StaffAccess } from "@/lib/permissions";

const DAY_MS = 86_400_000;
/** تهران بدون ساعت تابستانی — همان ثابت `attendance.ts` */
const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;

/** کلید قالب پیامک یادآوری — نبودش را `ensureReminderTemplate` خودش می‌سازد */
export const REMINDER_TEMPLATE_KEY = "credit-due-reminder";

/** متن پیش‌فرض یادآوری — مدیر از «باشگاه ← قالب‌ها» ویرایشش می‌کند */
export const REMINDER_DEFAULT_BODY =
  "{name} عزیز، موعد پرداخت شما بابت فاکتور {order} به مبلغ {amount} تومان فردا ({due}) می‌باشد.\n{store}";

/** وضعیت‌هایی که موعدهای باز سفارش را بی‌معنی می‌کنند */
const DEAD_ORDER_STATUSES = ["CANCELED", "REFUNDED"] as const;

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
 * وقتی آخرین موعدِ باز بسته شد، بدهی سفارش تسویه است: رکورد پرداخت موفق
 * می‌شود، معامله‌ی سود فاز ۹ ساخته می‌شود و امتیاز خرید باشگاه داده می‌شود —
 * هر دو تا این لحظه به‌خاطر `hasOpenCredit` منتظر مانده بودند.
 *
 * کار پیگیری بازِ همین موعد هم با «پرداخت شد» بسته می‌شود تا در کارتابل
 * نماند. ⚠️ مستقیم با Prisma، نه `updateTask` — آن مسیر قلاب واریز دارد و
 * دوباره همین تابع را صدا می‌زد.
 */
export async function payInstallment(
  installmentId: string,
  input: { amount?: unknown; note?: unknown },
  access: Pick<StaffAccess, "userId" | "name">,
) {
  const inst = await prisma.orderCreditInstallment.findUnique({
    where: { id: installmentId },
    select: {
      id: true, orderId: true, amount: true, status: true, seq: true, followUpTaskId: true,
      order: { select: { orderNumber: true, status: true } },
    },
  });
  if (!inst) throw new Error("موعد پیدا نشد");
  if (inst.status === "PAID") throw new Error("این موعد قبلاً پرداخت شده است");
  if (inst.status === "CANCELED") throw new Error("این موعد لغو شده است");

  // مبلغ خالی یعنی «همان مبلغ موعد» — حالت رایج
  const paidAmount = toMoney(input.amount) ?? inst.amount;

  // شرط `status: DUE` مرز واقعیِ «دو بار ثبت نشود» است، نه بررسی بالا
  const claimed = await prisma.orderCreditInstallment.updateMany({
    where: { id: installmentId, status: "DUE" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidAmount,
      paidNote: typeof input.note === "string" ? input.note.trim().slice(0, 500) || null : null,
      confirmedById: access.userId,
      confirmedByName: access.name,
    },
  });
  if (claimed.count === 0) throw new Error("این موعد هم‌زمان ثبت شد؛ صفحه را تازه کنید");

  if (inst.followUpTaskId) {
    await prisma.staffTask
      .updateMany({
        where: { id: inst.followUpTaskId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        data: { status: "DONE", outcome: "paid", doneAt: new Date() },
      })
      .catch((e) => console.error("[credit] بستن کار پیگیری ناموفق:", e));
  }

  const stillOpen = await prisma.orderCreditInstallment.count({
    where: { orderId: inst.orderId, status: "DUE" },
  });

  let orderClosed = false;
  if (stillOpen === 0) {
    orderClosed = true;
    await prisma.payment
      .updateMany({
        where: { orderId: inst.orderId, status: "PENDING" },
        data: { status: "SUCCEEDED", providerRef: `credit-${Date.now()}` },
      })
      .catch((e) => console.error("[credit] تسویه‌ی رکورد پرداخت ناموفق:", e));
    // سفارش‌های قدیمی‌تر که «در انتظار پرداخت» ثبت شده بودند
    if (inst.order.status === "PENDING_PAYMENT") {
      await prisma.order.update({ where: { id: inst.orderId }, data: { status: "PAID" } });
    }
    // import پویا — deals و rewards هم به این فایل وابسته‌اند
    const { syncDealSafe } = await import("./deals");
    syncDealSafe(inst.orderId);
    const { processOrderForClub } = await import("@/lib/club/rewards");
    void processOrderForClub(inst.orderId);
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

/**
 * تمدید موعد — تاریخ عوض می‌شود و یادآوری و کار پیگیری از نو.
 *
 * کار پیگیری بازِ تاریخ قبلی با نتیجه‌ی «قول پرداخت داد» بسته می‌شود؛ کار
 * تاریخ تازه را چرخه‌ی زمان‌بند همان روز می‌سازد (`runKey` روز را دارد).
 */
export async function postponeInstallment(
  installmentId: string,
  newDate: string | Date,
  access?: Pick<StaffAccess, "userId" | "name">,
) {
  const day = toDay(newDate);
  if (!day) throw new Error("تاریخ نامعتبر است");
  if (day.getTime() < dayKeyOf(new Date()).getTime()) throw new Error("تاریخ تازه نباید گذشته باشد");

  const inst = await prisma.orderCreditInstallment.findUnique({
    where: { id: installmentId },
    select: { status: true, seq: true, orderId: true, followUpTaskId: true, dueDate: true, order: { select: { orderNumber: true } } },
  });
  if (!inst) throw new Error("موعد پیدا نشد");
  if (inst.status !== "DUE") throw new Error("فقط موعد پرداخت‌نشده تمدید می‌شود");

  // ⚠️ `reminderSentAt` پاک می‌شود وگرنه یادآوریِ تاریخ تازه هرگز نمی‌رود
  await prisma.orderCreditInstallment.update({
    where: { id: installmentId },
    data: { dueDate: day, reminderSentAt: null, followUpTaskId: null },
  });
  if (inst.followUpTaskId) {
    await prisma.staffTask
      .updateMany({
        where: { id: inst.followUpTaskId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        data: { status: "DONE", outcome: "promised", doneAt: new Date() },
      })
      .catch(() => {});
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "ORDER",
    entityId: inst.orderId,
    entityTitle: `سفارش ${inst.order.orderNumber}`,
    summary: `تمدید قسط ${inst.seq}: ${formatJalali(inst.dueDate)} ← ${formatJalali(day)}`,
    ...(access ? { actor: { id: access.userId, name: access.name } } : {}),
  });
}

/**
 * بستن کار «پیگیری پرداخت» یک موعد با «پرداخت شد» = ثبت واریز.
 *
 * کار از روی `runKey` به موعد وصل است. مبلغ کار (اگر پر شده) مبلغ واریز است.
 * هیچ‌وقت مسیر کار را نمی‌شکند — فراخواننده `creditFromTaskSafe` را صدا می‌زند.
 */
export async function creditFromTask(taskId: string): Promise<"paid" | "none"> {
  const task = await prisma.staffTask.findUnique({
    where: { id: taskId },
    select: { status: true, outcome: true, runKey: true, amount: true, note: true, ownerId: true, ownerName: true },
  });
  if (!task?.runKey?.startsWith("credit:") || task.status !== "DONE" || task.outcome !== "paid") return "none";
  const installmentId = task.runKey.split(":")[1];
  const inst = await prisma.orderCreditInstallment.findUnique({ where: { id: installmentId }, select: { status: true } });
  if (inst?.status !== "DUE") return "none";

  await payInstallment(
    installmentId,
    { amount: task.amount && task.amount > 0n ? task.amount : undefined, note: task.note ?? "از کار پیگیری کارتابل" },
    { userId: task.ownerId ?? "", name: task.ownerName ?? "کارتابل" },
  );
  return "paid";
}

export function creditFromTaskSafe(taskId: string): void {
  creditFromTask(taskId).catch((e) => console.error("[credit] ثبت واریز از کار پیگیری شکست خورد:", e));
}

// ─────────────────────────────────────────────────────────────────
// چرخه‌ی زمان‌بند
// ─────────────────────────────────────────────────────────────────

export interface CreditCycleResult {
  remindersSent: number;
  tasksCreated: number;
  unowned: number;
  canceled: number;
}

/**
 * یک چرخه: لغو موعدهای سفارش لغوشده + یادآوری فردا + کار پیگیری امروز +
 * پاپ‌آپ موعد گذشته.
 *
 * هر بخش مستقل است و خطای یکی دیگری را متوقف نمی‌کند.
 */
export async function runCreditCycle(): Promise<CreditCycleResult> {
  const today = dayKeyOf(new Date());
  const tomorrow = new Date(today.getTime() + DAY_MS);

  // اول لغو، تا سفارش لغوشده پیامک و کار نگیرد
  const canceled = await cancelDeadInstallments().catch((e) => {
    console.error("[credit] لغو موعدهای سفارش لغوشده شکست خورد:", e);
    return 0;
  });
  const remindersSent = await sendReminders(tomorrow).catch((e) => {
    console.error("[credit] یادآوری موعد شکست خورد:", e);
    return 0;
  });
  const followUps = await createFollowUpTasks(today).catch((e) => {
    console.error("[credit] ساخت کار پیگیری شکست خورد:", e);
    return { created: 0, unowned: 0 };
  });
  await popupOverdue(today).catch((e) => console.error("[credit] پاپ‌آپ موعد گذشته شکست خورد:", e));

  return { remindersSent, tasksCreated: followUps.created, unowned: followUps.unowned, canceled };
}

/**
 * موعدهای باز سفارشِ لغو یا مرجوع‌شده ← CANCELED.
 *
 * در چرخه است نه در قلاب مسیر لغو، چون وضعیت سفارش از چند جا عوض می‌شود —
 * همان دلیل `sweepDeals`. حداکثر ده دقیقه عقب می‌ماند و در آن فاصله هم
 * `sendReminders` و `createFollowUpTasks` سفارش مرده را خودشان رد می‌کنند.
 */
async function cancelDeadInstallments(): Promise<number> {
  const r = await prisma.orderCreditInstallment.updateMany({
    where: { status: "DUE", order: { status: { in: [...DEAD_ORDER_STATUSES] } } },
    data: { status: "CANCELED" },
  });
  return r.count;
}

/**
 * قالب یادآوری. نبود ← با متن پیش‌فرض و **فعال** ساخته می‌شود، تا قابلیت روی
 * سایت تازه بدون سید کار کند. ⚠️ اگر مدیر خاموشش کرده باشد دوباره روشن
 * نمی‌شود — خاموش یعنی «نفرست».
 */
export async function ensureReminderTemplate() {
  const select = { id: true, body: true, isActive: true, mode: true, patternCode: true, kind: true } as const;
  const found = await prisma.smsTemplate.findUnique({ where: { key: REMINDER_TEMPLATE_KEY }, select });
  if (found) return found;
  try {
    return await prisma.smsTemplate.create({
      data: {
        key: REMINDER_TEMPLATE_KEY,
        title: "یادآوری موعد پرداخت اعتباری",
        kind: "TRANSACTIONAL",
        mode: "TEXT",
        body: REMINDER_DEFAULT_BODY,
        isActive: true,
      },
      select,
    });
  } catch (e) {
    // دو پروسه هم‌زمان ساختند
    if ((e as { code?: string }).code === "P2002") {
      return prisma.smsTemplate.findUnique({ where: { key: REMINDER_TEMPLATE_KEY }, select });
    }
    throw e;
  }
}

/**
 * ارسال یک پیامک خدماتی با قالب — هر دو حالت قالب.
 *
 * - متن آزاد (`TEXT`) ← `dispatchBatch`: نگهبان‌ها، ثبت در `SmsMessage`
 * - پترن (`PATTERN`) ← مستقیم از ارائه‌دهنده، بعد از همان نگهبان‌ها
 *
 * ⚠️ **عمداً از صف و worker رد نمی‌شود.** چند سایت worker پیامک ندارند؛ صف
 * بدون worker یعنی یادآوری‌ای که «فرستاده» ثبت می‌شود ولی هرگز نمی‌رود. یک
 * پیامک تکی از خود زمان‌بند فرستاده می‌شود.
 */
async function sendTemplateSms(
  template: { mode: string; patternCode: string | null; body: string | null },
  phone: string,
  userId: string,
  vars: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  if (template.mode === "PATTERN") {
    if (!template.patternCode) return { ok: false, error: "کد پترن قالب خالی است" };
    const { allowed, skipped } = await applyGuards([{ phone, userId }], "TRANSACTIONAL");
    if (allowed.length === 0) return { ok: false, error: `رد شد: ${skipped[0]?.reason ?? "نامعلوم"}` };
    const config = await loadSmsConfig();
    const line = pickLine(config, "TRANSACTIONAL");
    if (!line) return { ok: false, error: "خط خدماتی تنظیم نشده است" };
    const res = await (await getProvider()).sendPattern(template.patternCode, allowed[0].phone, vars, line);
    await prisma.smsMessage
      .create({
        data: {
          phone: allowed[0].phone,
          userId,
          templateKey: REMINDER_TEMPLATE_KEY,
          kind: "TRANSACTIONAL",
          lineNumber: line,
          body: JSON.stringify(vars),
          providerRequestId: res.requestId ?? null,
          status: res.ok ? "SENT" : "FAILED",
          errorMessage: res.ok ? null : res.error ?? null,
          sentAt: res.ok ? new Date() : null,
        },
      })
      .catch(() => {});
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }

  if (!template.body) return { ok: false, error: "متن قالب خالی است" };
  const r = await dispatchBatch({
    kind: "TRANSACTIONAL",
    text: template.body,
    recipients: [{ phone, userId, vars }],
    templateKey: REMINDER_TEMPLATE_KEY,
  });
  return r.sentCount > 0 ? { ok: true } : { ok: false, error: "نگهبان پیامک رد کرد (لغو عضویت یا مسدود)" };
}

/**
 * پیامک یادآوری روز قبل از موعد.
 *
 * فقط در **ساعت مجاز ارسال** (تنظیمات باشگاه، پیش‌فرض ۹ تا ۲۱ به وقت تهران).
 * بدون این شرط، چرخه‌ی اولِ بعد از نیمه‌شب یادآوری را ساعت دوازده و ده دقیقه‌ی
 * شب می‌فرستاد. موعدِ فردا تا پایان امروز واجد شرایط می‌ماند، پس با شروع ساعت
 * مجاز صبح همان روز می‌رود.
 *
 * روز تعطیل عقب نمی‌افتد — موعدِ پول است نه کار.
 */
async function sendReminders(tomorrow: Date): Promise<number> {
  if (!isWithinAllowedHours(await loadGuardSettings())) return 0;

  const template = await ensureReminderTemplate();
  // قالب خاموش: `reminderSentAt` دست نمی‌خورد، پس روشن‌کردن دوباره‌ی قالب
  // یادآوری‌های همان روز را از دست نمی‌دهد
  if (!template?.isActive) return 0;

  const due = await prisma.orderCreditInstallment.findMany({
    where: {
      status: "DUE",
      dueDate: tomorrow,
      reminderSentAt: null,
      order: { status: { notIn: [...DEAD_ORDER_STATUSES] } },
    },
    select: {
      id: true, amount: true, dueDate: true,
      order: {
        select: {
          orderNumber: true,
          userId: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
    take: 200,
  });
  if (due.length === 0) return 0;

  // پیامکِ سایت تنظیم نشده: بی‌صدا هیچ. بدون این، خطای «خط تنظیم نشده» گذرا
  // حساب می‌شد و هر ده دقیقه تا آخر روز تکرار و لاگ می‌شد.
  const smsConfig = await loadSmsConfig();
  if (!pickLine(smsConfig, "TRANSACTIONAL")) return 0;
  const store = smsConfig.storeName;

  let sent = 0;
  for (const inst of due) {
    // ⚠️ تصاحب اتمی **قبل از** ارسال. اگر دو چرخه هم‌زمان اجرا شوند، فقط یکی
    // `count = 1` می‌گیرد و فقط همان می‌فرستد.
    const claimed = await prisma.orderCreditInstallment.updateMany({
      where: { id: inst.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (claimed.count === 0) continue;

    const u = inst.order.user;
    const vars = {
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "مشتری",
      store,
      order: inst.order.orderNumber,
      amount: inst.amount.toLocaleString("fa-IR"),
      due: formatJalali(inst.dueDate),
    };

    try {
      const r = await sendTemplateSms(template, u.phone, inst.order.userId, vars);
      if (r.ok) sent++;
      // رد نگهبان (لغو عضویت، مسدود) یا خطای ارائه‌دهنده: نشانه می‌ماند تا هر
      // ده دقیقه دوباره تلاش نشود. در SmsMessage و لاگ دیده می‌شود.
      else console.warn(`[credit] یادآوری قسط ${inst.id} نرفت: ${r.error}`);
    } catch (e) {
      // خطای گذرا (شبکه): نشانه را پس می‌دهیم تا چرخه‌ی بعد دوباره تلاش کند
      await prisma.orderCreditInstallment.updateMany({
        where: { id: inst.id },
        data: { reminderSentAt: null },
      });
      console.error("[credit] ارسال یادآوری شکست خورد:", e);
    }
  }

  return sent;
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
    select: { id: true, title: true, domain: true, channel: true, isActive: true },
  });
  if (!type?.isActive) return { created: 0, unowned: 0 };

  const due = await prisma.orderCreditInstallment.findMany({
    where: {
      status: "DUE",
      dueDate: { lte: today },
      followUpTaskId: null,
      order: { status: { notIn: [...DEAD_ORDER_STATUSES] } },
    },
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
          _count: { select: { installments: true } },
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
      (inst.order.user.clubProfile?.ownerId ? inst.order.user.clubProfile.ownerName : null) ??
      name(inst.order.createdByStaff);

    if (!ownerId || !ownerName) {
      unowned++;
      continue;
    }

    // مهلت: پایان همان روزِ موعد به وقت تهران. تا آخر روز بسته نشود، قرمز است.
    const dueAt = new Date(inst.dueDate.getTime() + DAY_MS - TEHRAN_OFFSET_MS - 1);
    const total = inst.order._count.installments;
    const overdue = inst.dueDate.getTime() < today.getTime();

    try {
      const task = await prisma.staffTask.create({
        data: {
          typeId: type.id,
          domain: type.domain,
          channel: type.channel,
          source: "RECURRING",
          title:
            total > 1
              ? `پیگیری واریز قسط ${inst.seq.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")} — سفارش ${inst.order.orderNumber}`
              : `پیگیری واریز سفارش اعتباری ${inst.order.orderNumber}`,
          ownerId,
          ownerName,
          createdByName: "سیستم",
          status: "OPEN",
          // موعدِ گذشته فوری است؛ موعد امروز عادی
          priority: overdue ? "URGENT" : "NORMAL",
          customerId: inst.order.userId,
          contactName: name(inst.order.user),
          contactPhone: inst.order.user.phone,
          entity: "ORDER",
          entityId: inst.orderId,
          amount: inst.amount,
          note:
            `موعد ${formatJalali(inst.dueDate)} — ${inst.amount.toLocaleString("fa-IR")} تومان.\n` +
            "اگر واریز شد، کار را با «پرداخت شد» ببندید؛ واریز خودکار ثبت می‌شود. " +
            "برای تمدید موعد از «کارتابل ← موعدهای پرداخت» استفاده کنید.",
          dueAt,
          occurredAt: new Date(),
          // یکتایی — هر موعد در هر تاریخ حداکثر یک کار (تمدید، کار تازه می‌گیرد)
          runKey: `credit:${inst.id}:${inst.dueDate.toISOString().slice(0, 10)}`,
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

/**
 * پاپ‌آپ فوری برای موعدی که **گذشته** و کار پیگیری‌اش هنوز باز است.
 *
 * از همان راه ارجاع فوری (`StaffTaskReferral.isUrgent`) می‌رود که
 * `WorklistNotifier` می‌خواند. ارجاعِ سیستمی (`fromId = null`) روی همان کار،
 * نشانه‌ی «یک بار نشان داده شد» است — هر موعد یک پاپ‌آپ، نه هر ده دقیقه.
 */
async function popupOverdue(today: Date): Promise<number> {
  const overdue = await prisma.orderCreditInstallment.findMany({
    where: { status: "DUE", dueDate: { lt: today }, followUpTaskId: { not: null } },
    select: { followUpTaskId: true, amount: true, order: { select: { orderNumber: true } } },
    take: 100,
  });
  const ids = overdue.map((o) => o.followUpTaskId!);
  if (ids.length === 0) return 0;

  const [tasks, done] = await Promise.all([
    prisma.staffTask.findMany({
      where: { id: { in: ids }, status: { in: ["OPEN", "IN_PROGRESS"] }, ownerId: { not: null } },
      select: { id: true, ownerId: true, ownerName: true },
    }),
    prisma.staffTaskReferral.findMany({
      where: { taskId: { in: ids }, fromId: null, isUrgent: true },
      select: { taskId: true },
    }),
  ]);
  const already = new Set(done.map((d) => d.taskId));
  const byTask = new Map(overdue.map((o) => [o.followUpTaskId!, o]));

  let n = 0;
  for (const t of tasks) {
    if (already.has(t.id)) continue;
    const inst = byTask.get(t.id)!;
    await prisma.staffTaskReferral.create({
      data: {
        taskId: t.id,
        fromId: null,
        fromName: "سیستم",
        toId: t.ownerId!,
        toName: t.ownerName ?? "",
        isUrgent: true,
        note: `موعد پرداخت سفارش ${inst.order.orderNumber} (${inst.amount.toLocaleString("fa-IR")} تومان) گذشته و واریز ثبت نشده است.`,
      },
    });
    await prisma.staffTask.update({ where: { id: t.id }, data: { priority: "URGENT" } });
    n++;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────
// بدهی باز — برای پرونده‌ی مشتری و «سفارش‌های من»
// ─────────────────────────────────────────────────────────────────

/** مانده‌ی بدهی یک مشتری: جمع موعدهای باز و نزدیک‌ترین موعد */
export async function openDebtOf(userId: string) {
  const rows = await prisma.orderCreditInstallment.findMany({
    where: { status: "DUE", order: { userId, status: { notIn: [...DEAD_ORDER_STATUSES] } } },
    orderBy: { dueDate: "asc" },
    select: { id: true, amount: true, dueDate: true, seq: true, order: { select: { id: true, orderNumber: true } } },
  });
  const today = dayKeyOf(new Date()).getTime();
  return {
    total: rows.reduce((s, r) => s + r.amount, 0n),
    overdue: rows.filter((r) => r.dueDate.getTime() < today).reduce((s, r) => s + r.amount, 0n),
    count: rows.length,
    next: rows[0] ?? null,
    rows,
  };
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
