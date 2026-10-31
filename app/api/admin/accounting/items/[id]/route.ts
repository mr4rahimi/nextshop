import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { updateItem } from "@/lib/accounting/inventory/items";
import { onlinePricesOf, onlineRule } from "@/lib/accounting/inventory/online-price";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseItemInput } from "../parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — مشخصات کالا با بارکدها و کدهای قبلی */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const item = await prisma.accItem.findUnique({
    where: { id },
    include: {
      barcodes: { orderBy: { barcode: "asc" } },
      aliases: { orderBy: { createdAt: "desc" } },
      model: { select: { id: true, title: true } },
      attrs: { include: { axis: { select: { name: true, sortOrder: true } }, value: { select: { value: true } } } },
    },
  });
  if (!item) return NextResponse.json({ error: "کالا پیدا نشد" }, { status: 404 });
  const [product, rule] = await Promise.all([prisma.product.findUnique({ where: { id }, select: { id: true, title: true, slug: true } }), onlineRule()]);
  // قیمت آنلاین (۲.۹۶.۰): کلید روشن ← قیمت فروشگاه برای همه‌ی کالاها و قیمت آنلاین ساخته‌شده
  const o = rule.enabled ? (await onlinePricesOf(prisma, [id], rule)).get(id) ?? null : null;
  const online = rule.enabled ? { enabled: true, price: o?.price ?? null, pctBp: o?.pctBp ?? rule.pctBp, source: o?.source ?? null, manual: !!o?.manual } : { enabled: false };
  return NextResponse.json(serialize({ item, product, online, can: { manage: can(guard.access, "ACC_INVENTORY") } }));
}

/** PATCH — ویرایش؛ کد عوض‌شده در «کدهای قبلی» می‌ماند */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const input = parseItemInput(await readJson(req));
    const item = await prisma.$transaction((tx) => updateItem(tx, id, input, actorOf(guard.access)));
    return NextResponse.json(serialize({ ok: true, item }));
  } catch (e) {
    return accErrorResponse(e, "[acc-item]");
  }
}
