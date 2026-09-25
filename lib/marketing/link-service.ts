/**
 * لینک‌سازی خارجی — کمپین، صفحه‌ی هدف، گره، یال، بوم، آمار، انواع و پلتفرم‌ها.
 *
 * گردش کار گره (ارجاع، شروع، ثبت لینک، تأیید…) در `link-workflow.ts` است و
 * **تنها مسیر تغییر `LinkNode.status`** همان‌جاست؛ اینجا وضعیت دست نمی‌خورد.
 *
 * قاعده‌های ساختاری (بخش ۷.۳):
 *   - لایه از چارت مشتق می‌شود و `recomputeTiers` **فقط با تغییر یال** صدا
 *     زده می‌شود (تله‌ی ۲).
 *   - حلقه ممنوع است؛ گره‌ی معلق مجاز است؛ عمق بیش از ۴ هشدار است نه خطا.
 *   - گره یا صفحه‌ای که چیزی به آن لینک می‌دهد حذف نمی‌شود — وگرنه آن‌ها
 *     بی‌سروصدا معلق می‌شوند.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۷
 */

import { prisma } from "@/lib/prisma";
import { logActivityAsync } from "@/lib/activity";
import { can, type StaffAccess } from "@/lib/permissions";
import { parseMarketingDate } from "./dates";
import { usersWithPermission } from "./notifications";
import {
  MAX_TIER,
  blockedNodeIds,
  computeTiers,
  wouldCreateCycle,
  type GraphEdge,
} from "./link-graph";
import { summarizeAnchors, type AnchorSlice } from "./anchor-profile";
import {
  ANCHOR_KINDS,
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  type LinkAnchorKind,
  type LinkCampaignStatus,
  type LinkContentKind,
  type LinkNodeStatus,
} from "./link-constants";
import { CONTENT_READY_STATUSES } from "./types";
import type { Prisma, ContentTaskStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────
// دسترسی
// ─────────────────────────────────────────────────────────────────

/** دیدن کمپین‌ها و چارت — کارمند بی‌این‌ها فقط گره‌های خودش را فهرستی می‌بیند */
export function canViewCampaigns(access: StaffAccess) {
  return can(access, "LINK_MANAGE") || can(access, "MARKETING_VIEW_ALL");
}

export function isLinkManager(access: StaffAccess) {
  return can(access, "LINK_MANAGE");
}

function requireManager(access: StaffAccess) {
  if (!isLinkManager(access)) throw new Error("این کار با مدیر لینک‌سازی است");
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function cleanUrl(value: unknown): string | null {
  const url = clean(value);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) throw new Error("آدرس باید با http:// یا https:// شروع شود");
  try {
    new URL(url);
  } catch {
    throw new Error("آدرس معتبر نیست");
  }
  return url;
}

function toBigIntOrNull(value: unknown): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("هزینه باید عدد مثبت باشد");
  return BigInt(Math.round(n));
}

// ─────────────────────────────────────────────────────────────────
// گراف
// ─────────────────────────────────────────────────────────────────

/** کل گراف کمپین — ورودی لایه، حلقه و قفل پیش‌نیاز */
export async function loadGraph(campaignId: string) {
  const [nodes, edges] = await Promise.all([
    prisma.linkNode.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true, status: true, tier: true },
    }),
    prisma.linkEdge.findMany({
      where: { campaignId },
      select: { id: true, fromNodeId: true, toNodeId: true, toTargetId: true },
    }),
  ]);
  return { nodes, edges };
}

/**
 * بازمحاسبه‌ی لایه‌ی کل کمپین.
 *
 * ⚠️ تله‌ی ۲: فقط با تغییر یال (یا حذف گره و صفحه) صدا زده می‌شود و فقط
 * گره‌هایی را می‌نویسد که لایه‌شان واقعاً عوض شده تا `updatedAt` بی‌دلیل تکان
 * نخورد.
 */
export async function recomputeTiers(campaignId: string) {
  const { nodes, edges } = await loadGraph(campaignId);
  const tiers = computeTiers(
    nodes.map((n) => n.id),
    edges,
  );
  const updates = nodes.filter((n) => (tiers.get(n.id) ?? null) !== n.tier);
  if (updates.length) {
    await prisma.$transaction(
      updates.map((n) =>
        prisma.linkNode.update({ where: { id: n.id }, data: { tier: tiers.get(n.id) ?? null } }),
      ),
    );
  }
  return updates.length;
}

// ─────────────────────────────────────────────────────────────────
// وضعیت محتوای گره‌ها (برچسب «در انتظار محتوا»)
// ─────────────────────────────────────────────────────────────────

export type ContentState = {
  taskId: string;
  code: number;
  status: ContentTaskStatus;
  title: string;
  /** متن رسیده؛ گره آزاد است (بخش ۷.۶ — منتظر DONE ماندن اشتباه است) */
  isReady: boolean;
};

function contentStateOf(
  task: { id: string; code: number; status: ContentTaskStatus; title: string } | null,
): ContentState | null {
  if (!task) return null;
  return {
    taskId: task.id,
    code: task.code,
    status: task.status,
    title: task.title,
    isReady: CONTENT_READY_STATUSES.includes(task.status),
  };
}

// ─────────────────────────────────────────────────────────────────
// گره — نگاشت یکتا
// ─────────────────────────────────────────────────────────────────

export const NODE_SELECT = {
  id: true,
  code: true,
  campaignId: true,
  tier: true,
  status: true,
  anchorText: true,
  anchorKind: true,
  relFollow: true,
  relUgc: true,
  relSponsored: true,
  contentKind: true,
  wordCount: true,
  contentBrief: true,
  profileTitle: true,
  contentTaskId: true,
  assigneeId: true,
  assigneeName: true,
  createdById: true,
  createdByName: true,
  dueAt: true,
  publishedUrl: true,
  cost: true,
  note: true,
  returnCount: true,
  returnReason: true,
  failReason: true,
  assignedAt: true,
  startedAt: true,
  submittedAt: true,
  liveAt: true,
  lostAt: true,
  createdAt: true,
  type: { select: { id: true, title: true, icon: true, isRisky: true } },
  platform: { select: { id: true, title: true, domain: true, iconPath: true } },
  campaign: { select: { id: true, title: true } },
  outEdges: { select: { toNodeId: true, toTargetId: true } },
  contentTask: { select: { id: true, code: true, status: true, title: true } },
} satisfies Prisma.LinkNodeSelect;

type NodeRow = Prisma.LinkNodeGetPayload<{ select: typeof NODE_SELECT }>;

export type LinkNodeDto = ReturnType<typeof toNodeDto>;

/**
 * **تنها نگاشت گره.** فهرست، جزئیات، «گره‌های من» و پاسخ هر انتقال همه از
 * همین می‌گذرند — تله‌ی ۹: دو نگاشت هم‌شکل یعنی فیلد تازه یک‌جا اضافه شود و
 * جای دیگر نه، و نه tsc می‌گیردش نه تست.
 */
export function toNodeDto(row: NodeRow, blocked: Set<string>) {
  return {
    id: row.id,
    code: row.code,
    campaignId: row.campaignId,
    campaign: row.campaign,
    tier: row.tier,
    status: row.status,
    type: row.type,
    platform: row.platform,
    anchorText: row.anchorText,
    anchorKind: row.anchorKind,
    relFollow: row.relFollow,
    relUgc: row.relUgc,
    relSponsored: row.relSponsored,
    contentKind: row.contentKind,
    wordCount: row.wordCount,
    contentBrief: row.contentBrief,
    profileTitle: row.profileTitle,
    contentTaskId: row.contentTaskId,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    createdByName: row.createdByName,
    dueAt: row.dueAt,
    publishedUrl: row.publishedUrl,
    cost: row.cost === null ? null : Number(row.cost),
    note: row.note,
    returnCount: row.returnCount,
    returnReason: row.returnReason,
    failReason: row.failReason,
    assignedAt: row.assignedAt,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    liveAt: row.liveAt,
    lostAt: row.lostAt,
    createdAt: row.createdAt,
    destinations: row.outEdges.map((e) => ({ toNodeId: e.toNodeId, toTargetId: e.toTargetId })),
    isBlocked: blocked.has(row.id),
    content: contentStateOf(row.contentTask),
  };
}

/** گره‌های مسدودِ چند کمپین — یک بار به‌ازای هر کمپین، نه هر ردیف */
async function blockedFor(campaignIds: string[]) {
  const blocked = new Set<string>();
  for (const id of [...new Set(campaignIds)]) {
    const { nodes, edges } = await loadGraph(id);
    const live = new Set(nodes.filter((n) => n.status === "LIVE").map((n) => n.id));
    for (const b of blockedNodeIds(edges, live)) blocked.add(b);
  }
  return blocked;
}

export interface NodeFilter {
  campaignId?: string;
  mine?: boolean;
  status?: LinkNodeStatus[];
  q?: string;
}

/**
 * فهرست گره‌ها.
 *
 * ⚠️ کسی که کمپین‌ها را نمی‌بیند (نه مدیر، نه `MARKETING_VIEW_ALL`) **فقط گره‌های
 * خودش** را می‌گیرد، هر چیزی که در کوئری بفرستد — سمت سرور (تله‌ی ۱۲).
 */
export async function listNodes(filter: NodeFilter, access: StaffAccess) {
  const where: Prisma.LinkNodeWhereInput = { deletedAt: null, campaign: { deletedAt: null } };
  if (filter.campaignId) where.campaignId = filter.campaignId;
  if (filter.mine || !canViewCampaigns(access)) where.assigneeId = access.userId;
  if (filter.status?.length) where.status = { in: filter.status };
  const q = filter.q?.trim();
  if (q) {
    where.OR = [
      { anchorText: { contains: q, mode: "insensitive" } },
      { profileTitle: { contains: q, mode: "insensitive" } },
      { publishedUrl: { contains: q, mode: "insensitive" } },
      { platform: { title: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.linkNode.findMany({
    where,
    select: NODE_SELECT,
    // لایه‌ی نزدیک‌تر اول، بعد شماره — ترتیبی که مدیر انتظار دارد
    orderBy: filter.mine
      ? [{ dueAt: { sort: "asc", nulls: "last" } }, { code: "asc" }]
      : [{ tier: { sort: "asc", nulls: "last" } }, { code: "asc" }],
    take: 500,
  });

  const blocked = await blockedFor(rows.map((r) => r.campaignId));
  return rows.map((r) => toNodeDto(r, blocked));
}

export async function getNode(id: string) {
  const row = await prisma.linkNode.findFirst({
    where: { id, deletedAt: null },
    select: NODE_SELECT,
  });
  if (!row) throw new Error("گره پیدا نشد");
  const blocked = await blockedFor([row.campaignId]);
  return toNodeDto(row, blocked);
}

export async function getNodeEvents(id: string) {
  return prisma.linkNodeEvent.findMany({
    where: { nodeId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, actorName: true, action: true, note: true, createdAt: true },
  });
}

/** دسترسی دیدن یک گره: مدیر و ناظر همه را، کارمند فقط مال خودش */
export async function canSeeNode(id: string, access: StaffAccess) {
  if (canViewCampaigns(access)) return true;
  const hit = await prisma.linkNode.findFirst({
    where: { id, deletedAt: null, assigneeId: access.userId },
    select: { id: true },
  });
  return !!hit;
}

// ─────────────────────────────────────────────────────────────────
// ساخت و ویرایش گره
// ─────────────────────────────────────────────────────────────────

export interface Destination {
  toNodeId?: string | null;
  toTargetId?: string | null;
}

export interface NodeInput {
  campaignId?: string;
  typeId?: string;
  platformId?: string | null;
  anchorText?: string | null;
  anchorKind?: LinkAnchorKind | null;
  relFollow?: boolean;
  relUgc?: boolean;
  relSponsored?: boolean;
  contentKind?: LinkContentKind;
  wordCount?: number | null;
  contentBrief?: string | null;
  profileTitle?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  cost?: number | string | null;
  note?: string | null;
  destinations?: Destination[];
}

/**
 * مقصدها: هر مقصد **دقیقاً یکی** از گره یا صفحه‌ی هدف، هر دو مال همین
 * کمپین، و یال تازه نباید حلقه ببندد.
 *
 * قید `CHECK` دیتابیس همین را تضمین می‌کند ولی خطایش فارسی نیست؛ اینجا پیام
 * قابل‌فهم می‌دهیم و آنجا تور ایمنی می‌ماند.
 */
async function validateDestinations(
  campaignId: string,
  nodeId: string | null,
  destinations: Destination[],
) {
  const [{ nodes, edges }, targets] = await Promise.all([
    loadGraph(campaignId),
    prisma.linkTarget.findMany({ where: { campaignId }, select: { id: true } }),
  ]);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const targetIds = new Set(targets.map((t) => t.id));
  // یال‌های خودِ این گره در حال جایگزینی‌اند و در تشخیص حلقه حساب نمی‌شوند
  const otherEdges: GraphEdge[] = edges.filter((e) => e.fromNodeId !== nodeId);

  const out: { toNodeId: string | null; toTargetId: string | null }[] = [];
  const seen = new Set<string>();
  for (const d of destinations) {
    const toNodeId = d.toNodeId || null;
    const toTargetId = d.toTargetId || null;
    if (Boolean(toNodeId) === Boolean(toTargetId)) {
      throw new Error("هر مقصد باید یا یک گره باشد یا یک صفحه‌ی هدف");
    }
    const key = (toNodeId ?? toTargetId)!;
    if (seen.has(key)) continue;
    seen.add(key);

    if (toTargetId && !targetIds.has(toTargetId)) throw new Error("صفحه‌ی هدف در این کمپین نیست");
    if (toNodeId) {
      if (!nodeIds.has(toNodeId)) throw new Error("گره‌ی مقصد در این کمپین نیست");
      if (nodeId && wouldCreateCycle(otherEdges, nodeId, toNodeId)) {
        throw new Error(
          "این مقصد حلقه می‌سازد — گره‌ی مقصد مستقیم یا با واسطه به همین گره برمی‌گردد",
        );
      }
    }
    out.push({ toNodeId, toTargetId });
  }
  return out;
}

async function replaceEdges(
  campaignId: string,
  fromNodeId: string,
  destinations: { toNodeId: string | null; toTargetId: string | null }[],
) {
  await prisma.$transaction([
    prisma.linkEdge.deleteMany({ where: { fromNodeId } }),
    ...destinations.map((d) =>
      prisma.linkEdge.create({
        data: { campaignId, fromNodeId, toNodeId: d.toNodeId, toTargetId: d.toTargetId },
      }),
    ),
  ]);
}

/** مسئول گره فقط از دارندگان `LINK_WORK` (بخش ۴، قاعده‌ی ۲) */
async function validAssignee(userId: string | null | undefined) {
  if (!userId) return null;
  const staff = await usersWithPermission("LINK_WORK");
  const hit = staff.find((s) => s.id === userId);
  if (!hit) throw new Error("این کارمند مجوز لینک‌سازی ندارد");
  return hit;
}

async function validPlatform(typeId: string, platformId: string | null | undefined) {
  if (!platformId) return null;
  const p = await prisma.linkPlatform.findFirst({
    where: { id: platformId, typeId },
    select: { id: true },
  });
  // پلتفرم بدون نوع بی‌معنی است؛ پلتفرمِ نوعِ دیگر هم همین‌طور
  if (!p) throw new Error("این پلتفرم مال نوع انتخاب‌شده نیست");
  return p.id;
}

function nodeFields(input: NodeInput): Prisma.LinkNodeUncheckedUpdateInput {
  const data: Prisma.LinkNodeUncheckedUpdateInput = {};
  if (input.anchorText !== undefined) data.anchorText = clean(input.anchorText);
  if (input.anchorKind !== undefined) {
    if (input.anchorKind && !ANCHOR_KINDS.includes(input.anchorKind)) {
      throw new Error("نوع انکر معتبر نیست");
    }
    data.anchorKind = input.anchorKind || null;
  }
  if (input.relFollow !== undefined) data.relFollow = !!input.relFollow;
  if (input.relUgc !== undefined) data.relUgc = !!input.relUgc;
  if (input.relSponsored !== undefined) data.relSponsored = !!input.relSponsored;
  if (input.contentKind !== undefined) {
    if (!CONTENT_KINDS.includes(input.contentKind)) throw new Error("نوع محتوا معتبر نیست");
    data.contentKind = input.contentKind;
  }
  if (input.wordCount !== undefined) {
    const w = input.wordCount === null ? null : Number(input.wordCount);
    data.wordCount = w && Number.isFinite(w) && w > 0 ? Math.round(w) : null;
  }
  if (input.contentBrief !== undefined) data.contentBrief = clean(input.contentBrief);
  if (input.profileTitle !== undefined) data.profileTitle = clean(input.profileTitle);
  if (input.note !== undefined) data.note = clean(input.note);
  if (input.cost !== undefined) data.cost = toBigIntOrNull(input.cost);
  if (input.dueAt !== undefined) data.dueAt = parseMarketingDate(input.dueAt);
  return data;
}

export async function createNode(input: NodeInput, access: StaffAccess) {
  requireManager(access);
  if (!input.campaignId) throw new Error("کمپین مشخص نیست");
  if (!input.typeId) throw new Error("نوع لینک را انتخاب کنید");

  const campaign = await prisma.linkCampaign.findFirst({
    where: { id: input.campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!campaign) throw new Error("کمپین پیدا نشد");

  const type = await prisma.linkType.findFirst({
    where: { id: input.typeId, isActive: true },
    select: {
      id: true,
      defaultFollow: true,
      defaultUgc: true,
      defaultSponsored: true,
      defaultContentKind: true,
    },
  });
  if (!type) throw new Error("نوع لینک پیدا نشد");

  const platformId = await validPlatform(type.id, input.platformId);
  const assignee = await validAssignee(input.assigneeId);
  const destinations = await validateDestinations(campaign.id, null, input.destinations ?? []);

  // پیش‌فرض‌های نوع فقط وقتی می‌نشینند که کاربر چیزی نفرستاده؛ فرستادن
  // مقدار — حتی برابر پیش‌فرض — انتخاب آگاهانه است
  const fields = nodeFields({
    ...input,
    relFollow: undefined,
    relUgc: undefined,
    relSponsored: undefined,
    contentKind: undefined,
  });

  const node = await prisma.linkNode.create({
    data: {
      ...(fields as Prisma.LinkNodeUncheckedCreateInput),
      campaignId: campaign.id,
      typeId: type.id,
      platformId,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
      createdById: access.userId,
      createdByName: access.name,
      relFollow: input.relFollow ?? type.defaultFollow,
      relUgc: input.relUgc ?? type.defaultUgc,
      relSponsored: input.relSponsored ?? type.defaultSponsored,
      contentKind: input.contentKind ?? type.defaultContentKind,
      events: {
        create: {
          actorId: access.userId,
          actorName: access.name,
          action: "CREATED",
          toStatus: "PLANNED",
        },
      },
    },
    select: { id: true, code: true },
  });

  if (destinations.length) await replaceEdges(campaign.id, node.id, destinations);
  await recomputeTiers(campaign.id);

  logActivityAsync({
    action: "CREATE",
    entity: "LINK_NODE",
    entityId: node.id,
    entityTitle: `گره ${node.code}`,
    summary: `گره لینک‌سازی ${node.code.toLocaleString("fa-IR")} ساخته شد`,
  });

  return getNode(node.id);
}

/**
 * ویرایش بریف گره — مدیر. وضعیت از اینجا عوض نمی‌شود.
 *
 * ⚠️ تغییر مسئول روی گرهِ برنامه‌ریزی‌شده فقط ثبت می‌شود؛ روی گرهِ در جریان،
 * ارجاع واقعی است و از `link-workflow` (کنش `assign`) می‌گذرد تا رویداد و
 * اعلان بخورد.
 */
export async function updateNode(id: string, input: NodeInput, access: StaffAccess) {
  requireManager(access);
  const current = await prisma.linkNode.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, code: true, campaignId: true, typeId: true, status: true, assigneeId: true },
  });
  if (!current) throw new Error("گره پیدا نشد");

  const data = nodeFields(input);
  let typeId = current.typeId;
  if (input.typeId !== undefined && input.typeId !== current.typeId) {
    const type = await prisma.linkType.findFirst({
      where: { id: input.typeId, isActive: true },
      select: { id: true },
    });
    if (!type) throw new Error("نوع لینک پیدا نشد");
    typeId = type.id;
    data.typeId = type.id;
    // پلتفرمِ نوعِ قبلی دیگر معنی ندارد
    if (input.platformId === undefined) data.platformId = null;
  }
  if (input.platformId !== undefined) data.platformId = await validPlatform(typeId, input.platformId);

  if (input.assigneeId !== undefined && (input.assigneeId || null) !== current.assigneeId) {
    if (current.status !== "PLANNED") {
      throw new Error("مسئولِ گرهِ در جریان را از دکمه‌ی «ارجاع» عوض کنید");
    }
    const a = await validAssignee(input.assigneeId);
    data.assigneeId = a?.id ?? null;
    data.assigneeName = a?.name ?? null;
  }

  const destinations = input.destinations
    ? await validateDestinations(current.campaignId, id, input.destinations)
    : null;

  await prisma.linkNode.update({ where: { id }, data });
  if (destinations) {
    await replaceEdges(current.campaignId, id, destinations);
    await recomputeTiers(current.campaignId);
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "LINK_NODE",
    entityId: id,
    entityTitle: `گره ${current.code}`,
    summary: `گره لینک‌سازی ${current.code.toLocaleString("fa-IR")} ویرایش شد`,
  });

  return getNode(id);
}

/**
 * حذف نرم گره. گره‌ای که گره‌های دیگر به آن لینک می‌دهند حذف نمی‌شود —
 * حذفش یعنی آن‌ها بی‌سروصدا معلق شوند.
 */
export async function deleteNode(id: string, access: StaffAccess) {
  requireManager(access);
  const node = await prisma.linkNode.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, code: true, campaignId: true },
  });
  if (!node) throw new Error("گره پیدا نشد");

  const incoming = await prisma.linkEdge.count({
    where: { toNodeId: id, fromNode: { deletedAt: null } },
  });
  if (incoming > 0) {
    throw new Error(
      `${incoming.toLocaleString("fa-IR")} گره به این گره لینک می‌دهد — اول مقصدشان را عوض کنید`,
    );
  }

  // یال‌های گره پاک می‌شوند تا محاسبه‌ی لایه گره‌ی حذف‌شده را مسیر حساب نکند؛
  // اتصال به کار محتوا هم برداشته می‌شود تا آن کار آزاد شود. تاریخچه می‌ماند.
  await prisma.$transaction([
    prisma.linkEdge.deleteMany({ where: { OR: [{ fromNodeId: id }, { toNodeId: id }] } }),
    prisma.linkNode.update({
      where: { id },
      data: { deletedAt: new Date(), contentTaskId: null },
    }),
  ]);
  await recomputeTiers(node.campaignId);

  logActivityAsync({
    action: "DELETE",
    entity: "LINK_NODE",
    entityId: id,
    entityTitle: `گره ${node.code}`,
    summary: `گره لینک‌سازی ${node.code.toLocaleString("fa-IR")} حذف شد`,
  });
}

// ─────────────────────────────────────────────────────────────────
// کمپین
// ─────────────────────────────────────────────────────────────────

const CAMPAIGN_STATUSES: LinkCampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "DONE"];

const TARGET_SELECT = {
  id: true,
  url: true,
  label: true,
  primaryKeyword: true,
  isActive: true,
} satisfies Prisma.LinkTargetSelect;

export async function listCampaigns(includeDone: boolean) {
  const rows = await prisma.linkCampaign.findMany({
    where: { deletedAt: null, ...(includeDone ? {} : { status: { not: "DONE" } }) },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      note: true,
      status: true,
      weeklyQuota: true,
      createdAt: true,
      updatedAt: true,
      targets: { orderBy: { createdAt: "asc" }, select: TARGET_SELECT },
    },
  });

  // شمارش وضعیت گره‌ها برای نوار پیشرفت کارت — یک کوئری برای همه
  const counts = await prisma.linkNode.groupBy({
    by: ["campaignId", "status"],
    where: { deletedAt: null, campaignId: { in: rows.map((r) => r.id) } },
    _count: true,
  });

  return rows.map((r) => {
    const own = counts.filter((c) => c.campaignId === r.id);
    const total = own.reduce((s, c) => s + c._count, 0);
    const live = own.find((c) => c.status === "LIVE")?._count ?? 0;
    return { ...r, nodeCount: total, liveCount: live };
  });
}

/** هشدارهای ساختاری کمپین — سد نیستند، فقط دیده می‌شوند */
async function campaignWarnings(campaignId: string) {
  const { nodes, edges } = await loadGraph(campaignId);
  const withEdges = new Set(edges.map((e) => e.fromNodeId));
  return {
    orphans: nodes.filter((n) => n.tier === null && withEdges.has(n.id)).length,
    noDestination: nodes.filter((n) => !withEdges.has(n.id)).length,
    tooDeep: nodes.filter((n) => (n.tier ?? 0) > MAX_TIER).length,
    maxTier: MAX_TIER,
  };
}

export async function getCampaign(id: string) {
  const row = await prisma.linkCampaign.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      note: true,
      status: true,
      weeklyQuota: true,
      anchorProfile: true,
      createdAt: true,
      updatedAt: true,
      targets: { orderBy: { createdAt: "asc" }, select: TARGET_SELECT },
    },
  });
  if (!row) throw new Error("کمپین پیدا نشد");
  return { ...row, warnings: await campaignWarnings(id) };
}

export interface CampaignInput {
  title?: string;
  note?: string | null;
  status?: LinkCampaignStatus;
  weeklyQuota?: number | string | null;
  anchorProfile?: string;
  firstTarget?: TargetInput;
}

function quotaOf(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) throw new Error("سقف هفتگی باید عدد مثبت باشد");
  return Math.round(n);
}

/**
 * ساخت کمپین **همیشه با یک صفحه‌ی هدف** — کمپین بدون صفحه‌ی هدف ریشه ندارد،
 * هیچ گره‌ای لایه نمی‌گیرد و کل چارت معلق می‌ماند.
 */
export async function createCampaign(input: CampaignInput, access: StaffAccess) {
  requireManager(access);
  const title = clean(input.title);
  if (!title) throw new Error("نام کمپین لازم است");
  const url = cleanUrl(input.firstTarget?.url);
  if (!url) throw new Error("آدرس اولین صفحه‌ی هدف لازم است");

  const campaign = await prisma.linkCampaign.create({
    data: {
      title,
      note: clean(input.note),
      status: input.status && CAMPAIGN_STATUSES.includes(input.status) ? input.status : "ACTIVE",
      weeklyQuota: quotaOf(input.weeklyQuota),
      targets: {
        create: {
          url,
          label: clean(input.firstTarget?.label),
          primaryKeyword: clean(input.firstTarget?.primaryKeyword),
        },
      },
    },
    select: { id: true, title: true },
  });

  logActivityAsync({
    action: "CREATE",
    entity: "LINK_CAMPAIGN",
    entityId: campaign.id,
    entityTitle: campaign.title,
    summary: `کمپین لینک‌سازی «${campaign.title}» ساخته شد`,
  });
  return campaign;
}

export async function updateCampaign(id: string, input: CampaignInput, access: StaffAccess) {
  requireManager(access);
  const current = await prisma.linkCampaign.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!current) throw new Error("کمپین پیدا نشد");

  const data: Prisma.LinkCampaignUpdateInput = {};
  if (input.title !== undefined) {
    const title = clean(input.title);
    if (!title) throw new Error("نام کمپین لازم است");
    data.title = title;
  }
  if (input.note !== undefined) data.note = clean(input.note);
  if (input.weeklyQuota !== undefined) data.weeklyQuota = quotaOf(input.weeklyQuota);
  if (input.status !== undefined) {
    if (!CAMPAIGN_STATUSES.includes(input.status)) throw new Error("وضعیت کمپین معتبر نیست");
    data.status = input.status;
  }
  if (input.anchorProfile !== undefined) data.anchorProfile = input.anchorProfile;

  const updated = await prisma.linkCampaign.update({
    where: { id },
    data,
    select: { id: true, title: true },
  });
  logActivityAsync({
    action: "UPDATE",
    entity: "LINK_CAMPAIGN",
    entityId: id,
    entityTitle: updated.title,
    summary: `کمپین لینک‌سازی «${updated.title}» ویرایش شد`,
  });
  return updated;
}

/** کمپینی که گره‌ی در جریان دارد حذف نمی‌شود — «تمام‌شده» یا «متوقف» کنید */
export async function deleteCampaign(id: string, access: StaffAccess) {
  requireManager(access);
  const campaign = await prisma.linkCampaign.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!campaign) throw new Error("کمپین پیدا نشد");

  const working = await prisma.linkNode.count({
    where: { campaignId: id, deletedAt: null, status: { notIn: ["PLANNED", "FAILED"] } },
  });
  if (working > 0) {
    throw new Error(
      `${working.toLocaleString("fa-IR")} گره‌ی این کمپین در جریان یا فعال است — کمپین را «متوقف» یا «تمام‌شده» کنید`,
    );
  }

  await prisma.linkCampaign.update({ where: { id }, data: { deletedAt: new Date() } });
  logActivityAsync({
    action: "DELETE",
    entity: "LINK_CAMPAIGN",
    entityId: id,
    entityTitle: campaign.title,
    summary: `کمپین لینک‌سازی «${campaign.title}» حذف شد`,
  });
}

// ─────────────────────────────────────────────────────────────────
// صفحه‌ی هدف
// ─────────────────────────────────────────────────────────────────

export interface TargetInput {
  url?: string;
  label?: string | null;
  primaryKeyword?: string | null;
  isActive?: boolean;
}

export async function addTarget(campaignId: string, input: TargetInput, access: StaffAccess) {
  requireManager(access);
  const campaign = await prisma.linkCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    select: { id: true, targets: { select: { url: true } } },
  });
  if (!campaign) throw new Error("کمپین پیدا نشد");
  const url = cleanUrl(input.url);
  if (!url) throw new Error("آدرس صفحه لازم است");
  if (campaign.targets.some((t) => t.url === url)) {
    throw new Error("این صفحه قبلاً در همین کمپین ثبت شده است");
  }

  return prisma.linkTarget.create({
    data: {
      campaignId,
      url,
      label: clean(input.label),
      primaryKeyword: clean(input.primaryKeyword),
    },
    select: TARGET_SELECT,
  });
}

export async function updateTarget(id: string, input: TargetInput, access: StaffAccess) {
  requireManager(access);
  const target = await prisma.linkTarget.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new Error("صفحه‌ی هدف پیدا نشد");

  const data: Prisma.LinkTargetUpdateInput = {};
  if (input.url !== undefined) {
    const url = cleanUrl(input.url);
    if (!url) throw new Error("آدرس صفحه لازم است");
    data.url = url;
  }
  if (input.label !== undefined) data.label = clean(input.label);
  if (input.primaryKeyword !== undefined) data.primaryKeyword = clean(input.primaryKeyword);
  if (input.isActive !== undefined) data.isActive = !!input.isActive;
  return prisma.linkTarget.update({ where: { id }, data, select: TARGET_SELECT });
}

/**
 * حذف صفحه‌ی هدف. دو نگهبان: کمپین بدون صفحه‌ی هدف نمی‌ماند، و صفحه‌ای که
 * گره به آن لینک می‌دهد حذف نمی‌شود (غیرفعال کنید).
 */
export async function deleteTarget(id: string, access: StaffAccess) {
  requireManager(access);
  const target = await prisma.linkTarget.findUnique({
    where: { id },
    select: { id: true, campaignId: true },
  });
  if (!target) throw new Error("صفحه‌ی هدف پیدا نشد");

  const remaining = await prisma.linkTarget.count({ where: { campaignId: target.campaignId } });
  if (remaining <= 1) throw new Error("کمپین باید دست‌کم یک صفحه‌ی هدف داشته باشد");

  const edges = await prisma.linkEdge.count({
    where: { toTargetId: id, fromNode: { deletedAt: null } },
  });
  if (edges > 0) {
    throw new Error(
      `${edges.toLocaleString("fa-IR")} گره به این صفحه لینک می‌دهد — اول مقصدشان را عوض کنید`,
    );
  }

  await prisma.linkTarget.delete({ where: { id } });
  await recomputeTiers(target.campaignId);
}

// ─────────────────────────────────────────────────────────────────
// بوم
// ─────────────────────────────────────────────────────────────────

export async function getCanvas(campaignId: string) {
  const campaign = await prisma.linkCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    select: { id: true, isPristine: true },
  });
  if (!campaign) throw new Error("کمپین پیدا نشد");

  const [nodes, targets, edges] = await Promise.all([
    prisma.linkNode.findMany({
      where: { campaignId, deletedAt: null },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        tier: true,
        status: true,
        posX: true,
        posY: true,
        anchorText: true,
        relFollow: true,
        assigneeName: true,
        type: { select: { id: true, title: true, icon: true, isRisky: true } },
        platform: { select: { id: true, title: true, iconPath: true } },
      },
    }),
    prisma.linkTarget.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
      select: { id: true, url: true, label: true, primaryKeyword: true, posX: true, posY: true },
    }),
    prisma.linkEdge.findMany({
      where: { campaignId, fromNode: { deletedAt: null } },
      select: { id: true, fromNodeId: true, toNodeId: true, toTargetId: true },
    }),
  ]);

  // ⚠️ تله‌ی ۶: (۰،۰) دو معنی دارد. `isPristine` یعنی هنوز هیچ چیدمانی ذخیره
  // نشده؛ گره‌ای که **بعد از** ذخیره ساخته شده هم صفر است ولی کلاینت فقط
  // همان را خودکار می‌چیند.
  return { nodes, targets, edges, isPristine: campaign.isPristine };
}

export async function saveLayout(
  campaignId: string,
  placements: { id: string; kind: "node" | "target"; posX: number; posY: number }[],
  access: StaffAccess,
) {
  requireManager(access);
  const [nodes, targets] = await Promise.all([
    prisma.linkNode.findMany({ where: { campaignId, deletedAt: null }, select: { id: true } }),
    prisma.linkTarget.findMany({ where: { campaignId }, select: { id: true } }),
  ]);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const targetIds = new Set(targets.map((t) => t.id));

  // شناسه‌ی بیگانه بی‌سروصدا رد می‌شود — یک ردیف کهنه در حافظه‌ی کلاینت
  // نباید کل ذخیره را بشکند
  const clean = placements.filter(
    (p) =>
      Number.isFinite(p.posX) &&
      Number.isFinite(p.posY) &&
      (p.kind === "node" ? nodeIds.has(p.id) : targetIds.has(p.id)),
  );

  await prisma.$transaction([
    ...clean.map((p) =>
      p.kind === "node"
        ? prisma.linkNode.update({
            where: { id: p.id },
            data: { posX: Math.round(p.posX), posY: Math.round(p.posY) },
            select: { id: true },
          })
        : prisma.linkTarget.update({
            where: { id: p.id },
            data: { posX: Math.round(p.posX), posY: Math.round(p.posY) },
            select: { id: true },
          }),
    ),
    prisma.linkCampaign.update({ where: { id: campaignId }, data: { isPristine: false } }),
  ]);
  return clean.length;
}

// ─────────────────────────────────────────────────────────────────
// آمار — کنار چارت، نه در صفحه‌ی دیگر (بخش ۷ فاز ۷)
// ─────────────────────────────────────────────────────────────────

export type CampaignStats = {
  total: number;
  byStatus: { status: LinkNodeStatus; count: number }[];
  byTier: { tier: number | null; count: number }[];
  byType: { id: string; title: string; count: number }[];
  follow: { follow: number; nofollow: number; ugc: number; sponsored: number };
  anchors: AnchorSlice[];
  perTarget: { id: string; label: string; url: string; total: number; anchors: AnchorSlice[] }[];
  totalCost: number;
  progressPercent: number;
  anchorProfile: string;
  /** برای هشدار «بعد از افزودن» در فرم گره */
  nodes: { id: string; anchorKind: LinkAnchorKind | null; targetIds: string[] }[];
};

export async function campaignStats(campaignId: string): Promise<CampaignStats> {
  const campaign = await prisma.linkCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    select: {
      anchorProfile: true,
      targets: { orderBy: { createdAt: "asc" }, select: { id: true, url: true, label: true } },
    },
  });
  if (!campaign) throw new Error("کمپین پیدا نشد");

  const nodes = await prisma.linkNode.findMany({
    where: { campaignId, deletedAt: null },
    select: {
      id: true,
      tier: true,
      status: true,
      anchorKind: true,
      relFollow: true,
      relUgc: true,
      relSponsored: true,
      cost: true,
      type: { select: { id: true, title: true } },
      outEdges: { select: { toTargetId: true } },
    },
  });

  const total = nodes.length;
  const statusCounts = new Map<LinkNodeStatus, number>();
  const tierCounts = new Map<number | null, number>();
  const typeCounts = new Map<string, { title: string; count: number }>();
  let follow = 0;
  let ugc = 0;
  let sponsored = 0;
  let totalCost = 0;

  for (const n of nodes) {
    statusCounts.set(n.status, (statusCounts.get(n.status) ?? 0) + 1);
    tierCounts.set(n.tier, (tierCounts.get(n.tier) ?? 0) + 1);
    const t = typeCounts.get(n.type.id);
    if (t) t.count += 1;
    else typeCounts.set(n.type.id, { title: n.type.title, count: 1 });
    if (n.relFollow) follow += 1;
    if (n.relUgc) ugc += 1;
    if (n.relSponsored) sponsored += 1;
    totalCost += n.cost === null ? 0 : Number(n.cost);
  }

  // پیشرفت = سهم گره‌های فعال. شکست‌خورده و ازدست‌رفته در مخرج می‌مانند —
  // کاری که نشد هم بخشی از برنامه بود.
  const live = statusCounts.get("LIVE") ?? 0;

  return {
    total,
    byStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    byTier: [...tierCounts.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99)),
    byType: [...typeCounts.entries()]
      .map(([id, v]) => ({ id, title: v.title, count: v.count }))
      .sort((a, b) => b.count - a.count),
    follow: { follow, nofollow: total - follow, ugc, sponsored },
    anchors: summarizeAnchors(nodes, campaign.anchorProfile),
    perTarget: campaign.targets.map((t) => {
      const own = nodes.filter((n) => n.outEdges.some((e) => e.toTargetId === t.id));
      return {
        id: t.id,
        label: t.label || t.url,
        url: t.url,
        total: own.length,
        anchors: summarizeAnchors(own, campaign.anchorProfile),
      };
    }),
    totalCost,
    progressPercent: total === 0 ? 0 : Math.round((live / total) * 100),
    anchorProfile: campaign.anchorProfile,
    nodes: nodes.map((n) => ({
      id: n.id,
      anchorKind: n.anchorKind,
      targetIds: n.outEdges.map((e) => e.toTargetId).filter((x): x is string => !!x),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────
// انواع و پلتفرم‌ها
// ─────────────────────────────────────────────────────────────────

export async function listTypes(includeInactive: boolean) {
  const types = await prisma.linkType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      key: true,
      title: true,
      icon: true,
      description: true,
      seoNote: true,
      sampleSites: true,
      defaultContentKind: true,
      defaultFollow: true,
      defaultUgc: true,
      defaultSponsored: true,
      isRisky: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { nodes: { where: { deletedAt: null } } } },
      platforms: {
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          domain: true,
          accountNote: true,
          iconPath: true,
          domainAuthority: true,
          isActive: true,
        },
      },
    },
  });
  return types.map(({ _count, ...t }) => ({ ...t, nodeCount: _count.nodes }));
}

export interface TypeInput {
  title?: string;
  icon?: string | null;
  description?: string | null;
  seoNote?: string | null;
  sampleSites?: string | null;
  defaultContentKind?: LinkContentKind;
  defaultFollow?: boolean;
  defaultUgc?: boolean;
  defaultSponsored?: boolean;
  isRisky?: boolean;
  isActive?: boolean;
}

function typeData(input: TypeInput): Prisma.LinkTypeUpdateInput {
  const data: Prisma.LinkTypeUpdateInput = {};
  if (input.title !== undefined) {
    const title = clean(input.title);
    if (!title) throw new Error("نام نوع لازم است");
    data.title = title;
  }
  if (input.icon !== undefined) data.icon = clean(input.icon);
  if (input.description !== undefined) data.description = clean(input.description);
  if (input.seoNote !== undefined) data.seoNote = clean(input.seoNote);
  if (input.sampleSites !== undefined) data.sampleSites = clean(input.sampleSites);
  if (input.defaultContentKind !== undefined) {
    if (!(input.defaultContentKind in CONTENT_KIND_LABELS)) throw new Error("نوع محتوا معتبر نیست");
    data.defaultContentKind = input.defaultContentKind;
  }
  if (input.defaultFollow !== undefined) data.defaultFollow = !!input.defaultFollow;
  if (input.defaultUgc !== undefined) data.defaultUgc = !!input.defaultUgc;
  if (input.defaultSponsored !== undefined) data.defaultSponsored = !!input.defaultSponsored;
  if (input.isRisky !== undefined) data.isRisky = !!input.isRisky;
  if (input.isActive !== undefined) data.isActive = !!input.isActive;
  return data;
}

export async function createType(input: TypeInput) {
  const data = typeData(input);
  if (!data.title) throw new Error("نام نوع لازم است");
  const max = await prisma.linkType.aggregate({ _max: { sortOrder: true } });
  // نوع دست‌ساز `key` ندارد؛ کلید فقط مال انواع سیدشده است
  return prisma.linkType.create({
    data: { ...(data as Prisma.LinkTypeCreateInput), sortOrder: (max._max.sortOrder ?? 0) + 1 },
    select: { id: true },
  });
}

export async function updateType(id: string, input: TypeInput) {
  return prisma.linkType.update({ where: { id }, data: typeData(input), select: { id: true } });
}

/**
 * ⚠️ تله‌ی ۱۱: نوع سیدشده (با `key`) یا نوعی که گره دارد **حذف نمی‌شود**،
 * فقط غیرفعال — گزارش‌ها روی کلیدش می‌نشینند و گره‌ها به آن ارجاع دارند.
 * نوع دست‌سازِ بی‌استفاده واقعاً پاک می‌شود.
 */
export async function removeType(id: string): Promise<"deleted" | "deactivated"> {
  const type = await prisma.linkType.findUnique({
    where: { id },
    select: { key: true, _count: { select: { nodes: true, platforms: true } } },
  });
  if (!type) throw new Error("نوع پیدا نشد");
  if (type.key || type._count.nodes > 0 || type._count.platforms > 0) {
    await prisma.linkType.update({ where: { id }, data: { isActive: false } });
    return "deactivated";
  }
  await prisma.linkType.delete({ where: { id } });
  return "deleted";
}

export interface PlatformInput {
  typeId?: string;
  title?: string;
  domain?: string;
  accountNote?: string | null;
  domainAuthority?: number | string | null;
  isActive?: boolean;
}

/** دامنه بدون پروتکل و www و مسیر — «virgool.io» */
function normalizeDomain(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const host = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw new Error("دامنه معتبر نیست");
  return host;
}

function daOf(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("قدرت دامنه عددی بین ۰ تا ۱۰۰ است");
  return Math.round(n);
}

/**
 * ⚠️ `iconPath` اینجا نوشته **نمی‌شود**: سرور برای آیکن به اینترنت وصل
 * نمی‌شود و مسیر از روی دامنه حدس زده نمی‌شود. آیکن را اسکریپت لوکال
 * `seed-link-types.ts` از `public/link-platforms/` وصل می‌کند.
 */
export async function createPlatform(input: PlatformInput) {
  if (!input.typeId) throw new Error("نوع پلتفرم مشخص نیست");
  const title = clean(input.title);
  if (!title) throw new Error("نام پلتفرم لازم است");
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new Error("دامنه لازم است");

  const dup = await prisma.linkPlatform.findUnique({
    where: { typeId_domain: { typeId: input.typeId, domain } },
    select: { id: true },
  });
  if (dup) throw new Error("این دامنه در همین نوع ثبت شده است");

  return prisma.linkPlatform.create({
    data: {
      typeId: input.typeId,
      title,
      domain,
      accountNote: clean(input.accountNote),
      domainAuthority: daOf(input.domainAuthority),
    },
    select: { id: true },
  });
}

export async function updatePlatform(id: string, input: PlatformInput) {
  const data: Prisma.LinkPlatformUpdateInput = {};
  if (input.title !== undefined) {
    const title = clean(input.title);
    if (!title) throw new Error("نام پلتفرم لازم است");
    data.title = title;
  }
  if (input.domain !== undefined) {
    const domain = normalizeDomain(input.domain);
    if (!domain) throw new Error("دامنه لازم است");
    data.domain = domain;
  }
  if (input.accountNote !== undefined) data.accountNote = clean(input.accountNote);
  if (input.domainAuthority !== undefined) data.domainAuthority = daOf(input.domainAuthority);
  if (input.isActive !== undefined) data.isActive = !!input.isActive;
  return prisma.linkPlatform.update({ where: { id }, data, select: { id: true } });
}

/** پلتفرمی که گره دارد فقط غیرفعال می‌شود */
export async function removePlatform(id: string): Promise<"deleted" | "deactivated"> {
  const p = await prisma.linkPlatform.findUnique({
    where: { id },
    select: { _count: { select: { nodes: true } } },
  });
  if (!p) throw new Error("پلتفرم پیدا نشد");
  if (p._count.nodes > 0) {
    await prisma.linkPlatform.update({ where: { id }, data: { isActive: false } });
    return "deactivated";
  }
  await prisma.linkPlatform.delete({ where: { id } });
  return "deleted";
}

