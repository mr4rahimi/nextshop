/**
 * سرویس کار — **تنها مسیر تغییر وضعیت `StaffTask`**.
 *
 * ⚠️ هیچ‌جای دیگری مستقیم `prisma.staffTask.update` نزنید. چرخه‌ی وضعیت
 * (یادداشت ⟵ در حال انجام، نتیجه ⟵ انجام شد) اگر دور بخورد، دقیقاً همان
 * کارِ یادداشت‌دارِ بی‌صاحبی ساخته می‌شود که در برتر ماه‌ها آمار را خراب کرد.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۶
 */

import { prisma } from "@/lib/prisma";
import { logActivityAsync } from "@/lib/activity";
import type { StaffAccess } from "@/lib/permissions";
import type { Prisma, StaffTaskStatus } from "@prisma/client";

/** فیلدهایی که فهرست و کارت کار لازم دارند */
export const TASK_SELECT = {
  id: true,
  typeId: true,
  domain: true,
  channel: true,
  source: true,
  title: true,
  ownerId: true,
  ownerName: true,
  createdById: true,
  createdByName: true,
  status: true,
  priority: true,
  customerId: true,
  contactName: true,
  contactPhone: true,
  supplierName: true,
  entity: true,
  entityId: true,
  linkUrl: true,
  amount: true,
  carrier: true,
  outcome: true,
  note: true,
  parentId: true,
  ruleId: true,
  dueAt: true,
  occurredAt: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
  type: {
    select: { id: true, slug: true, title: true, icon: true, outcomes: true },
  },
  _count: { select: { notes: true, referrals: true } },
} satisfies Prisma.StaffTaskSelect;

/**
 * کارهایی که این کاربر «درگیرشان» بوده — مبنای دسترسی برای کسی که
 * `WORK_VIEW_ALL` ندارد.
 *
 * ⚠️ فقط «مالکِ فعلی» کافی نیست. کسی که کاری را ارجاع می‌دهد بلافاصله
 * مالکیتش را از دست می‌دهد، و اگر دسترسی هم از دست بدهد دیگر نمی‌تواند
 * پیگیری کند که گیرنده انجامش داد یا نه. همین باعث می‌شود ارجاع را اصلاً
 * نزند و کار را خودش نگه دارد.
 *
 * این با فیلترِ **نمایشِ** «کارهای من» فرق دارد: آن `ownerId` است و همان
 * می‌ماند. این فقط مرز دسترسی است.
 */
export function involvedFilter(userId: string): Prisma.StaffTaskWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { createdById: userId },
      { referrals: { some: { fromId: userId } } },
      { referrals: { some: { toId: userId } } },
    ],
  };
}

/** آیا این کاربر حق دیدن این کار را دارد (وقتی `WORK_VIEW_ALL` ندارد) */
export async function isInvolved(taskId: string, userId: string): Promise<boolean> {
  const hit = await prisma.staffTask.findFirst({
    where: { id: taskId, ...involvedFilter(userId) },
    select: { id: true },
  });
  return !!hit;
}

export interface CreateTaskInput {
  typeId: string;
  title?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  customerId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  supplierName?: string | null;
  entity?: string | null;
  entityId?: string | null;
  linkUrl?: string | null;
  amount?: string | number | null;
  carrier?: string | null;
  outcome?: string | null;
  note?: string | null;
  parentId?: string | null;
  dueAt?: string | Date | null;
  occurredAt?: string | Date | null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toBigInt(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return BigInt(typeof value === "number" ? Math.round(value) : value);
  } catch {
    return null;
  }
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * ثبت یک کار.
 *
 * کارِ بدون نتیجه `OPEN` می‌ماند؛ کاری که همان لحظه نتیجه‌اش ثبت می‌شود
 * مستقیم `DONE` می‌شود — این حالت رایج «تماس گرفتم و تمام شد» است.
 *
 * `dueAt` اگر داده نشده باشد از `slaMinutes` نوع کار پر می‌شود. این تنها جایی
 * است که سیستم بدون دخالت آدم مهلت می‌گذارد و همان چیزی است که وعده‌ی
 * «ارسال سه‌ساعته» را قابل دفاع می‌کند.
 */
export async function createTask(input: CreateTaskInput, access: StaffAccess) {
  const type = await prisma.staffTaskType.findUnique({
    where: { id: input.typeId },
    select: {
      id: true,
      title: true,
      domain: true,
      channel: true,
      source: true,
      slaMinutes: true,
      isActive: true,
    },
  });

  if (!type) throw new Error("نوع کار پیدا نشد");
  if (!type.isActive) throw new Error("این نوع کار غیرفعال شده است");

  const outcome = trimOrNull(input.outcome);
  const now = new Date();
  const dueAt =
    toDate(input.dueAt) ??
    (type.slaMinutes ? new Date(now.getTime() + type.slaMinutes * 60_000) : null);

  const task = await prisma.staffTask.create({
    data: {
      typeId: type.id,
      // دامنه و کانال کپی می‌شوند تا تغییر بعدیِ نوع، گزارش گذشته را جابه‌جا نکند
      domain: type.domain,
      channel: type.channel,
      source: type.source === "SYSTEM" ? "MANUAL" : type.source,
      title: trimOrNull(input.title) ?? type.title,

      ownerId: input.ownerId ?? access.userId,
      ownerName: trimOrNull(input.ownerName) ?? access.name,
      createdById: access.userId,
      createdByName: access.name,

      status: outcome ? "DONE" : "OPEN",
      priority: input.priority ?? "NORMAL",

      customerId: input.customerId ?? null,
      contactName: trimOrNull(input.contactName),
      contactPhone: trimOrNull(input.contactPhone),
      supplierName: trimOrNull(input.supplierName),

      entity: (input.entity as never) ?? null,
      entityId: trimOrNull(input.entityId),
      linkUrl: trimOrNull(input.linkUrl),
      amount: toBigInt(input.amount),
      carrier: trimOrNull(input.carrier),

      outcome,
      note: trimOrNull(input.note),
      parentId: input.parentId ?? null,

      dueAt,
      occurredAt: toDate(input.occurredAt) ?? now,
      doneAt: outcome ? now : null,
    },
    select: TASK_SELECT,
  });

  logActivityAsync({
    action: "CREATE",
    entity: "STAFF_TASK",
    entityId: task.id,
    entityTitle: task.title,
    summary: `ثبت کار «${task.title}»`,
  });

  return task;
}

export interface UpdateTaskInput {
  title?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status?: StaffTaskStatus;
  outcome?: string | null;
  note?: string | null;
  customerId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  supplierName?: string | null;
  linkUrl?: string | null;
  amount?: string | number | null;
  carrier?: string | null;
  dueAt?: string | Date | null;
  occurredAt?: string | Date | null;
}

/**
 * ویرایش کار و تغییر وضعیت.
 *
 * قاعده‌ی وضعیت، به همان ترتیبی که اعمال می‌شود:
 *  - ثبت نتیجه ⟵ `DONE`
 *  - وضعیت صریح در ورودی، حرف آخر را می‌زند
 *  - بازکردن دوباره‌ی کارِ بسته، `doneAt` را پاک می‌کند
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  access: StaffAccess,
) {
  const before = await prisma.staffTask.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, outcome: true, doneAt: true },
  });
  if (!before) throw new Error("کار پیدا نشد");

  const data: Prisma.StaffTaskUpdateInput = {};
  const has = (k: keyof UpdateTaskInput) => Object.prototype.hasOwnProperty.call(input, k);

  // ⚠️ فقط فیلدهایی نوشته می‌شوند که واقعاً در بدنه آمده‌اند. یک PATCH ناقص
  // نباید بقیه‌ی فیلدها را خالی کند — همان اشتباهی که یک بار روی محصولات رخ داد.
  if (has("title")) data.title = trimOrNull(input.title) ?? before.title;
  if (has("priority")) data.priority = input.priority;
  if (has("customerId")) data.customerId = input.customerId ?? null;
  if (has("contactName")) data.contactName = trimOrNull(input.contactName);
  if (has("contactPhone")) data.contactPhone = trimOrNull(input.contactPhone);
  if (has("supplierName")) data.supplierName = trimOrNull(input.supplierName);
  if (has("linkUrl")) data.linkUrl = trimOrNull(input.linkUrl);
  if (has("amount")) data.amount = toBigInt(input.amount);
  if (has("carrier")) data.carrier = trimOrNull(input.carrier);
  if (has("note")) data.note = trimOrNull(input.note);
  if (has("dueAt")) data.dueAt = toDate(input.dueAt);
  if (has("occurredAt")) data.occurredAt = toDate(input.occurredAt);

  if (has("ownerId")) {
    data.ownerId = input.ownerId ?? null;
    data.ownerName = trimOrNull(input.ownerName) ?? access.name;
  }

  let nextStatus: StaffTaskStatus = before.status;

  if (has("outcome")) {
    const outcome = trimOrNull(input.outcome);
    data.outcome = outcome;
    if (outcome) nextStatus = "DONE";
  }

  if (has("status") && input.status) nextStatus = input.status;

  if (nextStatus !== before.status) {
    data.status = nextStatus;
    data.doneAt = nextStatus === "DONE" ? new Date() : null;
  }

  const task = await prisma.staffTask.update({
    where: { id },
    data,
    select: TASK_SELECT,
  });

  logActivityAsync({
    action: "UPDATE",
    entity: "STAFF_TASK",
    entityId: task.id,
    entityTitle: task.title,
    summary:
      nextStatus !== before.status
        ? `وضعیت کار «${task.title}» به «${nextStatus}» تغییر کرد`
        : `ویرایش کار «${task.title}»`,
  });

  return task;
}

/**
 * افزودن یادداشت.
 *
 * **یادداشت‌گذاشتن کار را `IN_PROGRESS` می‌کند** — مگر اینکه قبلاً بسته شده باشد.
 * دلیلش این است که یادداشت اغلب روزها بعد و توسط کسی غیر از مسئولِ کار نوشته
 * می‌شود، و بدون این قاعده هیچ ردی از آن کار روی خودِ کار نمی‌ماند.
 */
export async function addNote(taskId: string, body: string, access: StaffAccess) {
  const text = body.trim();
  if (!text) throw new Error("متن یادداشت خالی است");

  const task = await prisma.staffTask.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, status: true },
  });
  if (!task) throw new Error("کار پیدا نشد");

  const [note] = await prisma.$transaction([
    prisma.staffTaskNote.create({
      data: {
        taskId,
        authorId: access.userId,
        authorName: access.name,
        body: text,
      },
    }),
    ...(task.status === "OPEN"
      ? [
          prisma.staffTask.update({
            where: { id: taskId },
            data: { status: "IN_PROGRESS" },
          }),
        ]
      : []),
  ]);

  return note;
}

/** یادداشت‌های یک کار، قدیمی‌ترین اول — رشته‌ی گفتگو به ترتیب خوانده می‌شود */
export async function listNotes(taskId: string) {
  return prisma.staffTaskNote.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────────
// ارجاع
// ─────────────────────────────────────────────────────────────────

export interface ReferInput {
  toId: string;
  note?: string | null;
  isUrgent?: boolean;
}

/**
 * ارجاع کار به کارمند دیگر.
 *
 * سه اثر همزمان، همه در یک تراکنش:
 *  ۱. ردیف تازه در `StaffTaskReferral` — تاریخچه هیچ‌وقت پاک نمی‌شود
 *  ۲. `ownerId` کار به گیرنده منتقل می‌شود
 *  ۳. کارِ بسته دوباره باز می‌شود
 *
 * اثر سوم عمدی است: ارجاعِ تازه یعنی کسی هنوز کار دارد. اگر `DONE` بماند، از
 * صف گیرنده بیرون می‌افتد و ارجاع بی‌اثر می‌شود.
 *
 * **یادداشت اجباری نیست.** سناریوی واقعی «الف تماس را به ب ارجاع می‌دهد چون
 * پرونده دست ب است» توضیح لازم ندارد، و اجباری‌کردنش یعنی ارجاع انجام نمی‌شود.
 */
export async function referTask(
  taskId: string,
  input: ReferInput,
  access: StaffAccess,
) {
  const task = await prisma.staffTask.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, status: true, ownerId: true },
  });
  if (!task) throw new Error("کار پیدا نشد");

  if (input.toId === task.ownerId) {
    throw new Error("این کار همین حالا به همین نفر سپرده شده است");
  }

  const to = await prisma.user.findUnique({
    where: { id: input.toId },
    select: { id: true, firstName: true, lastName: true, phone: true, isActive: true, role: true },
  });
  if (!to || !to.isActive) throw new Error("گیرنده پیدا نشد یا غیرفعال است");
  if (to.role !== "ADMIN" && to.role !== "SELLER") {
    throw new Error("کار فقط به کارکنان ارجاع می‌شود");
  }

  const toName =
    [to.firstName, to.lastName].filter(Boolean).join(" ").trim() || to.phone || "بدون نام";

  const [referral] = await prisma.$transaction([
    prisma.staffTaskReferral.create({
      data: {
        taskId,
        fromId: access.userId,
        fromName: access.name,
        toId: to.id,
        toName,
        note: trimOrNull(input.note),
        isUrgent: input.isUrgent === true,
      },
    }),
    prisma.staffTask.update({
      where: { id: taskId },
      data: {
        ownerId: to.id,
        ownerName: toName,
        // ارجاعِ تازه کارِ بسته را دوباره باز می‌کند
        status: "IN_PROGRESS",
        doneAt: null,
      },
    }),
  ]);

  logActivityAsync({
    action: "UPDATE",
    entity: "STAFF_TASK",
    entityId: taskId,
    entityTitle: task.title,
    summary: `ارجاع کار «${task.title}» به ${toName}`,
  });

  return referral;
}

/** تاریخچه‌ی ارجاع یک کار، قدیمی‌ترین اول */
export async function listReferrals(taskId: string) {
  return prisma.staffTaskReferral.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * پاک‌کردن نشان «جدید» برای بیننده.
 *
 * ⚠️ فقط از مسیرهایی صدا زده می‌شود که کاربر **عملاً ردیف را باز کرده**:
 * خواندن تاریخچه‌ی ارجاع، یا زدن دکمه‌ی «دیدم» روی پاپ‌آپ. هرگز از رندر فهرست.
 */
export async function markReferralsSeen(
  userId: string,
  opts: { taskId?: string; referralIds?: string[] },
) {
  const where: Prisma.StaffTaskReferralWhereInput = { toId: userId, seenAt: null };
  if (opts.taskId) where.taskId = opts.taskId;
  if (opts.referralIds?.length) where.id = { in: opts.referralIds };
  // بدون هیچ شرطی، همه‌ی ارجاع‌های کاربر پاک می‌شد — این را نمی‌خواهیم
  if (!opts.taskId && !opts.referralIds?.length) return { count: 0 };

  return prisma.staffTaskReferral.updateMany({ where, data: { seenAt: new Date() } });
}

/**
 * ویرایش یادداشت.
 *
 * نویسنده همیشه می‌تواند یادداشت خودش را ویرایش کند؛ بقیه فقط با
 * `WORK_EDIT_ALL`. این را عمداً اینجا چک می‌کنیم نه در مسیر API، تا هر
 * فراخوانی از هر جایی همین قاعده را داشته باشد.
 */
export async function editNote(
  noteId: string,
  body: string,
  access: StaffAccess,
  canEditAll: boolean,
) {
  const text = body.trim();
  if (!text) throw new Error("متن یادداشت خالی است");

  const note = await prisma.staffTaskNote.findUnique({
    where: { id: noteId },
    select: { id: true, authorId: true },
  });
  if (!note) throw new Error("یادداشت پیدا نشد");

  if (note.authorId !== access.userId && !canEditAll) {
    throw new Error("فقط نویسنده می‌تواند این یادداشت را ویرایش کند");
  }

  return prisma.staffTaskNote.update({
    where: { id: noteId },
    data: { body: text, editedAt: new Date() },
  });
}
