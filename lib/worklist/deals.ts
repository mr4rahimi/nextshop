/**
 * معامله — سود مستقیم هر سفارش و نسبت‌دادنش به یک کارمند (فاز ۹).
 *
 * چرخه: سفارش پرداخت می‌شود ← `syncDealForOrder` معامله‌ی PENDING می‌سازد ←
 * صاحبش قیمت خرید را وارد می‌کند (`setDealCost`) ← CONFIRMED با سود و پورسانت
 * هر ردیف ← در مانده‌ی تسویه‌نشده جمع می‌شود.
 *
 * ⚠️ قواعدی که نباید دور بخورند (بخش ۲۲ مستندات):
 * - هر سفارش حداکثر یک معامله (`orderId @unique`)؛ همگام‌سازی idempotent است
 * - معامله‌ی تسویه‌شده (`payoutId`) دیگر ویرایش نمی‌شود
 * - هیچ‌کدام از این توابع مسیر سفارش را نمی‌شکند؛ فراخواننده باید `.catch` کند
 *   یا از `syncDealSafe` استفاده کند
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, StaffDealStatus } from "@prisma/client";
import { toJalali } from "@/lib/club/jalali";
import type { StaffAccess } from "@/lib/permissions";
import { allocate, commissionFor, pickRule, ruleLabel } from "./commission-rules";

/** وضعیت‌هایی که سفارش از آن‌ها «پرداخت‌شده» حساب می‌شود — همان مبنای باشگاه */
export const EARNING_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"];
const VOID_STATUSES = ["CANCELED", "REFUNDED"];

export function monthKeyOf(at: Date): string {
  const j = toJalali(at);
  return `${j.year}-${String(j.month).padStart(2, "0")}`;
}

function fullName(u: { firstName: string | null; lastName: string | null; phone: string } | null): string | null {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone;
}

/** زنجیره‌ی دسته از خودش تا ریشه */
async function categoryPaths(): Promise<(id: string | null) => string[]> {
  const cats = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const parent = new Map(cats.map((c) => [c.id, c.parentId]));
  return (id) => {
    const out: string[] = [];
    let cur = id;
    // سقف عمق در برابر حلقه‌ی خراب در داده
    for (let i = 0; cur && i < 20; i++) {
      out.push(cur);
      cur = parent.get(cur) ?? null;
    }
    return out;
  };
}

// ─────────────────────────────────────────────────────────────────
// همگام‌سازی با سفارش
// ─────────────────────────────────────────────────────────────────

/**
 * ساخت یا به‌روزکردن معامله‌ی یک سفارش بر اساس وضعیتش. idempotent.
 *
 * - سفارش پرداخت‌شده و بدون معامله ← معامله‌ی PENDING
 * - سفارش لغو یا مرجوع ← VOID (اگر تسویه شده بود، کسری‌اش در تسویه‌ی بعدی)
 * - سفارش لغوشده که دوباره پرداخت‌شده شد ← برمی‌گردد، مگر کسری‌اش ثبت شده باشد
 */
export async function syncDealForOrder(orderId: string): Promise<"created" | "voided" | "restored" | "none"> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      userId: true,
      itemsTotal: true,
      discountTotal: true,
      createdAt: true,
      isReferral: true,
      paymentTerm: true,
      createdByStaffId: true,
      createdByStaff: { select: { firstName: true, lastName: true, phone: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          clubProfile: { select: { ownerId: true, ownerName: true } },
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          qty: true,
          unitPrice: true,
          unitSalePrice: true,
          titleSnapshot: true,
          product: { select: { categoryId: true, condition: true } },
        },
      },
      staffDeal: { select: { id: true, status: true, cost: true, payoutId: true, adjustedPayoutId: true } },
    },
  });
  if (!order) return "none";

  const paid = EARNING_STATUSES.includes(order.status);
  const voided = VOID_STATUSES.includes(order.status);
  const deal = order.staffDeal;

  if (deal) {
    if (voided && deal.status !== "VOID") {
      await prisma.staffDeal.update({ where: { id: deal.id }, data: { status: "VOID" } });
      return "voided";
    }
    if (paid && deal.status === "VOID" && !deal.adjustedPayoutId) {
      await prisma.staffDeal.update({
        where: { id: deal.id },
        data: { status: deal.cost !== null ? "CONFIRMED" : "PENDING" },
      });
      return "restored";
    }
    return "none";
  }

  if (!paid || order.items.length === 0) return "none";

  // سفارش اعتباری `CONFIRMED` ثبت می‌شود ولی پولش هنوز نرسیده (بخش ۲۴).
  // معامله با آخرین واریز ساخته می‌شود — `payInstallment` همین را صدا می‌زند.
  if (order.paymentTerm === "CREDIT") {
    const open = await prisma.orderCreditInstallment.count({ where: { orderId: order.id, status: "DUE" } });
    if (open > 0) return "none";
  }

  // درآمد: کالاها بعد از تخفیف، بدون کرایه‌ی ارسال (بخش ۲۲.۱)
  //
  // ⚠️ `discountTotal` در سفارش سایت پرداخت از کیف پول را هم دارد. کیف پول
  // تخفیف نیست — پول خودِ مشتری است که قبلاً گرفته شده — پس برمی‌گردد. کد
  // تخفیف و امتیاز باشگاه هزینه‌ی واقعی مجموعه‌اند و کم می‌مانند.
  const walletTx = await prisma.walletTransaction.aggregate({
    where: { userId: order.userId, amount: { lt: 0 }, meta: { path: ["orderId"], equals: order.id } },
    _sum: { amount: true },
  });
  const walletUsed = -(walletTx._sum.amount ?? 0n);
  const lineTotals = order.items.map((i) => (i.unitSalePrice ?? i.unitPrice) * BigInt(i.qty));
  const rawRevenue = order.itemsTotal - order.discountTotal + walletUsed;
  const revenue = rawRevenue > order.itemsTotal ? order.itemsTotal : rawRevenue;
  const itemRevenues = allocate(revenue > 0n ? revenue : 0n, lineTotals);
  const pathOf = await categoryPaths();

  // صاحب سود کسی است که فروش را بسته: ثبت‌کننده‌ی سفارش تلفنی، وگرنه صاحب مشتری
  const ownerId = order.createdByStaffId ?? order.user.clubProfile?.ownerId ?? null;
  const ownerName = order.createdByStaffId
    ? fullName(order.createdByStaff)
    : order.user.clubProfile?.ownerName ?? null;

  try {
    await prisma.staffDeal.create({
      data: {
        orderId: order.id,
        customerId: order.userId,
        customerName: fullName(order.user),
        ownerId,
        ownerName,
        isReferral: order.isReferral,
        title: `سفارش ${order.orderNumber}`,
        revenue: revenue > 0n ? revenue : 0n,
        monthKey: monthKeyOf(order.createdAt),
        occurredAt: order.createdAt,
        items: {
          create: order.items.map((i, idx) => ({
            orderItemId: i.id,
            productId: i.productId,
            title: i.titleSnapshot,
            categoryId: i.product.categoryId,
            categoryPath: pathOf(i.product.categoryId),
            condition: i.product.condition,
            qty: i.qty,
            revenue: itemRevenues[idx],
          })),
        },
      },
    });
  } catch (e) {
    // دو مسیر هم‌زمان همان سفارش را همگام کردند — مرز واقعی ایندکس یکتاست
    if ((e as { code?: string }).code === "P2002") return "none";
    throw e;
  }

  // قیمت خریدی که در سفارش تلفنی وارد شده بود — اگر همه‌اش معلوم است، معامله
  // همین حالا قطعی می‌شود و کارمند لازم نیست دوباره واردش کند (بخش ۲۲.۱۰).
  // ⚠️ جدا از ساخت: شکستش نباید معامله‌ی ساخته‌شده را بی‌اثر جلوه دهد.
  await applyKnownCosts(order.id, {
    userId: order.createdByStaffId,
    name: ownerName,
  }).catch((e) => console.error("[worklist] اعمال قیمت خرید سفارش روی معامله شکست خورد:", e));
  return "created";
}

/** کسی که قیمت خرید را ثبت کرد — در مسیر خودکار ممکن است آدم مشخصی نباشد */
export interface Confirmer {
  userId: string | null;
  name: string | null;
}

/**
 * قیمت‌های خرید منتظر در `OrderItemCost` را روی معامله‌ی سفارش می‌نشاند.
 *
 * - معامله‌ای نیست (سفارش هنوز پرداخت نشده) ← کاری نمی‌کند؛ `syncDealForOrder`
 *   هنگام ساخت همین را صدا می‌زند
 * - همه‌ی ردیف‌ها قیمت دارند ← `setDealCost` ردیف‌به‌ردیف، یعنی CONFIRMED
 * - فقط بعضی ← همان‌ها روی ردیف معامله پیش‌پر می‌شوند و معامله PENDING می‌ماند
 *
 * ⚠️ فقط معامله‌ی PENDING و تسویه‌نشده. قیمتی که کارمند روی معامله‌ی قطعی
 * دستی اصلاح کرده، با این مسیر خودکار بازنویسی نمی‌شود.
 */
export async function applyKnownCosts(
  orderId: string,
  by: Confirmer,
  extra?: { supplierId?: string | null },
): Promise<"confirmed" | "partial" | "none"> {
  const deal = await prisma.staffDeal.findUnique({
    where: { orderId },
    select: {
      id: true,
      status: true,
      payoutId: true,
      items: { orderBy: { id: "asc" }, select: { id: true, orderItemId: true } },
    },
  });
  if (!deal || deal.payoutId || deal.status !== "PENDING") return "none";

  const ids = deal.items.map((i) => i.orderItemId).filter((x): x is string => !!x);
  const known = await prisma.orderItemCost.findMany({ where: { orderItemId: { in: ids } } });
  if (known.length === 0) return "none";
  const byItem = new Map(known.map((k) => [k.orderItemId, k.cost]));

  const all = deal.items.every((i) => i.orderItemId && byItem.has(i.orderItemId));
  if (all) {
    await setDealCost(
      deal.id,
      {
        itemCosts: Object.fromEntries(deal.items.map((i) => [i.id, byItem.get(i.orderItemId!)!.toString()])),
        ...(extra?.supplierId ? { supplierId: extra.supplierId } : {}),
      },
      by,
    );
    return "confirmed";
  }

  await prisma.$transaction(async (tx) => {
    for (const i of deal.items) {
      const c = i.orderItemId ? byItem.get(i.orderItemId) : undefined;
      if (c !== undefined) await tx.staffDealItem.update({ where: { id: i.id }, data: { cost: c } });
    }
    // فرم معامله با همین پرچم در حالت ردیف‌به‌ردیف باز می‌شود و قیمت‌های معلوم پر است
    await tx.staffDeal.update({ where: { id: deal.id }, data: { costPerItem: true } });
  });
  return "partial";
}

/** نسخه‌ی بی‌خطر برای مسیرهای سفارش (تله‌ی ۸) */
export function syncDealSafe(orderId: string): void {
  syncDealForOrder(orderId).catch((e) => console.error("[worklist] همگام‌سازی معامله‌ی سفارش شکست خورد:", e));
}

/**
 * جاروب دوره‌ای در زمان‌بند: سفارش‌های پرداخت‌شده‌ی بدون معامله و معامله‌هایی
 * که سفارششان لغو شده. هر مسیری که وضعیت سفارش را عوض می‌کند و هوک ندارد،
 * حداکثر ده دقیقه عقب می‌ماند، نه برای همیشه.
 */
export async function sweepDeals(sinceDays = 45): Promise<{ created: number; voided: number }> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const [missing, toVoid] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: EARNING_STATUSES as never },
        staffDeal: null,
        updatedAt: { gte: since },
        // اعتباریِ با موعد باز هر ده دقیقه بی‌نتیجه بررسی نشود
        NOT: { installments: { some: { status: "DUE" } } },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.staffDeal.findMany({
      where: { status: { not: "VOID" }, order: { status: { in: VOID_STATUSES as never } } },
      select: { orderId: true },
      take: 500,
    }),
  ]);

  let created = 0;
  let voided = 0;
  for (const o of missing) {
    try {
      if ((await syncDealForOrder(o.id)) === "created") created++;
    } catch (e) {
      console.error("[worklist] ساخت معامله در جاروب شکست خورد:", e);
    }
  }
  for (const d of toVoid) {
    if (!d.orderId) continue;
    try {
      if ((await syncDealForOrder(d.orderId)) === "voided") voided++;
    } catch (e) {
      console.error("[worklist] لغو معامله در جاروب شکست خورد:", e);
    }
  }
  return { created, voided };
}

// ─────────────────────────────────────────────────────────────────
// قیمت خرید و پورسانت
// ─────────────────────────────────────────────────────────────────

export const DEAL_SELECT = {
  id: true,
  orderId: true,
  customerId: true,
  customerName: true,
  ownerId: true,
  ownerName: true,
  title: true,
  revenue: true,
  cost: true,
  profit: true,
  commission: true,
  costPerItem: true,
  isManual: true,
  noCommission: true,
  isReferral: true,
  taskId: true,
  supplierId: true,
  supplierName: true,
  note: true,
  status: true,
  monthKey: true,
  occurredAt: true,
  confirmedAt: true,
  confirmedByName: true,
  payoutId: true,
  adjustedPayoutId: true,
  createdAt: true,
  order: { select: { orderNumber: true, status: true, createdByStaffId: true } },
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      qty: true,
      condition: true,
      categoryId: true,
      revenue: true,
      cost: true,
      profit: true,
      percent: true,
      commission: true,
      ruleLabel: true,
    },
  },
} satisfies Prisma.StaffDealSelect;

/**
 * پورسانت همه‌ی ردیف‌های یک معامله را از روی طرح صاحبش دوباره می‌نویسد.
 *
 * فقط برای معامله‌ی قطعی و تسویه‌نشده. درصد و نام قاعده روی ردیف اسنپ‌شات
 * می‌شوند تا تغییر بعدی طرح، معامله‌ی گذشته را جابه‌جا نکند (بخش ۲۲.۸).
 */
async function applyCommission(tx: Prisma.TransactionClient, dealId: string) {
  const deal = await tx.staffDeal.findUniqueOrThrow({
    where: { id: dealId },
    select: {
      ownerId: true,
      noCommission: true,
      isReferral: true,
      owner: {
        select: {
          commissionPlan: {
            select: {
              isActive: true,
              rules: { select: { id: true, categoryId: true, condition: true, referral: true, percent: true, isActive: true, category: { select: { title: true } } } },
            },
          },
        },
      },
      items: { select: { id: true, categoryId: true, categoryPath: true, condition: true, profit: true } },
    },
  });

  const plan = deal.owner?.commissionPlan?.isActive ? deal.owner.commissionPlan : null;
  let total = 0n;

  // معامله‌ی بدون پورسانت (درآمد تعمیرات): سود سر جایش می‌ماند و در گزارش و
  // در `totalProfit` تسویه دیده می‌شود، ولی هیچ ردیفی پورسانت نمی‌گیرد.
  // عمداً صفر نوشته می‌شود نه `null` — `null` یعنی «هنوز حساب نشده».
  if (deal.noCommission) {
    for (const item of deal.items) {
      await tx.staffDealItem.update({
        where: { id: item.id },
        data: { percent: 0, commission: 0n, ruleId: null, ruleLabel: "بدون پورسانت" },
      });
    }
    await tx.staffDeal.update({ where: { id: dealId }, data: { commission: 0n } });
    return;
  }

  for (const item of deal.items) {
    if (!deal.ownerId) {
      await tx.staffDealItem.update({
        where: { id: item.id },
        data: { percent: null, commission: null, ruleId: null, ruleLabel: "بی‌صاحب — پورسانت ندارد" },
      });
      continue;
    }
    const rule = plan ? pickRule(plan.rules, { ...item, referral: deal.isReferral }) : null;
    const commission = rule ? commissionFor(item.profit ?? 0n, rule.percent) : 0n;
    total += commission;
    await tx.staffDealItem.update({
      where: { id: item.id },
      data: {
        percent: rule?.percent ?? 0,
        commission,
        ruleId: rule?.id ?? null,
        ruleLabel: rule
          ? ruleLabel(rule, rule.category?.title)
          : plan
            ? "هیچ قاعده‌ای نخورد — قاعده‌ی پیش‌فرض طرح را بسازید"
            : "کارمند طرح پورسانت ندارد",
      },
    });
  }

  await tx.staffDeal.update({
    where: { id: dealId },
    data: { commission: deal.ownerId ? total : null },
  });
}

export interface CostInput {
  /** کل قیمت خرید — به نسبت درآمد پخش می‌شود */
  cost?: string | number | null;
  /** قیمت خرید هر ردیف: `{ [itemId]: مبلغ }` */
  itemCosts?: Record<string, string | number> | null;
  supplierId?: string | null;
  note?: string | null;
}

function toMoney(v: unknown): bigint | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/[^\d]/g, "");
  if (!s || s.length > 15) return null;
  return BigInt(s);
}

/**
 * ثبت قیمت خرید و قطعی‌کردن معامله.
 *
 * ⚠️ دسترسی را فراخواننده (مسیر API) چک می‌کند؛ این تابع فقط قفل تسویه و
 * درستی اعداد را تضمین می‌کند.
 */
export async function setDealCost(dealId: string, input: CostInput, access: StaffAccess | Confirmer) {
  const deal = await prisma.staffDeal.findUnique({
    where: { id: dealId },
    select: { id: true, status: true, payoutId: true, items: { orderBy: { id: "asc" }, select: { id: true, revenue: true } } },
  });
  if (!deal) throw new Error("معامله پیدا نشد");
  if (deal.payoutId) throw new Error("این معامله تسویه شده و دیگر قابل ویرایش نیست");
  if (deal.status === "VOID") throw new Error("سفارش این معامله لغو یا مرجوع شده است");

  let costs: bigint[];
  let perItem = false;
  if (input.itemCosts && Object.keys(input.itemCosts).length > 0) {
    perItem = true;
    costs = deal.items.map((i) => {
      const v = toMoney(input.itemCosts![i.id]);
      if (v === null) throw new Error("قیمت خرید همه‌ی کالاها را وارد کنید");
      return v;
    });
  } else {
    const total = toMoney(input.cost);
    if (total === null) throw new Error("قیمت خرید را وارد کنید");
    costs = allocate(total, deal.items.map((i) => i.revenue));
  }

  let supplierName: string | null | undefined;
  if (input.supplierId !== undefined) {
    if (input.supplierId) {
      const s = await prisma.staffSupplier.findUnique({ where: { id: input.supplierId }, select: { name: true } });
      if (!s) throw new Error("تأمین‌کننده پیدا نشد");
      supplierName = s.name;
    } else {
      supplierName = null;
    }
  }

  const totalCost = costs.reduce((a, b) => a + b, 0n);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    let totalRevenue = 0n;
    for (const [idx, item] of deal.items.entries()) {
      totalRevenue += item.revenue;
      await tx.staffDealItem.update({
        where: { id: item.id },
        data: { cost: costs[idx], profit: item.revenue - costs[idx] },
      });
    }
    await tx.staffDeal.update({
      where: { id: dealId },
      data: {
        cost: totalCost,
        profit: totalRevenue - totalCost,
        costPerItem: perItem,
        status: "CONFIRMED",
        confirmedAt: now,
        confirmedById: access.userId,
        confirmedByName: access.name,
        ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null, supplierName } : {}),
        ...(input.note !== undefined ? { note: input.note?.trim().slice(0, 1000) || null } : {}),
      },
    });
    await applyCommission(tx, dealId);
  });

  return prisma.staffDeal.findUniqueOrThrow({ where: { id: dealId }, select: DEAL_SELECT });
}

/**
 * تعیین صاحب معامله — برای معامله‌های بی‌صاحب یا اصلاح. فقط تسویه‌نشده.
 * معامله‌ی قطعی با طرح صاحب جدید دوباره حساب می‌شود.
 */
export async function assignDealOwner(dealId: string, ownerId: string | null) {
  const deal = await prisma.staffDeal.findUnique({ where: { id: dealId }, select: { payoutId: true, status: true } });
  if (!deal) throw new Error("معامله پیدا نشد");
  if (deal.payoutId) throw new Error("معامله‌ی تسویه‌شده جابه‌جا نمی‌شود");

  let ownerName: string | null = null;
  if (ownerId) {
    const u = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { firstName: true, lastName: true, phone: true, role: true, isActive: true },
    });
    if (!u || !u.isActive || (u.role !== "ADMIN" && u.role !== "SELLER")) throw new Error("صاحب باید یکی از کارکنان فعال باشد");
    ownerName = fullName(u);
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffDeal.update({ where: { id: dealId }, data: { ownerId, ownerName } });
    if (deal.status === "CONFIRMED") await applyCommission(tx, dealId);
  });
  return prisma.staffDeal.findUniqueOrThrow({ where: { id: dealId }, select: DEAL_SELECT });
}

/**
 * معامله‌ی بدون سفارش — تنها جایی که درآمد را کارمند وارد می‌کند.
 * در فهرست با نشان «دستی» دیده می‌شود (بخش ۲۲.۳).
 */
export async function createManualDeal(
  input: {
    title?: unknown;
    revenue?: unknown;
    cost?: unknown;
    customerId?: unknown;
    supplierId?: unknown;
    categoryId?: unknown;
    condition?: unknown;
    note?: unknown;
    occurredAt?: unknown;
  },
  access: StaffAccess,
) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
  if (!title) throw new Error("عنوان معامله لازم است");
  const revenue = toMoney(input.revenue);
  if (revenue === null || revenue === 0n) throw new Error("مبلغ فروش را وارد کنید");

  const occurredAt =
    typeof input.occurredAt === "string" && !Number.isNaN(Date.parse(input.occurredAt))
      ? new Date(input.occurredAt)
      : new Date();
  const categoryId = typeof input.categoryId === "string" && input.categoryId ? input.categoryId : null;
  const condition = typeof input.condition === "string" && input.condition ? input.condition : "NEW";
  const customerId = typeof input.customerId === "string" && input.customerId ? input.customerId : null;
  const customer = customerId
    ? await prisma.user.findUnique({ where: { id: customerId }, select: { firstName: true, lastName: true, phone: true } })
    : null;
  const pathOf = await categoryPaths();

  const deal = await prisma.staffDeal.create({
    data: {
      title,
      isManual: true,
      ownerId: access.userId,
      ownerName: access.name,
      customerId: customer ? customerId : null,
      customerName: fullName(customer),
      revenue,
      monthKey: monthKeyOf(occurredAt),
      occurredAt,
      items: {
        create: [
          {
            title,
            categoryId,
            categoryPath: pathOf(categoryId),
            condition: condition as never,
            revenue,
          },
        ],
      },
    },
    select: { id: true },
  });

  const cost = toMoney(input.cost);
  if (cost !== null) {
    return setDealCost(
      deal.id,
      { cost: cost.toString(), supplierId: typeof input.supplierId === "string" ? input.supplierId : undefined, note: typeof input.note === "string" ? input.note : undefined },
      access,
    );
  }
  return prisma.staffDeal.findUniqueOrThrow({ where: { id: deal.id }, select: DEAL_SELECT });
}

/**
 * معامله از روی یک کارِ کارتابل — امروز فقط «تعمیر دستگاه».
 *
 * نوع کاری که `createsDeal` دارد، وقتی با **نتیجه‌ی موفق** و **مبلغ** بسته
 * می‌شود یک معامله‌ی قطعی می‌سازد: درآمد همان مبلغ کار، هزینه صفر، سود برابر
 * درآمد. اگر نوع کار `dealNoCommission` داشته باشد، معامله در سود می‌آید ولی
 * پورسانت نمی‌سازد (بخش ۲ سند تنظیم‌پذیری).
 *
 * ⚠️ سه نکته که دور زدنشان گران تمام می‌شود:
 *  - **idempotent** است: مرزش ایندکس یکتای `taskId` است، نه شمارش در کد.
 *    کاری که باز و بسته شود دو معامله نمی‌سازد.
 *  - **هزینه صفر یعنی سود برابر درآمد.** قطعات مصرفی تعمیر اگر روزی مهم شد،
 *    همان `setDealCost` معمولی جوابش را می‌دهد و این تابع دست نمی‌خورد.
 *  - **هیچ‌وقت مسیر کار را نمی‌شکند** — فراخواننده `dealFromTaskSafe` را صدا می‌زند.
 */
export async function dealFromTask(taskId: string): Promise<"created" | "none"> {
  const task = await prisma.staffTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      amount: true,
      outcome: true,
      status: true,
      ownerId: true,
      ownerName: true,
      customerId: true,
      occurredAt: true,
      createdAt: true,
      deal: { select: { id: true } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
      type: { select: { createsDeal: true, dealNoCommission: true, outcomes: true } },
    },
  });

  if (!task || !task.type.createsDeal) return "none";
  if (task.deal) return "none";
  if (task.status !== "DONE" || !task.outcome) return "none";
  // مبلغ صفر یا خالی یعنی کارمند هنوز عددش را نزده — معامله‌ی صفرریالی نمی‌سازیم
  if (!task.amount || task.amount <= 0n) return "none";

  // فقط نتیجه‌ی موفق درآمد است: «مشتری منصرف شد» معامله نیست
  const outcomes = Array.isArray(task.type.outcomes) ? (task.type.outcomes as { value?: unknown; isSuccess?: unknown }[]) : [];
  const isSuccess = outcomes.some((o) => o?.value === task.outcome && o?.isSuccess === true);
  if (!isSuccess) return "none";

  const occurredAt = task.occurredAt ?? task.createdAt;

  try {
    const deal = await prisma.staffDeal.create({
      data: {
        taskId: task.id,
        isManual: true,
        noCommission: task.type.dealNoCommission,
        ownerId: task.ownerId,
        ownerName: task.ownerName,
        customerId: task.customerId,
        customerName: fullName(task.customer),
        title: task.title,
        revenue: task.amount,
        cost: 0n,
        profit: task.amount,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        monthKey: monthKeyOf(occurredAt),
        occurredAt,
        items: {
          create: [
            {
              title: task.title,
              categoryPath: [],
              condition: "NEW",
              revenue: task.amount,
              cost: 0n,
              profit: task.amount,
            },
          ],
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => applyCommission(tx, deal.id));
    return "created";
  } catch (e) {
    // همان کار از دو مسیر هم‌زمان بسته شد — ایندکس یکتا جلویش را گرفت
    if ((e as { code?: string }).code === "P2002") return "none";
    throw e;
  }
}

/** نسخه‌ی بی‌خطر برای مسیر کار — بستن کار هیچ‌وقت نباید به خاطر معامله بشکند */
export function dealFromTaskSafe(taskId: string): void {
  dealFromTask(taskId).catch((e) =>
    console.error("[worklist] ساخت معامله از کار شکست خورد:", e),
  );
}

/** نوع کاری که قیمت خرید سفارش را می‌آورد — همان کار «تأمین کالا»ی سفارش تلفنی */
export const PURCHASE_TASK_SLUG = "purchase-coordination";

/**
 * بستن کار «تأمین کالا» با نتیجه‌ی موفق و مبلغ ← قیمت خرید سفارش (بخش ۲۲.۱۰).
 *
 * مبلغ کار، قیمت خرید **ردیف‌هایی است که هنوز قیمت ندارند** — همان‌هایی که کار
 * برایشان ساخته شد. بین آن‌ها به نسبت مبلغ فروش پخش می‌شود. اگر سفارش پرداخت
 * شده باشد معامله همین حالا قطعی می‌شود، وگرنه وقتی پرداخت شد.
 *
 * ⚠️ یک عدد، یک بار: کارمند مبلغ خرید را فقط روی همین کار می‌زند و دیگر لازم
 * نیست در «سود معاملات» تکرارش کند (قاعده‌ی طلایی بخش ۱).
 */
export async function costFromPurchaseTask(taskId: string): Promise<"applied" | "none"> {
  const task = await prisma.staffTask.findUnique({
    where: { id: taskId },
    select: {
      status: true,
      outcome: true,
      amount: true,
      entity: true,
      entityId: true,
      supplierId: true,
      ownerId: true,
      ownerName: true,
      type: { select: { slug: true, outcomes: true } },
    },
  });
  if (!task || task.type.slug !== PURCHASE_TASK_SLUG) return "none";
  if (task.status !== "DONE" || !task.outcome || task.entity !== "ORDER" || !task.entityId) return "none";
  if (!task.amount || task.amount <= 0n) return "none";
  const outcomes = Array.isArray(task.type.outcomes) ? (task.type.outcomes as { value?: unknown; isSuccess?: unknown }[]) : [];
  if (!outcomes.some((o) => o?.value === task.outcome && o?.isSuccess === true)) return "none";

  const items = await prisma.orderItem.findMany({
    where: { orderId: task.entityId },
    orderBy: { id: "asc" },
    select: { id: true, qty: true, unitPrice: true, unitSalePrice: true, cost: { select: { cost: true } } },
  });
  const missing = items.filter((i) => !i.cost);
  if (missing.length === 0) return "none";

  const shares = allocate(
    task.amount,
    missing.map((i) => (i.unitSalePrice ?? i.unitPrice) * BigInt(i.qty)),
  );
  await prisma.$transaction(
    missing.map((i, idx) =>
      prisma.orderItemCost.upsert({
        where: { orderItemId: i.id },
        create: { orderItemId: i.id, cost: shares[idx] },
        update: { cost: shares[idx] },
      }),
    ),
  );
  await applyKnownCosts(task.entityId, { userId: task.ownerId, name: task.ownerName }, { supplierId: task.supplierId });
  return "applied";
}

/** نسخه‌ی بی‌خطر برای مسیر کار */
export function costFromPurchaseTaskSafe(taskId: string): void {
  costFromPurchaseTask(taskId).catch((e) =>
    console.error("[worklist] ثبت قیمت خرید از کار تأمین شکست خورد:", e),
  );
}

export type DealTab = "pending" | "open" | "paid" | "unowned" | "void" | "all";

export function dealTabWhere(tab: DealTab): Prisma.StaffDealWhereInput {
  switch (tab) {
    case "pending":
      return { status: "PENDING" };
    case "open":
      return { status: "CONFIRMED", payoutId: null };
    case "paid":
      return { payoutId: { not: null } };
    case "unowned":
      return { ownerId: null, status: { not: "VOID" as StaffDealStatus } };
    case "void":
      return { status: "VOID" };
    default:
      return {};
  }
}
