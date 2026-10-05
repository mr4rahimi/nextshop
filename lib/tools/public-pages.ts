/**
 * پاسخ‌های سبک صفحه‌های عمومی ابزارها — docs/features/tools.md
 *
 * ۴۰۴ لینک کوتاه HTML ساده با رنگ هگز ثابت است، نه صفحه‌ی ۴۰۴ فروشگاه: route
 * handler است و رندر React ندارد، و نباید کش شود (لینک ممکن است دوباره روشن شود).
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function notFoundHtml(message: string): Response {
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>پیدا نشد</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fb;font-family:Tahoma,sans-serif;color:#1f2937"><div style="text-align:center;padding:24px"><div style="font-size:48px;font-weight:900;color:#cbd5e1">۴۰۴</div><p style="font-size:15px;line-height:2">${esc(message)}</p><a href="/" style="display:inline-block;margin-top:8px;padding:10px 20px;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px">صفحه‌ی اصلی</a></div></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
