import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { linkCandidates, linkItemToProduct, planLink } from "@/lib/accounting/inventory/link-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * وصل کردن کالای حسابداری به محصول سادهٔ موجود — lib/accounting/inventory/link-product.ts
 *
 * GET ?q=&page=&matched=1          کالاهای بی‌محصول با پیشنهاد محصول هم‌کد/هم‌بارکد/هم‌نام
 * GET ?productId=&itemId=          پیش‌نمایش (بی‌نوشتن)
 * POST { productId, itemId }       ادغام
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const productId = sp.get("productId");
    const itemId = sp.get("itemId");
    if (productId || itemId) return NextResponse.json(serialize(await planLink(prisma, productId ?? "", itemId ?? "")));
    const r = await linkCandidates(prisma, {
      q: sp.get("q"),
      page: Number(sp.get("page") ?? 1),
      perPage: Number(sp.get("perPage") ?? 30),
      onlyMatched: sp.get("matched") === "1",
    });
    return NextResponse.json(serialize(r));
  } catch (e) {
    return accErrorResponse(e, "[items/link]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ productId?: string; itemId?: string }>(req);
    const plan = await prisma.$transaction(
      (tx) => linkItemToProduct(tx, String(b.productId ?? ""), String(b.itemId ?? ""), actorOf(guard.access)),
      { timeout: 120_000 },
    );
    logActivityAsync({
      action: "UPDATE",
      entity: "PRODUCT",
      entityId: plan.product.id,
      entityTitle: plan.product.title,
      summary: `کالای حسابداری «${plan.item.title}» (${plan.item.code}) به محصول «${plan.product.title}» وصل شد`,
    });
    return NextResponse.json(serialize({ ok: true, mode: plan.mode }));
  } catch (e) {
    return accErrorResponse(e, "[items/link]");
  }
}
