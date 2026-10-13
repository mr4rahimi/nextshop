/**
 * ابزارهای مربی کار و «من»ِ فاز ۲ — docs/plans/admin-assistant.md بخش ۶ و ۱۷
 *
 * همان قواعد `tools.ts`: نگهبان هر کار همان نگهبان صفحه‌اش است (`canSeeSeoTask`،
 * `canSeeContentTask`، `canSeeNode`)، داده‌ی «من» از سشن، تاریخ آماده با `faDate`.
 * کار را با **کد نمایشی** («کار سئو ۱۲») پیدا می‌کنیم چون کاربر همان را می‌بیند و می‌گوید.
 */
import { prisma } from "@/lib/prisma";
import { can, canAny } from "@/lib/permissions";
import { canSeeSeoTask } from "@/lib/marketing/seo-task-service";
import { canSeeContentTask } from "@/lib/marketing/content-task-service";
import { canSeeNode } from "@/lib/marketing/link-service";
import {
  CONTENT_ACTION_LABELS, CONTENT_ALLOWED_FROM, CONTENT_STATUS_LABELS, DESTINATION_LABELS,
  EVENT_LABELS, CONTENT_EVENT_LABELS, SEO_ACTION_LABELS, SEO_ALLOWED_FROM, SEO_MANAGER_ACTIONS,
  SEO_STATUS_LABELS, parsePageUrls, type ContentAction, type SeoAction,
} from "@/lib/marketing/types";
import {
  ANCHOR_KIND_EXAMPLES, ANCHOR_KIND_LABELS, CONTENT_KIND_LABELS, NODE_STATUS_LABELS, anchorRanges, relOf,
} from "@/lib/marketing/link-constants";
import { PRIORITY_LABELS, formatMinutes } from "@/lib/worklist/types";
import { analyzeSeo, countWords, htmlToText } from "@/lib/blog-seo";
import { fromJalali, jalaliMonthName, jalaliToday } from "@/lib/club/jalali";
import { getMonthAttendance } from "@/lib/worklist/attendance";
import { getWorklistConfig } from "@/lib/worklist/settings";
import { computeStatement } from "@/lib/worklist/commission";
import { CONTENT_GUIDE, LINK_GUIDE, SEO_PLAYBOOKS, findGlossary } from "./playbooks";
import { faDate } from "./dates";
import type { AssistantTool } from "./tools";

const MARKETING = ["SEO_TASK_WORK", "SEO_TASK_MANAGE", "CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE", "LINK_WORK", "LINK_MANAGE", "MARKETING_VIEW_ALL"];
const NOT_FOUND = { error: "این کار پیدا نشد یا برای شما قابل‌دید نیست" };

const toman = (v: bigint | number | null | undefined) =>
  v === null || v === undefined ? null : `${Number(v).toLocaleString("fa-IR")} تومان`;

/** «۱۲»، «12»، «کار سئو ۱۲» ← 12 */
function parseCode(v: unknown): number | null {
  const digits = String(v ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
  const n = Number(digits);
  return digits && Number.isSafeInteger(n) && n > 0 ? n : null;
}

const recentEvents = <T extends { action: string; actorName: string | null; note: string | null; createdAt: Date }>(
  rows: T[], labels: Record<string, string>,
) =>
  rows.slice(0, 6).map((e) => ({
    what: labels[e.action] ?? e.action,
    by: e.actorName ?? "سیستم",
    note: e.note?.slice(0, 300) ?? null,
    when: faDate(e.createdAt),
  }));

// ─────────────────────────────────────────────────────────────────
// توضیح کار
// ─────────────────────────────────────────────────────────────────

async function explainSeo(code: number, access: Parameters<AssistantTool["run"]>[1]["access"]) {
  const task = await prisma.seoTask.findFirst({
    where: { code, deletedAt: null },
    select: {
      id: true, title: true, description: true, pageUrls: true, status: true, priority: true, dueAt: true,
      report: true, returnReason: true, reviewAt: true, assigneeId: true, assigneeName: true, createdByName: true,
      category: { select: { key: true, title: true } },
      checklist: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { title: true, doneAt: true } },
      events: { orderBy: { createdAt: "desc" }, take: 6, select: { action: true, actorName: true, note: true, createdAt: true } },
    },
  });
  if (!task || !(await canSeeSeoTask(task.id, access))) return NOT_FOUND;
  const manager = can(access, "SEO_TASK_MANAGE");
  const nextActions = (Object.keys(SEO_ALLOWED_FROM) as SeoAction[])
    .filter((a) => SEO_ALLOWED_FROM[a].includes(task.status))
    .filter((a) => manager || !SEO_MANAGER_ACTIONS.includes(a))
    .map((a) => SEO_ACTION_LABELS[a]);
  return {
    // اول خروجی و با نام صریح: در آزمون مدل دلیل برگشتِ ته خروجی را نادیده گرفت
    returnedBecause: task.status === "IN_PROGRESS" && task.returnReason
      ? `این کار برگشت خورده؛ دلیل مدیر: ${task.returnReason} — اول همین را به کاربر بگو و بگو چطور اصلاحش کند` : null,
    kind: `کار سئو ${code}`,
    page: `/admin/worklist/seo?task=${task.id}`,
    title: task.title,
    category: task.category.title,
    status: SEO_STATUS_LABELS[task.status],
    priority: PRIORITY_LABELS[task.priority],
    due: faDate(task.dueAt),
    assignee: task.assigneeName,
    youAreAssignee: task.assigneeId === access.userId,
    createdBy: task.createdByName,
    description: task.description,
    pageUrls: parsePageUrls(task.pageUrls),
    checklist: task.checklist.map((c) => ({ item: c.title, done: !!c.doneAt })),
    submittedReport: task.report,
    reviewDate: faDate(task.reviewAt),
    buttonsYouCanPressNow: nextActions,
    history: recentEvents(task.events, EVENT_LABELS),
    playbook: SEO_PLAYBOOKS[task.category.key ?? ""] ?? null,
    workflow:
      "شروع کار (اختیاری برای کار کوتاه) ← انجام ← «ثبت گزارش انجام» با شرح اجباری ← تأیید یا برگشت با دلیل توسط مدیر. چک‌لیست ناتمام جلوی گزارش را نمی‌گیرد.",
  };
}

const CONTENT_ACTOR: Record<ContentAction, "writer" | "publisher" | "manager" | "publisherOrManager"> = {
  start: "writer", submit: "writer", take: "publisher", complete: "publisher",
  approve: "manager", return: "publisherOrManager", cancel: "manager", reopen: "manager",
};

async function explainContent(code: number, access: Parameters<AssistantTool["run"]>[1]["access"]) {
  const task = await prisma.contentTask.findFirst({
    where: { code, deletedAt: null },
    select: {
      id: true, title: true, primaryKeyword: true, relatedKeywords: true, brief: true, destination: true,
      status: true, priority: true, dueAt: true, wordCount: true, returnReason: true, publishedUrl: true,
      writerId: true, writerName: true, publisherId: true, publisherName: true, createdByName: true,
      blogPost: { select: { title: true, slug: true, status: true } },
      events: { orderBy: { createdAt: "desc" }, take: 6, select: { action: true, actorName: true, note: true, createdAt: true } },
    },
  });
  if (!task || !(await canSeeContentTask(task.id, access))) return NOT_FOUND;
  const me = access.userId;
  const isWriter = task.writerId === me;
  const isPublisher = (task.publisherId ?? task.writerId) === me;
  const isManager = can(access, "CONTENT_TASK_MANAGE");
  const mine = (a: ContentAction) => {
    const who = CONTENT_ACTOR[a];
    return (who === "writer" && isWriter) || (who === "publisher" && isPublisher) || (who === "manager" && isManager)
      || (who === "publisherOrManager" && (isPublisher || isManager));
  };
  const nextActions = (Object.keys(CONTENT_ALLOWED_FROM) as ContentAction[])
    .filter((a) => CONTENT_ALLOWED_FROM[a].includes(task.status) && mine(a))
    .map((a) => CONTENT_ACTION_LABELS[a]);
  const returned = ["WRITING", "AWAITING_PUBLISH", "PUBLISHING"].includes(task.status) && task.returnReason;
  return {
    returnedBecause: returned ? `این کار برگشت خورده؛ دلیل: ${task.returnReason} — اول همین را به کاربر بگو و بگو چطور اصلاحش کند` : null,
    kind: `کار محتوا ${code}`,
    page: `/admin/worklist/content?task=${task.id}`,
    title: task.title,
    yourRole: [isWriter && "محتوانویس", isPublisher && "محتواگذار", isManager && "مدیر محتوا"].filter(Boolean).join(" و ") || "ناظر",
    status: CONTENT_STATUS_LABELS[task.status],
    destination: DESTINATION_LABELS[task.destination],
    primaryKeyword: task.primaryKeyword,
    relatedKeywords: task.relatedKeywords,
    brief: task.brief,
    words: task.wordCount,
    due: faDate(task.dueAt),
    writer: task.writerName,
    publisher: task.publisherName ?? task.writerName,
    article: task.blogPost ? { title: task.blogPost.title, status: task.blogPost.status } : null,
    publishedUrl: task.publishedUrl,
    buttonsYouCanPressNow: nextActions,
    history: recentEvents(task.events, CONTENT_EVENT_LABELS),
    guide: isWriter ? CONTENT_GUIDE.writer : isPublisher ? CONTENT_GUIDE.publisher : [...CONTENT_GUIDE.writer, ...CONTENT_GUIDE.publisher],
    tip: "برای امتیاز سئوی متن همین کار، ابزار analyze_content_draft را صدا بزن.",
  };
}

async function explainLink(code: number, access: Parameters<AssistantTool["run"]>[1]["access"]) {
  const node = await prisma.linkNode.findFirst({
    where: { code, deletedAt: null },
    select: {
      id: true, status: true, dueAt: true, anchorText: true, anchorKind: true, relFollow: true, relUgc: true,
      relSponsored: true, contentKind: true, wordCount: true, contentBrief: true, profileTitle: true, note: true,
      returnReason: true, failReason: true, publishedUrl: true, assigneeName: true, tier: true,
      type: { select: { title: true, isRisky: true } },
      platform: { select: { title: true } },
      campaign: { select: { title: true, anchorProfile: true } },
      contentTask: { select: { code: true, status: true } },
      outEdges: { select: { toTarget: { select: { url: true, primaryKeyword: true } }, toNode: { select: { code: true, status: true } } } },
    },
  });
  if (!node || !(await canSeeNode(node.id, access))) return NOT_FOUND;
  const ranges = anchorRanges(node.campaign.anchorProfile);
  return {
    returnedBecause: node.status === "IN_PROGRESS" && node.returnReason
      ? `این گره برگشت خورده؛ دلیل: ${node.returnReason} — اول همین را به کاربر بگو` : null,
    kind: `گره ${code}`,
    page: `/admin/worklist/links?node=${node.id}`,
    campaign: node.campaign.title,
    type: node.type.title,
    risky: node.type.isRisky,
    platform: node.platform?.title ?? null,
    status: NODE_STATUS_LABELS[node.status],
    layer: node.tier === null ? "معلق (هنوز به صفحه‌ی هدفی نمی‌رسد)" : `لایه ${node.tier}`,
    due: faDate(node.dueAt),
    assignee: node.assigneeName,
    linksTo: node.outEdges.map((e) =>
      e.toTarget
        ? { page: e.toTarget.url, keyword: e.toTarget.primaryKeyword }
        : { node: `گره ${e.toNode?.code}`, status: e.toNode ? NODE_STATUS_LABELS[e.toNode.status] : null },
    ),
    anchorText: node.anchorText,
    anchorKind: node.anchorKind ? `${ANCHOR_KIND_LABELS[node.anchorKind]} (مثل «${ANCHOR_KIND_EXAMPLES[node.anchorKind]}»)` : null,
    healthyAnchorShare: Object.fromEntries(
      Object.entries(ranges).map(([k, [lo, hi]]) => [ANCHOR_KIND_LABELS[k as keyof typeof ANCHOR_KIND_LABELS], `${lo} تا ${hi} درصد`]),
    ),
    rel: relOf(node),
    content: node.contentKind === "NONE" ? null : {
      kind: CONTENT_KIND_LABELS[node.contentKind], words: node.wordCount, brief: node.contentBrief,
      contentTask: node.contentTask ? `کار محتوا ${node.contentTask.code} (${CONTENT_STATUS_LABELS[node.contentTask.status]})` : null,
    },
    profileTitle: node.profileTitle,
    note: node.note,
    failReason: node.status === "FAILED" ? node.failReason : null,
    publishedUrl: node.publishedUrl,
    guide: LINK_GUIDE,
  };
}

// ─────────────────────────────────────────────────────────────────
// بررسی یک صفحه‌ی سایت از روی دیتابیس
// ─────────────────────────────────────────────────────────────────

function htmlStats(html: string | null | undefined) {
  if (!html) return { words: 0, images: 0, imagesNoAlt: 0, internalLinks: 0, h2: 0 };
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  return {
    words: countWords(htmlToText(html)),
    images: imgs.length,
    imagesNoAlt: imgs.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length,
    internalLinks: (html.match(/<a\b[^>]*href\s*=\s*["'](\/|https?:\/\/[^"']*?)/gi) ?? []).filter((a) => /href\s*=\s*["']\//i.test(a)).length,
    h2: (html.match(/<h2\b/gi) ?? []).length,
  };
}

const faqCount = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const len = (s: string | null | undefined) => (s?.trim() ? s.trim().length : 0);

function metaIssues(seoTitle: string | null | undefined, seoDescription: string | null | undefined) {
  const issues: string[] = [];
  const t = len(seoTitle);
  const d = len(seoDescription);
  if (!t) issues.push("عنوان سئو خالی است");
  else if (t < 30 || t > 65) issues.push(`طول عنوان سئو ${t} نویسه است (مناسب ۵۰ تا ۶۰)`);
  if (!d) issues.push("توضیح متا خالی است");
  else if (d < 100 || d > 170) issues.push(`طول توضیح متا ${d} نویسه است (مناسب ۱۲۰ تا ۱۵۵)`);
  return issues;
}

async function inspectPage(rawUrl: string) {
  let path = rawUrl.trim();
  try {
    path = new URL(path, "https://x.local").pathname;
  } catch {
    return { error: "نشانی معتبر نیست" };
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    // همان شکل کدگذاری‌شده
  }
  path = path.replace(/\/+$/, "") || "/";
  const [, first, second] = path.split("/");
  const redirect = await prisma.redirect.findFirst({
    where: { isActive: true, source: { in: [path, encodeURI(path)] } },
    select: { destination: true, statusCode: true },
  });
  const base = { path, redirect: redirect ? `این آدرس با ${redirect.statusCode} به ${redirect.destination} می‌رود` : null };

  if (first === "products" && second) {
    const p = await prisma.product.findFirst({
      where: { slug: second },
      select: {
        title: true, isActive: true, seoTitle: true, seoDescription: true, mainImage: true, shortDescription: true,
        expertDescription: true, faq: true, price: true, brandId: true, id: true,
        category: { select: { title: true } }, _count: { select: { reviews: { where: { status: "APPROVED" } } } },
      },
    });
    if (!p) return { ...base, found: false };
    const issues = metaIssues(p.seoTitle, p.seoDescription);
    if (!p.mainImage) issues.push("عکس اصلی ندارد");
    if (!p.expertDescription?.trim()) issues.push("بررسی تخصصی (متن کارشناسی) ندارد");
    if (!faqCount(p.faq)) issues.push("سؤال متداول ندارد");
    if (p.price === 0n && !p._count.reviews) issues.push("قیمت و نظر ندارد، پس اسکیمای محصول منتشر نمی‌شود");
    return {
      ...base, type: "محصول", found: true, title: p.title, active: p.isActive, category: p.category.title,
      seoTitle: p.seoTitle, seoDescription: p.seoDescription,
      expertTextWords: countWords(htmlToText(p.expertDescription ?? "")), faq: faqCount(p.faq),
      approvedReviews: p._count.reviews, issues, editIn: "فرم محصول (محصولات ← لیست محصولات)",
    };
  }
  if (first === "categories" && second) {
    const c = await prisma.category.findFirst({
      where: { slug: second },
      select: {
        title: true, isActive: true, seoTitle: true, seoDescription: true, description: true, descriptionTop: true, faq: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    if (!c) return { ...base, found: false };
    const bottom = htmlStats(c.description);
    const issues = metaIssues(c.seoTitle, c.seoDescription);
    if (!c.descriptionTop?.trim()) issues.push("توضیح بالای دسته خالی است");
    if (bottom.words < 150) issues.push(`توضیح پایین دسته ${bottom.words} کلمه است`);
    if (!bottom.internalLinks) issues.push("توضیح پایین لینک داخلی ندارد");
    if (!faqCount(c.faq)) issues.push("سؤال متداول ندارد");
    return {
      ...base, type: "دسته", found: true, title: c.title, active: c.isActive, activeProducts: c._count.products,
      seoTitle: c.seoTitle, seoDescription: c.seoDescription, topTextWords: countWords(htmlToText(c.descriptionTop ?? "")),
      bottomText: bottom, faq: faqCount(c.faq), issues, editIn: "محصولات ← دسته‌بندی‌ها ← ویرایش دسته",
    };
  }
  if (first === "brands" && second) {
    const b = await prisma.brand.findFirst({
      where: { slug: second },
      select: { title: true, isActive: true, seoTitle: true, seoDescription: true, description: true },
    });
    if (!b) return { ...base, found: false };
    const issues = metaIssues(b.seoTitle, b.seoDescription);
    const text = htmlStats(b.description);
    if (text.words < 80) issues.push(`متن برند ${text.words} کلمه است`);
    return { ...base, type: "برند", found: true, title: b.title, active: b.isActive, text, issues, editIn: "محصولات ← برندها ← ویرایش برند" };
  }
  if (first === "mag" && second) {
    const post = await prisma.blogPost.findFirst({
      where: { slug: second },
      select: {
        title: true, status: true, seoTitle: true, seoDescription: true, focusKeyword: true, noIndex: true,
        excerpt: true, content: true, coverImage: true, faq: true, slug: true, canonicalUrl: true,
      },
    });
    if (!post) return { ...base, found: false };
    const report = analyzeSeo({
      title: post.title, seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "", slug: post.slug,
      excerpt: post.excerpt ?? "", content: post.content, focusKeyword: post.focusKeyword ?? "",
      coverImage: post.coverImage ?? "", faqCount: faqCount(post.faq), noIndex: post.noIndex,
    });
    return {
      ...base, type: "مقاله", found: true, title: post.title, status: post.status, noIndex: post.noIndex,
      canonical: post.canonicalUrl, focusKeyword: post.focusKeyword, seoScore: report.score, stats: report.stats,
      issues: report.checks.filter((c) => c.status !== "good").map((c) => `${c.status === "bad" ? "قرمز" : "زرد"}: ${c.title}${c.hint ? ` — ${c.hint}` : ""}`),
      editIn: "مجله / بلاگ ← مطالب ← ویرایش، تب «سئو»",
    };
  }
  if (first === "collections" && second) {
    const l = await prisma.landingPage.findFirst({
      where: { slug: second },
      select: { title: true, h1: true, description: true, intro: true, bodyHtml: true, isActive: true, isIndexable: true },
    });
    if (!l) return { ...base, found: false };
    const body = htmlStats(l.bodyHtml);
    const issues = metaIssues(l.title, l.description);
    if (!l.intro?.trim()) issues.push("متن معرفی ندارد");
    if (!l.isIndexable) issues.push("قابل‌ایندکس نیست");
    return {
      ...base, type: "صفحه‌ی فرود", found: true, title: l.title, h1: l.h1, active: l.isActive, indexable: l.isIndexable,
      bottomText: body, issues, editIn: "محصولات ← صفحات فرود سئو",
    };
  }
  if (first && !second) {
    const page = await prisma.page.findFirst({
      where: { slug: first },
      select: { title: true, isActive: true, seoTitle: true, seoDescription: true },
    });
    if (page) {
      return { ...base, type: "برگه‌ی ثابت", found: true, title: page.title, active: page.isActive, issues: metaIssues(page.seoTitle, page.seoDescription), editIn: "تنظیمات ← سایت ← برگه‌ها" };
    }
  }
  return { ...base, found: false, note: "این آدرس به محصول، دسته، برند، مقاله، صفحه‌ی فرود یا برگه‌ای در دیتابیس نخورد" };
}

// ─────────────────────────────────────────────────────────────────
// ابزارها
// ─────────────────────────────────────────────────────────────────

export const COACH_TOOLS: AssistantTool[] = [
  {
    name: "explain_task",
    label: "خواندن جزئیات کار",
    topic: "جزئیات کارهای سئو، محتوا و لینک‌سازی",
    description:
      "جزئیات کامل یک کار سئو، کار محتوا یا گره لینک‌سازی با کد نمایشی‌اش: شرح و بریف، آدرس صفحه‌ها، چک‌لیست، دلیل برگشت، تاریخچه، " +
      "دکمه‌هایی که کاربر همین حالا می‌تواند بزند، و راهنمای همان نوع کار (playbook/guide). وقتی کاربر منظور کاری را نمی‌فهمد یا می‌پرسد چه کند، این را صدا بزن " +
      "و قدم‌به‌قدم با همان دکمه‌ها و صفحه‌ها توضیح بده. اگر کد را نمی‌دانی اول get_my_marketing_tasks را بزن.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["seo", "content", "link"], description: "seo = کار سئو، content = کار محتوا، link = گره" },
        code: { type: "integer", description: "کد نمایشی، مثلاً ۱۲ در «کار سئو ۱۲»" },
      },
      required: ["kind", "code"],
    },
    available: (a) => canAny(a, MARKETING),
    run: async (args, ctx) => {
      const code = parseCode(args.code);
      if (!code) return { error: "کد کار معتبر نیست" };
      if (args.kind === "seo") return canAny(ctx.access, ["SEO_TASK_WORK", "SEO_TASK_MANAGE", "MARKETING_VIEW_ALL"]) ? explainSeo(code, ctx.access) : NOT_FOUND;
      if (args.kind === "content") return canAny(ctx.access, ["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE", "MARKETING_VIEW_ALL"]) ? explainContent(code, ctx.access) : NOT_FOUND;
      if (args.kind === "link") return canAny(ctx.access, ["LINK_WORK", "LINK_MANAGE", "MARKETING_VIEW_ALL"]) ? explainLink(code, ctx.access) : NOT_FOUND;
      return { error: "نوع کار باید seo، content یا link باشد" };
    },
  },
  {
    name: "analyze_content_draft",
    label: "بررسی سئوی متن",
    topic: "امتیاز سئوی متن کارهای محتوا",
    description:
      "امتیاز سئوی متن یک کار محتوا (پیش‌نویس یا مقاله‌ی ساخته‌شده) با همان تحلیلگر تب «سئو» ویرایشگر مقاله: امتیاز، آمار (کلمه، سرتیتر، تصویر بی alt، لینک داخلی، تراکم کلمه‌ی کلیدی) " +
      "و موارد قرمز و زرد. موارد قرمز را اول بگو و برای هر کدام بگو چطور درستش کند.",
    parameters: {
      type: "object",
      properties: { code: { type: "integer", description: "کد کار محتوا" } },
      required: ["code"],
    },
    available: (a) => canAny(a, ["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE", "MARKETING_VIEW_ALL"]),
    run: async (args, ctx) => {
      const code = parseCode(args.code);
      if (!code) return { error: "کد کار معتبر نیست" };
      const task = await prisma.contentTask.findFirst({
        where: { code, deletedAt: null },
        select: {
          id: true, title: true, body: true, primaryKeyword: true,
          blogPost: {
            select: { title: true, slug: true, content: true, excerpt: true, seoTitle: true, seoDescription: true, focusKeyword: true, coverImage: true, faq: true, noIndex: true },
          },
        },
      });
      if (!task || !(await canSeeContentTask(task.id, ctx.access))) return NOT_FOUND;
      const post = task.blogPost;
      const content = post?.content ?? task.body ?? "";
      if (!htmlToText(content).trim()) return { note: "هنوز متنی برای این کار نوشته نشده است" };
      const report = analyzeSeo({
        title: post?.title ?? task.title, seoTitle: post?.seoTitle ?? "", seoDescription: post?.seoDescription ?? "",
        slug: post?.slug ?? "", excerpt: post?.excerpt ?? "", content,
        focusKeyword: post?.focusKeyword || task.primaryKeyword || "", coverImage: post?.coverImage ?? "",
        faqCount: faqCount(post?.faq), noIndex: post?.noIndex ?? false,
      });
      // پیش از ساخت مقاله، متا، نامک، خلاصه و کاور کار محتواگذار است — به محتوانویس نگوییم «متا بنویس»
      const checks = post ? report.checks : report.checks.filter(
        (c) => c.group !== "meta" && !/کاور|cover|متا|عنوان سئو|نامک|slug|seo-title|desc/i.test(`${c.id} ${c.title}`),
      );
      return {
        kind: `کار محتوا ${code}`,
        stage: post ? "مقاله در مجله ساخته شده (متا و کاور هم سنجیده شد)" : "پیش‌نویس — عنوان سئو، متا، نامک و کاور را محتواگذار بعداً کامل می‌کند",
        score: report.score,
        stats: report.stats,
        red: checks.filter((c) => c.status === "bad").map((c) => (c.hint ? `${c.title} — ${c.hint}` : c.title)),
        yellow: checks.filter((c) => c.status === "warn").map((c) => (c.hint ? `${c.title} — ${c.hint}` : c.title)),
      };
    },
  },
  {
    name: "inspect_page",
    label: "بررسی صفحه‌ی سایت",
    topic: "بررسی سئوی صفحه‌های سایت",
    description:
      "وضعیت سئوی یک صفحه‌ی همین فروشگاه از روی دیتابیس، با نشانی‌اش (کامل یا فقط مسیر): نوع صفحه (محصول، دسته، برند، مقاله، صفحه‌ی فرود، برگه)، " +
      "عنوان و توضیح سئو و طولشان، حجم متن، سؤال متداول، تصویر بی alt، لینک داخلی، ریدایرکت روی همین آدرس، فهرست ایرادها و جای ویرایشش در پنل. " +
      "برای آدرس‌های داخل کار سئو یا «این صفحه چه کم دارد» صدا بزن. رتبه و کلیک گوگل را نمی‌دهد.",
    parameters: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    available: (a) => canAny(a, [...MARKETING, "PANEL_CATALOG", "PANEL_CONTENT"]),
    run: async (args) => inspectPage(String(args.url ?? "")),
  },
  {
    name: "seo_glossary",
    label: "خواندن واژه‌نامه",
    topic: "واژه‌نامه‌ی سئو",
    description: "معنی ساده‌ی یک اصطلاح سئو یا لینک‌سازی (مثل canonical، انکر، ایندکس، اسکیما، nofollow، CTR).",
    parameters: {
      type: "object",
      properties: { term: { type: "string" } },
      required: ["term"],
    },
    available: () => true,
    run: async (args) => {
      const hits = findGlossary(String(args.term ?? ""));
      return hits.length ? { results: hits } : { results: [], note: "این اصطلاح در واژه‌نامه نیست؛ با دانش عمومی و با ذکر همین نکته توضیح بده" };
    },
  },
  {
    name: "get_my_attendance",
    label: "خواندن حضور شما",
    topic: "حضور و ساعت کار خودش",
    description: "حضور خود کاربر در ماه شمسی جاری یا قبل: روزهای حاضر، ساعت فعال، موظفی تا امروز و ریز روزها.",
    parameters: {
      type: "object",
      properties: { month: { type: "string", enum: ["this_month", "last_month"] } },
      required: [],
    },
    available: (a) => canAny(a, ["ATTENDANCE_VIEW_OWN", "ATTENDANCE_VIEW_ALL"]),
    run: async (args, ctx) => {
      const today = jalaliToday();
      let { year, month } = today;
      if (args.month === "last_month") {
        month -= 1;
        if (month === 0) { month = 12; year -= 1; }
      }
      const { workHours } = await getWorklistConfig();
      const { days, totals } = await getMonthAttendance(ctx.access.userId, year, month, workHours);
      const clock = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }) : null;
      return {
        page: "/admin/worklist/attendance",
        month: `${jalaliMonthName(month)} ${year}`,
        presentDays: totals.presentDays,
        active: formatMinutes(totals.activeMin),
        expectedToDate: formatMinutes(totals.expectedToDateMin),
        days: days
          .filter((d) => d.activeMin > 0)
          .map((d) => ({
            date: faDate(fromJalali(d.jy, d.jm, d.jd)),
            firstIn: clock(d.firstIn),
            lastOut: clock(d.lastOut),
            active: formatMinutes(d.activeMin),
            expected: formatMinutes(d.expectedMin),
          })),
      };
    },
  },
  {
    name: "get_my_commission",
    label: "خواندن پورسانت شما",
    topic: "پورسانت خودش",
    description: "پورسانت خود کاربر از آخرین تسویه تا امروز: طرح، تعداد معامله، سود، پورسانت، اصلاحیه، مانده‌ی قبل، قابل پرداخت و معامله‌های بی‌قیمت خرید.",
    parameters: { type: "object", properties: {}, required: [] },
    available: (a) => canAny(a, ["COMMISSION_VIEW_OWN", "COMMISSION_VIEW_ALL"]),
    run: async (_args, ctx) => {
      const s = await computeStatement(ctx.access.userId);
      return {
        page: "/admin/worklist/payouts",
        plan: s.planTitle,
        since: s.lastPaidAt ? faDate(s.lastPaidAt) : "از ابتدا",
        deals: s.dealCount,
        profit: toman(s.totalProfit),
        commission: toman(s.grossCommission),
        adjustment: s.adjustment ? toman(s.adjustment) : null,
        carriedFromLastPayout: s.carriedIn ? toman(s.carriedIn) : null,
        due: toman(s.due),
        dealsWithoutPurchasePrice: s.pendingCount,
        note: s.pendingCount ? "معامله‌هایی که قیمت خریدشان ثبت نشده در این عدد نیستند" : null,
      };
    },
  },
];
