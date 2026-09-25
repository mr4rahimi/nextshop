import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import {
  createContentTask,
  contentScopeFilter,
  CONTENT_TASK_SELECT,
} from "@/lib/marketing/content-task-service";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

/**
 * تب‌های صفحه‌ی محتوا.
 *
 * ⚠️ تبِ ناشناخته بی‌سروصدا به `open` برمی‌گردد. تب تازه در دو جا اضافه
 * می‌شود: همین‌جا و فهرست تب‌های `ContentTasksClient`.
 */
const TABS = ["open", "mine", "publish", "approval", "done", "canceled", "all"] as const;
type Tab = (typeof TABS)[number];

/**
 * «کارهای من» یعنی کاری که **الان** دست من است: نوشتنش اگر محتوانویسم،
 * انتشارش اگر محتواگذارم. کاری که منتظر دیگری است اینجا نمی‌آید.
 */
function tabFilter(tab: Tab, userId: string): Prisma.ContentTaskWhereInput {
  switch (tab) {
    case "mine":
      return {
        OR: [
          { writerId: userId, status: { in: ["ASSIGNED", "WRITING"] } },
          { publisherId: userId, status: { in: ["AWAITING_PUBLISH", "PUBLISHING"] } },
          // محتواگذارِ خالی = خودِ محتوانویس
          {
            publisherId: null,
            writerId: userId,
            status: { in: ["AWAITING_PUBLISH", "PUBLISHING"] },
          },
        ],
      };
    case "publish":
      return { status: { in: ["AWAITING_PUBLISH", "PUBLISHING"] } };
    case "approval":
      return { status: "AWAITING_APPROVAL" };
    case "done":
      return { status: "DONE" };
    case "canceled":
      return { status: "CANCELED" };
    case "all":
      return {};
    case "open":
    default:
      return { status: { notIn: ["DONE", "CANCELED"] } };
  }
}

export async function GET(req: Request) {
  const guard = await requirePermission([
    "CONTENT_TASK_WORK",
    "CONTENT_TASK_MANAGE",
    "MARKETING_VIEW_ALL",
  ]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { access } = guard;

  const sp = new URL(req.url).searchParams;
  const rawTab = sp.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "open";

  const where: Prisma.ContentTaskWhereInput = { deletedAt: null };

  // ⚠️ تب، مرز دسترسی و جستجو هر سه `OR` دارند؛ همه داخل یک `AND` می‌روند
  // وگرنه یکی دیگری را بی‌سروصدا پاک می‌کند (همان تله‌ی کارهای سئو).
  const canViewAll = can(access, "MARKETING_VIEW_ALL");
  const scoped: Prisma.ContentTaskWhereInput[] = [tabFilter(tab, access.userId)];
  if (!canViewAll) scoped.push(contentScopeFilter(access.userId));

  const destination = sp.get("destination");
  if (destination === "BLOG" || destination === "EXTERNAL") where.destination = destination;

  const q = sp.get("q")?.trim();
  if (q) {
    scoped.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { primaryKeyword: { contains: q, mode: "insensitive" } },
        { relatedKeywords: { contains: q, mode: "insensitive" } },
        { brief: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  where.AND = scoped;

  const cursor = sp.get("cursor");
  const rows = await prisma.contentTask.findMany({
    where,
    orderBy:
      tab === "done" || tab === "canceled" || tab === "all"
        ? [{ createdAt: "desc" }]
        : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: CONTENT_TASK_SELECT,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const countWhere = (t: Tab): Prisma.ContentTaskWhereInput => ({
    deletedAt: null,
    AND: [
      tabFilter(t, access.userId),
      ...(canViewAll ? [] : [contentScopeFilter(access.userId)]),
    ],
  });

  const [mine, publish, approval] = await Promise.all([
    prisma.contentTask.count({ where: countWhere("mine") }),
    prisma.contentTask.count({ where: countWhere("publish") }),
    prisma.contentTask.count({ where: countWhere("approval") }),
  ]);

  return NextResponse.json(
    serialize({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      counts: { mine, publish, approval },
    }),
  );
}

/** ساخت کار محتوا — مدیر */
export async function POST(req: Request) {
  const guard = await requirePermission("CONTENT_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const task = await createContentTask(body, guard.access);
    return NextResponse.json(serialize({ task }), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
