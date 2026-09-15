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
    return "created";
  } catch (e) {
    // دو مسیر هم‌زمان همان سفارش را همگام کردند — مرز واقعی ایندکس یکتاست
    if ((e as { code?: string }).code === "P2002") return "none";
    throw e;
  }
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
      where: { status: { in: EARNING_STATUSES as never }, staffDeal: null, updatedAt: { gte: since } },
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
      owner: {
        select: {
          commissionPlan: {
            select: {
              isActive: true,
              rules: { select: { id: true, categoryId: true, condition: true, percent: true, isActive: true, category: { select: { title: true } } } },
            },
          },
        },
      },
      items: { select: { id: true, categoryId: true, categoryPath: true, condition: true, profit: true } },
    },
  });

  const plan = deal.owner?.commissionPlan?.isActive ? deal.owner.commissionPlan : null;
  let total = 0n;

  for (const item of deal.items) {
    if (!deal.ownerId) {
      await tx.staffDealItem.update({
        where: { id: item.id },
        data: { percent: null, commission: null, ruleId: null, ruleLabel: "بی‌صاحب — پورسانت ندارد" },
      });
      continue;
    }
    const rule = plan ? pickRule(plan.rules, item) : null;
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
export async function setDealCost(dealId: string, input: CostInput, access: StaffAccess) {
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
