import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBigInt } from "@/lib/api/json";
import { buildAssembleHash } from "@/lib/configurator/hash";

export const runtime = "nodejs";

type Body = {
  templateSlug: string;
  selections: Array<{ stepKey: string; optionId: string; qty?: number }>;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.templateSlug || !Array.isArray(body.selections) || body.selections.length === 0) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const template = await prisma.template.findFirst({
    where: { slug: body.templateSlug, isActive: true },
    include: {
      steps: { where: { isActive: true }, include: { options: { where: { isActive: true } } } },
    },
  });

  if (!template) return NextResponse.json({ message: "Template not found" }, { status: 404 });

  // validate selections: step exists + option allowed in step
  const stepByKey = new Map(template.steps.map((s) => [s.key, s]));
  for (const sel of body.selections) {
    const step = stepByKey.get(sel.stepKey);
    if (!step) return NextResponse.json({ message: `Unknown stepKey: ${sel.stepKey}` }, { status: 400 });

    const allowed = step.options.some((o) => o.componentOptionId === sel.optionId);
    if (!allowed) return NextResponse.json({ message: `Option not allowed for step ${sel.stepKey}` }, { status: 400 });
  }

  const hash = buildAssembleHash({
    templateId: template.id,
    rulesVersion: template.rulesVersion,
    selections: body.selections,
  });

  // If exists, return it (with linked product if already created)
  const existing = await prisma.assembledProduct.findFirst({
    where: { hash },
    include: { product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } } },
  });

  if (existing) {
    return NextResponse.json(jsonBigInt({ hash, assembled: existing, created: false }));
  }

  // fetch options to compute price + inventory check
  const optionIds = body.selections.map((s) => s.optionId);
  const options = await prisma.componentOption.findMany({
    where: { id: { in: optionIds }, isActive: true },
    include: { inventory: true, componentType: true },
  });

  if (options.length !== optionIds.length) {
    return NextResponse.json({ message: "Some options not found/inactive" }, { status: 400 });
  }

  // Inventory check (MVP): stockQty - reservedQty >= qty
  for (const sel of body.selections) {
    const opt = options.find((o) => o.id === sel.optionId)!;
    const qty = sel.qty ?? 1;
    const available = (opt.inventory?.stockQty ?? 0) - (opt.inventory?.reservedQty ?? 0);
    if (available < qty) {
      return NextResponse.json(
        { message: `Out of stock: ${opt.title}`, optionId: opt.id, available },
        { status: 409 }
      );
    }
  }

  // price: basePrice + sum(priceDelta * qty)
  const priceFinal = options.reduce((sum, opt) => {
    const sel = body.selections.find((s) => s.optionId === opt.id)!;
    const qty = BigInt(sel.qty ?? 1);
    return sum + opt.priceDelta * qty;
  }, template.basePrice);

  // Create assembled + components + auto Product
  const created = await prisma.$transaction(async (tx) => {
    const assembled = await tx.assembledProduct.create({
      data: {
        templateId: template.id,
        hash,
        rulesVersion: template.rulesVersion,
        priceFinal,
        titleGenerated: `${template.title} (سفارشی)`,
        components: {
          create: body.selections.map((sel) => ({
            templateStepId: stepByKey.get(sel.stepKey)!.id,
            componentOptionId: sel.optionId,
            qty: sel.qty ?? 1,
          })),
        },
      },
    });

    // ساخت محصول فروشگاهی (MVP ساده)
    const slug = `custom-${hash.slice(0, 10)}`;
    const product = await tx.product.create({
      data: {
        title: assembled.titleGenerated ?? template.title,
        slug,
        categoryId: template.defaultCategoryId ?? (await tx.category.findFirstOrThrow({})).id,
        brandId: template.defaultBrandId ?? null,
        price: priceFinal,
        salePrice: null,
        assembledProductId: assembled.id,
        shortDescription: "این محصول به‌صورت سفارشی توسط کاربر مونتاژ شده است.",
        specs: {},
        features: [],
        colors: [],
        images: {
          create: [{ url: "/products/p1.jpg", alt: "تصویر موقت", sortOrder: 1 }],
        },
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });

    return { assembled, product };
  });

  return NextResponse.json(jsonBigInt({ hash, ...created, created: true }));
}
