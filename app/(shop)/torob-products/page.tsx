import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

// این صفحه فقط برای خزیدن ربات‌های تجمیع‌کننده قیمت (مثل ترب) است.
// عمداً نوایندکس است تا در نتایج گوگل ظاهر نشود، ولی follow است تا
// ربات بتواند از طریق لینک‌های این صفحه به صفحه تک‌محصول برسد.
export const metadata: Metadata = {
  title: "لیست محصولات",
  robots: {
    index: false,
    follow: true,
  },
};

// همیشه در لحظه از دیتابیس بخوان (کش نشود) تا ترب همیشه لیست به‌روز ببیند.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 1000;

interface Props {
  searchParams: { page?: string };
}

export default async function TorobProductsPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams?.page) || 1);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" }, // ترتیب پایدار برای صفحه‌بندی سازگار بین بازدیدها
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
      },
    }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div dir="rtl" style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>لیست محصولات ({total.toLocaleString("en-US")})</h1>
      <p>
        صفحه {page.toLocaleString("en-US")} از {totalPages.toLocaleString("en-US")}
      </p>

      <ul>
        {items.map((p) => (
          <li key={p.id}>
            {/* آدرس صفحه تک‌محصول را در صورت متفاوت بودن اصلاح کنید */}
            <Link href={`/products/${p.slug}`}>{p.title}</Link>
          </li>
        ))}
      </ul>

      <nav style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {page > 1 && (
          <Link href={`/torob-products?page=${page - 1}`}>صفحه قبل</Link>
        )}
        {page < totalPages && (
          <Link href={`/torob-products?page=${page + 1}`}>صفحه بعد</Link>
        )}
      </nav>
    </div>
  );
}