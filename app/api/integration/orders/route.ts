import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { IntegOrderStatus, Prisma } from "@prisma/client";
import { serialize } from "@/lib/serialize";
import { processPendingInvoices } from "@/lib/integration/core/invoicing";

export const dynamic = "force-dynamic";

const VALID_STATUS: IntegOrderStatus[] = ["PENDING", "NEEDS_MAPPING", "INVOICED", "CANCELLED"];

// GET /api/integration/orders?status=NEEDS_MAPPING&platform=basalam&q=...&take=100
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const status   = sp.get("status");
  const platform = sp.get("platform");
  const q        = sp.get("q")?.trim();
  const take     = Math.min(Number(sp.get("take")) || 100, 300);

  const where: Prisma.IntegOrderWhereInput = {};
  if (status && VALID_STATUS.includes(status as IntegOrderStatus)) {
    where.status = status as IntegOrderStatus;
  }
  if (platform) where.platformCode = platform;
  if (q) {
    where.OR = [
      { productTitle:    { contains: q, mode: "insensitive" } },
      { customerName:    { contains: q, mode: "insensitive" } },
      { customerPhone:   { contains: q } },
      { platformOrderNo: { contains: q } },
      { platformOrderId: { contains: q } },
    ];
  }

  const [rows, counts, hesaban] = await Promise.all([
    prisma.integOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        mapping: {
          select: { id: true, links: { select: { platformCode: true, externalId: true, externalTitle: true } } },
        },
      },
    }),
    prisma.integOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.integConnection.findFirst({
      where:  { platformCode: "hesaban" },
      select: { config: true },
    }),
  ]);

  // تنظیمات فاکتور را هم می‌فرستیم تا صفحه بتواند ردیف‌هایی که خودکار فاکتور
  // نمی‌شوند (قدیمی‌تر از تاریخ فعال‌سازی) را از بقیه‌ی PENDINGها تفکیک کند
  const cfg = (hesaban?.config ?? {}) as {
    autoInvoiceEnabled?: boolean;
    autoInvoiceSince?: string;
    invoiceMode?: string;
  };

  return NextResponse.json(
    serialize({
      rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      invoiceSettings: {
        enabled: !!cfg.autoInvoiceEnabled,
        mode:    cfg.invoiceMode === "MANUAL" ? "MANUAL" : "AUTO",
        since:   cfg.autoInvoiceSince ?? null,
      },
    }),
  );
}

// PATCH /api/integration/orders — اقدام روی ردیف‌های سفارش
// action=retry   → ردیف NEEDS_MAPPING را دوباره PENDING می‌کند تا worker فاکتور بزند
// action=cancel  → ردیف را لغو می‌کند (دیگر فاکتور نمی‌خورد)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as { ids?: string[]; action?: string } | null;
  const ids    = body?.ids ?? [];
  const action = body?.action;

  if (!ids.length) return NextResponse.json({ error: "شناسه‌ای ارسال نشده" }, { status: 400 });

  if (action === "retry") {
    // فقط ردیف‌هایی که هنوز فاکتور نخورده‌اند؛ ردیف INVOICED نباید دوباره ارسال شود
    const rows = await prisma.integOrder.findMany({
      where:  { id: { in: ids }, status: { in: ["NEEDS_MAPPING", "CANCELLED"] } },
      select: { id: true, mappingId: true, platformCode: true },
    });

    // بدون نگاشت، تلاش دوباره باز هم شکست می‌خورد — همان‌جا به کاربر گفته می‌شود
    const stillUnmapped: string[] = [];
    const ready: string[] = [];
    for (const r of rows) {
      if (!r.mappingId) { stillUnmapped.push(r.id); continue; }
      const hesabanLink = await prisma.integMappingLink.findUnique({
        where:  { mappingId_platformCode: { mappingId: r.mappingId, platformCode: "hesaban" } },
        select: { isActive: true },
      });
      if (hesabanLink?.isActive) ready.push(r.id);
      else stillUnmapped.push(r.id);
    }

    if (ready.length) {
      await prisma.integOrder.updateMany({
        where: { id: { in: ready } },
        data:  { status: "PENDING", blockedReason: null },
      });
    }

    return NextResponse.json({
      requeued: ready.length,
      blocked:  stillUnmapped.length,
      message: stillUnmapped.length
        ? `${ready.length} ردیف در صف فاکتور قرار گرفت — ${stillUnmapped.length} ردیف هنوز نگاشت حسابداری ندارد`
        : `${ready.length} ردیف در صف فاکتور قرار گرفت`,
    });
  }

  // ثبت فاکتور فوری برای ردیف‌های انتخاب‌شده — در هر دو حالت خودکار و دستی کار می‌کند
  if (action === "invoice") {
    const rows = await prisma.integOrder.findMany({
      where:  { id: { in: ids }, status: { in: ["PENDING", "NEEDS_MAPPING"] } },
      select: { id: true, mappingId: true },
    });

    const ready: string[] = [];
    const blocked: string[] = [];
    for (const r of rows) {
      if (!r.mappingId) { blocked.push(r.id); continue; }
      const hesabanLink = await prisma.integMappingLink.findUnique({
        where:  { mappingId_platformCode: { mappingId: r.mappingId, platformCode: "hesaban" } },
        select: { isActive: true },
      });
      if (hesabanLink?.isActive) ready.push(r.id); else blocked.push(r.id);
    }

    if (!ready.length) {
      return NextResponse.json({
        invoiced: 0,
        message: "هیچ‌کدام از ردیف‌های انتخاب‌شده نگاشت حسابداری فعال ندارند — اول محصول را نگاشت کنید",
      });
    }

    const result = await processPendingInvoices(ready);
    return NextResponse.json({
      invoiced: result.invoiced,
      message: result.skipped
        ? result.skipped
        : `${result.invoiced} قلم فاکتور شد` +
          (blocked.length ? ` — ${blocked.length} ردیف بدون نگاشت حسابداری کنار گذاشته شد` : ""),
    });
  }

  if (action === "cancel") {
    const res = await prisma.integOrder.updateMany({
      where: { id: { in: ids }, status: { in: ["PENDING", "NEEDS_MAPPING"] } },
      data:  { status: "CANCELLED", blockedReason: "توسط ادمین لغو شد" },
    });
    return NextResponse.json({ cancelled: res.count, message: `${res.count} ردیف لغو شد` });
  }

  return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
}
