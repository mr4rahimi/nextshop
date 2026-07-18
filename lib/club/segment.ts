import { prisma } from "@/lib/prisma";
import type { Prisma, ClubSource } from "@prisma/client";

/**
 * موتور بخش‌بندی مشتریان
 *
 * فیلتر به‌صورت JSON ذخیره می‌شود تا بدون تغییر کد قابل گسترش باشد و
 * در پنل ادمین با UI ساخته شود.
 *
 * ⚠️ این ماژول رضایت پیامک را اعمال **نمی‌کند**. آن کار نگهبان‌ها
 * (`sms/guards.ts`) در زمان ارسال است. اینجا فقط «چه کسانی» را تعیین
 * می‌کنیم، نه «آیا مجاز است».
 * دلیل: تعداد واقعی مخاطبان یک بخش باید مستقل از وضعیت رضایت دیده شود
 * تا ادمین بفهمد چقدر از بازارش را به‌خاطر نبود رضایت از دست می‌دهد.
 */

export interface Segment {
  /** منابع عضویت */
  sources?: ClubSource[];
  /** فقط اعضایی که رضایت پیامک دارند */
  onlyConsented?: boolean;
  /** ماه تولد شمسی ۱ تا ۱۲ */
  birthMonth?: number;
  /** فقط اعضای دارای تاریخ تولد */
  hasBirthDate?: boolean;
  /** حداقل و حداکثر تعداد خرید */
  minOrders?: number;
  maxOrders?: number;
  /** حداقل مجموع خرید به تومان */
  minSpent?: string;
  /** آخرین خرید بیش از N روز پیش (مشتری خوابیده) */
  inactiveDays?: number;
  /** آخرین خرید کمتر از N روز پیش (مشتری فعال) */
  activeWithinDays?: number;
  /** عضویت بیش از N روز پیش */
  memberSinceDays?: number;
  /** برچسب‌ها — هر عضوی که حداقل یکی را داشته باشد */
  tags?: string[];
  /** سطوح عضویت */
  tierIds?: string[];
}

export interface SegmentSummary {
  total: number;
  consented: number;
  withoutConsent: number;
  optedOut: number;
  blocked: number;
  /** تعداد نهایی که واقعاً پیام دریافت می‌کنند */
  reachable: number;
}

/** تبدیل فیلتر JSON به شرط Prisma */
export function buildSegmentWhere(segment: Segment): Prisma.ClubProfileWhereInput {
  const and: Prisma.ClubProfileWhereInput[] = [
    // اعضای مسدودشده هرگز در هیچ بخشی نیستند
    { isBlocked: false },
    { user: { isActive: true } },
  ];

  if (segment.sources?.length) {
    and.push({ source: { in: segment.sources } });
  }

  if (segment.onlyConsented) {
    and.push({ smsConsent: true });
  }

  if (segment.birthMonth) {
    and.push({ birthMonth: segment.birthMonth });
  }

  if (segment.hasBirthDate) {
    and.push({ birthDate: { not: null } });
  }

  if (typeof segment.minOrders === "number") {
    and.push({ orderCount: { gte: segment.minOrders } });
  }
  if (typeof segment.maxOrders === "number") {
    and.push({ orderCount: { lte: segment.maxOrders } });
  }

  if (segment.minSpent) {
    try {
      and.push({ totalSpent: { gte: BigInt(segment.minSpent) } });
    } catch {
      // مقدار نامعتبر — نادیده گرفته می‌شود
    }
  }

  if (segment.inactiveDays) {
    const cutoff = daysAgo(segment.inactiveDays);
    // هم کسانی که قبل از این تاریخ خرید کرده‌اند، هم کسانی که هرگز نخریده‌اند
    and.push({
      OR: [{ lastPurchaseAt: { lt: cutoff } }, { lastPurchaseAt: null }],
    });
  }

  if (segment.activeWithinDays) {
    and.push({ lastPurchaseAt: { gte: daysAgo(segment.activeWithinDays) } });
  }

  if (segment.memberSinceDays) {
    and.push({ joinedAt: { lte: daysAgo(segment.memberSinceDays) } });
  }

  if (segment.tags?.length) {
    and.push({ tags: { hasSome: segment.tags } });
  }

  if (segment.tierIds?.length) {
    and.push({ tierId: { in: segment.tierIds } });
  }

  return { AND: and };
}

/**
 * خلاصه یک بخش — نشان می‌دهد از کل مخاطبان، چند نفر واقعاً قابل دسترسی‌اند
 *
 * این تفکیک عمدی است: ادمین باید ببیند مثلاً «۱۲۰۰ نفر در این بخش هستند
 * ولی فقط ۳۰۰ نفر رضایت پیامک دارند» تا بفهمد گرفتن رضایت چقدر ارزش دارد.
 */
export async function summarizeSegment(segment: Segment): Promise<SegmentSummary> {
  const where = buildSegmentWhere(segment);

  const [total, consented] = await Promise.all([
    prisma.clubProfile.count({ where }),
    prisma.clubProfile.count({ where: { AND: [where, { smsConsent: true }] } }),
  ]);

  // شماره‌های لغو عضویت‌کرده که در این بخش هستند
  const consentedPhones = await prisma.clubProfile.findMany({
    where: { AND: [where, { smsConsent: true }] },
    select: { user: { select: { phone: true } } },
    take: 50_000,
  });

  const phones = consentedPhones.map((p) => p.user.phone);

  const optedOut =
    phones.length > 0
      ? await prisma.smsOptOut.count({ where: { phone: { in: phones } } })
      : 0;

  const blocked = await prisma.clubProfile.count({
    where: { AND: [stripBlockedFilter(where), { isBlocked: true }] },
  });

  return {
    total,
    consented,
    withoutConsent: total - consented,
    optedOut,
    blocked,
    reachable: Math.max(0, consented - optedOut),
  };
}

export interface SegmentRecipient {
  userId: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  points: number;
  orderCount: number;
  tierTitle: string | null;
}

/**
 * دریافت گیرندگان یک بخش برای ساخت دسته‌های ارسال
 *
 * فقط اعضای دارای رضایت برگردانده می‌شوند — چون این تابع در مسیر ارسال
 * واقعی استفاده می‌شود. نگهبان‌ها بعداً دوباره بررسی می‌کنند (دفاع لایه‌ای).
 */
export async function fetchSegmentRecipients(
  segment: Segment,
  options: { requireConsent?: boolean; limit?: number } = {}
): Promise<SegmentRecipient[]> {
  const { requireConsent = true, limit = 50_000 } = options;

  const where: Prisma.ClubProfileWhereInput = requireConsent
    ? { AND: [buildSegmentWhere(segment), { smsConsent: true }] }
    : buildSegmentWhere(segment);

  const profiles = await prisma.clubProfile.findMany({
    where,
    take: limit,
    orderBy: { joinedAt: "desc" },
    select: {
      id: true,
      orderCount: true,
      user: { select: { id: true, phone: true, firstName: true, lastName: true } },
      tier: { select: { title: true } },
    },
  });

  if (profiles.length === 0) return [];

  // موجودی امتیاز همه به‌صورت گروهی — نه یک کوئری به ازای هر نفر
  const balances = await prisma.pointTransaction.groupBy({
    by: ["profileId"],
    where: { profileId: { in: profiles.map((p) => p.id) } },
    _sum: { amount: true },
  });

  const pointsByProfile = new Map(
    balances.map((b) => [b.profileId, b._sum.amount ?? 0])
  );

  return profiles.map((p) => ({
    userId: p.user.id,
    phone: p.user.phone,
    firstName: p.user.firstName,
    lastName: p.user.lastName,
    points: pointsByProfile.get(p.id) ?? 0,
    orderCount: p.orderCount,
    tierTitle: p.tier?.title ?? null,
  }));
}

/** ساخت متغیرهای قالب برای یک گیرنده */
export function recipientVars(
  r: SegmentRecipient,
  storeName: string
): Record<string, string> {
  const fullname = [r.firstName, r.lastName].filter(Boolean).join(" ");

  return {
    name: r.firstName || "دوست",
    fullname: fullname || "دوست",
    points: String(r.points),
    tier: r.tierTitle ?? "",
    store: storeName,
    orders: String(r.orderCount),
  };
}

/** توضیح فارسی یک بخش — برای نمایش در فهرست کمپین‌ها */
export function describeSegment(segment: Segment): string {
  const parts: string[] = [];

  if (segment.sources?.length) {
    const fa: Record<string, string> = {
      ONLINE: "سایت",
      IN_STORE: "حضوری",
      CALLER_ID: "شماره‌گیر",
      IMPORT: "ورود فایل",
      MARKETPLACE: "مارکت‌پلیس",
    };
    parts.push(`منبع: ${segment.sources.map((s) => fa[s] ?? s).join("، ")}`);
  }

  if (segment.birthMonth) parts.push(`متولد ماه ${segment.birthMonth}`);
  if (segment.minOrders) parts.push(`حداقل ${segment.minOrders} خرید`);
  if (segment.maxOrders !== undefined) parts.push(`حداکثر ${segment.maxOrders} خرید`);
  if (segment.minSpent) parts.push(`خرید بیش از ${Number(segment.minSpent).toLocaleString("fa-IR")} تومان`);
  if (segment.inactiveDays) parts.push(`بدون خرید در ${segment.inactiveDays} روز`);
  if (segment.activeWithinDays) parts.push(`خرید در ${segment.activeWithinDays} روز اخیر`);
  if (segment.memberSinceDays) parts.push(`عضو بیش از ${segment.memberSinceDays} روز`);
  if (segment.tags?.length) parts.push(`برچسب: ${segment.tags.join("، ")}`);

  return parts.length > 0 ? parts.join(" · ") : "همه اعضا";
}

// ─── کمکی‌ها ────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

/** برای شمارش مسدودشده‌ها باید شرط isBlocked: false را برداریم */
function stripBlockedFilter(
  where: Prisma.ClubProfileWhereInput
): Prisma.ClubProfileWhereInput {
  const and = (where.AND as Prisma.ClubProfileWhereInput[]) ?? [];
  return { AND: and.filter((c) => c.isBlocked === undefined) };
}