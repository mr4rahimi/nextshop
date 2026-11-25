"use client";

/**
 * «فروش ← مرجوعی» — مرجوعی بیرون از صندوق (سفارش سایت، فروش دستی، یا وقتی صندوق باز نیست).
 * docs/plans/webhesab-parity.md بخش ۳۴.۱.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "../ui";
import ReturnStart from "./ReturnStart";

export default function ReturnsPage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <PageHeader
        title="مرجوعی"
        help="accountingReturns"
        back={{ href: "/admin/accounting/sales?type=SALES_RETURN", label: "فروش" }}
        desc="مشتری را با موبایل یا نام پیدا کنید، یا رسید/فاکتور را بزنید؛ همه‌ی خریدهایش می‌آید. کالاهای برگشتی و دلیل را انتخاب کنید و «برگشت از فروش» را صادر کنید."
        actions={
          <Link href="/admin/accounting/reports/returns" className="text-xs font-bold text-blue-600">
            گزارش مرجوعی‌ها
          </Link>
        }
      />
      <ReturnStart onFree={() => router.push("/admin/accounting/invoices/new?type=SALES_RETURN&free=1")} />
    </div>
  );
}
