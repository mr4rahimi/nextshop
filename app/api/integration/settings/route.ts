import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccMode } from "@/lib/accounting/settings";
import { getIntegSettingsRow, listPlatforms, type PlatformPref } from "@/lib/integration/core/config";
import { HIDEABLE_SECTIONS, INTEG_PROFILES } from "@/lib/integration/core/sections";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * تنظیمات یکپارچه‌سازی — سرویس‌های فعال، بخش‌های روشن، نوع کسب‌وکار و worker.
 * docs/integrations/settings-and-guide.md
 */
export async function GET() {
  const [row, platforms, connections, accMode, linkCounts] = await Promise.all([
    getIntegSettingsRow(),
    listPlatforms(),
    prisma.integConnection.findMany({ select: { platformCode: true, status: true } }),
    getAccMode(),
    prisma.integMappingLink.groupBy({ by: ["platformCode"], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const conn = new Map(connections.map((c) => [c.platformCode, c.status]));
  const links = new Map(linkCounts.map((l) => [l.platformCode, l._count._all]));

  return NextResponse.json({
    accMode,
    profile: row.profile,
    hiddenSections: row.hiddenSections,
    platformPrefs: row.platformPrefs ?? {},
    worker: {
      workerEnabled: row.workerEnabled,
      workerIntervalSec: row.workerIntervalSec,
      logRetentionDays: row.logRetentionDays,
    },
    platforms: platforms.map((p) => ({
      ...p,
      status: conn.get(p.code) ?? null,
      mappedCount: links.get(p.code) ?? 0,
      // حسابان تا وقتی حالت حسابداری «حسابان» است خاموش نمی‌شود
      locked: p.code === "hesaban" && accMode === "HESABAN" && p.isActive,
    })),
  });
}

interface Body {
  platforms?: { code: string; isActive: boolean }[];
  hiddenSections?: string[];
  profile?: string | null;
  platformPrefs?: Record<string, PlatformPref>;
  worker?: { workerEnabled?: boolean; workerIntervalSec?: number; logRetentionDays?: number };
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });

  const accMode = await getAccMode();
  const summary: string[] = [];

  if (body.platforms?.length) {
    const known = await prisma.integPlatform.findMany({ select: { code: true, name: true, isActive: true } });
    for (const p of body.platforms) {
      const cur = known.find((k) => k.code === p.code);
      if (!cur || cur.isActive === !!p.isActive) continue;
      if (p.code === "hesaban" && !p.isActive && accMode === "HESABAN") {
        return NextResponse.json(
          { error: "حسابداری کسب‌وکار روی «حسابان وب» است؛ اول از «حسابداری ← تنظیمات ← حسابداری کسب‌وکار» حالت را عوض کنید." },
          { status: 409 },
        );
      }
      await prisma.integPlatform.update({ where: { code: p.code }, data: { isActive: !!p.isActive } });
      // کارهای در انتظار سرویس خاموش لغو می‌شوند تا بعد از روشن‌کردن دوباره، کار کهنه اجرا نشود
      if (!p.isActive) {
        await prisma.integJob.updateMany({
          where: { platformCode: p.code, status: "PENDING" },
          data: { status: "CANCELLED", completedAt: new Date(), lastError: "سرویس در تنظیمات خاموش شد" },
        }).catch(() => {});
      }
      summary.push(`${cur.name}: ${p.isActive ? "روشن" : "خاموش"}`);
    }
  }

  const data: Record<string, unknown> = {};
  if (body.hiddenSections) {
    const valid = new Set<string>(HIDEABLE_SECTIONS.map((s) => s.key));
    data.hiddenSections = [...new Set(body.hiddenSections.filter((k) => valid.has(k)))];
    summary.push(`بخش‌های خاموش: ${(data.hiddenSections as string[]).length}`);
  }
  if (body.profile !== undefined) {
    data.profile = body.profile && INTEG_PROFILES.some((p) => p.key === body.profile) ? body.profile : null;
  }
  if (body.platformPrefs) {
    const clean: Record<string, PlatformPref> = {};
    for (const [code, pref] of Object.entries(body.platformPrefs)) {
      const url = (pref?.panelUrl ?? "").trim();
      if (url && !/^https:\/\/[^\s]+$/i.test(url)) {
        return NextResponse.json({ error: "آدرس پنل فروشندگی باید با https:// شروع شود" }, { status: 400 });
      }
      if (url) clean[code] = { panelUrl: url };
    }
    data.platformPrefs = clean;
  }
  if (body.worker) {
    const w = body.worker;
    if (w.workerEnabled !== undefined) data.workerEnabled = !!w.workerEnabled;
    if (w.workerIntervalSec !== undefined) data.workerIntervalSec = Math.min(600, Math.max(10, Math.round(w.workerIntervalSec)));
    if (w.logRetentionDays !== undefined) data.logRetentionDays = Math.min(365, Math.max(3, Math.round(w.logRetentionDays)));
  }

  if (Object.keys(data).length) {
    await getIntegSettingsRow();
    await prisma.integSettings.update({ where: { id: "singleton" }, data });
  }

  if (summary.length) {
    await logActivity({
      action: "UPDATE",
      entity: "SETTINGS",
      entityId: "integration",
      entityTitle: "تنظیمات یکپارچه‌سازی",
      summary: summary.join(" · "),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
