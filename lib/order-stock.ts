import { prisma } from "@/lib/prisma";
import { decrementMappingStockForOrder } from "@/lib/integration/core/inventory";

// کسر موجودی سایت + موجودی نگاشت برای اقلام یک سفارش.
// باید فقط «یک بار» و در گذار سفارش به وضعیت پرداخت‌شده صدا زده شود.
export async function deductStockForOrderItems(
  items: { productId: string; qty: number }[],
): Promise<void> {
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
