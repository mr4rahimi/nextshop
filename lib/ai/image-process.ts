/**
 * پردازش تصویر در مرورگر برای استودیو تصویر هوش مصنوعی — docs/features/ai-product-image.md
 *
 * چرا در مرورگر: sharp روی سرور production بالا نمی‌آید (app/api/admin/upload/route.ts).
 * canvas روی گوشی هم سریع است و آپلود با اینترنت موبایل را سبک می‌کند.
 *
 * فقط در مرورگر صدا زده شود.
 */
import { AI_IMAGE_SIZE } from "@/lib/ai/image-presets";

/** بزرگ‌ترین ضلع عکسی که به مدل می‌رود — بیشترش فقط آپلود را کند می‌کند */
const INPUT_MAX_SIDE = 1536;
/** هدف حجم خروجی نهایی */
const TARGET_BYTES = 300 * 1024;

async function decode(src: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // imageOrientation چرخش EXIF عکس گوشی را اعمال می‌کند
    return await createImageBitmap(src, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(src);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(
        "این عکس در مرورگر باز نمی‌شود (احتمالاً HEIC آیفون). در تنظیمات دوربین «سازگارترین» را انتخاب کنید یا عکس را JPG کنید.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(res => canvas.toBlob(res, type, quality));
}

/** عکس گوشی → JPEG سبک با چرخش درست، آماده‌ی ارسال به مدل */
export async function prepareInput(file: Blob): Promise<Blob> {
  const img = await decode(file);
  const scale = Math.min(1, INPUT_MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const blob = await toBlob(c, "image/jpeg", 0.9);
  if (!blob) throw new Error("آماده‌سازی عکس ناموفق بود.");
  return blob;
}

/**
 * خروجی مدل → فایل نهایی استاندارد فروشگاه:
 * مربع ۱۰۲۴، در حالت سفید پس‌زمینه‌ی دقیقاً #FFFFFF، WebP (یا JPEG در مرورگرهای قدیمی) زیر ~۳۰۰KB.
 */
export async function finalizeOutput(dataUrl: string, opts: { whiteBg: boolean; baseName: string }): Promise<File> {
  const src = await (await fetch(dataUrl)).blob();
  const img = await decode(src);
  const S = AI_IMAGE_SIZE;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: opts.whiteBg })!;

  // مدل معمولاً مربع می‌دهد؛ اگر نداد: حالت سفید «جا بده» روی سفید، بقیه «پر کن» از وسط
  if (opts.whiteBg) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, S, S);
    const k = Math.min(S / img.width, S / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    whitenBackground(ctx, S);
  } else {
    const k = Math.max(S / img.width, S / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  }

  let blob: Blob | null = null;
  for (const q of [0.86, 0.78, 0.7]) {
    blob = await toBlob(c, "image/webp", q);
    // سافاری قدیمی WebP نمی‌سازد و بی‌صدا PNG برمی‌گرداند
    if (!blob || blob.type !== "image/webp") blob = await toBlob(c, "image/jpeg", q + 0.04);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("ساخت فایل نهایی ناموفق بود.");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${opts.baseName || "product"}-ai.${ext}`, { type: blob.type });
}

/**
 * مدل‌ها «سفید» را حدود ۲۵۲ تحویل می‌دهند (تست واقعی gpt-image-2)، نه ۲۵۵.
 * پیکسل‌های تقریباً سفید و بی‌رنگ را سفید خالص می‌کنیم؛ سایه‌ی نرم زیر محصول
 * تیره‌تر از آستانه است و می‌ماند.
 */
function whitenBackground(ctx: CanvasRenderingContext2D, S: number) {
  const data = ctx.getImageData(0, 0, S, S);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    if (mn >= 240 && mx - mn <= 10) { d[i] = d[i + 1] = d[i + 2] = 255; }
  }
  ctx.putImageData(data, 0, 0);
}
