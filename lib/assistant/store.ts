/**
 * تنظیمات، سهمیه و گفتگوهای دستیار — docs/plans/admin-assistant.md بخش ۷ و ۸
 *
 * ⚠️ پنل مدیر فقط شمارش و هزینه را می‌بیند، نه متن گفتگوی دیگران (تصمیم ۴).
 * هیچ تابعی اینجا متن گفتگو را بی `userId` صاحبش برنمی‌گرداند.
 */
import type { AssistantRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_SETTING_ID, DEFAULT_ASSISTANT_MODEL, DEFAULT_DAILY_LIMIT } from "./constants";
import { startOfTehranDay } from "./dates";

export interface AssistantSettingView {
  enabled: boolean;
  model: string;
  maxTokens: number;
  dailyLimit: number;
  extraGuide: string;
  updatedByName: string | null;
  updatedAt: Date | null;
}

export async function getAssistantSetting(): Promise<AssistantSettingView> {
  const row = await prisma.assistantSetting.findUnique({ where: { id: ASSISTANT_SETTING_ID } });
  return {
    enabled: row?.enabled ?? false,
    model: row?.model?.trim() || DEFAULT_ASSISTANT_MODEL,
    maxTokens: row?.maxTokens ?? 3000,
    dailyLimit: row?.dailyLimit ?? DEFAULT_DAILY_LIMIT,
    extraGuide: row?.extraGuide ?? "",
    updatedByName: row?.updatedByName ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function saveAssistantSetting(
  input: { enabled: boolean; model: string; maxTokens: number; dailyLimit: number; extraGuide: string },
  byName: string,
) {
  const data = {
    enabled: input.enabled,
    model: input.model.trim().slice(0, 100) || DEFAULT_ASSISTANT_MODEL,
    maxTokens: Math.min(8000, Math.max(500, Math.round(input.maxTokens))),
    dailyLimit: Math.min(1000, Math.max(0, Math.round(input.dailyLimit))),
    extraGuide: input.extraGuide.trim().slice(0, 2000) || null,
    updatedByName: byName,
  };
  await prisma.assistantSetting.upsert({
    where: { id: ASSISTANT_SETTING_ID },
    update: data,
    create: { id: ASSISTANT_SETTING_ID, ...data },
  });
}

// ─────────────────────────────────────────────────────────────────
// سهمیه
// ─────────────────────────────────────────────────────────────────

export interface AssistantQuota {
  enabled: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/** فقط پاسخ موفق شمرده می‌شود — خطای سرویس از سهمیه کم نمی‌کند */
function countAnswersSince(userId: string, since: Date) {
  return prisma.assistantMessage.count({
    where: { userId, role: "ASSISTANT", error: null, createdAt: { gte: since } },
  });
}

/** سقف مؤثر کاربر: ردیف اختصاصی یا پیش‌فرض؛ صفر یعنی خاموش برای او */
export async function assistantQuota(userId: string): Promise<AssistantQuota> {
  const [setting, own, used] = await Promise.all([
    getAssistantSetting(),
    prisma.assistantUserLimit.findUnique({ where: { userId } }),
    countAnswersSince(userId, startOfTehranDay()),
  ]);
  const limit = own?.dailyLimit ?? setting.dailyLimit;
  return { enabled: setting.enabled && limit > 0, limit, used, remaining: Math.max(0, limit - used) };
}

/**
 * سقف اختصاصی کارمندها. `null` یعنی برگشت به پیش‌فرض (ردیف پاک می‌شود).
 */
export async function saveUserLimits(rows: { userId: string; dailyLimit: number | null }[]) {
  await prisma.$transaction(
    rows.map((row) =>
      row.dailyLimit === null
        ? prisma.assistantUserLimit.deleteMany({ where: { userId: row.userId } })
        : prisma.assistantUserLimit.upsert({
            where: { userId: row.userId },
            update: { dailyLimit: Math.min(1000, Math.max(0, Math.round(row.dailyLimit))) },
            create: { userId: row.userId, dailyLimit: Math.min(1000, Math.max(0, Math.round(row.dailyLimit))) },
          }),
    ),
  );
}

/**
 * نمای مدیر: هر کارمند با سقف و مصرف امروز و این ماه — **فقط شمارش و هزینه**.
 */
export async function assistantUsageByStaff() {
  const today = startOfTehranDay();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [staff, limits, todayCounts, monthAgg, feedback] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
      orderBy: [{ firstName: "asc" }, { phone: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true, staffRole: { select: { title: true } } },
    }),
    prisma.assistantUserLimit.findMany(),
    prisma.assistantMessage.groupBy({
      by: ["userId"],
      where: { role: "ASSISTANT", error: null, createdAt: { gte: today } },
      _count: { _all: true },
    }),
    prisma.assistantMessage.groupBy({
      by: ["userId"],
      where: { role: "ASSISTANT", createdAt: { gte: monthAgo } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    prisma.assistantMessage.groupBy({
      by: ["feedback"],
      where: { role: "ASSISTANT", createdAt: { gte: monthAgo }, feedback: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const limitOf = new Map(limits.map((l) => [l.userId, l.dailyLimit]));
  const todayOf = new Map(todayCounts.map((c) => [c.userId, c._count._all]));
  const monthOf = new Map(monthAgg.map((c) => [c.userId, { count: c._count._all, cost: c._sum.costUsd ?? 0 }]));
  return {
    staff: staff.map((u) => ({
      userId: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone,
      roleTitle: u.staffRole?.title ?? null,
      dailyLimit: limitOf.has(u.id) ? limitOf.get(u.id)! : null,
      today: todayOf.get(u.id) ?? 0,
      month: monthOf.get(u.id)?.count ?? 0,
      monthCost: monthOf.get(u.id)?.cost ?? 0,
    })),
    feedback: {
      up: feedback.find((f) => f.feedback === 1)?._count._all ?? 0,
      down: feedback.find((f) => f.feedback === -1)?._count._all ?? 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// گفتگو — همیشه با userId صاحبش
// ─────────────────────────────────────────────────────────────────

export function findOwnConversation(userId: string, id: string) {
  return prisma.assistantConversation.findFirst({ where: { id, userId, deletedAt: null } });
}

export function createConversation(userId: string, userName: string, title: string) {
  return prisma.assistantConversation.create({ data: { userId, userName, title: title || "گفتگو" } });
}

export function touchConversation(id: string) {
  return prisma.assistantConversation.update({ where: { id }, data: { updatedAt: new Date() } });
}

/** چند پیام آخر به ترتیب زمان — پاسخ خطادار به مدل نمی‌رود */
export async function recentMessages(conversationId: string, take: number) {
  const rows = await prisma.assistantMessage.findMany({
    where: { conversationId, OR: [{ role: "USER" }, { error: null }] },
    orderBy: { createdAt: "desc" },
    take,
    select: { role: true, content: true },
  });
  return rows.reverse().filter((r) => r.content.trim());
}

export function createMessage(data: {
  conversationId: string;
  userId: string;
  role: AssistantRole;
  content: string;
  pagePath?: string;
  toolCalls?: Prisma.InputJsonValue;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  durationMs?: number;
  error?: string | null;
}) {
  return prisma.assistantMessage.create({ data });
}

export function listConversations(userId: string) {
  return prisma.assistantConversation.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function getConversationView(userId: string, id: string) {
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id, userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, role: true, content: true, error: true, feedback: true, createdAt: true },
      },
    },
  });
  return conversation;
}

export async function deleteConversation(userId: string, id: string) {
  const { count } = await prisma.assistantConversation.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return count > 0;
}

export async function setFeedback(userId: string, messageId: string, feedback: 1 | -1 | null) {
  const { count } = await prisma.assistantMessage.updateMany({
    where: { id: messageId, userId, role: "ASSISTANT" },
    data: { feedback },
  });
  return count > 0;
}
