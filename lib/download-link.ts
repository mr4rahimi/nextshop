// پیوست دانلودی محصول: یا فایل آپلودشده روی همین سایت (/uploads/...) یا لینک خارجی (http/https).
// لینک خارجی در سایت با rel="nofollow noopener noreferrer" و در تب تازه باز می‌شود تا اعتبار صفحه به آن منتقل نشود.

/** فقط مسیر داخلی یا نشانی http/https پذیرفته می‌شود؛ هر چیز دیگر (javascript: و ...) null می‌شود */
export function sanitizeDownloadUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function isExternalDownload(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** پسوند فایل برای برچسب دکمه (PDF، ZIP، EXE ...)؛ برای لینکی که پسوند روشن ندارد null */
export function downloadExt(url: string): string | null {
  let path = url;
  try { path = new URL(url, "http://x").pathname; } catch {}
  const m = path.match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toUpperCase() : null;
}
