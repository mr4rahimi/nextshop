// فقط سرور — این فایل Prisma ایمپورت می‌کند
import { prisma } from "@/lib/prisma";
import type { PriceUpdate } from "@/lib/integration/types";
import { evaluateFormula, type FormulaNode } from "./formula";

// re-export برای سازگاری با کد قبلی
export { evaluateFormula, RULE_TEMPLATES } from "./formula";
export type { FormulaNode, ConditionNode } from "./formula";

// ── اعمال قوانین قیمت (فقط در worker — سرور) ────────────────────────

interface PriceItem {
  shopProductId:      string;
  platformProductId:  string;
  price:              number;
  salePrice?:         number;
  stock:              number;
  lastPurchasePrice?: number;
}

export async function applyRulesToPrices(
  platformCode: string,
  items: PriceItem[],
): Promise<PriceUpdate[]> {
  const rules = await prisma.integPriceRule.findMany({
    where:   { isActive: true },
    orderBy: { priority: "asc" },
  });

  const applicable = rules.filter(
    (r) => r.targetPlatforms.length === 0 || r.targetPlatforms.includes(platformCode),
  );

  if (applicable.length === 0) {
    return items.map((i) => ({
      platformProductId: i.platformProductId,
      price:             i.price,
      salePrice:         i.salePrice,
    }));
  }

  return items.map((item) => {
    const ctx = {
      last_purchase_price: item.lastPurchasePrice ?? item.price,
      avg_purchase_price:  item.lastPurchasePrice ?? item.price,
      shop_price:          item.price,
      current_stock:       item.stock,
      shipping_cost:       0,
      packaging_cost:      0,
    };

    for (const rule of applicable) {
      try {
        const raw = evaluateFormula(rule.formula as unknown as FormulaNode, ctx);
        return {
          platformProductId: item.platformProductId,
          price:             Math.max(1, Math.round(raw)),
        };
      } catch {
        continue;
      }
    }

    return {
      platformProductId: item.platformProductId,
      price:             item.price,
      salePrice:         item.salePrice,
    };
  });
}
