import { NextResponse } from "next/server";
import { requirePermission, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivityAsync } from "@/lib/activity";
import { assignOwner, ownershipScope, setCategory } from "@/lib/club/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * عملیات گروهی روی اعضای انتخاب‌شده: تعیین صاحب یا دسته.
 *
 * `{ profileIds, ownerId?, categoryId?, reason? }` — `ownerId: null` یعنی بی‌صاحب.
 * ⚠️ شناسه‌های بیرون از مرز دسترسی کاربر بی‌صدا کنار گذاشته می‌شوند.
 */
export async function POST(req: Request) {
  const guard = await requirePermission(["CUSTOMER_ASSIGN", "CUSTOMER_EDIT"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { access } = guard;

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.profileIds) ? body.profileIds : [];
  const ids = raw.filter((x): x is string => typeof x === "string").slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ error: "عضوی انتخاب نشده است" }, { status: 400 });

  const scope = ownershipScope(access);
  const allowed = (
    await prisma.clubProfile.findMany({
      where: { AND: [{ id: { in: ids } }, scope ?? {}] },
      select: { id: true },
    })
  ).map((p) => p.id);
  if (allowed.length === 0) return NextResponse.json({ error: "عضوی پیدا نشد" }, { status: 404 });

  const result: { owners?: number; categories?: number } = {};
  try {
    if (body.ownerId !== undefined) {
      if (!can(access, "CUSTOMER_ASSIGN")) {
        return NextResponse.json({ error: "اجازه‌ی جابه‌جایی صاحب مشتری را ندارید" }, { status: 403 });
      }
      result.owners = (await assignOwner(allowed, body.ownerId || null, access, body.reason)).changed;
    }
    if (body.categoryId !== undefined) {
      if (!can(access, "CUSTOMER_EDIT")) {
        return NextResponse.json({ error: "اجازه‌ی ویرایش مشتری را ندارید" }, { status: 403 });
      }
      result.categories = await setCategory(allowed, body.categoryId || null);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "USER",
    summary:
      `عملیات گروهی روی ${allowed.length} عضو باشگاه` +
      (result.owners !== undefined ? ` · تغییر صاحب ${result.owners}` : "") +
      (result.categories !== undefined ? ` · تغییر دسته ${result.categories}` : ""),
  });

  return NextResponse.json({ ok: true, count: allowed.length, ...result });
}
