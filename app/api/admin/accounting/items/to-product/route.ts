import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { VariantError } from "@/lib/variants-admin";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import {
  addToProduct,
  applyModelGuess,
  createFromModel,
  createSimpleFromItem,
  dismissItems,
  loadSuggestions,
  planAddToProduct,
  planFromModel,
} from "@/lib/accounting/inventory/to-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — کالاهای بی‌محصول گروه‌شده با مدل، پیشنهاد مدل، و دسته/برند برای فرم (docs/plans/inventory-items.md فاز ۵) */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [data, categories, brands] = await Promise.all([
    loadSuggestions(),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true, parentId: true } }),
    prisma.brand.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return NextResponse.json(serialize({ ...data, categories, brands }));
}

const big = (v: unknown, label: string): bigint | null => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[,٬\s]/g, "");
  if (!/^\d+$/.test(s)) throw new AccError(`${label} نامعتبر است`);
  return BigInt(s);
};
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : undefined);

/**
 * POST { action, … }
 * - plan-model / create-model { modelId, title, categoryId, brandId, price, axisMap, exclude }
 * - plan-add / add { productId, itemIds? }
 * - guess { title, items: [{ id, attrs: [{ axisId, value }] }] } — ساخت مدل از پیشنهاد
 * - simple { itemId, title, categoryId, brandId, price }
 * - dismiss { itemIds } — «فروش آنلاین ندارد»
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await req.json();
    const action = String(b.action ?? "");
    // ساختن یا تغییر محصول سایت مجوز محصولات را هم می‌خواهد
    if (["create-model", "add", "simple"].includes(action)) {
      const cat = await requirePermission("PANEL_CATALOG");
      if (!cat.ok) return NextResponse.json({ error: "ساخت محصول دسترسی «محصولات» می‌خواهد" }, { status: 403 });
    }
    const modelInput = () => ({
      modelId: String(b.modelId ?? ""),
      title: b.title ? String(b.title) : null,
      categoryId: b.categoryId ? String(b.categoryId) : null,
      brandId: b.brandId ? String(b.brandId) : null,
      price: big(b.price, "قیمت"),
      axisMap: b.axisMap && typeof b.axisMap === "object" ? (Object.fromEntries(Object.entries(b.axisMap).map(([k, v]) => [k, String(v ?? "")]).filter(([, v]) => v)) as Record<string, string>) : undefined,
      exclude: ids(b.exclude),
    });

    switch (action) {
      case "plan-model":
        return NextResponse.json(serialize(await planFromModel(prisma, modelInput())));
      case "create-model": {
        const r = await prisma.$transaction((tx) => createFromModel(tx, modelInput()), { timeout: 60_000 });
        logActivityAsync({
          action: "CREATE",
          entity: "PRODUCT",
          entityId: r.product.id,
          entityTitle: r.product.title,
          summary: `محصول «${r.product.title}» با ${r.variants} تنوع از کالاهای انبار ساخته شد (پیش‌نویس)`,
        });
        return NextResponse.json(serialize({ ok: true, ...r }));
      }
      case "plan-add":
        return NextResponse.json(serialize(await planAddToProduct(prisma, String(b.productId ?? ""), ids(b.itemIds))));
      case "add": {
        const r = await prisma.$transaction((tx) => addToProduct(tx, String(b.productId ?? ""), ids(b.itemIds)), { timeout: 60_000 });
        logActivityAsync({
          action: "UPDATE",
          entity: "PRODUCT",
          entityId: r.product.id,
          entityTitle: r.product.title,
          summary: `${r.added} تنوع از کالاهای انبار به «${r.product.title}» اضافه شد`,
        });
        return NextResponse.json(serialize({ ok: true, ...r }));
      }
      case "guess": {
        const m = await prisma.$transaction((tx) => applyModelGuess(tx, { title: b.title, items: Array.isArray(b.items) ? b.items : [] }));
        return NextResponse.json(serialize({ ok: true, model: { id: m.id, title: m.title } }));
      }
      case "simple": {
        const r = await prisma.$transaction((tx) =>
          createSimpleFromItem(tx, String(b.itemId ?? ""), {
            title: b.title ? String(b.title) : null,
            categoryId: b.categoryId ? String(b.categoryId) : null,
            brandId: b.brandId ? String(b.brandId) : null,
            price: big(b.price, "قیمت"),
          }),
        );
        logActivityAsync({ action: "CREATE", entity: "PRODUCT", entityId: r.product.id, entityTitle: r.product.title, summary: `محصول «${r.product.title}» از کالای انبار ساخته شد (پیش‌نویس)` });
        return NextResponse.json(serialize({ ok: true, ...r }));
      }
      case "dismiss": {
        const n = await prisma.$transaction((tx) => dismissItems(tx, ids(b.itemIds) ?? []));
        return NextResponse.json({ ok: true, count: n });
      }
      default:
        return NextResponse.json({ error: "کار نامعتبر" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof VariantError) return NextResponse.json({ error: e.message }, { status: 400 });
    return accErrorResponse(e, "[to-product]");
  }
}
