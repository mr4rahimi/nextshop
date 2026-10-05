/**
 * ریدایرکت خودکار وقتی اسلاگ عوض می‌شود.
 *
 * قبلاً هر ویرایش اسلاگ (محصول، دسته، برند، مقاله، لندینگ) آدرس قدیم را —
 * که گوگل ایندکس کرده بود — بی‌صدا ۴۰۴ می‌کرد (ممیزی مهام، مهر ۱۴۰۵). حالا
 * سرویس ذخیره‌ی هر کدام این تابع را صدا می‌زند و یک قاعده‌ی ۳۰۱ در همان جدول
 * `Redirect` پنل سئو ساخته می‌شود؛ پس ادمین آن را می‌بیند و می‌تواند حذفش کند.
 *
 * سه کار، به همین ترتیب:
 * ۱. قاعده‌ای که مبدأش **آدرس تازه** است حذف می‌شود — proxy قبل از صفحه
 *    اجرا می‌شود و آن قاعده صفحه‌ی زنده را به جای دیگری می‌فرستاد (مثلاً وقتی
 *    اسلاگ به مقدار قبلی‌اش برمی‌گردد).
 * ۲. زنجیره‌ها صاف می‌شوند: هر قاعده‌ای که به آدرس قدیم می‌رفت حالا مستقیم
 *    به آدرس تازه می‌رود (الف→ب، ب→ج ⇒ الف→ج و ب→ج).
 * ۳. قاعده‌ی قدیم→تازه ساخته یا به‌روز می‌شود.
 *
 * proxy قواعد را ۶۰ ثانیه کش می‌کند، پس آدرس قدیم تا یک دقیقه ممکن است ۴۰۴ بدهد.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizePath } from "@/lib/redirects";

type Db = PrismaClient | Prisma.TransactionClient;

export const SLUG_BASE = {
  product: "/products",
  category: "/categories",
  brand: "/brands",
  blog: "/mag",
  landing: "/collections",
} as const;

export type SlugEntity = keyof typeof SLUG_BASE;

const NOTE: Record<SlugEntity, string> = {
  product: "خودکار — تغییر اسلاگ محصول",
  category: "خودکار — تغییر اسلاگ دسته",
  brand: "خودکار — تغییر اسلاگ برند",
  blog: "خودکار — تغییر اسلاگ مقاله",
  landing: "خودکار — تغییر اسلاگ لندینگ",
};

/** مقصدها ممکن است encode‌شده یا خام ذخیره شده باشند؛ هر دو شکل را می‌سازد. */
function pathForms(path: string): string[] {
  const forms = new Set([path, normalizePath(path)]);
  try {
    forms.add(encodeURI(path));
    forms.add(normalizePath(decodeURI(path)));
  } catch {
    /* دنباله‌ی نامعتبر — همان شکل‌های قبلی کافی است */
  }
  return [...forms];
}

export async function redirectSlugChange(
  db: Db,
  entity: SlugEntity,
  oldSlug: string | null | undefined,
  newSlug: string | null | undefined,
): Promise<void> {
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;

  const base = SLUG_BASE[entity];
  const oldPath = `${base}/${oldSlug}`;
  const newPath = `${base}/${newSlug}`;
  const source = normalizePath(oldPath);

  // فقط بزرگی و کوچکی حروف عوض شده — مسیرها در proxy کوچک می‌شوند، قاعده حلقه می‌شد
  if (source === normalizePath(newPath)) return;

  await db.redirect.deleteMany({
    where: { matchType: "EXACT", source: { in: pathForms(newPath) } },
  });

  await db.redirect.updateMany({
    where: {
      OR: pathForms(oldPath).map((p) => ({ destination: { equals: p, mode: "insensitive" as const } })),
    },
    data: { destination: newPath },
  });

  await db.redirect.upsert({
    where: { source },
    create: { source, destination: newPath, statusCode: 301, matchType: "EXACT", note: NOTE[entity] },
    update: { destination: newPath, statusCode: 301, matchType: "EXACT", isActive: true },
  });
}
