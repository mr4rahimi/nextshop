import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { loadVariantAdmin, saveVariants, VariantError, type VariantsInput } from "@/lib/variants-admin";
import { effectivePrice, variantsEnabled } from "@/lib/variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — تنوع‌ها، محورها، عکس‌ها، ویژگی‌های فروشگاه (docs/plans/inventory-items.md فاز ۴) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // `?brief=1` — فقط تنوع‌های فعال با قیمت مؤثر، برای سفارش تلفنی
  if (new URL(req.url).searchParams.get("brief")) {
    const enabled = await variantsEnabled();
    const product = await prisma.product.findUnique({ where: { id }, select: { price: true, salePrice: true } });
    const vs = enabled && product ? await prisma.productVariant.findMany({ where: { productId: id, isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }) : [];
    return NextResponse.json(
      serialize({
        enabled,
        variants: vs.map((v) => {
          const e = effectivePrice(product!, v);
          return { id: v.id, title: v.title, price: e.salePrice ?? e.price, stock: v.stock };
        }),
      }),
    );
  }
  const data = await loadVariantAdmin(id);
  if (!data.product) return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
  return NextResponse.json(serialize({ ...data, enabled: await variantsEnabled() }));
}

const big = (v: unknown, label: string): bigint | null => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) throw new VariantError(`${label} نامعتبر است`);
  return BigInt(s);
};

/** PUT { axes, variants, images } — کل فهرست تنوع‌ها */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const b = await req.json();
    const input: VariantsInput = {
      axes: (Array.isArray(b.axes) ? b.axes : []).map((a: { attributeId: string; display?: string }) => ({ attributeId: String(a.attributeId), display: a.display })),
      variants: (Array.isArray(b.variants) ? b.variants : []).map((v: Record<string, unknown>) => ({
        options: (v.options ?? {}) as Record<string, string>,
        price: big(v.price, "قیمت"),
        salePrice: big(v.salePrice, "قیمت ویژه"),
        stock: Number(v.stock ?? 0),
        sku: v.sku ? String(v.sku) : null,
        accItemId: v.accItemId ? String(v.accItemId) : null,
        isActive: v.isActive !== false,
      })),
      images: Array.isArray(b.images) ? b.images.map((i: { imageId: string; attributeValueId: string | null }) => ({ imageId: String(i.imageId), attributeValueId: i.attributeValueId || null })) : undefined,
    };
    await prisma.$transaction((tx) => saveVariants(tx, id, input), { timeout: 60_000 });
    const data = await loadVariantAdmin(id);
    return NextResponse.json(serialize({ ok: true, ...data, enabled: await variantsEnabled() }));
  } catch (e) {
    if (e instanceof VariantError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[variants]", e);
    return NextResponse.json({ error: "ذخیره نشد" }, { status: 500 });
  }
}
