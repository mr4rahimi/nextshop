import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivityAsync, diffFields, summarizeChanges } from "@/lib/activity";
import { faqForPrisma } from "@/lib/faq-db";

/** فیلدهای دسته‌بندی که تغییرشان در گزارش ثبت می‌شود */
const CATEGORY_FIELDS = {
  title:          { label: "عنوان" },
  slug:           { label: "نشانی (slug)" },
  imageUrl:       { label: "تصویر دسته", kind: "image" as const },
  description:    { label: "توضیحات (پایین گرید)" },
  descriptionTop: { label: "توضیحات (بالای گرید)" },
  faq:            { label: "سوالات متداول" },
  seoTitle:       { label: "عنوان سئو" },
  seoDescription: { label: "توضیح سئو" },
  isActive:       { label: "وضعیت نمایش", kind: "bool" as const },
  parentId:       { label: "دسته‌ی والد" },
  sortOrder:      { label: "ترتیب" },
};



// GET
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      parent: true,
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json(categories);
}

// POST (Create)
export async function POST(req: Request) {
  const data = await req.json();

  const category = await prisma.category.create({
    data: {
      ...data,
      parentId: data.parentId ? data.parentId : null,
      // `...data` مقدار خام را می‌نوشت؛ ستون Json باید همیشه نرمال‌شده باشد
      // وگرنه ردیف ناقص به `Question` بدون پاسخ در اسکیما تبدیل می‌شود.
      faq: faqForPrisma(data.faq),
    },
  });

  logActivityAsync({
    action: "CREATE",
    entity: "CATEGORY",
    entityId: category.id,
    entityTitle: category.title,
    summary: `دسته‌بندی «${category.title}» ایجاد شد`,
    changes: [{ field: "imageUrl", label: "تصویر دسته", kind: "image", before: null, after: category.imageUrl }],
  });

  return NextResponse.json(category);
}

// PUT (Update)
export async function PUT(req: Request) {
  const data = await req.json();

  const before = await prisma.category.findUnique({ where: { id: data.id } });

  const category = await prisma.category.update({
    where: { id: data.id },
    data: {
      title: data.title,
      slug: data.slug,

      description: data.description,
      imageUrl: data.imageUrl,

      /**
       * فقط وقتی نوشته می‌شود که کلید در بدنه باشد.
       * `data.faq` مطلق یعنی یک بدنه‌ی ناقص (مثلاً از فرمی که این تب را
       * ندارد) سوالات متداول موجود را پاک می‌کند.
       */
      ...("descriptionTop" in data ? { descriptionTop: data.descriptionTop } : {}),
      ...("faq" in data ? { faq: faqForPrisma(data.faq) } : {}),

      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      seoKeywords: data.seoKeywords,

      sortOrder: data.sortOrder,
      isActive: data.isActive,

      parent: data.parentId
        ? { connect: { id: data.parentId } }
        : { disconnect: true },
    },
  });

  if (before) {
    const changes = diffFields(before as never, data, CATEGORY_FIELDS);
    if (changes.length > 0) {
      logActivityAsync({
        action: "UPDATE",
        entity: "CATEGORY",
        entityId: category.id,
        entityTitle: category.title,
        summary: summarizeChanges(changes),
        changes,
      });
    }
  }

  return NextResponse.json(category);
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();

  const [childrenCount, productsCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (childrenCount > 0) {
    return NextResponse.json(
      { error: `این دسته دارای ${childrenCount} زیردسته است و قابل حذف نیست` },
      { status: 400 }
    );
  }

  if (productsCount > 0) {
    return NextResponse.json(
      { error: `این دسته دارای ${productsCount} محصول است و قابل حذف نیست` },
      { status: 400 }
    );
  }

  const before = await prisma.category.findUnique({ where: { id } });
  await prisma.category.delete({ where: { id } });

  logActivityAsync({
    action: "DELETE",
    entity: "CATEGORY",
    entityId: id,
    entityTitle: before?.title ?? id,
    summary: `دسته‌بندی «${before?.title ?? id}» حذف شد`,
    changes: [{ field: "imageUrl", label: "تصویر دسته", kind: "image", before: before?.imageUrl ?? null, after: null }],
  });

  return NextResponse.json({ success: true });
}
