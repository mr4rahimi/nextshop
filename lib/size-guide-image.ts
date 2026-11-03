/**
 * عکس راهنمای سایز برای آخر گالری — docs/features/size-guide.md فاز ۲. فقط مرورگر.
 *
 * عمداً canvas مرورگر، نه سرور و نه هوش مصنوعی: فونت فارسی سایت همین‌جا بارگذاری شده و
 * شکل‌دهی حروف کار مرورگر است؛ روی سرور باید فونت و pango روی هر ماشین نصب می‌شد
 * (sharp روی بعضی سرورها بالا نمی‌آید — `app/api/admin/upload`). طرح لباس با `Path2D` از
 * همان رشته‌های SVG صفحه کشیده می‌شود.
 */

import { FIT_LABEL, SIZING_LABEL, faNum, kindColumn, type SizeChart } from "@/lib/size-guide";
import { SIZE_SHAPES, labelPos, type Line } from "@/lib/size-guide-shapes";

const W = 1024;
const PAD = 56;
const ACCENT = "#f43f5e";
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

/** رنگ اصلی فروشگاه از متغیر Tailwind؛ مرورگری که oklch نفهمد آبی پیش‌فرض می‌گیرد */
function primaryColor(ctx: CanvasRenderingContext2D): string {
  const el = document.createElement("span");
  el.className = "text-primary-600";
  document.body.appendChild(el);
  const c = getComputedStyle(el).color;
  el.remove();
  ctx.fillStyle = "#2563eb";
  ctx.fillStyle = c;
  return ctx.fillStyle;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t.trim()}…`;
}

function arrowLine(ctx: CanvasRenderingContext2D, l: Line) {
  ctx.beginPath();
  ctx.moveTo(l.x1, l.y1);
  ctx.lineTo(l.x2, l.y2);
  ctx.stroke();
  const a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
  for (const [x, y, dir] of [[l.x2, l.y2, a], [l.x1, l.y1, a + Math.PI]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5 * Math.cos(dir - 0.45), y - 5 * Math.sin(dir - 0.45));
    ctx.lineTo(x - 5 * Math.cos(dir + 0.45), y - 5 * Math.sin(dir + 0.45));
    ctx.closePath();
    ctx.fill();
  }
}

/** طرح لباس در جعبه‌ی (x, y, size×size*1.15) */
function drawDiagram(ctx: CanvasRenderingContext2D, chart: SizeChart, x: number, y: number, size: number) {
  if (chart.kind === "custom") return;
  const shape = SIZE_SHAPES[chart.kind];
  const k = size / 200;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  const outline = new Path2D(shape.outline);
  ctx.fillStyle = "#f9fafb";
  ctx.fill(outline);
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1.4;
  ctx.stroke(outline);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  for (const d of shape.details) ctx.stroke(new Path2D(d));
  ctx.fillStyle = "#d1d5db";
  for (const [cx, cy] of shape.dots ?? []) {
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of chart.columns) {
    const l = shape.lines[c.key];
    const letter = kindColumn(chart.kind, c.key)?.letter;
    if (!l || !letter) continue;
    ctx.strokeStyle = ACCENT;
    ctx.fillStyle = ACCENT;
    ctx.lineWidth = 1.6;
    arrowLine(ctx, l);
    const [mx, my] = labelPos(c.key, l);
    ctx.beginPath();
    ctx.arc(mx, my, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 9.5px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(letter, mx, my + 0.5);
  }
  ctx.restore();
}

function letterBadge(ctx: CanvasRenderingContext2D, letter: string, cx: number, cy: number, r: number) {
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.round(r * 1.25)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "ltr";
  ctx.fillText(letter, cx, cy + 1);
}

/** جدول + طرح + راهنما ← فایل WebP مربع ۱۰۲۴ */
export async function renderSizeGuideImage(chart: SizeChart, opts: { productTitle: string; storeName?: string | null }): Promise<File> {
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  await Promise.all([document.fonts.load(`400 20px ${family}`, "سایز"), document.fonts.load(`900 20px ${family}`, "سایز")]).catch(() => {});
  const f = (weight: 400 | 900, px: number) => `${weight} ${px}px ${family}`;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext("2d")!;
  const primary = primaryColor(ctx);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, W);
  ctx.direction = "rtl";
  const R = W - PAD;

  // سرتیتر
  ctx.fillStyle = primary;
  ctx.fillRect(R - 8, PAD + 4, 8, 44);
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = f(900, 40);
  ctx.fillText("راهنمای سایز", R - 24, PAD + 40);
  ctx.fillStyle = MUTED;
  ctx.font = f(400, 22);
  ctx.fillText(ellipsize(ctx, opts.productTitle, W - 2 * PAD - 24), R - 24, PAD + 84);

  // برچسب فرم و قالب سایز
  let chipX = R;
  const chipY = PAD + 112;
  for (const t of [chart.fit ? `فرم: ${FIT_LABEL[chart.fit]}` : null, chart.sizing ? SIZING_LABEL[chart.sizing] : null].filter(Boolean) as string[]) {
    ctx.font = f(400, 19);
    const w = ctx.measureText(t).width + 28;
    ctx.fillStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.roundRect(chipX - w, chipY, w, 38, 12);
    ctx.fill();
    ctx.fillStyle = "#374151";
    ctx.textBaseline = "middle";
    ctx.fillText(t, chipX - 14, chipY + 20);
    chipX -= w + 12;
  }
  const hasChips = chart.fit || chart.sizing;
  let y = PAD + (hasChips ? 172 : 124);

  // طرح (چپ) + راهنمای اندازه‌گیری (راست). جدول اولویت دارد: با سایزهای زیاد اول راهنما،
  // بعد طرح کوچک یا حذف می‌شود تا هر ردیف دست‌کم ۳۰ پیکسل بماند.
  const footerH = 80;
  const avail = W - footerH - y - 24;
  const tableMin = (chart.rows.length + 1) * 30;
  const legend = chart.kind === "custom" ? [] : chart.columns.map((c) => ({ ...c, kc: kindColumn(chart.kind, c.key) })).filter((c) => c.kc?.how);
  let legendH = legend.length * 54;
  let diagH = chart.kind === "custom" ? 0 : Math.min(345, avail - (chart.rows.length + 1) * 44);
  if (avail - Math.max(diagH, legendH) < tableMin) legendH = 0;
  if (diagH && avail - Math.max(diagH, legendH) < tableMin) diagH = Math.min(345, avail - tableMin);
  if (diagH < 160) diagH = 0;
  if (!diagH) legendH = Math.min(legendH, Math.max(0, avail - tableMin));
  const topH = Math.max(diagH, legendH);
  if (diagH) drawDiagram(ctx, chart, PAD, y + (topH - diagH) / 2, diagH / 1.15);
  if (legendH >= legend.length * 54) {
    const lx = R;
    const lw = diagH ? W - PAD - (PAD + diagH / 1.15 + 40) : W - 2 * PAD;
    let ly = y + (topH - legendH) / 2 + 20;
    for (const c of legend) {
      if (c.kc?.letter) letterBadge(ctx, c.kc.letter, lx - 15, ly, 15);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.direction = "rtl";
      ctx.fillStyle = INK;
      ctx.font = f(900, 21);
      const label = `${c.label}:`;
      ctx.fillText(label, lx - 42, ly + 2);
      const lwLabel = ctx.measureText(label).width + 10;
      ctx.fillStyle = MUTED;
      ctx.font = f(400, 18);
      ctx.fillText(ellipsize(ctx, c.kc!.how, lw - 42 - lwLabel), lx - 42 - lwLabel, ly + 2);
      ly += 54;
    }
  }
  y += topH ? topH + 24 : 0;

  // جدول
  const cols = chart.columns.length + 1;
  const tableW = W - 2 * PAD;
  const cw = tableW / cols;
  const rh = Math.max(24, Math.min(56, (W - footerH - y) / (chart.rows.length + 1)));
  const fs = Math.round(Math.min(24, rh * 0.48));
  const cellX = (i: number) => R - cw * i - cw / 2;
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.roundRect(PAD, y, tableW, rh, 14);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = f(900, fs);
  ctx.direction = "rtl";
  ctx.fillText("سایز", cellX(0), y + rh / 2 + 1);
  chart.columns.forEach((c, i) => {
    const letter = kindColumn(chart.kind, c.key)?.letter;
    ctx.font = f(900, Math.min(fs, 21));
    ctx.fillStyle = "#ffffff";
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.fillText(ellipsize(ctx, letter ? `${c.label} ${letter}` : c.label, cw - 12), cellX(i + 1), y + rh / 2 + 1);
  });
  y += rh;
  chart.rows.forEach((r, ri) => {
    if (ri % 2 === 1) {
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(PAD, y, tableW, rh);
    }
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD, y + rh - 1, tableW, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.font = f(900, fs);
    ctx.direction = "ltr";
    ctx.fillText(r.size, cellX(0), y + rh / 2 + 1);
    ctx.font = f(400, fs);
    ctx.fillStyle = "#374151";
    chart.columns.forEach((c, i) => {
      const v = r.values[c.key];
      ctx.fillText(v == null ? "—" : faNum(v), cellX(i + 1), y + rh / 2 + 1);
    });
    y += rh;
  });

  // پانویس
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = f(400, 18);
  ctx.fillText("اندازه‌ها به سانتی‌متر و روی لباس پهن‌شده است؛ ۱ تا ۲ سانت اختلاف طبیعی است.", R, W - PAD + 8);
  if (opts.storeName) {
    ctx.textAlign = "left";
    ctx.fillStyle = primary;
    ctx.font = f(900, 20);
    ctx.fillText(opts.storeName, PAD, W - PAD + 8);
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
  if (!blob) throw new Error("ساخت عکس ممکن نشد");
  // Safari قدیمی WebP نمی‌سازد و PNG می‌دهد
  return new File([blob], `size-guide-${Date.now()}.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type });
}
