import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { createTask, TASK_SELECT } from "@/lib/worklist/task-service";
import { startOfToday, endOfToday } from "@/lib/worklist/types";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

/**
 * تب‌های کارتابل.
 *
 * ⚠️ تبِ ناشناخته بی‌سروصدا به `today` برمی‌گردد. افزودن تب تازه در دو جا
 * لازم است: همین شیء و فهرست تب‌های صفحه.
 */
const TABS = [
  "today",
  "overdue",
  "upcoming",
  "referred",
  "open",
  "done",
  "unlogged",
  "all",
] as const;
type Tab = (typeof TABS)[number];

function tabFilter(tab: Tab, userId: string): Prisma.StaffTaskWhereInput {
  const openish: Prisma.StaffTaskWhereInput = {
    status: { in: ["OPEN", "IN_PROGRESS"] },
  };

  switch (tab) {
    case "referred":
      // «ارجاع به من» = دست‌کم یک ارجاع به من خورده و هنوز مسئولش خودم هستم.
      // کاری که دوباره به دیگری ارجاع شده از این صف می‌رود ولی ردیف ارجاع
      // قبلی سر جایش می‌ماند.
      return { ...openish, ownerId: userId, referrals: { some: { toId: userId } } };
    case "today":
      // کارِ امروز = مهلتش امروز است، یا مهلت ندارد و امروز ساخته شده
      return {
        ...openish,
        OR: [
          { dueAt: { gte: startOfToday(), lte: endOfToday() } },
          { dueAt: null, createdAt: { gte: startOfToday(), lte: endOfToday() } },
        ],
      };
    case "overdue":
      return { ...openish, dueAt: { lt: new Date() } };
    case "upcoming":
      return { ...openish, dueAt: { gt: endOfToday() } };
    case "open":
      return openish;
    case "done":
      return { status: "DONE" };
    case "unlogged":
      // کاری که تمام شده ولی نتیجه‌اش ثبت نشده — خوراک نمودارها از دست می‌رود
      return { ...openish, outcome: null };
    case "all":
    default:
      return {};
  }
}

/**
 * فهرست کارها با فیلتر و صفحه‌بندی cursor.
 *
 * پارامترها: tab، ownerId (`me` یعنی خودم)، typeId، domain، channel، status،
 * q (جستجو در عنوان، نام و شماره‌ی مخاطب)، cursor.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { access } = guard;

  const sp = new URL(req.url).searchParams;
  const rawTab = sp.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "today";

  const where: Prisma.StaffTaskWhereInput = { ...tabFilter(tab, access.userId) };

  // کسی که فقط WORK_VIEW_OWN دارد، هرچه بخواهد باز هم کار خودش را می‌بیند.
  // تب «ارجاع به من» همیشه شخصی است و با ownerId دیگری بازنویسی نمی‌شود.
  const canViewAll = can(access, "WORK_VIEW_ALL");
  const ownerParam = sp.get("ownerId");
  if (!canViewAll) {
    where.ownerId = access.userId;
  } else if (ownerParam && tab !== "referred") {
    where.ownerId = ownerParam === "me" ? access.userId : ownerParam;
  }

  const typeId = sp.get("typeId");
  if (typeId) where.typeId = typeId;

  const domain = sp.get("domain");
  if (domain) where.domain = domain as never;

  const channel = sp.get("channel");
  if (channel) where.channel = channel as never;

  const status = sp.get("status");
  if (status) where.status = status as never;

  const customerId = sp.get("customerId");
  if (customerId) where.customerId = customerId;

  const q = sp.get("q")?.trim();
  if (q) {
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { contactName: { contains: q, mode: "insensitive" } },
          { contactPhone: { contains: q } },
          { supplierName: { contains: q, mode: "insensitive" } },
          { note: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const cursor = sp.get("cursor");

  // کارِ عقب‌افتاده اول، بعد نزدیک‌ترین مهلت، بعد تازه‌ترین
  const rows = await prisma.staffTask.findMany({
    where,
    orderBy:
      tab === "done" || tab === "all"
        ? [{ createdAt: "desc" }]
        : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: TASK_SELECT,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json(
    serialize({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      canViewAll,
      me: { id: access.userId, name: access.name },
    }),
  );
}

/** ثبت کار تازه */
export async function POST(req: Request) {
  const guard = await requirePermission("WORK_CREATE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    if (!body?.typeId) {
      return NextResponse.json({ error: "نوع کار انتخاب نشده است" }, { status: 400 });
    }

    // ارجاع به دیگری مجوز جدا دارد
    if (body.ownerId && body.ownerId !== guard.access.userId) {
      if (!can(guard.access, "WORK_ASSIGN")) {
        return NextResponse.json(
          { error: "اجازه‌ی ارجاع کار به دیگران را ندارید" },
          { status: 403 },
        );
      }
    }

    const task = await createTask(body, guard.access);
    return NextResponse.json(serialize({ task }), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
