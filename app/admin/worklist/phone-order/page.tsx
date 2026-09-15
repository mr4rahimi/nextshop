import PhoneOrderLauncher from "@/components/admin/worklist/PhoneOrderLauncher";

export const dynamic = "force-dynamic";

export const metadata = { title: "ثبت سفارش تلفنی" };

/**
 * سفارش تلفنی بیرون از صفحه‌ی «سفارش‌ها».
 *
 * با دروازه‌ی بخش‌های پنل، کارمند فروشی که `ORDER_CREATE` دارد ولی فهرست همه‌ی
 * سفارش‌ها (`PANEL_ORDERS`) را نه، دیگر به فرم داخل صفحه‌ی سفارش‌ها نمی‌رسید.
 */
export default function PhoneOrderPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">ثبت سفارش تلفنی</h1>
        <p className="text-xs text-gray-500 mt-1">
          سفارش به نام شما ثبت می‌شود و اگر مشتری صاحب نداشته باشد، مشتری شما می‌شود.
        </p>
      </div>
      <PhoneOrderLauncher />
    </div>
  );
}
