import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "image/gif", "image/svg+xml", "image/avif",
]);

const ALLOWED_DOWNLOAD_TYPES = new Set([
  "application/pdf",
  "application/zip", "application/x-zip-compressed",
  "application/x-rar-compressed", "application/vnd.rar",
  "application/octet-stream",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file") as File;
  const type = (data.get("type") as string) || "image"; // "image" | "download"

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (type === "download") {
    if (file.size > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
    }
    // For downloads allow all non-dangerous types; block executables
    const blockedExts = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".msi"]);
    const ext = path.extname(file.name).toLowerCase();
    if (blockedExts.has(ext)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }
  } else {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
  }

  const bytes = await file.arrayBuffer();
  let buffer: Buffer<ArrayBufferLike> = Buffer.from(bytes);

  if (type !== "download") {
    buffer = await downscaleImage(buffer, file.type);
  }

  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || (type === "download" ? ".bin" : ".jpg");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(process.cwd(), "public/uploads", fileName);

  await writeFile(filePath, buffer);

  return NextResponse.json({ url: `/uploads/${fileName}` });
}

/** بزرگ‌ترین ضلع مجاز برای تصاویر آپلودی */
const MAX_IMAGE_DIMENSION = 1600;

/**
 * تصاویر بزرگ را به حداکثر ۱۶۰۰ پیکسل کوچک می‌کند.
 *
 * چرا لازم است: `next.config.ts` با `unoptimized: true` کار می‌کند (سرور
 * production از SSE4.2 پشتیبانی نمی‌کند و sharp در runtime بالا نمی‌آید)، پس
 * هیچ resize خودکاری در زمان نمایش انجام نمی‌شود و هر فایلی که آپلود شود
 * دقیقاً با همان حجم به کاربر تحویل داده می‌شود.
 *
 * `sharp` به‌صورت dynamic ایمپورت می‌شود و **هر خطایی نادیده گرفته می‌شود**:
 * روی سرورهایی که CPU پشتیبانی نمی‌کند، فایل اصلی بدون تغییر ذخیره می‌شود.
 * پس این تابع هیچ‌وقت آپلود را نمی‌شکند — فقط وقتی می‌تواند، بهتر می‌کند.
 *
 * SVG و GIF دست‌نخورده می‌مانند (برداری / متحرک).
 */
async function downscaleImage(buffer: Buffer, mime: string): Promise<Buffer<ArrayBufferLike>> {
  if (mime === "image/svg+xml" || mime === "image/gif") return buffer;

  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buffer, { failOn: "none" });
    const meta = await img.metadata();

    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (!longest || longest <= MAX_IMAGE_DIMENSION) return buffer;

    // fit:"inside" نسبت ابعاد را حفظ می‌کند و withoutEnlargement تضمین می‌کند
    // تصویر کوچک هیچ‌وقت بزرگ نشود — برای افقی و عمودی هر دو درست کار می‌کند.
    const resized = await img
      .rotate() // اعمال EXIF orientation قبل از اینکه متادیتا از بین برود
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    // اگر به هر دلیلی نتیجه بزرگ‌تر شد، اصل را نگه می‌داریم
    return resized.length < buffer.length ? resized : buffer;
  } catch {
    // sharp در دسترس نیست یا فایل قابل پردازش نبود — همان اصل ذخیره می‌شود
    return buffer;
  }
}
