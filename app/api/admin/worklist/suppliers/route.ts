import { NextResponse } from "next/server";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { createSupplier, listSuppliers } from "@/lib/worklist/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فهرست تأمین‌کننده‌ها.
 *
 * هرکس کار ثبت می‌کند باید بتواند انتخاب کند، پس `WORK_CREATE` هم کافی است.
 * غیرفعال‌ها فقط برای کسی که `SUPPLIER_MANAGE` دارد و `all=1` می‌خواهد.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["SUPPLIER_VIEW", "SUPPLIER_CREATE", "SUPPLIER_MANAGE", "WORK_CREATE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const sp = new URL(req.url).searchParams;
  const canManage = can(guard.access, "SUPPLIER_MANAGE");
  const suppliers = await listSuppliers({
    q: sp.get("q"),
    includeInactive: canManage && sp.get("all") === "1",
    take: Math.min(Number(sp.get("take")) || 200, 500),
  });

  return NextResponse.json({
    suppliers,
    can: { create: can(guard.access, "SUPPLIER_CREATE") || canManage, manage: canManage },
  });
}

export async function POST(req: Request) {
  const guard = await requirePermission(["SUPPLIER_CREATE", "SUPPLIER_MANAGE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const { supplier, existed } = await createSupplier(body ?? {}, guard.access);
    if (!existed) {
      logActivityAsync({
        action: "CREATE",
        entity: "OTHER",
        entityId: supplier.id,
        entityTitle: supplier.name,
        summary: `ثبت تأمین‌کننده «${supplier.name}»`,
      });
    }
    return NextResponse.json({ supplier, existed }, { status: existed ? 200 : 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
