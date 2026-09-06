import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const tiers = await prisma.clubTier.findMany({
    orderBy: { minSpent: "asc" },
    include: { _count: { select: { profiles: true } } },
  });

  return NextResponse.json(serialize({ tiers }));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseTier(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const exists = await prisma.clubTier.findUnique({ where: { slug: parsed.slug } });
  if (exists) {
    return NextResponse.json({ error: "سطحی با این شناسه از قبل هست" }, { status: 400 });
  }

  const tier = await prisma.clubTier.create({ data: parsed });
  return NextResponse.json(serialize({ tier }));
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "شناسه سطح لازم است" }, { status: 400 });

  const parsed = parseTier(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const clash = await prisma.clubTier.findFirst({
    where: { slug: parsed.slug, NOT: { id } },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json({ error: "سطح دیگری همین شناسه را دارد" }, { status: 400 });
  }

  const tier = await prisma.clubTier.update({ where: { id }, data: parsed });
  return NextResponse.json(serialize({ tier }));
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "شناسه سطح لازم است" }, { status: 400 });

  // اعضای این سطح بی‌سطح می‌شوند، نه حذف — با اجرای بعدی assignTier جا می‌افتند
  await prisma.$transaction([
    prisma.clubProfile.updateMany({ where: { tierId: id }, data: { tierId: null } }),
    prisma.clubTier.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}

type ParsedTier = {
  title: string;
  slug: string;
  minSpent: bigint;
  color: string | null;
  pointRate: number;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
};

function parseTier(body: unknown): ParsedTier | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "عنوان سطح الزامی است" };

  const slug = (typeof b.slug === "string" ? b.slug : "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return { error: "شناسه انگلیسی سطح الزامی است" };

  const minSpentNum = Number(b.minSpent);
  if (!Number.isFinite(minSpentNum) || minSpentNum < 0) {
    return { error: "حداقل مبلغ خرید نامعتبر است" };
  }

  const pointRate = Number(b.pointRate);
  if (!Number.isFinite(pointRate) || pointRate <= 0 || pointRate > 10) {
    return { error: "ضریب امتیاز باید بین ۰ تا ۱۰ باشد" };
  }

  const benefits = Array.isArray(b.benefits)
    ? b.benefits.map((x) => String(x).trim()).filter(Boolean)
    : [];

  return {
    title,
    slug,
    minSpent: BigInt(Math.floor(minSpentNum)),
    color: typeof b.color === "string" && b.color.trim() ? b.color.trim() : null,
    pointRate,
    benefits,
    sortOrder: Number.isFinite(Number(b.sortOrder)) ? Math.floor(Number(b.sortOrder)) : 0,
    isActive: b.isActive !== false,
  };
}
