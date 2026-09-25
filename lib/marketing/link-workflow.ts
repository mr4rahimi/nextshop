/**
 * گردش کار گره‌ی لینک‌سازی — **تنها مسیر تغییر `LinkNode.status`**.
 *
 * همان قاعده‌ی ثابت سه حوزه: هر انتقال وضعیت را عوض می‌کند، یک
 * `LinkNodeEvent` می‌سازد و به نفر بعدی اعلان می‌دهد. اندپوینت هم یکی است
 * (`POST …/transition` با `action`).
 *
 * ```
 * PLANNED ─ارجاع→ ASSIGNED ─شروع→ IN_PROGRESS ─ثبت لینک→ SUBMITTED ─تأیید→ LIVE ─دیگر نیست→ LOST
 *                                       ▲                      │
 *                                       └────برگشت با دلیل─────┘
 * ```
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۷.۵ تا ۷.۷
 */

import { prisma } from "@/lib/prisma";
import { logActivityAsync } from "@/lib/activity";
import type { StaffAccess } from "@/lib/permissions";
import { notify, usersWithPermission } from "./notifications";
import { blockedNodeIds } from "./link-graph";
import { getNode, isLinkManager, loadGraph } from "./link-service";
import { createContentTask } from "./content-task-service";
import {
  NODE_ALLOWED_FROM,
  NODE_MANAGER_ACTIONS,
  NODE_STATUS_LABELS,
  type LinkNodeStatus,
  type NodeAction,
} from "./link-constants";
import { CONTENT_READY_STATUSES } from "./types";
import type { MarketingEventAction, Prisma } from "@prisma/client";

const ACTION_EVENT: Record<NodeAction, MarketingEventAction> = {
  assign: "ASSIGNED",
  start: "STARTED",
  submit: "SUBMITTED",
  approve: "APPROVED",
  return: "RETURNED",
  fail: "FAILED",
  lost: "LOST",
  reopen: "REOPENED",
};

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/** اعلان گره: کارمند به «گره‌های من»، مدیر به چارت کمپین */
function nodeUrl(node: { id: string; campaignId: string }, forManager: boolean) {
  return forManager
    ? `/admin/worklist/links/${node.campaignId}?node=${node.id}`
    : `/admin/worklist/links?node=${node.id}`;
}

export interface NodeTransitionInput {
  note?: string | null;
  publishedUrl?: string | null;
  assigneeId?: string | null;
}

export async function transitionNode(
  id: string,
  action: NodeAction,
  input: NodeTransitionInput,
  access: StaffAccess,
) {
  const node = await prisma.linkNode.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      campaignId: true,
      status: true,
      assigneeId: true,
      createdById: true,
      contentTask: { select: { code: true, status: true } },
    },
  });
  if (!node) throw new Error("گره پیدا نشد");

  if (!NODE_ALLOWED_FROM[action].includes(node.status)) {
    throw new Error(
      `این گره الان «${NODE_STATUS_LABELS[node.status]}» است و این کار رویش معنی ندارد`,
    );
  }

  const manager = isLinkManager(access);
  if (NODE_MANAGER_ACTIONS.includes(action) && !manager) {
    throw new Error("این کار با مدیر لینک‌سازی است");
  }
  if (!NODE_MANAGER_ACTIONS.includes(action) && node.assigneeId !== access.userId && !manager) {
    throw new Error("این گره به شما ارجاع نشده است");
  }

  const note = clean(input.note);
  const now = new Date();
  let next: LinkNodeStatus = node.status;
  const data: Prisma.LinkNodeUncheckedUpdateInput = {};

  switch (action) {
    case "assign": {
      const staff = await usersWithPermission("LINK_WORK");
      const who = staff.find((s) => s.id === input.assigneeId);
      if (!who) throw new Error("کارمندی با مجوز لینک‌سازی انتخاب کنید");
      data.assigneeId = who.id;
      data.assigneeName = who.name;
      data.assignedAt = now;
      next = node.status === "PLANNED" ? "ASSIGNED" : node.status;
      break;
    }
    case "start": {
      // ⚠️ قفل پیش‌نیاز سمت سرور است، نه فقط دکمه‌ی غیرفعال (بخش ۷.۷)
      const { nodes, edges } = await loadGraph(node.campaignId);
      const live = new Set(nodes.filter((n) => n.status === "LIVE").map((n) => n.id));
      if (blockedNodeIds(edges, live).has(id)) {
        throw new Error(
          "پیش‌نیاز این گره هنوز فعال نشده — اول لینکی که این گره به آن اشاره می‌کند باید ساخته شود",
        );
      }
      // گره‌ی وصل به کار محتوا تا متنش نرسیده شروع نمی‌شود (بخش ۷.۶)
      if (node.contentTask && !CONTENT_READY_STATUSES.includes(node.contentTask.status)) {
        throw new Error(
          `محتوای این گره (کار ${node.contentTask.code.toLocaleString("fa-IR")}) هنوز نوشته و ارسال نشده است`,
        );
      }
      data.startedAt = now;
      next = "IN_PROGRESS";
      break;
    }
    case "submit": {
      // «انجام دادم» بدون آدرس یعنی هیچ
      const url = clean(input.publishedUrl);
      if (!url || !/^https?:\/\/\S+\.\S+/i.test(url)) {
        throw new Error("آدرس صفحه‌ای که لینک در آن گذاشته شد را وارد کنید");
      }
      data.publishedUrl = url;
      data.submittedAt = now;
      data.returnReason = null;
      next = "SUBMITTED";
      break;
    }
    case "approve":
      data.liveAt = now;
      next = "LIVE";
      break;
    case "return":
      if (!note) throw new Error("دلیل برگشت اجباری است");
      data.returnReason = note;
      data.returnCount = { increment: 1 };
      next = "IN_PROGRESS";
      break;
    case "fail":
      if (!note) throw new Error("دلیل را بنویسید — «نشد» بدون دلیل چیزی یاد نمی‌دهد");
      data.failReason = note;
      next = "FAILED";
      break;
    case "lost":
      // دستی هم ثبت می‌شود تا نرخ ازدست‌رفتن از صفر شروع نکند (بخش ۸)
      data.lostAt = now;
      next = "LOST";
      break;
    case "reopen":
      data.lostAt = null;
      data.failReason = null;
      next = node.assigneeId ? "ASSIGNED" : "PLANNED";
      break;
  }
  data.status = next;

  await prisma.$transaction([
    prisma.linkNode.update({ where: { id }, data }),
    prisma.linkNodeEvent.create({
      data: {
        nodeId: id,
        actorId: access.userId,
        actorName: access.name,
        action: ACTION_EVENT[action],
        fromStatus: node.status,
        toStatus: next,
        note: action === "submit" ? clean(input.publishedUrl) : note,
      },
    }),
  ]);

  // ── اعلان به نفر بعدی
  const code = node.code.toLocaleString("fa-IR");
  const base = { actorId: access.userId, type: "LINK_NODE" as const, entityId: id };
  const assignee = action === "assign" ? (data.assigneeId as string) : node.assigneeId;

  switch (action) {
    case "assign":
      await notify({
        ...base,
        userIds: [assignee],
        title: `گره لینک‌سازی ${code} به شما ارجاع شد`,
        url: nodeUrl(node, false),
      });
      break;
    case "submit": {
      // سازنده اگر خودش مدیر است همو؛ وگرنه همه‌ی مدیران
      const managers = await usersWithPermission("LINK_MANAGE");
      const creatorIsManager = managers.some((m) => m.id === node.createdById);
      await notify({
        ...base,
        userIds: creatorIsManager ? [node.createdById] : managers.map((m) => m.id),
        title: `لینک گره ${code} ثبت شد و منتظر تأیید است`,
        url: nodeUrl(node, true),
      });
      break;
    }
    case "approve":
      await notify({ ...base, userIds: [assignee], title: `لینک گره ${code} تأیید و فعال شد`, url: nodeUrl(node, false) });
      break;
    case "return":
      await notify({ ...base, userIds: [assignee], title: `گره ${code} برگشت خورد`, body: note, url: nodeUrl(node, false) });
      break;
    case "fail": {
      const managers = await usersWithPermission("LINK_MANAGE");
      await notify({
        ...base,
        userIds: [node.createdById, ...managers.map((m) => m.id)],
        title: `گره ${code} نشد`,
        body: note,
        url: nodeUrl(node, true),
      });
      break;
    }
    case "reopen":
      await notify({ ...base, userIds: [assignee], title: `گره ${code} دوباره باز شد`, url: nodeUrl(node, false) });
      break;
    case "start":
    case "lost":
      break;
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "LINK_NODE",
    entityId: id,
    entityTitle: `گره ${node.code}`,
    summary: `گره لینک‌سازی ${code}: ${NODE_STATUS_LABELS[next]}`,
    changes: [
      {
        field: "status",
        label: "وضعیت",
        before: NODE_STATUS_LABELS[node.status],
        after: NODE_STATUS_LABELS[next],
      },
    ],
  });

  return getNode(id);
}

// ─────────────────────────────────────────────────────────────────
// ساخت خودکار برنامه — بخش ۷.۷
// ─────────────────────────────────────────────────────────────────

/**
 * گره‌های `PLANNED` که مسئول دارند `ASSIGNED` می‌شوند.
 *
 * - **ترتیب از لایه می‌آید** — مهلت‌ها لایه‌به‌لایه پخش می‌شوند؛ قفل «در
 *   انتظار پیش‌نیاز» را خودِ `start` سمت سرور نگه می‌دارد.
 * - **گره‌ی بی‌مسئول رد می‌شود**، نه اینکه کل عملیات شکست بخورد.
 * - **اجرای دوباره امن است** — فقط `PLANNED`ها، و هر گره با شرط وضعیت
 *   قبضه می‌شود تا دو کلیک هم‌زمان دو رویداد نسازد.
 * - **به‌ازای هر نفر یک اعلان**، نه هر گره.
 * - `weeklyQuota` مهلت‌ها را پخش می‌کند — راهنماست نه قفل.
 */
export async function buildPlan(campaignId: string, access: StaffAccess) {
  if (!isLinkManager(access)) throw new Error("این کار با مدیر لینک‌سازی است");

  const campaign = await prisma.linkCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    select: { id: true, title: true, weeklyQuota: true },
  });
  if (!campaign) throw new Error("کمپین پیدا نشد");

  const [planned, withoutAssignee] = await Promise.all([
    prisma.linkNode.findMany({
      where: { campaignId, deletedAt: null, status: "PLANNED", assigneeId: { not: null } },
      select: { id: true, assigneeId: true, dueAt: true },
      orderBy: [{ tier: { sort: "asc", nulls: "last" } }, { code: "asc" }],
    }),
    prisma.linkNode.count({
      where: { campaignId, deletedAt: null, status: "PLANNED", assigneeId: null },
    }),
  ]);

  const quota = campaign.weeklyQuota ?? 0;
  const perAssignee = new Map<string, number>();
  const now = new Date();
  let assigned = 0;

  for (const [index, node] of planned.entries()) {
    // مهلتِ دستی مدیر دست نمی‌خورد؛ فقط گره‌ی بی‌مهلت از سقف هفتگی مهلت می‌گیرد
    const dueAt =
      node.dueAt ??
      (quota > 0
        ? new Date(now.getTime() + (Math.floor(index / quota) + 1) * 7 * 24 * 3600 * 1000)
        : null);

    // قبضه‌ی اتمیک: اگر هم‌زمان کسی دیگر واگذارش کرده، صفر ردیف
    const claimed = await prisma.linkNode.updateMany({
      where: { id: node.id, status: "PLANNED" },
      data: { status: "ASSIGNED", assignedAt: now, dueAt },
    });
    if (claimed.count === 0) continue;

    await prisma.linkNodeEvent.create({
      data: {
        nodeId: node.id,
        actorId: access.userId,
        actorName: access.name,
        action: "ASSIGNED",
        fromStatus: "PLANNED",
        toStatus: "ASSIGNED",
        note: "ساخت برنامه",
      },
    });
    assigned += 1;
    perAssignee.set(node.assigneeId!, (perAssignee.get(node.assigneeId!) ?? 0) + 1);
  }

  for (const [userId, count] of perAssignee) {
    await notify({
      userIds: [userId],
      actorId: access.userId,
      type: "LINK_NODE",
      entityId: campaignId,
      title: `${count.toLocaleString("fa-IR")} گره از کمپین «${campaign.title}» به شما ارجاع شد`,
      url: "/admin/worklist/links",
    });
  }

  if (assigned > 0) {
    logActivityAsync({
      action: "UPDATE",
      entity: "LINK_CAMPAIGN",
      entityId: campaignId,
      entityTitle: campaign.title,
      summary: `برنامه‌ی کمپین «${campaign.title}» ساخته شد: ${assigned.toLocaleString("fa-IR")} گره واگذار شد`,
    });
  }

  return { assigned, skippedWithoutAssignee: withoutAssignee };
}

// ─────────────────────────────────────────────────────────────────
// اتصال به کار محتوا — بخش ۷.۶
// ─────────────────────────────────────────────────────────────────

/**
 * ساخت کار محتوا از روی گره.
 *
 * ⚠️ مقصدِ کار **بیرونی** (`EXTERNAL`) است، نه مجله: متن مهمان‌نویسی روی
 * سایت میزبان منتشر می‌شود و نباید `BlogPost` بسازد (بخش ۷.۶). کلمه‌ی کلیدی
 * از **صفحه‌ی هدفِ همین گره** برداشته می‌شود، نه از کمپین.
 */
export async function createContentForNode(
  nodeId: string,
  input: { title?: string; writerId?: string; publisherId?: string | null; dueAt?: string | null },
  access: StaffAccess,
) {
  if (!isLinkManager(access)) throw new Error("این کار با مدیر لینک‌سازی است");

  const node = await prisma.linkNode.findFirst({
    where: { id: nodeId, deletedAt: null },
    select: {
      id: true,
      code: true,
      contentTaskId: true,
      anchorText: true,
      profileTitle: true,
      contentBrief: true,
      wordCount: true,
      assigneeId: true,
      campaign: { select: { title: true } },
      outEdges: {
        where: { toTargetId: { not: null } },
        take: 1,
        select: { toTarget: { select: { primaryKeyword: true, url: true } } },
      },
    },
  });
  if (!node) throw new Error("گره پیدا نشد");
  if (node.contentTaskId) throw new Error("این گره از قبل به یک کار محتوا وصل است");

  const writers = await usersWithPermission("CONTENT_TASK_WORK");
  if (!writers.some((w) => w.id === input.writerId)) {
    throw new Error("محتوانویسی با مجوز محتوا انتخاب کنید");
  }

  const target = node.outEdges[0]?.toTarget;
  const primaryKeyword =
    target?.primaryKeyword || node.anchorText || node.profileTitle || node.campaign.title;
  const briefParts = [
    node.contentBrief,
    node.wordCount ? `حدود ${node.wordCount.toLocaleString("fa-IR")} کلمه` : null,
    node.anchorText ? `متن لینک: «${node.anchorText}»` : null,
    target?.url ? `لینک به: ${target.url}` : null,
  ].filter(Boolean);

  const task = await createContentTask(
    {
      title: clean(input.title) || node.profileTitle || `محتوای گره ${node.code.toLocaleString("fa-IR")}`,
      primaryKeyword,
      brief: briefParts.join("\n"),
      destination: "EXTERNAL",
      writerId: input.writerId,
      // محتواگذارِ پیش‌فرض همان کسی است که گره به او ارجاع شده
      publisherId: input.publisherId || node.assigneeId || null,
      dueAt: input.dueAt ?? null,
    },
    access,
    { skipGuard: true },
  );

  await prisma.linkNode.update({ where: { id: nodeId }, data: { contentTaskId: task.id } });
  return getNode(nodeId);
}

/** وصل‌کردن به کار محتوای موجود */
export async function attachContentTask(nodeId: string, taskId: string, access: StaffAccess) {
  if (!isLinkManager(access)) throw new Error("این کار با مدیر لینک‌سازی است");

  const task = await prisma.contentTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, destination: true, linkNode: { select: { id: true, code: true } } },
  });
  if (!task) throw new Error("کار محتوا پیدا نشد");
  // قید یکتای دیتابیس همین را می‌گیرد، ولی پیامش فارسی نیست
  if (task.linkNode && task.linkNode.id !== nodeId) {
    throw new Error(
      `این کار محتوا از قبل به گره ${task.linkNode.code.toLocaleString("fa-IR")} وصل است — یک مقاله یک بار نوشته می‌شود`,
    );
  }
  if (task.destination === "BLOG") {
    throw new Error("این کار برای مجله‌ی خودمان است؛ متن مهمان‌نویسی باید مقصد «سایت بیرونی» داشته باشد");
  }

  await prisma.linkNode.update({ where: { id: nodeId }, data: { contentTaskId: taskId } });
  return getNode(nodeId);
}

/** برداشتن اتصال — کار محتوا پاک نمی‌شود؛ متنی که نوشته شده ارزش خودش را دارد */
export async function detachContentTask(nodeId: string, access: StaffAccess) {
  if (!isLinkManager(access)) throw new Error("این کار با مدیر لینک‌سازی است");
  const node = await prisma.linkNode.findFirst({
    where: { id: nodeId, deletedAt: null },
    select: { contentTaskId: true },
  });
  if (!node) throw new Error("گره پیدا نشد");
  if (!node.contentTaskId) throw new Error("این گره به کار محتوایی وصل نیست");
  await prisma.linkNode.update({ where: { id: nodeId }, data: { contentTaskId: null } });
  return getNode(nodeId);
}
