import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import {
  createSeoTask,
  seoScopeFilter,
  SEO_TASK_SELECT,
} from "@/lib/marketing/seo-task-service";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

/**
 * تب‌های صفحه‌ی کارهای سئو.
 *
 * ⚠️ تبِ ناشناخته بی‌سروصدا به `open` برمی‌گردد. افزودن تب تازه در دو جا
 * لازم است: همین شیء و فهرست تب‌های کلاینت.
 */
const TABS = ["open", "mine", "approval", "review", "done", "canceled", "all"] as const;
type Tab = (typeof TABS)[number];

function tabFilter(tab: Tab, userId: string): Prisma.SeoTaskWhereInput {
  switch (tab) {
    case "mine":
      return { assigneeId: userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } };
    case "approval":
      return { status: "AWAITING_APPROVAL" };
    case "review":
      // «بررسی نتیجه» = تأیید شده، تاریخ بررسی رسیده، نتیجه هنوز ثبت نشده
      return {
        status: "DONE",
        reviewOutcome: null,
        reviewAt: { not: null, lte: new Date() },
      };
    case "done":
      return { status: "DONE" };
    case "canceled":
      return { status: "CANCELED" };
    case "all":
      return {};
    case "open":
    default:
      return { status: { in: ["ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"] } };
  }
}

/** فهرست کارهای سئو با فیلتر و صفحه‌بندی cursor */
export async function GET(req: Request) {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE", "MARKETING_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { access } = guard;

  const sp = new URL(req.url).searchParams;
  const rawTab = sp.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "open";

  const where: Prisma.SeoTaskWhereInput = {
    deletedAt: null,
    ...tabFilter(tab, access.userId),
  };

  // ⚠️ مرز دسترسی و جستجو هر دو داخل همان آرایه‌ی AND می‌روند. اگر هرکدام
  // مستقیم `where.AND` را بنویسد، دیگری را پاک می‌کند و فیلتر دسترسی
  // بی‌سروصدا از بین می‌رود — همان تله‌ی مسیر کارهای کارتابل.
  const canViewAll = can(access, "MARKETING_VIEW_ALL");
  const scoped: Prisma.SeoTaskWhereInput[] = [];
  if (!canViewAll) scoped.push(seoScopeFilter(access.userId));

  const assigneeId = sp.get("assigneeId");
  if (assigneeId && tab !== "mine") {
    scoped.push({ assigneeId: assigneeId === "me" ? access.userId : assigneeId });
  }

  const categoryId = sp.get("categoryId");
  if (categoryId) where.categoryId = categoryId;

  const priority = sp.get("priority");
  if (priority) where.priority = priority as never;

  const q = sp.get("q")?.trim();
  if (q) {
    scoped.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { pageUrls: { contains: q, mode: "insensitive" } },
        { report: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (scoped.length) where.AND = scoped;

  const cursor = sp.get("cursor");

  const rows = await prisma.seoTask.findMany({
    where,
    // عقب‌افتاده اول، بعد نزدیک‌ترین مهلت، بعد تازه‌ترین
    orderBy:
      tab === "done" || tab === "canceled" || tab === "all"
        ? [{ createdAt: "desc" }]
        : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: SEO_TASK_SELECT,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // شمارنده‌ی تب‌هایی که کاربر باید ببیند حتی وقتی رویشان نیست
  const countWhere = (extra: Prisma.SeoTaskWhereInput): Prisma.SeoTaskWhereInput => ({
    deletedAt: null,
    ...extra,
    ...(canViewAll ? {} : { AND: [seoScopeFilter(access.userId)] }),
  });

  const [approvalCount, reviewCount, mineCount] = await Promise.all([
    prisma.seoTask.count({ where: countWhere(tabFilter("approval", access.userId)) }),
    prisma.seoTask.count({ where: countWhere(tabFilter("review", access.userId)) }),
    prisma.seoTask.count({ where: countWhere(tabFilter("mine", access.userId)) }),
  ]);

  return NextResponse.json(
    serialize({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      counts: { approval: approvalCount, review: reviewCount, mine: mineCount },
      can: {
        viewAll: canViewAll,
        work: can(access, "SEO_TASK_WORK"),
        manage: can(access, "SEO_TASK_MANAGE"),
      },
      me: { id: access.userId, name: access.name },
    }),
  );
}

/** ثبت کار سئوی تازه — هم مدیر، هم کارمند */
export async function POST(req: Request) {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();

    // واگذاری به دیگری کار مدیر است؛ کارمند برای خودش ثبت می‌کند
    if (
      body?.assigneeId &&
      body.assigneeId !== guard.access.userId &&
      !can(guard.access, "SEO_TASK_MANAGE")
    ) {
      return NextResponse.json(
        { error: "واگذاری کار به دیگران با مدیر سئو است" },
        { status: 403 },
      );
    }

    const task = await createSeoTask(body, guard.access);
    return NextResponse.json(serialize({ task }), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
