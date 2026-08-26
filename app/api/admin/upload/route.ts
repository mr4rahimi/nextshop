import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
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

/**
 * فرمت‌هایی که مرورگر نمایششان نمی‌دهد ولی کاربر مدام آپلودشان می‌کند.
 * جدا نگه داشته می‌شوند تا به‌جای «فرمت مجاز نیست» پیام راهنمای مشخص بگیرند.
 * (تبدیل خودکارشان ممکن نیست: sharp روی سرور production بالا نمی‌آید.)
 */
const CAMERA_TYPES = new Set(["image/heic", "image/heif", "image/x-adobe-dng", "image/tiff"]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

/** مگابایت خوانا برای پیام خطا */
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file") as File;
  const type = (data.get("type") as string) || "image"; // "image" | "download"

  if (!file) {
    return NextResponse.json({ error: "فایلی انتخاب نشده است" }, { status: 400 });
  }

  if (type === "download") {
    if (file.size > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({
        error: `حجم فایل ${mb(file.size)} مگابایت است؛ حداکثر مجاز ۱۰۰ مگابایت.`,
      }, { status: 400 });
    }
    // For downloads allow all non-dangerous types; block executables
    const blockedExts = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".msi"]);
    const ext = path.extname(file.name).toLowerCase();
    if (blockedExts.has(ext)) {
      return NextResponse.json({
        error: `فایل اجرایی «${ext}» به دلایل امنیتی قابل آپلود نیست.`,
      }, { status: 400 });
    }
  } else {
    if (CAMERA_TYPES.has(file.type)) {
      return NextResponse.json({
        error: "این عکس با فرمت دوربین/آیفون (HEIC یا TIFF) است و مرورگرها نمایشش نمی‌دهند. " +
               "در گوشه‌ی گوشی «فرمت سازگارتر» را روشن کنید یا عکس را به JPG تبدیل کنید.",
      }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({
        error: `فرمت «${file.type || path.extname(file.name) || "نامشخص"}» پشتیبانی نمی‌شود. ` +
               "فرمت‌های مجاز: JPG، PNG، WebP، GIF، SVG، AVIF.",
      }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({
        error: `حجم تصویر ${mb(file.size)} مگابایت است؛ حداکثر مجاز ۱۰ مگابایت. ` +
               "تصویر را کوچک‌تر کنید و دوباره تلاش کنید.",
      }, { status: 400 });
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

  // نوشتن روی دیسک می‌تواند شکست بخورد (دیسک پر، مجوز، پوشه‌ی گم‌شده).
  // بدون این try کاربر یک ۵۰۰ خام می‌گیرد و فکر می‌کند عکس آپلود شده است.
  try {
    await writeFile(filePath, buffer);
  } catch (e: any) {
    console.error("[upload] نوشتن فایل شکست خورد:", filePath, e?.message);
    return NextResponse.json({
      error: "ذخیره‌ی فایل روی سرور ممکن نشد. لطفاً به مدیر فنی اطلاع دهید.",
    }, { status: 500 });
  }

  logActivityAsync({
    action: "UPLOAD",
    entity: "MEDIA",
    entityId: fileName,
    entityTitle: file.name,
    summary: `${type === "download" ? "فایل" : "تصویر"} «${file.name}» آپلود شد (${mb(buffer.length)} مگابایت)`,
    changes: [
      {
        field: "url",
        label: type === "download" ? "فایل" : "تصویر",
        kind: type === "download" ? "text" : "image",
        before: null,
        after: `/uploads/${fileName}`,
      },
    ],
  });

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
