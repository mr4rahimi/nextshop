/**
 * درگاه پرداخت آزمایشی دمو — docs/plans/demo.md مرحله‌ی ۲.
 *
 * `api/payment/create` در دمو به اینجا می‌فرستد. هر دو دکمه همان callback
 * واقعی را صدا می‌زنند؛ پس کسر موجودی، فاکتور فروش، دریافت وجه و باشگاه همان
 * مسیر پرداخت واقعی را می‌روند. بیرون از دمو این صفحه وجود ندارد.
 */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "درگاه پرداخت آزمایشی", robots: { index: false } };

export default async function DemoPayPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDemo()) notFound();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, grandTotal: true, status: true },
  });
  if (!order) notFound();

  const transid = `demo-${order.id}`;
  const ok = `/api/payment/callback?invoice_id=${order.id}&status=1&transid=${transid}&tracking_number=${transid}`;
  const cancel = `/api/payment/callback?invoice_id=${order.id}&status=0`;

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl">
        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          درگاه آزمایشی نسخه‌ی نمایشی
        </span>
        <h1 className="mt-4 text-xl font-black text-gray-900">پرداخت سفارش {order.orderNumber}</h1>
        <p className="mt-3 text-3xl font-black text-gray-900">
          {Number(order.grandTotal).toLocaleString("fa-IR")} <span className="text-base font-bold text-gray-500">تومان</span>
        </p>
        <p className="mt-4 text-sm leading-7 text-gray-600">
          در نسخه‌ی شما اینجا درگاه بانکی واقعی باز می‌شود. در دمو هیچ پولی جابه‌جا نمی‌شود؛
          نتیجه را خودتان انتخاب کنید تا ادامه‌ی مسیر سفارش را در پنل ببینید.
        </p>
        {order.status === "PENDING_PAYMENT" ? (
          <div className="mt-6 grid gap-3">
            <a href={ok} className="rounded-2xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700">
              پرداخت موفق
            </a>
            <a href={cancel} className="rounded-2xl border border-gray-300 py-3 font-bold text-gray-700 hover:bg-gray-50">
              انصراف از پرداخت
            </a>
          </div>
        ) : (
          <a href={`/checkout/success/${order.id}`} className="mt-6 block rounded-2xl bg-gray-900 py-3 font-black text-white">
            این سفارش قبلاً پرداخت شده
          </a>
        )}
      </div>
    </main>
  );
}
