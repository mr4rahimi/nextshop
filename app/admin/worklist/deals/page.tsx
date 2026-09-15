import HelpButton from "@/components/admin/worklist/HelpButton";
import DealsClient from "@/components/admin/worklist/DealsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "سود معاملات" };

export default function DealsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">سود معاملات</h1>
          <HelpButton topic="deals" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          هر سفارش پرداخت‌شده اینجا می‌آید. فقط قیمت خرید را وارد کنید؛ فروش را سیستم از خود سفارش می‌داند.
        </p>
      </div>
      <DealsClient />
    </div>
  );
}
