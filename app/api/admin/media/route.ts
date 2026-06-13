import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function detectType(mime: string): "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER" {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (
    mime === "application/pdf" ||
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("powerpoint") ||
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime === "text/plain" ||
    mime.includes("officedocument")
  ) return "DOCUMENT";
  return "OTHER";
}

function folderFor(type: string) {
  switch (type) {
    case "IMAGE": return "images";
    case "VIDEO": return "videos";
    case "AUDIO": return "audio";
    case "DOCUMENT": return "documents";
    default: return "others";
  }
}

function sanitizeFileName(name: string) {
  const ext = path.extname(name);
  const base = path.basename(name, ext)
    .replace(/[^\w\u0600-\u06FF\-]+/g, "-")
    .slice(0, 80);
  return `${Date.now()}-${base}${ext}`;
}

// ─── GET /api/admin/media ──────────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const page     = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get("pageSize"), 24)));
  const type     = url.searchParams.get("type")?.trim();
  const search   = url.searchParams.get("search")?.trim();

  const where: any = {};
  if (type && type !== "ALL") where.type = type;
  if (search) {
    where.OR = [
      { originalName: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total, stats] = await Promise.all([
    prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mediaFile.count({ where }),
    prisma.mediaFile.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const statsMap: Record<string, number> = {};
  stats.forEach(s => { statsMap[s.type] = s._count._all; });

  return NextResponse.json(serialize({ items, total, page, pageSize, stats: statsMap }));
}

// ─── POST /api/admin/media — آپلود (چندفایلی) ──────────────────────────────
export async function POST(req: Request) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "فایلی ارسال نشده" }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    const mimeType = file.type || "application/octet-stream";
    const type = detectType(mimeType);
    const folder = folderFor(type);

    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(process.cwd(), "public/uploads", folder, yearMonth);
    await mkdir(dir, { recursive: true });

    const fileName = sanitizeFileName(file.name);
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(dir, fileName), Buffer.from(bytes));

    const url = `/uploads/${folder}/${yearMonth}/${fileName}`;

    const media = await prisma.mediaFile.create({
      data: {
        fileName,
        originalName: file.name,
        url,
        mimeType,
        type,
        size: file.size,
        folder: `${folder}/${yearMonth}`,
      },
    });

    results.push(media);
  }

  return NextResponse.json(serialize({ items: results }));
}