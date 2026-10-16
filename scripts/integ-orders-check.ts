/**
 * بررسی «سفارش‌های بازارگاه» و پاک‌سازی سفارش‌های تکراری تپسی‌شاپ — نسخه‌ی ۲.۹۲.۰
 *
 *   pnpm tsx scripts/integ-orders-check.ts            # فقط گزارش، هیچ چیز تغییر نمی‌کند
 *   pnpm tsx scripts/integ-orders-check.ts --apply    # نسخه‌ی اضافه‌ی تکراری‌ها لغو می‌شود
 *
 * **تکرار تپسی از کجا می‌آمد؟** وب‌هوک هر قلم را با کلید `${orderId}:${orderItemId}`
 * ثبت می‌کرد و polling همان قلم را با `${orderId}:${sku}`. کلید یکتا این دو را یکی
 * نمی‌دید و سفارش دو بار در پنل و حسابداری داخلی می‌نشست. از ۲.۹۲.۰ هر دو مسیر
 * ردیف دیگری را می‌شناسند؛ این اسکریپت ردیف‌های قدیمی را جمع می‌کند.
 *
 * **چه چیزی تکراری حساب می‌شود؟** دو ردیف تپسی با یک شماره سفارش و تعداد برابر که
 * یکی از polling است (شناسه‌ی قلم = sku) و دیگری از وب‌هوک (عنوان = همان sku)، یا هر
 * دو نگاشت یکسان دارند. شناسه‌ی سفارش ملاک نیست: وب‌هوک‌های قدیمی آن را با گرد شدن
 * عدد بزرگ JSON خراب ذخیره کرده‌اند.
 *
 * **کدام ردیف می‌ماند؟** اگر یکی فاکتور خورده، همان؛ وگرنه ردیف polling (شناسه و
 * عنوان درست دارد) و نام و تلفن مشتری از ردیف وب‌هوک رویش نوشته می‌شود. ردیف اضافه
 * CANCELLED می‌شود و فروشش در حسابداری داخلی ابطال می‌شود. اگر هر دو در حسابان
 * فاکتور خورده باشند، فقط گزارش می‌شود و یکی از فاکتورها باید دستی در حسابان ابطال شود.
 *
 * ردیف‌های وب‌هوکی که جفت ندارند و به‌جای عنوان، شناسه‌ی محصول دارند، اگر همان
 * sku در ردیف polling دیگری عنوان داشته باشد، عنوانشان اصلاح می‌شود.
 *
 * اجرای دوباره بی‌خطر است. مستندات: docs/integrations/orders-and-invoicing.md
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { emitAccEventSafe } from "../lib/accounting/events";

const APPLY = process.argv.includes("--apply");
const TAPSI = "tapsi_shop";

type Row = Awaited<ReturnType<typeof loadTapsi>>[number];

function loadTapsi() {
  return prisma.integOrder.findMany({
    where:   { platformCode: TAPSI },
    orderBy: { createdAt: "asc" },
    select:  {
      id: true, mappingId: true, platformOrderId: true, platformOrderNo: true, platformOrderItemId: true,
      productTitle: true, qty: true, status: true, customerName: true, customerPhone: true, createdAt: true,
    },
  });
}

async function report() {
  console.log("── سفارش‌ها به تفکیک پلتفرم و وضعیت ──");
  const counts = await prisma.integOrder.groupBy({
    by: ["platformCode", "status"], _count: { _all: true }, _max: { createdAt: true },
  });
  for (const c of counts) {
    console.log(`  ${c.platformCode.padEnd(12)} ${c.status.padEnd(14)} ${String(c._count._all).padStart(5)}  آخرین: ${c._max.createdAt?.toISOString() ?? "-"}`);
  }

  console.log("\n── اتصال‌ها و آخرین دریافت سفارش ──");
  const conns = await prisma.integConnection.findMany({
    select: { platformCode: true, status: true, lastError: true, lastErrorAt: true, syncIntervalMin: true },
  });
  for (const c of conns) {
    const lastJob = await prisma.integJob.findFirst({
      where:   { platformCode: c.platformCode, type: "FETCH_ORDERS" },
      orderBy: { createdAt: "desc" },
      select:  { status: true, attempts: true, lastError: true, scheduledAt: true, completedAt: true },
    });
    const lastLog = await prisma.integLog.findFirst({
      where:   { platformCode: c.platformCode, operationType: "FETCH_ORDERS" },
      orderBy: { createdAt: "desc" },
      select:  { status: true, errorMessage: true, responseData: true, createdAt: true },
    });
    console.log(`  ${c.platformCode} — اتصال: ${c.status}، هر ${c.syncIntervalMin} دقیقه`);
    if (c.lastError) console.log(`     خطای اتصال (${c.lastErrorAt?.toISOString()}): ${c.lastError.slice(0, 200)}`);
    console.log(`     آخرین job: ${lastJob ? `${lastJob.status} تلاش ${lastJob.attempts} زمان ${lastJob.scheduledAt.toISOString()}${lastJob.lastError ? ` خطا: ${lastJob.lastError.slice(0, 200)}` : ""}` : "هرگز"}`);
    console.log(`     آخرین لاگ: ${lastLog ? `${lastLog.status} ${lastLog.createdAt.toISOString()} ${lastLog.errorMessage?.slice(0, 200) ?? JSON.stringify(lastLog.responseData)?.slice(0, 200)}` : "هرگز"}`);
  }
}

async function dedupeTapsi() {
  const rows = await loadTapsi();

  const byOrder = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.platformOrderNo) continue; // ردیف‌های خیلی قدیمی شماره سفارش ندارند
    const list = byOrder.get(r.platformOrderNo) ?? [];
    list.push(r);
    byOrder.set(r.platformOrderNo, list);
  }

  let fixed = 0, manual = 0, retitled = 0;
  const dropped = new Set<string>();
  console.log(`\n── تکراری‌های تپسی‌شاپ ${APPLY ? "(اعمال)" : "(فقط گزارش — برای اعمال --apply بدهید)"} ──`);

  for (const [orderNo, list] of byOrder) {
    for (const poll of list) {
      for (const hook of list) {
        if (poll === hook || dropped.has(poll.id) || dropped.has(hook.id)) continue;
        if (poll.status === "CANCELLED" || hook.status === "CANCELLED") continue;
        const sameSku     = !!poll.platformOrderItemId && poll.platformOrderItemId === hook.productTitle;
        const sameMapping = !!poll.mappingId && poll.mappingId === hook.mappingId && poll.id < hook.id;
        if (!sameSku && !sameMapping) continue;

        const label = `${orderNo} «${poll.productTitle.slice(0, 50)}»`;
        if (poll.qty !== hook.qty) {
          console.log(`  ⚠ ${label}: تعداد نابرابر ${poll.qty}/${hook.qty} — دستی بررسی شود`);
          manual++;
          continue;
        }
        if (poll.status === "INVOICED" && hook.status === "INVOICED") {
          console.log(`  ⚠ ${label}: هر دو ردیف در حسابان فاکتور خورده‌اند — یکی را در حسابان ابطال کنید`);
          manual++;
          dropped.add(hook.id); // دوباره گزارش نشود
          continue;
        }

        const keep = hook.status === "INVOICED" ? hook : poll;
        const drop = keep === poll ? hook : poll;
        dropped.add(drop.id);
        fixed++;
        console.log(`  ✓ ${label}: نگه‌داشتن ${keep.platformOrderId} (${keep.status})، لغو ${drop.platformOrderId} (${drop.status})`);
        if (!APPLY) continue;

        await prisma.integOrder.update({
          where: { id: keep.id },
          data:  {
            productTitle:  poll.productTitle,
            customerName:  keep.customerName ?? hook.customerName,
            customerPhone: keep.customerPhone ?? hook.customerPhone,
          },
        });
        await prisma.integOrder.update({
          where: { id: drop.id },
          data:  { status: "CANCELLED", blockedReason: `تکراری — همان قلم ردیف ${keep.platformOrderId} است` },
        });
        await emitAccEventSafe({
          type: "SALE_VOIDED",
          aggregate: { type: "IntegOrder", id: drop.id },
          dedupeKey: `integ:${drop.id}:void`,
          payload: { integOrderId: drop.id },
        });
      }
    }
  }

  // عنوان ردیف‌های وب‌هوکی که شناسه‌ی محصول را جای عنوان دارند
  const titleBySku = new Map<string, string>();
  for (const r of rows) {
    if (r.platformOrderItemId && r.productTitle !== r.platformOrderItemId && !/^\d+$/.test(r.productTitle)) {
      titleBySku.set(r.platformOrderItemId, r.productTitle);
    }
  }
  for (const r of rows) {
    if (dropped.has(r.id) || !/^\d+$/.test(r.productTitle)) continue;
    const title = titleBySku.get(r.productTitle);
    if (!title) continue;
    retitled++;
    if (APPLY) await prisma.integOrder.update({ where: { id: r.id }, data: { productTitle: title } });
  }

  console.log(`\n  ${fixed} تکراری ${APPLY ? "لغو شد" : "پیدا شد"}، ${manual} مورد نیازمند بررسی دستی، عنوان ${retitled} ردیف ${APPLY ? "اصلاح شد" : "قابل اصلاح است"}`);
}

async function main() {
  await report();
  await dedupeTapsi();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
