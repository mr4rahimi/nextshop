import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  changeNeedsPurge,
  normalizePath,
  normalizeDestination,
  validateRule,
  type RedirectMatch,
} from "@/lib/redirects";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const onlyInactive = url.searchParams.get("inactive") === "1";

  const where = {
    ...(q
      ? {
          OR: [
            { source: { contains: q, mode: "insensitive" as const } },
            { destination: { contains: q, mode: "insensitive" as const } },
            { note: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(onlyInactive ? { isActive: false } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.redirect.findMany({
      where,
      orderBy: [{ hits: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.redirect.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE });
}

/** ساخت یک قاعده، یا ورود دسته‌ای وقتی بدنه آرایه باشد. */
export async function POST(req: Request) {
  const body = await req.json();

  if (Array.isArray(body?.items)) return bulkImport(body.items, body.mode);

  const rule = shape(body);
  const errors = validateRule(rule);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const existing = await prisma.redirect.findUnique({ where: { source: rule.source } });
  if (existing) {
    return NextResponse.json(
      { errors: [{ field: "source", message: "برای این مبدأ قبلاً قاعده‌ای ثبت شده" }] },
      { status: 409 },
    );
  }

  const created = await prisma.redirect.create({
    data: { ...rule, note: body.note?.trim() || null, isActive: body.isActive !== false },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  if (!body?.id) return NextResponse.json({ error: "id لازم است" }, { status: 400 });

  const rule = shape(body);
  const errors = validateRule(rule);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const clash = await prisma.redirect.findUnique({ where: { source: rule.source } });
  if (clash && clash.id !== body.id) {
    return NextResponse.json(
      { errors: [{ field: "source", message: "این مبدأ به قاعده‌ی دیگری تعلق دارد" }] },
      { status: 409 },
    );
  }

  const before = await prisma.redirect.findUnique({ where: { id: body.id } });
  const updated = await prisma.redirect.update({
    where: { id: body.id },
    data: { ...rule, note: body.note?.trim() || null, isActive: body.isActive !== false },
  });
  if (before && changeNeedsPurge(before, updated)) await markPurge();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id لازم است" }, { status: 400 });
  const deleted = await prisma.redirect.delete({ where: { id } });
  if (changeNeedsPurge(deleted, null)) await markPurge();
  return NextResponse.json({ ok: true });
}

/**
 * ریدایرکت دائمی در مرورگر مشتری‌ها کش شده؛ حذف یا تغییرش باید به آن‌ها هم
 * برسد. زمان تغییر ثبت می‌شود و proxy تا ۳۰ روز به هر مرورگر یک بار
 * Clear-Site-Data می‌فرستد — docs/features/redirects.md بخش «کش مرورگر»
 */
async function markPurge() {
  const now = new Date();
  await prisma.storeSettings
    .upsert({
      where: { id: "singleton" },
      update: { redirectCachePurgeAt: now },
      create: { id: "singleton", redirectCachePurgeAt: now },
    })
    .catch(() => {});
}

function shape(body: {
  source?: string;
  destination?: string;
  statusCode?: number | string;
  matchType?: string;
}) {
  const matchType = (body.matchType || "EXACT") as RedirectMatch;
  return {
    // مبدأ regex نباید نرمال شود — الگو باید دست‌نخورده بماند
    source: matchType === "REGEX" ? (body.source || "").trim() : normalizePath(body.source || ""),
    destination: normalizeDestination(body.destination || ""),
    statusCode: Number(body.statusCode) || 301,
    matchType,
  };
}

/**
 * ورود دسته‌ای.
 *
 * `mode` تعیین می‌کند با مبدأهای تکراری چه شود:
 *   skip     (پیش‌فرض) — رد می‌شود و در گزارش می‌آید
 *   overwrite — قاعده‌ی موجود به‌روز می‌شود
 *
 * عمداً در یک تراکنش نیست: در فایل‌های چندهزارتایی یک ردیف خراب نباید کل
 * ورود را برگرداند. به‌جایش هر ردیف جدا پردازش و گزارش می‌شود.
 */
async function bulkImport(
  items: Array<{ source?: string; destination?: string; statusCode?: number; matchType?: string; note?: string }>,
  mode: string,
) {
  const overwrite = mode === "overwrite";
  const report = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
  let purge = false;

  for (const raw of items) {
    const rule = shape(raw);
    const errors = validateRule(rule);
    if (errors.length) {
      report.failed++;
      if (report.errors.length < 20) {
        report.errors.push(`${raw.source || "(خالی)"} — ${errors.map((e) => e.message).join("، ")}`);
      }
      continue;
    }

    try {
      const existing = await prisma.redirect.findUnique({ where: { source: rule.source } });
      if (existing) {
        if (!overwrite) {
          report.skipped++;
          continue;
        }
        const updated = await prisma.redirect.update({
          where: { id: existing.id },
          data: { ...rule, note: raw.note?.trim() || existing.note },
        });
        if (changeNeedsPurge(existing, updated)) purge = true;
        report.updated++;
      } else {
        await prisma.redirect.create({
          data: { ...rule, note: raw.note?.trim() || null },
        });
        report.created++;
      }
    } catch (e) {
      report.failed++;
      if (report.errors.length < 20) {
        report.errors.push(`${rule.source} — ${(e as Error).message}`);
      }
    }
  }

  if (purge) await markPurge();
  return NextResponse.json(report);
}
