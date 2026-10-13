/**
 * ابزارهای دستیار — docs/plans/admin-assistant.md بخش ۲، ۶ و ۱۱
 *
 * **مرز امنیتی اینجاست، نه در پرامپت.** هر ابزار:
 *   ۱. فقط وقتی به مدل معرفی می‌شود که کاربر دسترسی‌اش را دارد (`available`)؛
 *   ۲. هنگام اجرا همان را دوباره چک می‌کند (`toolsFor` و `runTool` هر دو)؛
 *   ۳. داده‌ی «من» را با `access.userId` سشن می‌خواند و **هیچ ورودی userId نمی‌پذیرد**.
 * ابزار تازه‌ای که داده‌ی دیگران یا مالی برمی‌گرداند باید همان مجوز صفحه‌ی متناظرش را بخواهد.
 *
 * تاریخ‌ها با `faDate` آماده و با نام ماه می‌روند (درس فاز ۰).
 */
import { prisma } from "@/lib/prisma";
import { can, canAny, type StaffAccess } from "@/lib/permissions";
import { DOMAIN_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/worklist/types";
import { CONTENT_STATUS_LABELS, SEO_STATUS_LABELS } from "@/lib/marketing/types";
import { ANCHOR_KIND_LABELS, NODE_STATUS_LABELS } from "@/lib/marketing/link-constants";
import { articleForPage, readArticle, searchHelp } from "./help";
import { pageLabel } from "./pages";
import { faDate, startOfTehranDay } from "./dates";

export interface ToolContext {
  access: StaffAccess;
  pagePath?: string;
}

export interface AssistantTool {
  name: string;
  /** متنی که حین اجرا به کاربر نشان داده می‌شود */
  label: string;
  /**
   * چه داده‌ای می‌دهد، به زبان کاربر. برای ابزاری که کاربر **ندارد** در پرامپت می‌آید تا مدل
   * بگوید «در دسترس شما نیست» — آزمون ۱۴۰۵/۰۷/۲۱: محتوانویس «سفارش‌های من» را پرسید و مدل با
   * ابزار کارتابل جواب ساخت «سفارشی ثبت نشده».
   */
  topic: string;
  description: string;
  parameters: Record<string, unknown>;
  available: (access: StaffAccess) => boolean;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

const noArgs = { type: "object", properties: {}, required: [] };
const everyone = () => true;
const gate = (access: StaffAccess) => ({ isUnrestricted: access.isUnrestricted, permissions: access.permissions });

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  CONFIRMED: "تأیید شده",
  PROCESSING: "در حال آماده‌سازی",
  PACKAGING: "بسته‌بندی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  COMPLETED: "تکمیل شده",
  CANCELED: "لغو شده",
  REFUNDED: "مسترد شده",
};

const toman = (v: bigint | number | null | undefined) =>
  v === null || v === undefined ? null : `${Number(v).toLocaleString("fa-IR")} تومان`;

const isOverdue = (due: Date | null) => !!due && due.getTime() < Date.now();

// ─────────────────────────────────────────────────────────────────
// راهنما
// ─────────────────────────────────────────────────────────────────

const HELP_TOOLS: AssistantTool[] = [
  {
    name: "search_help",
    label: "جستجو در راهنما",
    topic: "راهنمای پنل",
    description:
      "جستجو در راهنمای پنل مدیریت فروشگاه و فهرست تغییرات نسخه‌ها. برای هر سؤال «چطور/کجا/چرا/یعنی چه» درباره‌ی پنل اول این را صدا بزن. " +
      "عبارت را با واژه‌های خود پنل بنویس (مثلاً «ریدایرکت» یا «سفارش تلفنی»). نتیجه‌ی changelog تاریخ دارد؛ نسخه‌ی تازه‌تر رفتار فعلی را می‌گوید.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "چند واژه‌ی کلیدی فارسی" } },
      required: ["query"],
    },
    available: everyone,
    run: async (args, ctx) => searchHelp(gate(ctx.access), String(args.query ?? "")),
  },
  {
    name: "read_help_article",
    label: "خواندن راهنما",
    topic: "متن مقاله‌های راهنما",
    description: "متن کامل یک مقاله‌ی راهنما با شناسه‌اش (از نتیجه‌ی search_help یا فهرست پرامپت).",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    available: everyone,
    run: async (args, ctx) => {
      const article = readArticle(gate(ctx.access), String(args.id ?? ""));
      return article
        ? { id: article.id, title: article.title, page: article.href ?? null, body: article.body }
        : { error: "این مقاله پیدا نشد یا برای شما قابل‌دید نیست" };
    },
  },
  {
    name: "explain_current_page",
    label: "خواندن راهنمای همین صفحه",
    topic: "راهنمای صفحه‌ی فعلی",
    description: "راهنمای صفحه‌ای که کاربر همین حالا در پنل رویش است. برای «این صفحه چیه» یا «اینجا چه کار کنم».",
    parameters: noArgs,
    available: everyone,
    run: async (_args, ctx) => {
      if (!ctx.pagePath) return { error: "صفحه‌ی فعلی معلوم نیست" };
      const article = articleForPage(gate(ctx.access), ctx.pagePath);
      return {
        page: pageLabel(ctx.pagePath),
        article: article ? { id: article.id, title: article.title, body: article.body } : null,
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// داده‌ی «من» — شناسه همیشه از سشن
// ─────────────────────────────────────────────────────────────────

const SELF_TOOLS: AssistantTool[] = [
  {
    name: "get_my_work",
    label: "خواندن کارهای کارتابل شما",
    topic: "کارهای کارتابل خودش (تماس، پیگیری و کارهای روزانه)",
    description:
      "کارهای باز «کارهای من» در کارتابل که مسئولشان خود کاربر است (تماس، پیگیری، کارهای روزانه): عقب‌افتاده، امروز و پیش رو، با مهلت و اولویت. " +
      "کار سئو، کار محتوا، گره لینک‌سازی و سفارش اینجا نیستند و ابزار خودشان را دارند. ورودی ندارد؛ کاربر از سشن معلوم است.",
    parameters: noArgs,
    available: (a) => canAny(a, ["WORK_VIEW_OWN", "WORK_VIEW_ALL"]),
    run: async (_args, ctx) => {
      const tomorrow = new Date(startOfTehranDay().getTime() + 86_400_000);
      const tasks = await prisma.staffTask.findMany({
        where: { ownerId: ctx.access.userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: 25,
        select: {
          title: true, status: true, priority: true, domain: true, dueAt: true,
          contactName: true, note: true, type: { select: { title: true } },
        },
      });
      const total = await prisma.staffTask.count({
        where: { ownerId: ctx.access.userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      });
      return {
        page: "/admin/worklist",
        totalOpen: total,
        overdue: tasks.filter((t) => isOverdue(t.dueAt)).length,
        dueToday: tasks.filter((t) => t.dueAt && !isOverdue(t.dueAt) && t.dueAt < tomorrow).length,
        tasks: tasks.map((t) => ({
          title: t.title,
          type: t.type.title,
          domain: DOMAIN_LABELS[t.domain],
          status: STATUS_LABELS[t.status],
          priority: PRIORITY_LABELS[t.priority],
          due: faDate(t.dueAt),
          overdue: isOverdue(t.dueAt),
          contact: t.contactName,
          note: t.note?.slice(0, 200) ?? null,
        })),
        ...(total > tasks.length ? { note: `فقط ${tasks.length} کار اول (به ترتیب مهلت) آمده است` } : {}),
      };
    },
  },
  {
    name: "get_my_marketing_tasks",
    label: "خواندن کارهای سئو، محتوا و لینک شما",
    topic: "کارهای سئو، محتوا و لینک‌سازی خودش",
    description:
      "کارهای باز سئو، محتوا و گره‌های لینک‌سازی که خود کاربر مسئولشان است، با کد، وضعیت، مهلت، **دلیل برگشت** و نشانی صفحه‌ی کار. " +
      "برای هر سؤال درباره‌ی «کار سئو/کار محتوا/مقاله‌ای که باید بنویسم/گره/برگشت خورده» این را صدا بزن. " +
      "در محتوا «نقش» می‌گوید کاربر محتوانویس است یا محتواگذار. ورودی ندارد.",
    parameters: noArgs,
    available: (a) =>
      canAny(a, ["SEO_TASK_WORK", "SEO_TASK_MANAGE", "CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE", "LINK_WORK", "LINK_MANAGE"]),
    run: async (_args, ctx) => {
      const me = ctx.access.userId;
      const a = ctx.access;
      const [seo, content, links] = await Promise.all([
        canAny(a, ["SEO_TASK_WORK", "SEO_TASK_MANAGE"])
          ? prisma.seoTask.findMany({
              where: { assigneeId: me, deletedAt: null, status: { in: ["ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"] } },
              orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
              take: 20,
              select: {
                id: true, code: true, title: true, status: true, priority: true, dueAt: true,
                returnReason: true, category: { select: { title: true } },
              },
            })
          : [],
        canAny(a, ["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE"])
          ? prisma.contentTask.findMany({
              where: {
                deletedAt: null,
                status: { in: ["ASSIGNED", "WRITING", "AWAITING_PUBLISH", "PUBLISHING", "AWAITING_APPROVAL"] },
                OR: [{ writerId: me }, { publisherId: me }],
              },
              orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
              take: 20,
              select: {
                id: true, code: true, title: true, status: true, dueAt: true, primaryKeyword: true,
                writerId: true, publisherId: true, returnReason: true, wordCount: true,
              },
            })
          : [],
        canAny(a, ["LINK_WORK", "LINK_MANAGE"])
          ? prisma.linkNode.findMany({
              where: { assigneeId: me, deletedAt: null, status: { in: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"] } },
              orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
              take: 20,
              select: {
                id: true, code: true, status: true, dueAt: true, anchorText: true, anchorKind: true,
                returnReason: true, type: { select: { title: true } }, platform: { select: { title: true } },
                campaign: { select: { title: true } },
              },
            })
          : [],
      ]);
      return {
        seoTasks: seo.map((t) => ({
          code: `کار سئو ${t.code}`,
          title: t.title,
          category: t.category.title,
          status: SEO_STATUS_LABELS[t.status],
          priority: PRIORITY_LABELS[t.priority],
          due: faDate(t.dueAt),
          overdue: t.status !== "AWAITING_APPROVAL" && isOverdue(t.dueAt),
          returnReason: t.status === "IN_PROGRESS" ? t.returnReason : null,
          page: `/admin/worklist/seo?task=${t.id}`,
        })),
        contentTasks: content.map((t) => ({
          code: `کار محتوا ${t.code}`,
          title: t.title,
          role: t.writerId === me && (t.publisherId === me || !t.publisherId)
            ? "محتوانویس و محتواگذار" : t.writerId === me ? "محتوانویس" : "محتواگذار",
          status: CONTENT_STATUS_LABELS[t.status],
          primaryKeyword: t.primaryKeyword,
          words: t.wordCount,
          due: faDate(t.dueAt),
          overdue: isOverdue(t.dueAt),
          returnReason: t.returnReason,
          page: `/admin/worklist/content?task=${t.id}`,
        })),
        linkNodes: links.map((n) => ({
          code: `گره ${n.code}`,
          campaign: n.campaign.title,
          type: n.type.title,
          platform: n.platform?.title ?? null,
          anchor: n.anchorText,
          anchorKind: n.anchorKind ? ANCHOR_KIND_LABELS[n.anchorKind] : null,
          status: NODE_STATUS_LABELS[n.status],
          due: faDate(n.dueAt),
          returnReason: n.returnReason,
          page: `/admin/worklist/links?node=${n.id}`,
        })),
      };
    },
  },
  {
    name: "get_my_orders",
    label: "خواندن سفارش‌های تلفنی شما",
    topic: "سفارش‌های تلفنی که خودش ثبت کرده",
    description:
      "سفارش‌های تلفنی که خود کاربر ثبت کرده («سفارش‌های من»)، تازه‌ترین اول، با وضعیت و مبلغ. سود و قیمت خرید را نمی‌دهد. " +
      "tab: all همه، pending منتظر پرداخت، active در جریان، done تحویل‌شده، canceled لغوشده.",
    parameters: {
      type: "object",
      properties: { tab: { type: "string", enum: ["all", "pending", "active", "done", "canceled"] } },
      required: [],
    },
    available: (a) => can(a, "ORDER_CREATE"),
    run: async (args, ctx) => {
      const TABS: Record<string, string[] | null> = {
        all: null,
        pending: ["PENDING_PAYMENT"],
        active: ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED"],
        done: ["DELIVERED", "COMPLETED"],
        canceled: ["CANCELED", "REFUNDED"],
      };
      const statuses = TABS[String(args.tab ?? "all")] ?? null;
      const where = {
        createdByStaffId: ctx.access.userId,
        ...(statuses ? { status: { in: statuses as never[] } } : {}),
      };
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            orderNumber: true, status: true, grandTotal: true, createdAt: true,
            user: { select: { firstName: true, lastName: true } },
            _count: { select: { items: true } },
          },
        }),
        prisma.order.count({ where }),
      ]);
      return {
        page: "/admin/worklist/orders",
        total,
        orders: orders.map((o) => ({
          orderNumber: o.orderNumber,
          status: ORDER_STATUS_LABELS[o.status] ?? o.status,
          customer: [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") || null,
          items: o._count.items,
          total: toman(o.grandTotal),
          created: faDate(o.createdAt),
        })),
      };
    },
  },
];

export const ALL_TOOLS: AssistantTool[] = [...HELP_TOOLS, ...SELF_TOOLS];

/** فقط ابزارهایی که این کاربر مجاز است — همین فهرست به مدل معرفی می‌شود */
export function toolsFor(access: StaffAccess): AssistantTool[] {
  return ALL_TOOLS.filter((t) => t.available(access));
}
