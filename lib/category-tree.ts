/**
 * درخت دسته‌بندی محصول — توابع خالص که هم در سرور و هم در کلاینت اجرا می‌شوند.
 *
 * هر محصول فقط به یک دسته وصل است (`Product.categoryId`، معمولاً زیردسته)،
 * پس عضویت در دسته‌ی مادر با نوشتن ردیف اضافه ساخته نمی‌شود؛ هر جا محصول
 * «در یک دسته» جستجو می‌شود باید خود دسته و همه‌ی نوادگانش را در نظر بگیرد.
 */

export type CategoryLink = { id: string; parentId?: string | null };
export type CategoryNode = CategoryLink & { title: string };

export const CATEGORY_PATH_SEPARATOR = " › ";

/** خود دسته و همه‌ی نوادگانش. حلقه‌ی خراب در parentId باعث گیر کردن نمی‌شود. */
export function categorySubtreeIds(rows: CategoryLink[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = children.get(row.parentId);
    if (list) list.push(row.id);
    else children.set(row.parentId, [row.id]);
  }
  const ids = new Set([rootId]);
  for (const id of ids) for (const child of children.get(id) ?? []) ids.add(child);
  return [...ids];
}

/**
 * دسته‌ها به ترتیب درخت، هر کدام با مسیر کامل: «پوشاک زنانه › هودی و سویشرت».
 * ترتیب ورودی بین خواهر و برادرها حفظ می‌شود.
 */
export function categoryOptions<T extends CategoryNode>(rows: T[]): (T & { label: string })[] {
  const known = new Set(rows.map((row) => row.id));
  const roots: T[] = [];
  const children = new Map<string, T[]>();
  for (const row of rows) {
    if (row.parentId && known.has(row.parentId)) {
      const list = children.get(row.parentId);
      if (list) list.push(row);
      else children.set(row.parentId, [row]);
    } else {
      roots.push(row);
    }
  }

  const out: (T & { label: string })[] = [];
  const seen = new Set<string>();
  const walk = (row: T, prefix: string) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    const label = prefix ? `${prefix}${CATEGORY_PATH_SEPARATOR}${row.title}` : row.title;
    out.push({ ...row, label });
    for (const child of children.get(row.id) ?? []) walk(child, label);
  };
  for (const root of roots) walk(root, "");
  // دسته‌های گرفتار در حلقه‌ی parentId هم باید در فهرست بمانند
  for (const row of rows) walk(row, "");
  return out;
}
