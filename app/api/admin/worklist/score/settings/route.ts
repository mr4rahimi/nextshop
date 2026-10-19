import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { getGroupWeights, getScoreSettings } from "@/lib/worklist/score";
import { isScoreGroup, metricsOf, SCORE_GROUPS } from "@/lib/worklist/score-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEIGHT = 100;

/**
 * تنظیمات امتیاز عملکرد — بخش ۱۵ مستندات کارتابل.
 *
 * ⚠️ **یک ذخیره برای همه‌چیز**: کلید، پارامترها، وزن‌ها و گروه کارکنان با هم
 * فرستاده می‌شوند. در برتر سه دکمه‌ی ذخیره بود و مدیر پایینی را می‌زد و خیال
 * می‌کرد بالایی هم ذخیره شده.
 */
export async function GET() {
  const guard = await requirePermission("SCORE_SETTINGS_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [settings, staff, ...weights] = await Promise.all([
    getScoreSettings(),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SELLER"] }, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        scoreGroup: true, scoreExcluded: true, staffRole: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    ...SCORE_GROUPS.map((g) => getGroupWeights(g)),
  ]);

  return NextResponse.json({
    ...settings,
    metrics: Object.fromEntries(SCORE_GROUPS.map((g, i) => [g, weights[i]])),
    staff: staff.map((u) => ({
      userId: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone,
      roleTitle: u.staffRole?.title ?? null,
      group: u.scoreGroup,
      excluded: u.scoreExcluded,
    })),
  });
}

export async function PUT(req: Request) {
  const guard = await requirePermission("SCORE_SETTINGS_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });

  const minVolumePct = Number(body.minVolumePct);
  if (!Number.isInteger(minVolumePct) || minVolumePct < 0 || minVolumePct > 100) {
    return NextResponse.json({ error: "کف حجم باید درصدی بین ۰ و ۱۰۰ باشد" }, { status: 400 });
  }
  const conversionDays = Number(body.conversionDays);
  if (!Number.isInteger(conversionDays) || conversionDays < 1 || conversionDays > 60) {
    return NextResponse.json({ error: "پنجره‌ی تبدیل باید بین ۱ و ۶۰ روز باشد" }, { status: 400 });
  }

  // ── وزن‌ها: فقط کدهای تعریف‌شده‌ی همان گروه ─────────────────────
  const metricRows: { code: string; group: (typeof SCORE_GROUPS)[number]; weight: number; isActive: boolean }[] = [];
  for (const g of SCORE_GROUPS) {
    const list = body.metrics?.[g];
    if (!Array.isArray(list)) continue;
    const allowed = new Set(metricsOf(g).map((m) => m.code));
    for (const m of list) {
      if (!allowed.has(m?.code)) continue;
      const w = Number(m.weight);
      if (!Number.isInteger(w) || w < 0 || w > MAX_WEIGHT) {
        return NextResponse.json({ error: "وزن هر معیار باید عددی بین ۰ و ۱۰۰ باشد" }, { status: 400 });
      }
      metricRows.push({ code: m.code, group: g, weight: w, isActive: m.isActive !== false });
    }
  }

  // ── گروه کارکنان ─────────────────────────────────────────────
  const staffRows: { userId: string; group: (typeof SCORE_GROUPS)[number] | null; excluded: boolean }[] = [];
  if (Array.isArray(body.staff)) {
    for (const s of body.staff) {
      if (typeof s?.userId !== "string") continue;
      if (s.group !== null && !isScoreGroup(s.group)) {
        return NextResponse.json({ error: "گروه کارمند نامعتبر است" }, { status: 400 });
      }
      staffRows.push({ userId: s.userId, group: s.group, excluded: s.excluded === true });
    }
  }
  // فقط کارکنان — این مسیر نباید راهی برای دست‌زدن به حساب مشتری باشد
  const staffIds = new Set(
    (await prisma.user.findMany({
      where: { id: { in: staffRows.map((s) => s.userId) }, role: { in: ["ADMIN", "SELLER"] } },
      select: { id: true },
    })).map((u) => u.id),
  );

  await prisma.$transaction([
    prisma.storeSettings.upsert({
      where: { id: "singleton" },
      update: {
        scoreEnabled: body.enabled === true,
        scoreMinVolumePct: minVolumePct,
        scoreConversionDays: conversionDays,
        scoreShowRank: body.showRank === true,
      },
      create: {
        id: "singleton",
        scoreEnabled: body.enabled === true,
        scoreMinVolumePct: minVolumePct,
        scoreConversionDays: conversionDays,
        scoreShowRank: body.showRank === true,
      },
    }),
    ...metricRows.map((m) =>
      prisma.staffScoreMetric.upsert({
        where: { code_group: { code: m.code, group: m.group } },
        update: { weight: m.weight, isActive: m.isActive },
        create: m,
      }),
    ),
    ...staffRows
      .filter((s) => staffIds.has(s.userId))
      .map((s) =>
        prisma.user.update({
          where: { id: s.userId },
          data: { scoreGroup: s.group, scoreExcluded: s.excluded },
        }),
      ),
  ]);

  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityTitle: "امتیاز عملکرد",
    summary: `امتیاز عملکرد ${body.enabled === true ? "روشن" : "خاموش"} · کف حجم ${minVolumePct}٪ · ${metricRows.length} وزن · ${staffRows.length} کارمند`,
  });

  return NextResponse.json({ ok: true });
}
