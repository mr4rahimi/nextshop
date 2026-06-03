import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBigInt } from "@/lib/api/json";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const template = await prisma.template.findFirst({
    where: { slug, isActive: true },
    include: {
      steps: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          componentType: true,
          options: {
            where: { isActive: true },
            include: {
              option: {
                include: { inventory: true },
              },
            },
          },
        },
      },
    },
  });

  if (!template) return NextResponse.json({ message: "Template not found" }, { status: 404 });

  return NextResponse.json(
    jsonBigInt({
      id: template.id,
      title: template.title,
      slug: template.slug,
      basePrice: template.basePrice,
      rulesVersion: template.rulesVersion,
      steps: template.steps.map((s) => ({
        id: s.id,
        key: s.key,
        title: s.title,
        sortOrder: s.sortOrder,
        isRequired: s.isRequired,
        selectionMode: s.selectionMode,
        scope: s.scope,
        componentType: {
          id: s.componentType.id,
          code: s.componentType.code,
          title: s.componentType.title,
        },
        options: s.options.map((so) => ({
          id: so.option.id,
          title: so.option.title,
          slug: so.option.slug,
          imageUrl: so.option.imageUrl,
          priceDelta: so.option.priceDelta,
          meta: so.option.meta,
          stockQty: so.option.inventory?.stockQty ?? 0,
          reservedQty: so.option.inventory?.reservedQty ?? 0,
        })),
      })),
    })
  );
}
