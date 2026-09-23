import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { validateInstallments } from "@/lib/worklist/credit";
import { logActivityAsync } from "@/lib/activity";
import { deductStockForOrderItems } from "@/lib/order-stock";
import { createTask } from "@/lib/worklist/task-service";
import { normalizePhone } from "@/lib/club/phone";
import { ensureClubProfile } from "@/lib/club/profile";
import type { OrderStatus, Prisma } from "@prisma/client";
import { claimIfUnowned } from "@/lib/club/ownership";
import { PURCHASE_TASK_SLUG, syncDealSafe } from "@/lib/worklist/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ثبت سفارش تلفنی از پنل ادمین.
 *
 * تا پیش از این، سفارش فقط از دو مسیر تسویه‌حساب مشتری ساخته می‌شد و
 * «سفارش تلفنی» — که در فهرست کارهای مهام‌پرینت آمده — هیچ راهی برای ثبت
 * نداشت.
 *
 * ⚠️ این سفارش **کارِ کارتابل نمی‌سازد.** شمارشش از `Order.createdByStaffId`
 * می‌آید (`lib/worklist/system-map.ts`). اگر اینجا `StaffTask` هم بسازیم،
 * یک کار دو بار شمرده می‌شود.
 *
 * آنچه اختیاری ساخته می‌شود، کارِ **بعدی** است: هماهنگی خرید از تأمین‌کننده و
 * هماهنگی ارسال. این‌ها زنجیره‌ی بعد از فروش‌اند نه خودِ فروش.
 *
 * قیمت خرید هر ردیف (اختیاری) در `OrderItemCost` می‌نشیند و با پرداخت سفارش
 * معامله را همان لحظه قطعی می‌کند. **اگر قیمت خرید حتی یک ردیف معلوم نباشد،
 * کار «تأمین کالا» اجباری است** — کارمند تأمین‌کننده را پیدا می‌کند و با بستن
 * همان کار، قیمت خرید ثبت می‌شود (بخش ۲۲.۱۰).
 *
 * **اعتباری** (بخش ۲۴): با `paymentTerm: "CREDIT"` و موعدها. سفارش `CONFIRMED`
 * ثبت می‌شود (کالا می‌رود، موجودی کسر می‌شود) ولی پرداختش در انتظار می‌ماند؛
 * سود و امتیاز باشگاه با آخرین واریز آزاد می‌شوند. مجوز جدای `CREDIT_MANAGE`.
 */

function generateOrderNumber(): string {
  return `MN-${Math.floor(10000 + Math.random() * 90000)}`;
}

/** فقط وضعیت‌هایی که ثبت دستی معنی می‌دهد */
const ALLOWED_STATUS: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "CONFIRMED"];

interface ItemInput {
  productId: string;
  qty: number;
  /** قیمت دستی — وقتی روی تلفن قیمت دیگری توافق شده */
  unitPrice?: string | number | null;
  /** قیمت خرید **واحد** از تأمین‌کننده — خالی یعنی هنوز معلوم نیست */
  unitCost?: string | number | null;
}

function toBigInt(v: string | number | null | undefined, fallback = 0n): bigint {
  if (v === null || v === undefined || v === "") return fallback;
  try {
    return BigInt(typeof v === "number" ? Math.round(v) : String(v).replace(/[^\d]/g, "") || "0");
  } catch {
    return fallback;
  }
}

export async function POST(req: Request) {
  // ⚠️ مجوز جداست، نه `WORK_CREATE`. ثبت سفارش پول جابه‌جا می‌کند و موجودی
  // کم می‌کند؛ کسی که فقط کار در کارتابل ثبت می‌کند نباید بتواند سفارش بزند.
  const guard = await requirePermission("ORDER_CREATE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: {
    customerId?: string | null;
    newCustomer?: { phone?: string; firstName?: string; lastName?: string } | null;
    items?: ItemInput[];
    address?: {
      receiver?: string;
      phone?: string;
      province?: string;
      city?: string;
      addressLine?: string;
      postalCode?: string;
    } | null;
    addressId?: string | null;
    shippingFee?: string | number | null;
    discountTotal?: string | number | null;
    note?: string | null;
    status?: OrderStatus;
    /** فروش ریفری — پورسانتش با قاعده‌های ریفری طرح حساب می‌شود */
    isReferral?: boolean;
    /** نقدی (پیش‌فرض) یا اعتباری */
    paymentTerm?: "CASH" | "CREDIT";
    /** موعدهای پرداخت اعتباری — جمعشان باید دقیقاً مبلغ نهایی باشد */
    installments?: { dueDate: string; amount: string | number }[];
    /** کارهای بعدی که همراه سفارش ساخته شوند */
    createPurchaseTask?: boolean;
    createShippingTask?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی نامعتبر" }, { status: 400 });
  }

  const items = (body.items ?? []).filter((i) => i?.productId && Number(i.qty) > 0);
  if (items.length === 0) {
    return NextResponse.json({ error: "دست‌کم یک کالا انتخاب کنید" }, { status: 400 });
  }

  const credit = body.paymentTerm === "CREDIT";
  if (credit && !can(guard.access, "CREDIT_MANAGE")) {
    return NextResponse.json({ error: "ثبت سفارش اعتباری مجوز جدا لازم دارد" }, { status: 403 });
  }

  // ⚠️ اعتباری همیشه `CONFIRMED`: کالا تحویل می‌شود و پول بعداً می‌آید. «پول
  // نرسیده» از موعدهای باز خوانده می‌شود، نه از وضعیت (تصمیم بخش ۲۴.۳).
  const status: OrderStatus = credit
    ? "CONFIRMED"
    : ALLOWED_STATUS.includes(body.status as OrderStatus)
      ? (body.status as OrderStatus)
      : "PENDING_PAYMENT";

  // ── مشتری ─────────────────────────────────────────────────────
  let userId = body.customerId ?? null;

  if (!userId) {
    const phone = normalizePhone(body.newCustomer?.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "مشتری را انتخاب کنید یا شماره‌ی موبایل معتبر وارد کنید" },
        { status: 400 },
      );
    }
    // upsert چون ممکن است همان شماره قبلاً به‌عنوان مخاطب تماس ثبت شده باشد
    const user = await prisma.user.upsert({
      where: { phone },
      update: {
        firstName: body.newCustomer?.firstName?.trim() || undefined,
        lastName: body.newCustomer?.lastName?.trim() || undefined,
      },
      create: {
        phone,
        firstName: body.newCustomer?.firstName?.trim() || null,
        lastName: body.newCustomer?.lastName?.trim() || null,
        role: "CUSTOMER",
      },
      select: { id: true },
    });
    userId = user.id;
  }

  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "مشتری پیدا نشد" }, { status: 400 });
  }

  // ── کالاها ────────────────────────────────────────────────────
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, title: true, price: true, salePrice: true, sku: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const missing = items.filter((i) => !byId.has(i.productId));
  if (missing.length > 0) {
    return NextResponse.json({ error: "یکی از کالاها پیدا نشد" }, { status: 400 });
  }

  const orderItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];
  let itemsTotal = 0n;
  /** ردیف‌هایی که قیمت خریدشان هنوز معلوم نیست — برای کار «تأمین کالا» */
  const noCost: string[] = [];

  for (const it of items) {
    const p = byId.get(it.productId)!;
    const qty = Math.max(1, Math.floor(Number(it.qty)));
    // قیمت دستی بر قیمت کاتالوگ اولویت دارد — روی تلفن مذاکره می‌شود
    const manual = toBigInt(it.unitPrice, 0n);
    const effective = manual > 0n ? manual : (p.salePrice ?? p.price);

    itemsTotal += effective * BigInt(qty);
    const unitCost = toBigInt(it.unitCost, 0n);
    if (unitCost <= 0n) noCost.push(`${p.title} × ${qty}`);
    orderItems.push({
      product: { connect: { id: p.id } },
      qty,
      unitPrice: p.price,
      // قیمت مؤثر همیشه در `unitSalePrice` می‌نشیند تا فاکتور همان را نشان دهد
      unitSalePrice: effective,
      titleSnapshot: p.title,
      skuSnapshot: p.sku ?? null,
      // کل ردیف ذخیره می‌شود، نه واحد — `OrderItemCost` در schema
      ...(unitCost > 0n ? { cost: { create: { cost: unitCost * BigInt(qty) } } } : {}),
    });
  }

  const shippingFee = toBigInt(body.shippingFee, 0n);
  const discountTotal = toBigInt(body.discountTotal, 0n);
  const grandTotal = itemsTotal + shippingFee - discountTotal;
  if (grandTotal < 0n) {
    return NextResponse.json({ error: "تخفیف از مبلغ سفارش بیشتر است" }, { status: 400 });
  }

  // موعدها **پیش از** ساخت سفارش سنجیده می‌شوند — سفارش اعتباریِ بی‌موعد نباید بماند
  let installmentRows: { seq: number; dueDate: Date; amount: bigint }[] = [];
  if (credit) {
    if (grandTotal <= 0n) {
      return NextResponse.json({ error: "سفارش بدون مبلغ اعتباری نمی‌شود" }, { status: 400 });
    }
    const v = validateInstallments(body.installments, grandTotal);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    installmentRows = v.rows;
  }

  // ── آدرس ──────────────────────────────────────────────────────
  let addressId = body.addressId ?? null;
  const a = body.address;
  if (!addressId && a?.addressLine?.trim()) {
    const created = await prisma.address.create({
      data: {
        userId: customer.id,
        receiver:
          a.receiver?.trim() ||
          [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
          customer.phone,
        phone: normalizePhone(a.phone) ?? customer.phone,
        province: a.province?.trim() || "",
        city: a.city?.trim() || "",
        addressLine: a.addressLine.trim(),
        postalCode: a.postalCode?.trim() || null,
      },
      select: { id: true },
    });
    addressId = created.id;
  }

  // ── ثبت سفارش ─────────────────────────────────────────────────
  // «کالا رفته» — برای کسر موجودی. اعتباری هم کالا را می‌فرستد.
  const paid = status === "PAID" || status === "CONFIRMED";
  /** پول واقعاً رسیده — اعتباری نه */
  const moneyIn = paid && !credit;

  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      addressId,
      orderNumber: generateOrderNumber(),
      status,
      itemsTotal,
      shippingFee,
      discountTotal,
      grandTotal,
      note: body.note?.trim() || null,
      isReferral: body.isReferral === true,
      paymentTerm: credit ? "CREDIT" : "CASH",
      ...(credit ? { installments: { create: installmentRows } } : {}),
      // ⚠️ همین فیلد تعریفِ «سفارش تلفنی» است. سفارش‌های سایت `null` می‌مانند.
      createdByStaffId: guard.access.userId,
      items: { create: orderItems },
      payments:
        grandTotal > 0n
          ? {
              create: [
                {
                  amount: grandTotal,
                  status: moneyIn ? "SUCCEEDED" : "PENDING",
                  provider: credit ? "credit" : "phone_order",
                  providerRef: moneyIn ? `phone-${Date.now()}` : null,
                },
              ],
            }
          : undefined,
    },
    select: { id: true, orderNumber: true, grandTotal: true, status: true },
  });

  // کسر موجودی فقط وقتی سفارش همان لحظه پرداخت‌شده ثبت شود؛ در غیر این صورت
  // گذار وضعیت در مسیر ویرایش سفارش این کار را می‌کند.
  if (paid) {
    await deductStockForOrderItems(
      items.map((i) => ({ productId: i.productId, qty: Math.max(1, Math.floor(Number(i.qty))) })),
    ).catch((e: unknown) =>
      console.error("[order-stock] کسر موجودی سفارش تلفنی ناموفق:", e),
    );
  }

  // پروفایل باشگاه — هیچ‌وقت نباید ثبت سفارش را بشکند.
  // `CALLER_ID` نزدیک‌ترین منبع به سفارش تلفنی است؛ عضو تازه‌ای به enum
  // اضافه نشد تا گزارش‌های موجود جذب مشتری دست نخورند.
  await ensureClubProfile(customer.id, { source: "CALLER_ID" }).catch(() => {});

  // مشتریِ بی‌صاحب به ثبت‌کننده‌ی سفارش می‌رسد (فاز ۸). صاحبِ موجود عوض نمی‌شود.
  await claimIfUnowned({
    userId: customer.id,
    ownerId: guard.access.userId,
    ownerName: guard.access.name,
    via: "ORDER",
  });

  // معامله‌ی سود — فقط اگر همان لحظه پرداخت‌شده ثبت شده باشد؛ بقیه با گذار وضعیت.
  // اعتباری را خودِ syncDealForOrder تا آخرین واریز رد می‌کند.
  if (moneyIn) syncDealSafe(order.id);

  logActivityAsync({
    action: "CREATE",
    entity: "ORDER",
    entityId: order.id,
    entityTitle: order.orderNumber,
    summary: credit
      ? `ثبت سفارش تلفنی اعتباری ${order.orderNumber} — ${installmentRows.length} موعد`
      : `ثبت سفارش تلفنی ${order.orderNumber}`,
  });

  // ── کارهای بعدی زنجیره ────────────────────────────────────────
  // ⚠️ خودِ سفارش کار نمی‌سازد (دوباره‌شماری). این‌ها کارِ بعد از فروش‌اند.
  const followUps: { slug: string; title: string; note?: string; amount?: string }[] = [];
  // قیمت خرید نامعلوم ← کار تأمین اجباری است، تیک یا بی‌تیک. بدون آن معامله
  // در «قیمت خرید ثبت‌نشده» می‌ماند و کسی دنبال تأمین‌کننده نمی‌رود.
  if (body.createPurchaseTask || noCost.length > 0) {
    followUps.push({
      slug: PURCHASE_TASK_SLUG,
      title: `تأمین کالای سفارش ${order.orderNumber}`,
      note:
        noCost.length > 0
          ? `قیمت خرید این کالاها هنوز معلوم نیست:\n${noCost.map((t) => `• ${t}`).join("\n")}\n\n` +
            "تأمین‌کننده را پیدا کنید و بعد از خرید، روی همین کار «خرید شد» را بزنید: قیمت خرید هر کالا و تأمین‌کننده را همان‌جا وارد می‌کنید و خودکار روی سود معامله می‌نشیند. بعد کار «هماهنگی ارسال» ساخته می‌شود."
          : undefined,
    });
  }
  if (body.createShippingTask) {
    followUps.push({
      slug: "shipping-coordination",
      title: `هماهنگی ارسال سفارش ${order.orderNumber}`,
      amount: grandTotal.toString(),
    });
  }

  const createdTasks: { id: string; title: string }[] = [];
  for (const f of followUps) {
    try {
      const type = await prisma.staffTaskType.findUnique({
        where: { slug: f.slug },
        select: { id: true, isActive: true },
      });
      if (!type?.isActive) continue;
      const task = await createTask(
        {
          typeId: type.id,
          title: f.title,
          customerId: customer.id,
          contactName:
            [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || null,
          contactPhone: customer.phone,
          entity: "ORDER",
          entityId: order.id,
          // ⚠️ مبلغ کار تأمین خالی می‌ماند: همان عدد، قیمت خرید می‌شود
          // (`costFromPurchaseTask`). پرکردنش با مبلغ فروش سود را صفر می‌کرد.
          amount: f.amount ?? null,
          note: f.note ?? null,
        },
        guard.access,
      );
      createdTasks.push({ id: task.id, title: task.title });
    } catch (e) {
      // ساخت کار بعدی نباید ثبت سفارش را بشکند
      console.error("[worklist] ساخت کار بعدیِ سفارش ناموفق:", e);
    }
  }

  return NextResponse.json(serialize({ order, tasks: createdTasks }), { status: 201 });
}
