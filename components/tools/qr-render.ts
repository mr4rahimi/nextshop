/**
 * ساخت تصویر QR در مرورگر — SVG برای چاپخانه و PNG در سه اندازه.
 *
 * - کتابخانه‌ی npm `qrcode` فقط ماتریس را می‌سازد؛ رسم با خودمان است تا
 *   لوگو، رنگ و متن زیر QR در SVG و PNG یکسان باشند. سرویس بیرونی نه.
 * - حاشیه‌ی سفید (quiet zone) ۴ ماژول، قابل کم‌کردن نیست — کمترش اسکن نمی‌شود.
 * - **با لوگو سطح تصحیح خطا `H` می‌شود** و ناحیه‌ی زیر لوگو خالی می‌ماند
 *   (حدود ۵٪ ماژول‌ها؛ H تا ۳۰٪ را جبران می‌کند). الگوهای گوشه هرگز پوشیده نمی‌شوند.
 * - متن زیر QR در PNG **جدا روی بوم** نوشته می‌شود: SVGی که به‌صورت تصویر
 *   بار شود به فونت‌های صفحه دسترسی ندارد.
 *
 * مستندات: docs/features/tools.md بخش ۲
 */

import QRCode from "qrcode";
import type { QrStyle } from "@/lib/tools/qr-content";

const QUIET = 4;
/** کسری از عرض QR که لوگو می‌گیرد */
const LOGO_FRACTION = 0.22;

interface Matrix {
  size: number;
  dark: (r: number, c: number) => boolean;
  /** محدوده‌ی خالی وسط برای لوگو — به ماژول */
  hole: { from: number; to: number } | null;
}

function matrix(payload: string, withLogo: boolean): Matrix {
  const qr = QRCode.create(payload || " ", { errorCorrectionLevel: withLogo ? "H" : "M" });
  const size = qr.modules.size;
  let hole: Matrix["hole"] = null;
  if (withLogo) {
    let n = Math.round(size * LOGO_FRACTION);
    if ((size - n) % 2) n += 1; // متقارن
    const from = (size - n) / 2;
    hole = { from, to: from + n };
  }
  const inHole = (r: number, c: number) => !!hole && r >= hole.from && r < hole.to && c >= hole.from && c < hole.to;
  return { size, hole, dark: (r, c) => !inHole(r, c) && qr.modules.get(r, c) === 1 };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** SVG کامل با لوگو و متن — برای پیش‌نمایش و فایل چاپخانه */
export function buildQrSvg(payload: string, style: QrStyle): string {
  const m = matrix(payload, !!style.logo);
  const total = m.size + QUIET * 2;
  const captionH = style.caption ? Math.max(6, Math.round(total * 0.14)) : 0;
  let d = "";
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (m.dark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }
  let logo = "";
  if (style.logo && m.hole) {
    const pad = 0.6;
    const x = m.hole.from + QUIET + pad;
    const w = m.hole.to - m.hole.from - pad * 2;
    logo = `<rect x="${m.hole.from + QUIET}" y="${m.hole.from + QUIET}" width="${m.hole.to - m.hole.from}" height="${m.hole.to - m.hole.from}" rx="1.2" fill="${style.bg}"/><image href="${style.logo}" x="${x}" y="${x}" width="${w}" height="${w}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const caption = style.caption
    ? `<text x="${total / 2}" y="${total + captionH * 0.45}" text-anchor="middle" dominant-baseline="middle" direction="rtl" font-family="Vazirmatn, IRANSans, Tahoma, sans-serif" font-weight="700" font-size="${Math.min(captionH * 0.55, (total * 1.6) / Math.max(style.caption.length, 1))}" fill="${style.fg}">${esc(style.caption)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total + captionH}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${style.bg}"/><path d="${d}" fill="${style.fg}"/>${logo}${caption}</svg>`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** PNG با عرض مشخص — متن با فونت خود صفحه روی بوم نوشته می‌شود */
export async function buildQrPng(payload: string, style: QrStyle, width: number): Promise<Blob> {
  const m = matrix(payload, !!style.logo);
  const total = m.size + QUIET * 2;
  const unit = width / total;
  const captionH = style.caption ? Math.round(width * 0.14) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width + captionH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = style.fg;
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (m.dark(r, c)) {
        // گرد کردن لبه‌ها تا بین ماژول‌ها خط سفید نیفتد
        const x = Math.floor((c + QUIET) * unit), y = Math.floor((r + QUIET) * unit);
        ctx.fillRect(x, y, Math.ceil((c + QUIET + 1) * unit) - x, Math.ceil((r + QUIET + 1) * unit) - y);
      }
    }
  }
  if (style.logo && m.hole) {
    const img = await loadImage(style.logo);
    const pad = 0.6 * unit;
    const x = (m.hole.from + QUIET) * unit;
    const w = (m.hole.to - m.hole.from) * unit;
    ctx.fillStyle = style.bg;
    ctx.fillRect(x, x, w, w);
    ctx.drawImage(img, x + pad, x + pad, w - pad * 2, w - pad * 2);
  }
  if (style.caption) {
    const family = getComputedStyle(document.body).fontFamily || "Tahoma, sans-serif";
    let size = Math.round(captionH * 0.5);
    ctx.font = `700 ${size}px ${family}`;
    // اندازه‌ی قلم با طول متن کوچک می‌شود تا از عرض بیرون نزند
    while (size > 10 && ctx.measureText(style.caption).width > width * 0.9) {
      size -= 2;
      ctx.font = `700 ${size}px ${family}`;
    }
    ctx.fillStyle = style.fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(style.caption, width / 2, width + captionH * 0.4);
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG ساخته نشد"))), "image/png"));
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * لوگو در مرورگر مربع و حداکثر ۲۵۶ پیکسل می‌شود و به‌صورت data URL در
 * `QrCode.style` می‌نشیند — فایل جدا لازم نیست.
 */
export async function logoToDataUrl(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const side = 256;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;
    const scale = Math.min(side / img.width, side / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
    let url = canvas.toDataURL("image/png");
    if (url.length > 190_000) {
      const webp = canvas.toDataURL("image/webp", 0.85);
      if (webp.startsWith("data:image/webp") && webp.length <= 190_000) return webp;
      // سافاری WEBP نمی‌سازد؛ JPEG روی زمینه‌ی سفید
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, side, side);
      url = canvas.toDataURL("image/jpeg", 0.85);
    }
    return url;
  } finally {
    URL.revokeObjectURL(src);
  }
}
