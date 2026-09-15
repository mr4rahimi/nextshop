import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { updateSupplier } from "@/lib/worklist/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ویرایش یا غیرفعال‌کردن تأمین‌کننده.
 *
 * DELETE ندارد: کارها و معامله‌های قدیمی به آن ارجاع دارند (تله‌ی ۹، همان
 * قاعده‌ی نوع کار).
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("SUPPLIER_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  try {
    const body = await req.json();
    const supplier = await updateSupplier(id, body ?? {});
    logActivityAsync({
      action: "UPDATE",
      entity: "OTHER",
      entityId: supplier.id,
      entityTitle: supplier.name,
      summary: `ویرایش تأمین‌کننده «${supplier.name}»${supplier.isActive ? "" : " (غیرفعال)"}`,
    });
    return NextResponse.json({ supplier });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
