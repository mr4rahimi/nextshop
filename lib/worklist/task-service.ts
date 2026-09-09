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
  _count: { select: { notes: true } },
} satisfies Prisma.StaffTaskSelect;

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
