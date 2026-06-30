import { prisma } from "@/lib/prisma";
import type { PriceRuleContext, PriceUpdate } from "@/lib/integration/types";

// ── انواع node در فرمول JSON ──────────────────────────────────────────

export type FormulaNode =
  | { type: "var";   name: keyof PriceRuleContext }
  | { type: "const"; value: number }
  | { type: "add";      args: [FormulaNode, FormulaNode] }
  | { type: "subtract"; args: [FormulaNode, FormulaNode] }
  | { type: "multiply"; args: [FormulaNode, FormulaNode] }
  | { type: "divide";   args: [FormulaNode, FormulaNode] }
  | { type: "max";      args: [FormulaNode, FormulaNode] }
  | { type: "min";      args: [FormulaNode, FormulaNode] }
  | { type: "percent_of"; percent: number; of: FormulaNode }
  | { type: "round_up";   to: number; arg: FormulaNode }
  | { type: "if"; condition: ConditionNode; then: FormulaNode; else: FormulaNode };

export type ConditionNode =
  | { type: "lt" | "gt" | "eq" | "lte" | "gte"; args: [FormulaNode, FormulaNode] }
  | { type: "and" | "or"; args: [ConditionNode, ConditionNode] };

// ── ارزیاب فرمول (pure function) ──────────────────────────────────────

export function evaluateFormula(node: FormulaNode, ctx: PriceRuleContext): number {
  switch (node.type) {
    case "var":
      return (ctx[node.name] as number) ?? 0;
    case "const":
      return node.value;
    case "add":
      return evaluateFormula(node.args[0], ctx) + evaluateFormula(node.args[1], ctx);
    case "subtract":
      return evaluateFormula(node.args[0], ctx) - evaluateFormula(node.args[1], ctx);
    case "multiply":
      return evaluateFormula(node.args[0], ctx) * evaluateFormula(node.args[1], ctx);
    case "divide": {
      const d = evaluateFormula(node.args[1], ctx);
      return d === 0 ? 0 : evaluateFormula(node.args[0], ctx) / d;
    }
    case "max":
      return Math.max(evaluateFormula(node.args[0], ctx), evaluateFormula(node.args[1], ctx));
    case "min":
      return Math.min(evaluateFormula(node.args[0], ctx), evaluateFormula(node.args[1], ctx));
    case "percent_of":
      return (node.percent / 100) * evaluateFormula(node.of, ctx);
    case "round_up": {
      const v = evaluateFormula(node.arg, ctx);
      return node.to <= 0 ? v : Math.ceil(v / node.to) * node.to;
    }
    case "if":
      return evaluateFormula(
        evaluateCondition(node.condition, ctx) ? node.then : node.else,
        ctx,
      );
    default:
      throw new Error(`نوع node ناشناخته: ${(node as { type: string }).type}`);
  }
}

function evaluateCondition(node: ConditionNode, ctx: PriceRuleContext): boolean {
  const L = (n: FormulaNode) => evaluateFormula(n, ctx);
  switch (node.type) {
    case "lt":  return L(node.args[0]) <  L(node.args[1]);
    case "gt":  return L(node.args[0]) >  L(node.args[1]);
    case "lte": return L(node.args[0]) <= L(node.args[1]);
    case "gte": return L(node.args[0]) >= L(node.args[1]);
    case "eq":  return L(node.args[0]) === L(node.args[1]);
    case "and": return evaluateCondition(node.args[0], ctx) && evaluateCondition(node.args[1], ctx);
    case "or":  return evaluateCondition(node.args[0], ctx) || evaluateCondition(node.args[1], ctx);
    default:
      throw new Error(`نوع condition ناشناخته: ${(node as { type: string }).type}`);
  }
}

// ── اعمال قوانین قیمت (استفاده در worker) ────────────────────────────

interface PriceItem {
  shopProductId:     string;
  platformProductId: string;
  price:             number;  // قیمت فروشگاه (ریال)
  salePrice?:        number;  // قیمت تخفیف‌خورده
  stock:             number;
  lastPurchasePrice?: number; // از meta در mapping ذخیره‌شده
}

export async function applyRulesToPrices(
  platformCode: string,
  items: PriceItem[],
): Promise<PriceUpdate[]> {
  const rules = await prisma.integPriceRule.findMany({
    where:   { isActive: true },
    orderBy: { priority: "asc" },
  });

  // فیلتر قوانین مخصوص این پلتفرم
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
    const ctx: PriceRuleContext = {
      last_purchase_price: item.lastPurchasePrice ?? item.price,
      avg_purchase_price:  item.lastPurchasePrice ?? item.price,
      shop_price:          item.price,
      current_stock:       item.stock,
      shipping_cost:       0,
      packaging_cost:      0,
    };

    // اجرای اولین قانون قابل‌اعمال (بر اساس اولویت)
    for (const rule of applicable) {
      try {
        const node = rule.formula as unknown as FormulaNode;
        const raw  = evaluateFormula(node, ctx);
        const finalPrice = Math.max(1, Math.round(raw));
        return {
          platformProductId: item.platformProductId,
          price:             finalPrice,
        };
      } catch {
        // اگر فرمول خطا داشت، قانون بعدی را امتحان کن
        continue;
      }
    }

    // هیچ قانونی اعمال نشد — قیمت اصلی
    return {
      platformProductId: item.platformProductId,
      price:             item.price,
      salePrice:         item.salePrice,
    };
  });
}

// ── template‌های آماده برای ساخت سریع قانون ─────────────────────────

export const RULE_TEMPLATES: {
  key:         string;
  label:       string;
  description: string;
  formula:     FormulaNode;
}[] = [
  {
    key:         "shop_as_is",
    label:       "قیمت فروشگاه — بدون تغییر",
    description: "قیمت پلتفرم = قیمت فروشگاه",
    formula:     { type: "var", name: "shop_price" },
  },
  {
    key:         "cost_plus_30",
    label:       "قیمت خرید + ۳۰٪",
    description: "قیمت پلتفرم = آخرین قیمت خرید × ۱.۳، گرد شده به ۱۰۰۰ ریال",
    formula: {
      type: "round_up", to: 1000,
      arg: {
        type: "multiply",
        args: [{ type: "var", name: "last_purchase_price" }, { type: "const", value: 1.30 }],
      },
    },
  },
  {
    key:         "shop_plus_5_percent",
    label:       "قیمت فروشگاه + ۵٪",
    description: "قیمت پلتفرم = قیمت فروشگاه × ۱.۰۵، گرد شده به ۱۰۰۰ ریال",
    formula: {
      type: "round_up", to: 1000,
      arg: {
        type: "multiply",
        args: [{ type: "var", name: "shop_price" }, { type: "const", value: 1.05 }],
      },
    },
  },
  {
    key:         "fixed_margin_20",
    label:       "حداقل سود ۲۰٪ (بیشتر از قیمت فروشگاه)",
    description: "قیمت پلتفرم = max(قیمت فروشگاه، قیمت خرید × ۱.۲)، گرد شده به ۱۰۰۰",
    formula: {
      type: "round_up", to: 1000,
      arg: {
        type: "max",
        args: [
          { type: "var", name: "shop_price" },
          {
            type: "multiply",
            args: [{ type: "var", name: "last_purchase_price" }, { type: "const", value: 1.20 }],
          },
        ],
      },
    },
  },
  {
    key:         "dynamic_stock",
    label:       "قیمت پویا بر اساس موجودی",
    description: "موجودی < ۵: قیمت خرید × ۱.۵ / موجودی ≥ ۵: قیمت خرید × ۱.۲۵",
    formula: {
      type: "if",
      condition: {
        type: "lt",
        args: [
          { type: "var", name: "current_stock" },
          { type: "const", value: 5 },
        ],
      },
      then: {
        type: "round_up", to: 1000,
        arg: {
          type: "multiply",
          args: [{ type: "var", name: "last_purchase_price" }, { type: "const", value: 1.50 }],
        },
      },
      else: {
        type: "round_up", to: 1000,
        arg: {
          type: "multiply",
          args: [{ type: "var", name: "last_purchase_price" }, { type: "const", value: 1.25 }],
        },
      },
    },
  },
];
