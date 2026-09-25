/**
 * سرویس کار محتوا — **تنها مسیر تغییر وضعیت `ContentTask`**.
 *
 * قرینه‌ی `seo-task-service.ts` است و همان قاعده‌ی ثابت را دارد: هر انتقال
 * وضعیت را عوض می‌کند، یک `ContentTaskEvent` می‌سازد و به نفر بعدی اعلان
 * می‌دهد. اندپوینت انتقال هم یکی است (`POST …/transition` با `action`).
 *
 * سه نقش روی هر کار:
 *   - **محتوانویس** (`writerId`) — شروع نوشتن و ارسال
 *   - **محتواگذار** (`publisherId`، خالی = همان محتوانویس) — انتشار
 *   - **مدیر** (`CONTENT_TASK_MANAGE`) — ساخت، تأیید، لغو، بازگشایی، و هر
 *     کاری که از دست دو نفر دیگر هم برمی‌آید
 *
 * دو استثنای عمدی که رویداد نمی‌سازند و اعلان نمی‌دهند (تله‌ی ۱۰):
 *   - ذخیره‌ی پیش‌نویس — `content-publish.ts`
 *   - افزودن و حذف پیوست
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۶
 */

import { prisma } from "@/lib/prisma";
import { logActivityAsync } from "@/lib/activity";
import { can, type StaffAccess } from "@/lib/permissions";
import { notify, usersWithPermission } from "./notifications";
import { parseMarketingDate } from "./dates";
import { ensureBlogPost, publishBlogPost } from "./content-publish";
import {
  CONTENT_ALLOWED_FROM,
  CONTENT_MANAGER_ACTIONS,
  CONTENT_STATUS_LABELS,
  countWords,
  type ContentAction,
} from "./types";
import type {
  Prisma,
  ContentTaskStatus,
  ContentDestination,
  MarketingEventAction,
} from "@prisma/client";

export const CONTENT_TASK_SELECT = {
  id: true,
  code: true,
  title: true,
  primaryKeyword: true,
  relatedKeywords: true,
  brief: true,
  destination: true,
  writerId: true,
  writerName: true,
  publisherId: true,
  publisherName: true,
  createdById: true,
  createdByName: true,
  status: true,
  priority: true,
  dueAt: true,
  wordCount: true,
  blogPostId: true,
  publishedUrl: true,
  returnReason: true,
  cancelReason: true,
  startedAt: true,
  submittedAt: true,
  publishedAt: true,
  approvedAt: true,
  approvedByName: true,
  createdAt: true,
  updatedAt: true,
  linkNode: { select: { id: true, code: true, campaignId: true } },
  _count: { select: { files: true } },
} satisfies Prisma.ContentTaskSelect;

export const CONTENT_TASK_DETAIL_SELECT = {
  ...CONTENT_TASK_SELECT,
  body: true,
  blogPost: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      coverImage: true,
      categoryId: true,
      seoTitle: true,
      seoDescription: true,
      content: true,
      publishedAt: true,
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
} satisfies Prisma.ContentTaskSelect;

/**
 * کارهایی که کاربرِ بدون `MARKETING_VIEW_ALL` می‌بیند: نویسنده، محتواگذار یا
 * سازنده‌اش باشد. ⚠️ سمت سرور است، نه فیلتر رابط کاربری (تله‌ی ۱۲).
 */
export function contentScopeFilter(userId: string): Prisma.ContentTaskWhereInput {
  return {
    OR: [{ writerId: userId }, { publisherId: userId }, { createdById: userId }],
  };
}

export async function canSeeContentTask(taskId: string, access: StaffAccess): Promise<boolean> {
  if (can(access, "MARKETING_VIEW_ALL")) return true;
  const hit = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null, ...contentScopeFilter(access.userId) },
    select: { id: true },
  });
  return !!hit;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

async function staffName(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    select: { firstName: true, lastName: true, phone: true },
  });
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone || "بدون نام";
}

function taskUrl(id: string) {
  return `/admin/worklist/content?task=${id}`;
}

/** محتواگذارِ مؤثر: اگر خالی است، خودِ محتوانویس منتشر می‌کند */
function effectivePublisher(task: { publisherId: string | null; writerId: string | null }) {
  return task.publisherId ?? task.writerId;
}

// ─────────────────────────────────────────────────────────────────
// ساخت و ویرایش
// ─────────────────────────────────────────────────────────────────

export interface CreateContentTaskInput {
  title?: string;
  primaryKeyword?: string | null;
  relatedKeywords?: string | null;
  brief?: string | null;
  destination?: ContentDestination;
  writerId?: string | null;
  publisherId?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt?: string | null;
}

/**
 * ساخت کار محتوا — کار مدیر است. `skipGuard` فقط برای «ساخت کار محتوا از
 * گره‌ی لینک‌سازی» است که نگهبانِ خودش (`LINK_MANAGE`) را دارد.
 */
export async function createContentTask(
  input: CreateContentTaskInput,
  access: StaffAccess,
  opts: { skipGuard?: boolean } = {},
) {
  if (!opts.skipGuard && !can(access, "CONTENT_TASK_MANAGE")) {
    throw new Error("ساخت کار محتوا با مدیر محتواست");
  }

  const title = clean(input.title);
  if (!title) throw new Error("عنوان کار لازم است");
  if (!input.writerId) throw new Error("محتوانویس را انتخاب کنید");

  const writerName = await staffName(input.writerId);
  if (!writerName) throw new Error("محتوانویس انتخاب‌شده پیدا نشد");

  let publisherName: string | null = null;
  if (input.publisherId) {
    publisherName = await staffName(input.publisherId);
    if (!publisherName) throw new Error("محتواگذار انتخاب‌شده پیدا نشد");
  }

  const task = await prisma.contentTask.create({
    data: {
      title,
      primaryKeyword: clean(input.primaryKeyword),
      relatedKeywords: clean(input.relatedKeywords),
      brief: clean(input.brief),
      destination: input.destination === "EXTERNAL" ? "EXTERNAL" : "BLOG",
      writerId: input.writerId,
      writerName,
      publisherId: input.publisherId || null,
      publisherName,
      createdById: access.userId,
      createdByName: access.name,
      priority: input.priority ?? "NORMAL",
      dueAt: parseMarketingDate(input.dueAt),
      events: {
        create: {
          actorId: access.userId,
          actorName: access.name,
          action: "CREATED",
          toStatus: "ASSIGNED",
          note: input.primaryKeyword ? `کلمه‌ی کلیدی: ${input.primaryKeyword}` : null,
        },
      },
    },
    select: CONTENT_TASK_SELECT,
  });

  await notify({
    userIds: [task.writerId],
    actorId: access.userId,
    type: "CONTENT_TASK",
    entityId: task.id,
    title: `کار محتوای ${task.code.toLocaleString("fa-IR")} به شما واگذار شد`,
    body: title,
    url: taskUrl(task.id),
  });

  logActivityAsync({
    action: "CREATE",
    entity: "CONTENT_TASK",
    entityId: task.id,
    entityTitle: title,
    summary: `کار محتوای «${title}» ثبت شد`,
  });

  return task;
}

/**
 * ویرایش فیلدهای کار — **بدون دست‌زدن به وضعیت و متن**. فقط مدیر.
 *
 * تغییر محتوانویس یا محتواگذار یک رویداد و یک اعلان دارد، وگرنه نفر تازه
 * هیچ‌وقت نمی‌فهمد کاری به او داده شده.
 */
export async function updateContentTask(
  taskId: string,
  input: CreateContentTaskInput,
  access: StaffAccess,
) {
  if (!can(access, "CONTENT_TASK_MANAGE")) {
    throw new Error("ویرایش کار محتوا با مدیر محتواست");
  }

  const current = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, status: true, writerId: true, publisherId: true, blogPostId: true },
  });
  if (!current) throw new Error("کار پیدا نشد");

  const data: Prisma.ContentTaskUpdateInput = {};
  if (input.title !== undefined) {
    const title = clean(input.title);
    if (!title) throw new Error("عنوان کار لازم است");
    data.title = title;
  }
  if (input.primaryKeyword !== undefined) data.primaryKeyword = clean(input.primaryKeyword);
  if (input.relatedKeywords !== undefined) data.relatedKeywords = clean(input.relatedKeywords);
  if (input.brief !== undefined) data.brief = clean(input.brief);
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueAt !== undefined) data.dueAt = parseMarketingDate(input.dueAt);
  if (input.destination !== undefined) {
    // ⚠️ مقصدِ کاری که مقاله‌اش ساخته شده عوض نمی‌شود — وگرنه یک BlogPost
    // بی‌صاحب در مجله می‌ماند یا متن بیرونی به‌اشتباه در مجله منتشر می‌شود.
    if (current.blogPostId && input.destination !== "BLOG") {
      throw new Error("مقاله‌ی این کار ساخته شده؛ مقصدش دیگر عوض نمی‌شود");
    }
    data.destination = input.destination === "EXTERNAL" ? "EXTERNAL" : "BLOG";
  }

  const handovers: { userId: string; role: string }[] = [];

  if (input.writerId !== undefined && input.writerId && input.writerId !== current.writerId) {
    const name = await staffName(input.writerId);
    if (!name) throw new Error("محتوانویس انتخاب‌شده پیدا نشد");
    data.writerId = input.writerId;
    data.writerName = name;
    handovers.push({ userId: input.writerId, role: `محتوانویس شد: ${name}` });
  }
  if (input.publisherId !== undefined && (input.publisherId || null) !== current.publisherId) {
    if (input.publisherId) {
      const name = await staffName(input.publisherId);
      if (!name) throw new Error("محتواگذار انتخاب‌شده پیدا نشد");
      data.publisherId = input.publisherId;
      data.publisherName = name;
      handovers.push({ userId: input.publisherId, role: `محتواگذار شد: ${name}` });
    } else {
      data.publisherId = null;
      data.publisherName = null;
    }
  }

  const task = await prisma.contentTask.update({
    where: { id: taskId },
    data,
    select: CONTENT_TASK_SELECT,
  });

  for (const h of handovers) {
    await prisma.contentTaskEvent.create({
      data: {
        taskId,
        actorId: access.userId,
        actorName: access.name,
        action: "ASSIGNED",
        fromStatus: current.status,
        toStatus: current.status,
        note: h.role,
      },
    });
    await notify({
      userIds: [h.userId],
      actorId: access.userId,
      type: "CONTENT_TASK",
      entityId: taskId,
      title: `کار محتوای ${task.code.toLocaleString("fa-IR")} به شما واگذار شد`,
      body: task.title,
      url: taskUrl(taskId),
    });
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "CONTENT_TASK",
    entityId: taskId,
    entityTitle: task.title,
    summary: `کار محتوای «${task.title}» ویرایش شد`,
  });

  return task;
}

// ─────────────────────────────────────────────────────────────────
// انتقال وضعیت
// ─────────────────────────────────────────────────────────────────

const ACTION_EVENT: Record<ContentAction, MarketingEventAction> = {
  start: "STARTED",
  submit: "REPORTED",
  take: "PUBLISHING",
  complete: "SUBMITTED",
  approve: "APPROVED",
  return: "RETURNED",
  cancel: "CANCELED",
  reopen: "REOPENED",
};

export interface TransitionContentInput {
  note?: string | null;
  /** مقصد EXTERNAL: آدرس صفحه‌ای که متن در آن منتشر شد */
  publishedUrl?: string | null;
  /** برگشت از «منتظر تأیید» مستقیم به محتوانویس، نه یک قدم عقب */
  toWriter?: boolean;
}

export async function transitionContentTask(
  taskId: string,
  action: ContentAction,
  input: TransitionContentInput,
  access: StaffAccess,
) {
  const current = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      destination: true,
      writerId: true,
      publisherId: true,
      createdById: true,
      blogPostId: true,
      body: true,
      wordCount: true,
      startedAt: true,
    },
  });
  if (!current) throw new Error("کار پیدا نشد");

  if (!CONTENT_ALLOWED_FROM[action].includes(current.status)) {
    throw new Error(`از وضعیت «${CONTENT_STATUS_LABELS[current.status]}» این کار ممکن نیست`);
  }

  const isManager = can(access, "CONTENT_TASK_MANAGE");
  const me = access.userId;
  const isWriter = current.writerId === me;
  const isPublisher = effectivePublisher(current) === me;

  if (CONTENT_MANAGER_ACTIONS.includes(action) && !isManager) {
    throw new Error("این کار با مدیر محتواست");
  }
  if ((action === "start" || action === "submit") && !isWriter && !isManager) {
    throw new Error("این کار محتوانویس دیگری دارد");
  }
  if ((action === "take" || action === "complete") && !isPublisher && !isManager) {
    throw new Error("انتشار این کار با محتواگذار دیگری است");
  }
  if (action === "return") {
    // برگشت از «منتظر تأیید» قضاوت مدیر است؛ قبل از آن حق محتواگذار هم هست
    const allowed =
      isManager || (current.status !== "AWAITING_APPROVAL" && isPublisher);
    if (!allowed) throw new Error("برگرداندن این کار با محتواگذار یا مدیر است");
  }

  const note = clean(input.note);
  if (action === "return" && !note) throw new Error("دلیل برگشت اجباری است");

  // مقصد برگشت: یک قدم عقب، مگر مدیر از «منتظر تأیید» مستقیم به نویسنده بفرستد
  let next: ContentTaskStatus;
  switch (action) {
    case "start":
      next = "WRITING";
      break;
    case "submit":
      next = "AWAITING_PUBLISH";
      break;
    case "take":
      next = "PUBLISHING";
      break;
    case "complete":
      next = "AWAITING_APPROVAL";
      break;
    case "approve":
      next = "DONE";
      break;
    case "return":
      next =
        current.status === "AWAITING_APPROVAL" && !input.toWriter ? "PUBLISHING" : "WRITING";
      break;
    case "cancel":
      next = "CANCELED";
      break;
    case "reopen":
      next = "WRITING";
      break;
  }

  const now = new Date();
  const data: Prisma.ContentTaskUpdateInput = { status: next };

  switch (action) {
    case "start":
      data.startedAt = now;
      break;
    case "submit": {
      // متنِ خالی به محتواگذار نمی‌رود؛ یا در ویرایشگر نوشته شده یا فایل پیوست است
      const words = current.wordCount ?? countWords(current.body);
      if (words === 0) {
        const files = await prisma.contentTaskFile.count({
          where: { taskId, deletedAt: null },
        });
        if (files === 0) {
          throw new Error("متنی نوشته نشده — در ویرایشگر بنویسید یا فایل متن را پیوست کنید");
        }
      }
      data.submittedAt = now;
      data.returnReason = null;
      break;
    }
    case "take":
      data.returnReason = null;
      break;
    case "complete": {
      if (current.destination === "EXTERNAL") {
        const url = clean(input.publishedUrl);
        if (!url || !/^https?:\/\//i.test(url)) {
          throw new Error("آدرس صفحه‌ای که متن در آن منتشر شد را وارد کنید");
        }
        data.publishedUrl = url;
      }
      data.publishedAt = now;
      break;
    }
    case "approve":
      data.approvedAt = now;
      data.approvedById = access.userId;
      data.approvedByName = access.name;
      break;
    case "return":
      data.returnReason = note;
      if (next === "WRITING") data.submittedAt = null;
      break;
    case "cancel":
      data.cancelReason = note;
      break;
    case "reopen":
      data.approvedAt = null;
      data.approvedById = null;
      data.approvedByName = null;
      data.cancelReason = null;
      break;
  }

  // ── اثر روی مقاله‌ی مجله — قبل از تراکنش وضعیت، تا اگر شکست خورد کار
  // جلو نرود و کاربر پیام روشن بگیرد.
  if (action === "take" && current.destination === "BLOG") {
    // ساخت مقاله‌ی پیش‌نویس از روی متن کار؛ از این لحظه منبع حقیقتِ متن
    // `BlogPost.content` است (بخش ۶.۲، قاعده‌ی ۲)
    // `ensureBlogPost` خودش مقاله را به کار وصل می‌کند و اجرای دوباره‌اش
    // (مثلاً بعد از برگشت) همان مقاله را برمی‌گرداند، نه مقاله‌ی دوم
    await ensureBlogPost(taskId);
  }
  if (action === "complete" && current.destination === "BLOG") {
    if (!current.blogPostId) throw new Error("مقاله‌ی این کار هنوز ساخته نشده است");
    const { url } = await publishBlogPost(current.blogPostId);
    data.publishedUrl = url;
  }

  const [task] = await prisma.$transaction([
    prisma.contentTask.update({ where: { id: taskId }, data, select: CONTENT_TASK_SELECT }),
    prisma.contentTaskEvent.create({
      data: {
        taskId,
        actorId: access.userId,
        actorName: access.name,
        action: ACTION_EVENT[action],
        fromStatus: current.status,
        toStatus: next,
        note: action === "complete" ? (clean(input.publishedUrl) ?? note) : note,
      },
    }),
  ]);

  await notifyTransition(action, next, task, access);

  logActivityAsync({
    action: "UPDATE",
    entity: "CONTENT_TASK",
    entityId: taskId,
    entityTitle: task.title,
    summary: `کار محتوای «${task.title}»: ${CONTENT_STATUS_LABELS[next]}`,
    changes: [
      {
        field: "status",
        label: "وضعیت",
        before: CONTENT_STATUS_LABELS[current.status],
        after: CONTENT_STATUS_LABELS[next],
      },
    ],
  });

  return task;
}

/**
 * اعلانِ بعد از هر انتقال — به نفر بعدیِ همان مرحله.
 *
 * ⚠️ «منتظر تأیید» به مدیران می‌رود مگر سازنده خودش مدیر باشد؛ همان قاعده‌ی
 * کار سئو.
 */
async function notifyTransition(
  action: ContentAction,
  next: ContentTaskStatus,
  task: {
    id: string;
    code: number;
    title: string;
    writerId: string | null;
    publisherId: string | null;
    createdById: string | null;
  },
  access: StaffAccess,
) {
  const code = task.code.toLocaleString("fa-IR");
  const base = {
    actorId: access.userId,
    type: "CONTENT_TASK" as const,
    entityId: task.id,
    url: taskUrl(task.id),
    body: task.title,
  };
  const publisher = effectivePublisher(task);

  switch (action) {
    case "submit":
      await notify({ ...base, userIds: [publisher], title: `متن کار محتوای ${code} آماده‌ی انتشار است` });
      break;
    case "complete": {
      const managers = await usersWithPermission("CONTENT_TASK_MANAGE");
      const creatorIsManager = managers.some((m) => m.id === task.createdById);
      await notify({
        ...base,
        userIds: creatorIsManager ? [task.createdById] : managers.map((m) => m.id),
        title: `کار محتوای ${code} منتشر شد و منتظر تأیید است`,
      });
      break;
    }
    case "approve":
      await notify({
        ...base,
        userIds: [task.writerId, task.publisherId],
        title: `کار محتوای ${code} تأیید شد`,
      });
      break;
    case "return":
      await notify({
        ...base,
        userIds: [next === "WRITING" ? task.writerId : publisher],
        title: `کار محتوای ${code} برگشت خورد`,
      });
      break;
    case "cancel":
      await notify({
        ...base,
        userIds: [task.writerId, task.publisherId],
        title: `کار محتوای ${code} لغو شد`,
      });
      break;
    case "reopen":
      await notify({ ...base, userIds: [task.writerId], title: `کار محتوای ${code} بازگشایی شد` });
      break;
    case "start":
    case "take":
      // خبر تازه‌ای برای کسی نیست؛ در تاریخچه هست
      break;
  }
}

/** حذف **نرم**؛ رویدادها و مقاله‌ی ساخته‌شده می‌مانند */
export async function deleteContentTask(taskId: string) {
  const current = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, title: true, linkNode: { select: { code: true } } },
  });
  if (!current) throw new Error("کار پیدا نشد");
  if (current.linkNode) {
    throw new Error(
      `این کار به گره ${current.linkNode.code.toLocaleString("fa-IR")} لینک‌سازی وصل است — اول اتصال را بردارید`,
    );
  }

  await prisma.contentTask.update({ where: { id: taskId }, data: { deletedAt: new Date() } });

  logActivityAsync({
    action: "DELETE",
    entity: "CONTENT_TASK",
    entityId: taskId,
    entityTitle: current.title,
    summary: `کار محتوای «${current.title}» حذف شد`,
  });
}
