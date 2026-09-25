/**
 * سرویس کار سئو — **تنها مسیر تغییر وضعیت `SeoTask`**.
 *
 * ⚠️ هیچ‌جای دیگری مستقیم `prisma.seoTask.update` روی `status` نزنید.
 *
 * قاعده‌ی ثابتِ هر سه حوزه: **هر انتقال سه کار می‌کند** — وضعیت را عوض
 * می‌کند، یک `SeoTaskEvent` می‌سازد، و به نفر بعدی اعلان می‌دهد. جایی که
 * این سه از هم جدا شوند، گزارش‌ها دروغ می‌شوند. به همین دلیل اندپوینت
 * انتقال هم عمداً **یکی** است (`POST …/transition` با `action`)، نه شش روت.
 *
 * دو استثنای عمدی که رویداد نمی‌سازند و اعلان نمی‌دهند:
 *   - تیک چک‌لیست (کاربر ده بار تیک می‌زند و برمی‌دارد)
 *   - افزودن و حذف پیوست
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵
 */

import { prisma } from "@/lib/prisma";
import { logActivityAsync } from "@/lib/activity";
import { can, type StaffAccess } from "@/lib/permissions";
import { notify, usersWithPermission } from "./notifications";
import { parseMarketingDate } from "./dates";
import {
  SEO_ALLOWED_FROM,
  SEO_NEXT_STATUS,
  SEO_MANAGER_ACTIONS,
  SEO_ACTIONS_NEEDING_NOTE,
  SEO_STATUS_LABELS,
  type SeoAction,
} from "./types";
import type { Prisma, SeoTaskStatus, MarketingEventAction } from "@prisma/client";

/** فیلدهای فهرست — جزئیات از همین‌ها بیشتر دارد، نه کمتر */
export const SEO_TASK_SELECT = {
  id: true,
  code: true,
  categoryId: true,
  title: true,
  description: true,
  pageUrls: true,
  assigneeId: true,
  assigneeName: true,
  createdById: true,
  createdByName: true,
  status: true,
  priority: true,
  dueAt: true,
  report: true,
  returnReason: true,
  cancelReason: true,
  startedAt: true,
  reportedAt: true,
  approvedAt: true,
  approvedByName: true,
  reviewAt: true,
  reviewOutcome: true,
  reviewNote: true,
  reviewedAt: true,
  recurrenceId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, key: true, title: true } },
  _count: { select: { checklist: true, files: true, events: true } },
} satisfies Prisma.SeoTaskSelect;

/** فیلدهای اضافه‌ی صفحه‌ی جزئیات */
export const SEO_TASK_DETAIL_SELECT = {
  ...SEO_TASK_SELECT,
  checklist: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      sortOrder: true,
      doneAt: true,
      doneById: true,
      doneByName: true,
    },
  },
  files: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      fileName: true,
      mimeType: true,
      size: true,
      uploadedByName: true,
      createdAt: true,
    },
  },
  events: {
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      actorId: true,
      actorName: true,
      action: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SeoTaskSelect;

/**
 * کارهایی که این کاربر حق دیدنشان را دارد وقتی `MARKETING_VIEW_ALL` ندارد.
 *
 * ⚠️ فقط «مسئول فعلی» کافی نیست: کسی که کاری را ثبت کرده و به همکارش داده،
 * باید بتواند پیگیری کند — وگرنه دفعه‌ی بعد اصلاً ارجاع نمی‌دهد و کار را
 * خودش نگه می‌دارد. همان درسِ `involvedFilter` در کارتابل.
 */
export function seoScopeFilter(userId: string): Prisma.SeoTaskWhereInput {
  return { OR: [{ assigneeId: userId }, { createdById: userId }] };
}

/** آیا این کاربر به این کار دسترسی دارد */
export async function canSeeSeoTask(
  taskId: string,
  access: StaffAccess,
): Promise<boolean> {
  if (can(access, "MARKETING_VIEW_ALL")) return true;
  const hit = await prisma.seoTask.findFirst({
    where: { id: taskId, deletedAt: null, ...seoScopeFilter(access.userId) },
    select: { id: true },
  });
  return !!hit;
}

/** ⚠️ `new Date(string)` روی سرور UTC مهلت را ۳:۳۰ جابه‌جا می‌کرد (تله‌ی ۳) */
const toDate = (v: unknown) => parseMarketingDate(v);
/** تاریخ بررسی «از آن روز» است، نه «تا آخر آن روز» */
const toReviewDate = (v: unknown) => parseMarketingDate(v, "start");

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/** نام کارمند از روی شناسه — اسنپ‌شات، چون حساب حذف‌شده نباید گزارش را خالی کند */
async function staffName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    select: { firstName: true, lastName: true, phone: true },
  });
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone || "بدون نام";
}

// ─────────────────────────────────────────────────────────────────
// ساخت و ویرایش
// ─────────────────────────────────────────────────────────────────

export interface CreateSeoTaskInput {
  categoryId?: string;
  title?: string;
  description?: string | null;
  pageUrls?: string | null;
  assigneeId?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt?: string | null;
  reviewAt?: string | null;
  checklist?: string[];
}

export async function createSeoTask(input: CreateSeoTaskInput, access: StaffAccess) {
  const title = clean(input.title);
  if (!title) throw new Error("عنوان کار لازم است");
  if (!input.categoryId) throw new Error("دسته‌ی کار انتخاب نشده است");

  const category = await prisma.seoTaskCategory.findFirst({
    where: { id: input.categoryId, isActive: true },
    select: { id: true, title: true },
  });
  if (!category) throw new Error("دسته‌ی انتخاب‌شده معتبر نیست");

  // مسئولِ خالی یعنی خودِ سازنده. کارِ بی‌صاحب بدتر از کارِ ساخته‌نشده است.
  const assigneeId = input.assigneeId || access.userId;
  const assigneeName =
    assigneeId === access.userId ? access.name : await staffName(assigneeId);
  if (!assigneeName) throw new Error("کارمند انتخاب‌شده پیدا نشد");

  const items = (input.checklist ?? [])
    .map((t) => clean(t))
    .filter((t): t is string => !!t);

  const task = await prisma.seoTask.create({
    data: {
      categoryId: category.id,
      title,
      description: clean(input.description),
      pageUrls: clean(input.pageUrls),
      assigneeId,
      assigneeName,
      createdById: access.userId,
      createdByName: access.name,
      priority: input.priority ?? "NORMAL",
      dueAt: toDate(input.dueAt),
      reviewAt: toReviewDate(input.reviewAt),
      checklist: {
        create: items.map((t, i) => ({ title: t, sortOrder: i })),
      },
      events: {
        create: {
          actorId: access.userId,
          actorName: access.name,
          action: "CREATED",
          toStatus: "ASSIGNED",
          note: `دسته: ${category.title}`,
        },
      },
    },
    select: SEO_TASK_SELECT,
  });

  await notify({
    userIds: [assigneeId],
    actorId: access.userId,
    type: "SEO_TASK",
    entityId: task.id,
    title: `کار سئو ${task.code.toLocaleString("fa-IR")} به شما واگذار شد`,
    body: title,
    url: `/admin/worklist/seo?task=${task.id}`,
  });

  logActivityAsync({
    action: "CREATE",
    entity: "SEO_TASK",
    entityId: task.id,
    entityTitle: title,
    summary: `کار سئو «${title}» ثبت شد`,
  });

  return task;
}

export interface UpdateSeoTaskInput extends CreateSeoTaskInput {
  reviewOutcome?: "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | null;
  reviewNote?: string | null;
}

/**
 * ویرایش فیلدهای کار — **بدون دست‌زدن به وضعیت**.
 *
 * سازنده تا وقتی کار بسته نشده می‌تواند ویرایش کند؛ مدیر هر کاری را.
 */
export async function updateSeoTask(
  taskId: string,
  input: UpdateSeoTaskInput,
  access: StaffAccess,
) {
  const current = await prisma.seoTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, status: true, createdById: true, assigneeId: true, title: true },
  });
  if (!current) throw new Error("کار پیدا نشد");

  const isManager = can(access, "SEO_TASK_MANAGE");
  if (!isManager) {
    const mine =
      current.createdById === access.userId || current.assigneeId === access.userId;
    if (!mine) throw new Error("اجازه‌ی ویرایش این کار را ندارید");
    if (current.status === "DONE" || current.status === "CANCELED") {
      throw new Error("کار بسته شده است؛ ویرایشش با مدیر است");
    }
  }

  const data: Prisma.SeoTaskUpdateInput = {};

  if (input.title !== undefined) {
    const title = clean(input.title);
    if (!title) throw new Error("عنوان کار لازم است");
    data.title = title;
  }
  if (input.description !== undefined) data.description = clean(input.description);
  if (input.pageUrls !== undefined) data.pageUrls = clean(input.pageUrls);
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueAt !== undefined) data.dueAt = toDate(input.dueAt);
  if (input.reviewAt !== undefined) data.reviewAt = toReviewDate(input.reviewAt);

  if (input.categoryId !== undefined) {
    const category = await prisma.seoTaskCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new Error("دسته‌ی انتخاب‌شده معتبر نیست");
    data.category = { connect: { id: category.id } };
  }

  // تغییر مسئول یک رویداد و یک اعلان دارد — وگرنه کارمند تازه هیچ‌وقت
  // نمی‌فهمد کاری به او داده شده.
  let handedTo: string | null = null;
  if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
    if (!isManager && current.createdById !== access.userId) {
      throw new Error("اجازه‌ی تغییر مسئول این کار را ندارید");
    }
    const name = await staffName(input.assigneeId ?? null);
    if (!name) throw new Error("کارمند انتخاب‌شده پیدا نشد");
    data.assigneeId = input.assigneeId;
    data.assigneeName = name;
    handedTo = input.assigneeId ?? null;
  }

  const task = await prisma.seoTask.update({
    where: { id: taskId },
    data,
    select: SEO_TASK_SELECT,
  });

  if (handedTo) {
    await prisma.seoTaskEvent.create({
      data: {
        taskId,
        actorId: access.userId,
        actorName: access.name,
        action: "ASSIGNED",
        fromStatus: current.status,
        toStatus: current.status,
        note: `مسئول شد: ${task.assigneeName}`,
      },
    });
    await notify({
      userIds: [handedTo],
      actorId: access.userId,
      type: "SEO_TASK",
      entityId: taskId,
      title: `کار سئو ${task.code.toLocaleString("fa-IR")} به شما واگذار شد`,
      body: task.title,
      url: `/admin/worklist/seo?task=${taskId}`,
    });
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "SEO_TASK",
    entityId: taskId,
    entityTitle: task.title,
    summary: `کار سئو «${task.title}» ویرایش شد`,
  });

  return task;
}

// ─────────────────────────────────────────────────────────────────
// انتقال وضعیت — قلب سرویس
// ─────────────────────────────────────────────────────────────────

const ACTION_EVENT: Record<SeoAction, MarketingEventAction> = {
  start: "STARTED",
  report: "REPORTED",
  approve: "APPROVED",
  return: "RETURNED",
  cancel: "CANCELED",
  reopen: "REOPENED",
};

export async function transitionSeoTask(
  taskId: string,
  action: SeoAction,
  note: string | null,
  access: StaffAccess,
) {
  const current = await prisma.seoTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      assigneeId: true,
      createdById: true,
      startedAt: true,
    },
  });
  if (!current) throw new Error("کار پیدا نشد");

  if (!SEO_ALLOWED_FROM[action].includes(current.status)) {
    throw new Error(
      `از وضعیت «${SEO_STATUS_LABELS[current.status]}» این کار ممکن نیست`,
    );
  }

  const isManager = can(access, "SEO_TASK_MANAGE");
  if (SEO_MANAGER_ACTIONS.includes(action) && !isManager) {
    throw new Error("این کار با مدیر سئو است");
  }
  if (!isManager) {
    // کارمند فقط روی کار خودش مرحله می‌زند
    const mine =
      current.assigneeId === access.userId || current.createdById === access.userId;
    if (!mine) throw new Error("این کار مسئول دیگری دارد");
  }

  const text = clean(note);
  if (SEO_ACTIONS_NEEDING_NOTE.includes(action) && !text) {
    throw new Error(
      action === "report"
        ? "گزارش انجام اجباری است — «انجام دادم» بدون شرح، چیزی را روشن نمی‌کند"
        : "دلیل برگشت اجباری است",
    );
  }

  const next: SeoTaskStatus = SEO_NEXT_STATUS[action];
  const now = new Date();
  const data: Prisma.SeoTaskUpdateInput = { status: next };

  switch (action) {
    case "start":
      data.startedAt = now;
      break;
    case "report":
      // ⚠️ ثبت گزارش از «واگذارشده» هم مجاز است؛ آن‌وقت زمان شروع همین حالاست.
      if (!current.startedAt) data.startedAt = now;
      data.report = text;
      data.reportedAt = now;
      data.returnReason = null;
      break;
    case "approve":
      data.approvedAt = now;
      data.approvedById = access.userId;
      data.approvedByName = access.name;
      break;
    case "return":
      data.returnReason = text;
      data.reportedAt = null;
      break;
    case "cancel":
      data.cancelReason = text;
      break;
    case "reopen":
      data.approvedAt = null;
      data.approvedById = null;
      data.approvedByName = null;
      data.cancelReason = null;
      break;
  }

  const [task] = await prisma.$transaction([
    prisma.seoTask.update({ where: { id: taskId }, data, select: SEO_TASK_SELECT }),
    prisma.seoTaskEvent.create({
      data: {
        taskId,
        actorId: access.userId,
        actorName: access.name,
        action: ACTION_EVENT[action],
        fromStatus: current.status,
        toStatus: next,
        note: text,
      },
    }),
  ]);

  await notifyTransition(action, task, access);

  logActivityAsync({
    action: "UPDATE",
    entity: "SEO_TASK",
    entityId: taskId,
    entityTitle: task.title,
    summary: `کار سئو «${task.title}»: ${SEO_STATUS_LABELS[next]}`,
    changes: [
      {
        field: "status",
        label: "وضعیت",
        before: SEO_STATUS_LABELS[current.status],
        after: SEO_STATUS_LABELS[next],
      },
    ],
  });

  return task;
}

/**
 * اعلانِ بعد از هر انتقال.
 *
 * ⚠️ **«منتظر تأیید» به مدیران می‌رود، نه فقط به سازنده.** کاری که کارمند
 * برای خودش ساخته نباید منتظر تأیید کسی بماند که از وجودش خبر ندارد؛ ولی
 * اگر سازنده خودش مدیر است، همو کافی است.
 */
async function notifyTransition(
  action: SeoAction,
  task: { id: string; code: number; title: string; assigneeId: string | null; createdById: string | null },
  access: StaffAccess,
) {
  const code = task.code.toLocaleString("fa-IR");
  const url = `/admin/worklist/seo?task=${task.id}`;
  const base = { actorId: access.userId, type: "SEO_TASK" as const, entityId: task.id, url, body: task.title };

  switch (action) {
    case "report": {
      const managers = await usersWithPermission("SEO_TASK_MANAGE");
      const creatorIsManager = managers.some((m) => m.id === task.createdById);
      await notify({
        ...base,
        userIds: creatorIsManager ? [task.createdById] : managers.map((m) => m.id),
        title: `کار سئو ${code} منتظر تأیید است`,
      });
      break;
    }
    case "approve":
      await notify({ ...base, userIds: [task.assigneeId], title: `کار سئو ${code} تأیید شد` });
      break;
    case "return":
      await notify({ ...base, userIds: [task.assigneeId], title: `کار سئو ${code} برگشت خورد` });
      break;
    case "cancel":
      await notify({
        ...base,
        userIds: [task.assigneeId, task.createdById],
        title: `کار سئو ${code} لغو شد`,
      });
      break;
    case "reopen":
      await notify({ ...base, userIds: [task.assigneeId], title: `کار سئو ${code} بازگشایی شد` });
      break;
    case "start":
      // شروعِ کار خبر تازه‌ای برای کسی نیست؛ در تاریخچه هست و همان کافی است.
      break;
  }
}

/**
 * ثبت نتیجه‌ی بررسی.
 *
 * ⚠️ **وضعیت کار را عوض نمی‌کند.** کار انجام شده است؛ سؤال این است که ارزشش
 * را داشت یا نه. یکی‌کردن این دو یعنی کاری که درست انجام شده ولی اثری نداشت
 * «ناتمام» شمرده شود.
 */
export async function reviewSeoTask(
  taskId: string,
  outcome: "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE",
  note: string | null,
  access: StaffAccess,
) {
  const current = await prisma.seoTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, status: true, title: true, createdById: true, approvedById: true },
  });
  if (!current) throw new Error("کار پیدا نشد");
  if (current.status !== "DONE") {
    throw new Error("فقط کارِ تأییدشده نتیجه‌ی بررسی می‌گیرد");
  }
  if (
    !can(access, "SEO_TASK_MANAGE") &&
    current.approvedById !== access.userId &&
    current.createdById !== access.userId
  ) {
    throw new Error("ثبت نتیجه با تأییدکننده یا مدیر است");
  }

  const [task] = await prisma.$transaction([
    prisma.seoTask.update({
      where: { id: taskId },
      data: {
        reviewOutcome: outcome,
        reviewNote: clean(note),
        reviewedAt: new Date(),
      },
      select: SEO_TASK_SELECT,
    }),
    prisma.seoTaskEvent.create({
      data: {
        taskId,
        actorId: access.userId,
        actorName: access.name,
        action: "REVIEWED",
        fromStatus: "DONE",
        toStatus: "DONE",
        note: clean(note),
      },
    }),
  ]);

  logActivityAsync({
    action: "UPDATE",
    entity: "SEO_TASK",
    entityId: taskId,
    entityTitle: task.title,
    summary: `نتیجه‌ی کار سئو «${task.title}» ثبت شد`,
  });

  return task;
}

/**
 * حذف **نرم**؛ رویدادها می‌مانند.
 */
export async function deleteSeoTask(taskId: string) {
  const current = await prisma.seoTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!current) throw new Error("کار پیدا نشد");

  await prisma.seoTask.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });

  logActivityAsync({
    action: "DELETE",
    entity: "SEO_TASK",
    entityId: taskId,
    entityTitle: current.title,
    summary: `کار سئو «${current.title}» حذف شد`,
  });
}
