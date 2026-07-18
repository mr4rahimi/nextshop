import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { extractVariables, countSmsParts } from "@/lib/club/sms/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

/** فهرست قالب‌ها به‌همراه آمار ارسال هرکدام */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const templates = await prisma.smsTemplate.findMany({
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

  // تعداد ارسال هر قالب — یک کوئری برای همه
  const usage = await prisma.smsMessage.groupBy({
    by: ["templateKey", "status"],
    _count: { _all: true },
  });

  const stats: Record<string, { sent: number; skipped: number; failed: number }> = {};
  for (const row of usage) {
    if (!row.templateKey) continue;
    const s = (stats[row.templateKey] ??= { sent: 0, skipped: 0, failed: 0 });
    if (row.status === "SENT" || row.status === "DELIVERED") s.sent += row._count._all;
    else if (row.status === "SKIPPED") s.skipped += row._count._all;
    else if (row.status === "FAILED") s.failed += row._count._all;
  }

  return NextResponse.json({
    templates: templates.map((t) => ({
      ...t,
      variables: t.body ? extractVariables(t.body) : [],
      parts: t.body ? countSmsParts(t.body).parts : null,
      stats: stats[t.key] ?? { sent: 0, skipped: 0, failed: 0 },
    })),
  });
}

/** ساخت قالب جدید */
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: {
    key?: string;
    title?: string;
    kind?: "TRANSACTIONAL" | "MARKETING";
    mode?: "PATTERN" | "TEXT";
    patternCode?: string;
    body?: string;
    isActive?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const key = body.key!.trim().toLowerCase().replace(/\s+/g, "_");

  const exists = await prisma.smsTemplate.findUnique({ where: { key } });
  if (exists) {
    return NextResponse.json({ error: "قالبی با این شناسه وجود دارد" }, { status: 409 });
  }

  const template = await prisma.smsTemplate.create({
    data: {
      key,
      title: body.title!.trim(),
      kind: body.kind ?? "MARKETING",
      mode: body.mode ?? "TEXT",
      patternCode: body.mode === "PATTERN" ? body.patternCode!.trim() : null,
      body: body.mode === "TEXT" ? body.body!.trim() : body.body?.trim() || null,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ success: true, template });
}

export function validate(body: {
  key?: string;
  title?: string;
  mode?: string;
  patternCode?: string;
  body?: string;
}): string | null {
  if (!body.key?.trim()) return "شناسه قالب الزامی است";
  if (!/^[a-z0-9_]+$/i.test(body.key.trim().replace(/\s+/g, "_"))) {
    return "شناسه فقط می‌تواند شامل حروف انگلیسی، عدد و زیرخط باشد";
  }
  if (!body.title?.trim()) return "عنوان قالب الزامی است";

  if (body.mode === "PATTERN") {
    if (!body.patternCode?.trim()) return "کد پترن الزامی است";
  } else {
    if (!body.body?.trim()) return "متن پیام الزامی است";
    if (body.body.trim().length > 900) return "متن پیام بیش از حد طولانی است";
  }

  return null;
}