import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { validate } from "../route";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.smsTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "قالب یافت نشد" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  // تغییر سریع وضعیت فعال/غیرفعال بدون اعتبارسنجی کامل
  if (Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
    const template = await prisma.smsTemplate.update({
      where: { id },
      data: { isActive: body.isActive },
    });
    return NextResponse.json({ success: true, template });
  }

  const merged = {
    key: (body.key as string) ?? existing.key,
    title: (body.title as string) ?? existing.title,
    mode: (body.mode as string) ?? existing.mode,
    patternCode: (body.patternCode as string) ?? existing.patternCode ?? undefined,
    body: (body.body as string) ?? existing.body ?? undefined,
  };

  const error = validate(merged);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const key = merged.key.trim().toLowerCase().replace(/\s+/g, "_");

  if (key !== existing.key) {
    const clash = await prisma.smsTemplate.findUnique({ where: { key } });
    if (clash) {
      return NextResponse.json({ error: "قالبی با این شناسه وجود دارد" }, { status: 409 });
    }
  }

  const mode = merged.mode as "PATTERN" | "TEXT";

  const template = await prisma.smsTemplate.update({
    where: { id },
    data: {
      key,
      title: merged.title.trim(),
      kind: (body.kind as "TRANSACTIONAL" | "MARKETING") ?? existing.kind,
      mode,
      patternCode: mode === "PATTERN" ? merged.patternCode!.trim() : null,
      body: merged.body?.trim() || null,
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  });

  return NextResponse.json({ success: true, template });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;

  // قالبی که به کمپین یا اتوماسیون وصل است حذف نمی‌شود
  const [campaigns, automations] = await Promise.all([
    prisma.smsCampaign.count({ where: { templateId: id } }),
    prisma.clubAutomation.count({ where: { templateId: id } }),
  ]);

  if (campaigns > 0 || automations > 0) {
    return NextResponse.json(
      {
        error: `این قالب در ${campaigns} کمپین و ${automations} پیامک خودکار استفاده شده. به‌جای حذف، غیرفعالش کنید.`,
      },
      { status: 409 }
    );
  }

  await prisma.smsTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}