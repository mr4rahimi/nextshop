import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** عددهای کارت‌های خانه‌ی ابزارها */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [links, qrs, landings, published, clicks30, reviewsSent30, reviewSetting, cartSent30, cartRecovered30, cartSetting, stockWaiting] = await Promise.all([
    prisma.shortLink.count({ where: { kind: "MANUAL", deletedAt: null } }),
    prisma.qrCode.count({ where: { deletedAt: null } }),
    prisma.toolLanding.count({ where: { deletedAt: null } }),
    prisma.toolLanding.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    prisma.shortLinkClick.count({ where: { at: { gte: since } } }),
    prisma.reviewRequest.count({ where: { status: "SENT", sentAt: { gte: since } } }),
    prisma.reviewRequestSetting.findUnique({ where: { id: "singleton" }, select: { isEnabled: true } }),
    prisma.cartRecovery.count({ where: { status: { in: ["SENT", "RECOVERED"] }, sentAt: { gte: since } } }),
    prisma.cartRecovery.count({ where: { status: "RECOVERED", sentAt: { gte: since } } }),
    prisma.cartRecoverySetting.findUnique({ where: { id: "singleton" }, select: { isEnabled: true } }),
    prisma.stockAlert.count({ where: { status: "WAITING" } }),
  ]);
  return NextResponse.json({
    links, qrs, landings, published, clicks30, reviewsSent30, reviewsEnabled: reviewSetting?.isEnabled ?? false,
    cartSent30, cartRecovered30, cartEnabled: cartSetting?.isEnabled ?? false, stockWaiting,
    canManage: g.access.isUnrestricted || g.access.permissions.includes("TOOLS_MANAGE"),
  });
}
