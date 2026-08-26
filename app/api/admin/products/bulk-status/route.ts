import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";

/**
 * تغییر گروهی وضعیت فعال/غیرفعال محصولات.
 *
 * چرا اندپوینت جدا: قبلاً ویرایش گروهی برای هر محصول یک
 * `PUT /api/admin/products/[id]` با بدنه‌ی `{isActive}` می‌فرستاد و آن مسیر
 * گالری تصاویر و مشخصات فنی را جایگزین می‌کرد. اینجا فقط یک ستون لمس می‌شود.
 */
export async function POST(req: Request) {
  const { ids, isActive } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "هیچ محصولی انتخاب نشده است" }, { status: 400 });
  }
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: { isActive },
  });

  logActivityAsync({
    action: "BULK_UPDATE",
    entity: "PRODUCT",
    entityTitle: `${result.count} محصول`,
    summary: `${result.count} محصول به‌صورت گروهی ${isActive ? "فعال" : "غیرفعال"} شد`,
    changes: [{ field: "isActive", label: "وضعیت نمایش", kind: "bool", before: !isActive, after: isActive }],
  });

  return NextResponse.json({ success: true, count: result.count });
}
