import { prisma } from "@/lib/prisma";
import { decrementMappingStockForOrder } from "@/lib/integration/core/inventory";
import { emitAccEventSafe } from "@/lib/accounting/events";

// کسر موجودی سایت + موجودی نگاشت برای اقلام یک سفارش.
// باید فقط «یک بار» و در گذار سفارش به وضعیت پرداخت‌شده صدا زده شود.
//
// همین لحظه «خروج کالا» است و فاکتور فروش حسابداری داخلی همین‌جا صادر می‌شود
// (docs/plans/accounting.md بخش ۵ و تله‌ی ۴). کاردکس فاکتور `Product.stock` را
// دوباره کم نمی‌کند — کسر همین تابع کافی است (تله‌ی ۱۵).
export async function deductStockForOrderItems(
  items: { productId: string; qty: number }[],
  orderId: string,
): Promise<void> {
  await emitAccEventSafe({
    type: "SALE_ISSUED",
    aggregate: { type: "Order", id: orderId },
    dedupeKey: `order:${orderId}:sale`,
    payload: { orderId },
  });

  await Promise.all(
    items.map((item) =>
      prisma.product.updateMany({
        where: { id: item.productId, trackStock: true, stock: { gt: 0 } },
        data:  { stock: { decrement: item.qty } },
      }),
    ),
  );

  // Integration Hub: کسر موجودی نگاشت + push به همه پلتفرم‌ها (به‌جز مبدأ و حسابداری)
  await Promise.all(
    items.map((item) =>
      decrementMappingStockForOrder("shop", item.productId, item.qty).catch(() => {}),
    ),
  ).catch(() => {});
}
