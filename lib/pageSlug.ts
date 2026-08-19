/**
 * تولید اسلاگ یکتای برگه — سمت سرور (به Prisma نیاز دارد).
 * از `lib/pages.ts` جداست چون آن فایل باید در کلاینت هم قابل import بماند.
 */
import { prisma } from "@/lib/prisma";
import { isValidSlug, slugify } from "@/lib/slug";
import { RESERVED_PAGE_SLUGS } from "@/lib/pages";

export async function resolvePageSlug(
  raw: string,
  fallback: string,
  skipId?: string
): Promise<{ slug: string } | { error: string }> {
  const base = slugify(raw || fallback);
  if (!isValidSlug(base)) {
    return { error: "نشانی برگه نامعتبر است (فقط حروف لاتین، عدد و خط تیره)" };
  }
  if (RESERVED_PAGE_SLUGS.has(base)) {
    return { error: `نشانی «${base}» رزرو شده است و توسط صفحات خود سایت استفاده می‌شود` };
  }

  let final = base, n = 2;
  for (;;) {
    const hit = await prisma.page.findUnique({ where: { slug: final }, select: { id: true } });
    if (!hit || hit.id === skipId) break;
    final = `${base}-${n++}`;
  }
  return { slug: final };
}
