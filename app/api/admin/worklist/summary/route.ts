import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { parseRange, eachDay, dayKey } from "@/lib/reports";
import { countSystemWork } from "@/lib/worklist/system-map";
import { DOMAIN_LABELS, parseOutcomes } from "@/lib/worklist/types";
import type { Prisma, StaffDomain } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * گزارش عملکرد تیم — فاز ۶، بخش ۱۴ مستندات.
 *
 * ⚠️ **`ActivityLog` در `StaffTask` کپی نمی‌شود.** ادغام همین‌جا در لایه‌ی
 * خواندن انجام می‌شود (بخش ۹): کار دستی از `StaffTask` و کار خودکار از
 * `countSystemWork` می‌آید و کنار هم نشان داده می‌شوند، **نه جمع‌شده**. جمع‌زدن
 * این دو یعنی ثبت محصولی که هم `ActivityLog` دارد هم کارِ سیستمی، دو بار
 * شمرده شود.
 *
 * مبنای زمان هر معیار عمداً فرق دارد و در `docs` توضیح داده شده:
 *  - حجم کار: `doneAt` — کاری که در این بازه **بسته** شده
 *  - مستندسازی و نرخ ثبت نتیجه: `createdAt` — کاری که در این بازه **ثبت** شده
 *  - عقب‌افتاده: وضعیت **همین حالا**، نه در بازه
 */

/** بیشتر از این یعنی نمودار خوانا نیست؛ بقیه در «سایر» جمع می‌شوند */
const TOP_N = 8;

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

export async function GET(req: Request) {
  const guard = await requirePermission("WORK_REPORT_VIEW");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const range = parseRange(url.searchParams);
  const inRange = { gte: range.from, lte: range.to };

  // فیلتر اختیاری روی یک کارمند — «چرا عدد او این است» با همین باز می‌شود
  const ownerId = url.searchParams.get("ownerId") || null;
  const ownerFilter: Prisma.StaffTaskWhereInput = ownerId ? { ownerId } : {};

  const [done, created, overdue, notes, referrals, types, staff] = await Promise.all([
    // بسته‌شده در بازه
    prisma.staffTask.findMany({
      where: { ...ownerFilter, status: "DONE", doneAt: inRange },
      select: {
        id: true, domain: true, typeId: true, outcome: true,
        ownerId: true, ownerName: true, doneAt: true,
      },
    }),
    // ثبت‌شده در بازه — مخرجِ «نرخ ثبت نتیجه»
    prisma.staffTask.findMany({
      where: { ...ownerFilter, createdAt: inRange },
      select: { id: true, outcome: true, ownerId: true, ownerName: true, createdAt: true, status: true },
    }),
    // عقب‌افتاده: وضعیت همین حالا
    prisma.staffTask.findMany({
      where: { ...ownerFilter, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: new Date() } },
      select: { ownerId: true, ownerName: true },
    }),
    // ⚠️ مستندسازی = کارِ **متمایز**، نه تعداد یادداشت. ده یادداشت روی یک کار
    // یک واحد است، وگرنه پرحرفی امتیاز می‌آورد.
    prisma.staffTaskNote.findMany({
      where: { createdAt: inRange, ...(ownerId ? { authorId: ownerId } : {}) },
      select: { taskId: true, authorId: true },
      distinct: ["taskId", "authorId"],
    }),
    prisma.staffTaskReferral.findMany({
      where: { createdAt: inRange, ...(ownerId ? { fromId: ownerId } : {}) },
      select: { taskId: true, fromId: true },
      distinct: ["taskId", "fromId"],
    }),
    prisma.staffTaskType.findMany({
      select: { id: true, title: true, domain: true, outcomes: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SELLER"] }, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
  ]);

  const typeById = new Map(types.map((t) => [t.id, t]));

  // ── سری زمانی روزانه ──────────────────────────────────────────
  const days = eachDay(range);
  const blank = () => Object.fromEntries(days.map((d) => [d, 0])) as Record<string, number>;
  const seriesDone = blank();
  const seriesCreated = blank();

  for (const t of done) {
    const k = t.doneAt ? dayKey(t.doneAt) : null;
    if (k && k in seriesDone) seriesDone[k]++;
  }
  for (const t of created) {
    const k = dayKey(t.createdAt);
    if (k in seriesCreated) seriesCreated[k]++;
  }

  // ── تفکیک دامنه، نوع و نتیجه ──────────────────────────────────
  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byOutcome: Record<string, { label: string; count: number; isSuccess: boolean }> = {};

  for (const t of done) {
    byDomain[t.domain] = (byDomain[t.domain] ?? 0) + 1;
    const type = typeById.get(t.typeId);
    if (type) byType[type.title] = (byType[type.title] ?? 0) + 1;

    if (t.outcome && type) {
      // برچسبِ نتیجه از خود نوع می‌آید. نتیجه‌ای که دیگر در نوع نیست (چون
      // مدیر عوضش کرده) با مقدار خامش دیده می‌شود، نه اینکه ناپدید شود.
      const known = parseOutcomes(type.outcomes).find((o) => o.value === t.outcome);
      const key = `${type.id}:${t.outcome}`;
      byOutcome[key] ??= {
        label: `${known?.label ?? t.outcome} — ${type.title}`,
        count: 0,
        isSuccess: known?.isSuccess === true,
      };
      byOutcome[key].count++;
    }
  }

  // ── جدول کارکنان ──────────────────────────────────────────────
  const nameOf = (u: { firstName: string | null; lastName: string | null; phone: string }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone;

  type Row = {
    userId: string;
    name: string;
    done: number;
    created: number;
    withOutcome: number;
    documented: number;
    overdue: number;
    system: number;
  };
  const rows = new Map<string, Row>();
  const row = (id: string | null, fallbackName: string): Row | null => {
    if (!id) return null; // کارِ بی‌مسئول در گزارش عملکرد جایی ندارد
    let r = rows.get(id);
    if (!r) {
      r = { userId: id, name: fallbackName, done: 0, created: 0, withOutcome: 0, documented: 0, overdue: 0, system: 0 };
      rows.set(id, r);
    }
    return r;
  };

  for (const u of staff) row(u.id, nameOf(u));
  for (const t of done) { const r = row(t.ownerId, t.ownerName); if (r) r.done++; }
  for (const t of created) {
    const r = row(t.ownerId, t.ownerName);
    if (!r) continue;
    r.created++;
    if (t.outcome) r.withOutcome++;
  }
  for (const t of overdue) { const r = row(t.ownerId, t.ownerName); if (r) r.overdue++; }

  // یادداشت و ارجاع روی یک کار، یک واحد مستندسازی است نه دو تا
  const docPairs = new Set<string>();
  for (const n of notes) if (n.authorId) docPairs.add(`${n.authorId}:${n.taskId}`);
  for (const rf of referrals) if (rf.fromId) docPairs.add(`${rf.fromId}:${rf.taskId}`);
  for (const pair of docPairs) {
    const [userId] = pair.split(":");
    const r = rows.get(userId);
    if (r) r.documented++;
  }

  // کار خودکار از ActivityLog — کنار کار دستی، نه جمع‌شده با آن
  const system = await countSystemWork(range.from, range.to, ownerId ? [ownerId] : undefined);
  for (const src of system) {
    for (const [userId, count] of Object.entries(src.byActor)) {
      const r = rows.get(userId);
      if (r) r.system += count;
    }
  }

  const staffRows = Array.from(rows.values())
    .filter((r) => r.done + r.created + r.documented + r.overdue + r.system > 0)
    .sort((a, b) => b.done - a.done);

  const topN = (obj: Record<string, number>) => {
    const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, TOP_N);
    const restTotal = sorted.slice(TOP_N).reduce((s, [, v]) => s + v, 0);
    const items = head.map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
    if (restTotal > 0) items.push({ label: "سایر", value: restTotal, color: "#94a3b8" });
    return items;
  };

  const totalCreated = created.length;
  const totalWithOutcome = created.filter((t) => t.outcome).length;

  return NextResponse.json({
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    days,
    kpi: {
      done: done.length,
      created: totalCreated,
      // نرخ ثبت نتیجه: درصد کارهای ثبت‌شده‌ی بازه که نتیجه خورده‌اند
      outcomeRate: totalCreated > 0 ? Math.round((totalWithOutcome / totalCreated) * 100) : 0,
      overdue: overdue.length,
      documented: docPairs.size,
      system: system.reduce((s, x) => s + x.total, 0),
      openNow: created.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
    },
    series: {
      done: days.map((d) => seriesDone[d]),
      created: days.map((d) => seriesCreated[d]),
    },
    byDomain: Object.entries(byDomain)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({
        label: DOMAIN_LABELS[key as StaffDomain] ?? key,
        value,
        color: COLORS[i % COLORS.length],
      })),
    byType: topN(byType),
    byOutcome: Object.values(byOutcome)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((o) => ({ label: o.label, value: o.count, color: o.isSuccess ? "#10b981" : "#94a3b8" })),
    system: system.filter((s) => s.total > 0).map((s) => ({ key: s.key, label: s.label, value: s.total })),
    staff: staffRows,
    canExport: can(guard.access, "WORK_REPORT_EXPORT"),
  });
}
