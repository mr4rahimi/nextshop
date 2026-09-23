import HelpButton from "@/components/admin/worklist/HelpButton";
import MyOrdersClient from "@/components/admin/worklist/MyOrdersClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "سفارش‌های من" };

/** سفارش‌های تلفنیِ همین کارمند — بدون نیاز به بخش «سفارش‌ها»ی سایت (`PANEL_ORDERS`) */
export default function MyOrdersPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">سفارش‌های من</h1>
          <HelpButton topic="myOrders" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          سفارش‌های تلفنی که خودتان ثبت کرده‌اید، با وضعیت، قیمت خرید و سود هر کدام.
        </p>
      </div>
      <MyOrdersClient />
    </div>
  );
}
