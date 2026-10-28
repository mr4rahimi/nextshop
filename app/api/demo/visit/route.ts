import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isDemo } from "@/lib/demo";
import { DEMO_LEAD_COOKIE } from "@/lib/demo/login";

export const runtime = "nodejs";

const MAX_SECTIONS = 80;

/**
 * بخشی از پنل که بازدیدکننده‌ی دمو باز کرد — برای تماس پیگیری (docs/plans/demo.md مرحله‌ی ۴).
 * فقط دو تکه‌ی اول مسیر (`/admin/integration`) نگه داشته می‌شود، بی‌شناسه و بی‌پارامتر.
 */
export async function POST(req: Request) {
  if (!isDemo()) return NextResponse.json({ ok: false });
  const leadId = (await cookies()).get(DEMO_LEAD_COOKIE)?.value;
  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  const section = typeof path === "string" && path.startsWith("/admin")
    ? path.split("?")[0].split("/").slice(0, 3).join("/").slice(0, 60)
    : null;
  if (!leadId || !section) return NextResponse.json({ ok: false });

  const lead = await prisma.demoLead.findUnique({ where: { id: leadId }, select: { sections: true } });
  if (!lead) return NextResponse.json({ ok: false });
  await prisma.demoLead.update({
    where: { id: leadId },
    data: {
      lastAt: new Date(),
      ...(lead.sections.includes(section) || lead.sections.length >= MAX_SECTIONS ? {} : { sections: { push: section } }),
    },
  });
  return NextResponse.json({ ok: true });
}
