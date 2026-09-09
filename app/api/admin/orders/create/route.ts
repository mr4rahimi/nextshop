import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { deductStockForOrderItems } from "@/lib/order-stock";
import { createTask } from "@/lib/worklist/task-service";
import { normalizePhone } from "@/lib/club/phone";
import { ensureClubProfile } from "@/lib/club/profile";
import type { OrderStatus, Prisma } from "@prisma/client";

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

  const status: OrderStatus = ALLOWED_STATUS.includes(body.status as OrderStatus)
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

  for (const it of items) {
    const p = byId.get(it.productId)!;
    const qty = Math.max(1, Math.floor(Number(it.qty)));
    // قیمت دستی بر قیمت کاتالوگ اولویت دارد — روی تلفن مذاکره می‌شود
    const manual = toBigInt(it.unitPrice, 0n);
    const effective = manual > 0n ? manual : (p.salePrice ?? p.price);

    itemsTotal += effective * BigInt(qty);
    orderItems.push({
      product: { connect: { id: p.id } },
      qty,
      unitPrice: p.price,
      // قیمت مؤثر همیشه در `unitSalePrice` می‌نشیند تا فاکتور همان را نشان دهد
      unitSalePrice: effective,
      titleSnapshot: p.title,
      skuSnapshot: p.sku ?? null,
    });
  }

  const shippingFee = toBigInt(body.shippingFee, 0n);
  const discountTotal = toBigInt(body.discountTotal, 0n);
  const grandTotal = itemsTotal + shippingFee - discountTotal;
  if (grandTotal < 0n) {
    return NextResponse.json({ error: "تخفیف از مبلغ سفارش بیشتر است" }, { status: 400 });
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
  const paid = status === "PAID" || status === "CONFIRMED";

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
      // ⚠️ همین فیلد تعریفِ «سفارش تلفنی» است. سفارش‌های سایت `null` می‌مانند.
      createdByStaffId: guard.access.userId,
      items: { create: orderItems },
      payments:
        grandTotal > 0n
          ? {
              create: [
                {
                  amount: grandTotal,
                  status: paid ? "SUCCEEDED" : "PENDING",
                  provider: "phone_order",
                  providerRef: paid ? `phone-${Date.now()}` : null,
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

  logActivityAsync({
    action: "CREATE",
    entity: "ORDER",
    entityId: order.id,
    entityTitle: order.orderNumber,
    summary: `ثبت سفارش تلفنی ${order.orderNumber}`,
  });

  // ── کارهای بعدی زنجیره ────────────────────────────────────────
  // ⚠️ خودِ سفارش کار نمی‌سازد (دوباره‌شماری). این‌ها کارِ بعد از فروش‌اند.
  const followUps: { slug: string; title: string }[] = [];
  if (body.createPurchaseTask) {
    followUps.push({ slug: "purchase-coordination", title: `تأمین کالای سفارش ${order.orderNumber}` });
  }
  if (body.createShippingTask) {
    followUps.push({ slug: "shipping-coordination", title: `هماهنگی ارسال سفارش ${order.orderNumber}` });
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
          amount: grandTotal.toString(),
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
