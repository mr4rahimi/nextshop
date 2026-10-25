/**
 * راهنمای پنل برای دستیار — docs/plans/admin-assistant.md بخش ۵
 *
 * سه منبع، به ترتیب اعتبار:
 *   ۱. راهنمای «؟» هر بخش (`HELP` در help-content.ts) — همان متنی که کارمند در پنل می‌بیند،
 *      پس راهنما دو جا نوشته نمی‌شود؛
 *   ۲. مقاله‌های دستی (`articles.ts`) برای صفحه‌های بی‌«؟»، و مقاله‌ی خودکار «این صفحه
 *      کجاست» برای بقیه‌ی صفحه‌های منو؛
 *   ۳. فهرست نسخه‌ها — از اول برای کاربر نهایی نوشته شده و جزئیات ریز را دارد.
 * مجموعه کوچک است، پس جستجوی کلیدواژه‌ای در حافظه کافی است و پایگاه برداری لازم نیست.
 */
import type { GateAccess } from "@/lib/admin-sections";
import { VERSIONS } from "@/lib/changelog-data";
import { HELP, type HelpTopic } from "@/components/admin/worklist/help-content";
import { MANUAL_ARTICLES, type HelpArticle } from "./articles";
import { canSeePage, visiblePages } from "./pages";

/**
 * صفحه‌ی هر موضوع «؟». موضوعی که اینجا نیست، اگر با `accounting` یا `tools` شروع شود به
 * خانه‌ی همان بخش وصل می‌شود؛ وگرنه برای همه قابل‌دید است (متن راهنما حساس نیست).
 */
const TOPIC_PAGES: Record<string, string> = {
  myWork: "/admin/worklist",
  plan: "/admin/plan",
  allTasks: "/admin/worklist/tasks",
  quickForm: "/admin/worklist",
  outcome: "/admin/worklist",
  refer: "/admin/worklist",
  notes: "/admin/worklist",
  calls: "/admin/worklist/calls",
  phoneOrder: "/admin/worklist/phone-order",
  credit: "/admin/worklist/credit",
  myOrders: "/admin/worklist/orders",
  roles: "/admin/worklist/roles",
  rules: "/admin/worklist/settings",
  attendance: "/admin/worklist/attendance",
  myNotes: "/admin/worklist/notes",
  workHours: "/admin/worklist/settings",
  suppliers: "/admin/worklist/suppliers",
  customers: "/admin/club/members",
  deals: "/admin/worklist/deals",
  payouts: "/admin/worklist/payouts",
  commissionPlans: "/admin/worklist/payouts",
  seoTasks: "/admin/worklist/seo",
  contentTasks: "/admin/worklist/content",
  siteAnalytics: "/admin/worklist/analytics",
  linkBuilding: "/admin/worklist/links",
  teamReport: "/admin/worklist/reports",
  staffScore: "/admin/worklist/score",
  aiTextBulk: "/admin/products/ai-text",
  aiSettings: "/admin/ai-settings",
  baleBot: "/admin/integration/bale-bot",
  blogPost: "/admin/blog",
  accountingItemCoding: "/admin/accounting/inventory/coding",
  accountingRelabel: "/admin/accounting/inventory/relabel",
  accountingPosHub: "/admin/accounting/pos",
  accountingOnlinePrice: "/admin/accounting/inventory/online-prices",
  accountingCounts: "/admin/accounting/inventory/counts",
  accountingSalesAnalysis: "/admin/accounting/reports/sales",
  accountingMovers: "/admin/accounting/reports/movers",
  accountingPosRegister: "/admin/accounting/pos",
  accountingPosClose: "/admin/accounting/pos?tab=shifts",
  tools: "/admin/tools",
  toolsEmployee: "/admin/tools/employee-cost",
  toolsText: "/admin/tools/text-counter",
};

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function topicHref(key: string, knownPages: Set<string>): string | undefined {
  if (TOPIC_PAGES[key]) return TOPIC_PAGES[key];
  for (const section of ["accounting", "tools"]) {
    if (key === section) return `/admin/${section}`;
    if (key.startsWith(section)) {
      const guess = `/admin/${section}/${kebab(key.slice(section.length))}`;
      return knownPages.has(guess) ? guess : `/admin/${section}`;
    }
  }
  return undefined;
}

function topicBody(topic: HelpTopic): string {
  const parts: string[] = [];
  if (topic.intro) parts.push(topic.intro);
  for (const s of topic.sections) parts.push(`${s.heading}:\n${s.items.map((i) => `- ${i}`).join("\n")}`);
  if (topic.tip) parts.push(`نکته: ${topic.tip}`);
  return parts.join("\n\n");
}

/** همه‌ی مقاله‌ها، یک بار ساخته می‌شود */
let cache: HelpArticle[] | null = null;
function allArticles(): HelpArticle[] {
  if (cache) return cache;
  const everyPage = visiblePages({ isUnrestricted: true, permissions: [] });
  const known = new Set(everyPage.map((p) => p.href.split("?")[0]));

  const fromHelp: HelpArticle[] = Object.entries(HELP as Record<string, HelpTopic>).map(([key, topic]) => ({
    id: `help-${key}`,
    title: topic.title,
    href: topicHref(key, known),
    keywords: topic.sections.map((s) => s.heading),
    body: topicBody(topic),
  }));

  const covered = new Set([...fromHelp, ...MANUAL_ARTICLES].map((a) => a.href).filter(Boolean));
  const fromMenu: HelpArticle[] = everyPage
    .filter((p) => !covered.has(p.href))
    .map((p) => ({
      id: `page-${p.href.replace(/^\/admin\/?/, "").replace(/[/?=&]+/g, "-") || "dashboard"}`,
      title: p.label,
      href: p.href,
      keywords: [p.group],
      body: `صفحه‌ی «${p.label}»${p.group ? ` در منوی «${p.group}»` : ""}. برای جزئیات طرز کار، فهرست تغییرات نسخه‌ها را جستجو کنید.`,
    }));

  cache = [...MANUAL_ARTICLES, ...fromHelp, ...fromMenu];
  return cache;
}

// ─────────────────────────────────────────────────────────────────
// متن فارسی
// ─────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  "و در به از که را این آن با برای تا یا هم چه چطور چطوری چگونه کجا کجاست چی چیه است هست نیست می باید کنم کنیم کرد کردم شود شد بشه میشه من ما رو یه یک دارم داره هر".split(" "),
);

export function normalizeFa(text: string): string {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[‌‏‎]/g, " ")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .toLowerCase();
}

function tokens(query: string): string[] {
  return [
    ...new Set(
      normalizeFa(query)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
    ),
  ];
}

/** واژه‌ی سه‌حرفی به بالا با «شامل‌بودن» تا «محصول» به «محصولات» هم بخورد */
function scoreText(text: string, queryTokens: string[], weight: number): number {
  const words = new Set(text.split(/[^\p{L}\p{N}]+/u));
  let score = 0;
  for (const t of queryTokens) {
    if (t.length >= 3 ? text.includes(t) : words.has(t)) score += weight;
  }
  return score;
}

// ─────────────────────────────────────────────────────────────────
// دسترسی و جستجو
// ─────────────────────────────────────────────────────────────────

function canSeeArticle(article: HelpArticle, access: GateAccess): boolean {
  if (article.href) return canSeePage(article.href, access);
  if (article.anyPermission?.length) {
    return access.isUnrestricted || article.anyPermission.some((p) => access.permissions.includes(p));
  }
  return true;
}

export function visibleArticles(access: GateAccess): HelpArticle[] {
  return allArticles().filter((a) => canSeeArticle(a, access));
}

export interface HelpSearchResult {
  articles: { id: string; title: string; page: string | null; excerpt: string }[];
  changelog: { version: string; date: string; release: string; text: string }[];
}

export function searchHelp(access: GateAccess, query: string): HelpSearchResult {
  const q = tokens(query);
  if (q.length === 0) return { articles: [], changelog: [] };

  const articles = visibleArticles(access)
    .map((a) => ({
      a,
      score:
        scoreText(normalizeFa(a.title), q, 3) +
        scoreText(normalizeFa(a.keywords.join(" ")), q, 2) +
        scoreText(normalizeFa(a.body), q, 1),
    }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 4)
    .map(({ a }) => ({ id: a.id, title: a.title, page: a.href ?? null, excerpt: a.body.slice(0, 700) }));

  // خط‌های امنیتی changelog جزئیات مجوز را شرح می‌دهند نه طرز کار — راهنما نیستند
  const changelog = VERSIONS.flatMap((release, index) =>
    release.changes
      .filter((c) => c.type !== "security")
      .map((c) => ({
        release,
        text: c.text,
        // نسخه‌ی تازه‌تر بر قدیمی مقدم است چون رفتار فعلی را می‌گوید
        score: scoreText(normalizeFa(`${release.title} ${c.text}`), q, 1) - index * 0.002,
      })),
  )
    .filter((r) => r.score >= Math.min(2, q.length) - 0.5)
    .sort((x, y) => y.score - x.score)
    .slice(0, 6)
    .map((r) => ({ version: r.release.version, date: r.release.date, release: r.release.title, text: r.text }));

  return { articles, changelog };
}

export function readArticle(access: GateAccess, id: string): HelpArticle | null {
  return visibleArticles(access).find((a) => a.id === id) ?? null;
}

/** مقاله‌ی صفحه‌ای که کاربر رویش است — طولانی‌ترین `href` که مسیر با آن شروع می‌شود */
export function articleForPage(access: GateAccess, pathname: string): HelpArticle | null {
  let best: HelpArticle | null = null;
  for (const a of visibleArticles(access)) {
    if (!a.href) continue;
    const path = a.href.split("?")[0];
    const hit = pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
    if (hit && (!best || path.length > best.href!.split("?")[0].length)) best = a;
  }
  return best;
}
