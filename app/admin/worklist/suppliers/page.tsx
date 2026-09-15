import HelpButton from "@/components/admin/worklist/HelpButton";
import SuppliersClient from "@/components/admin/worklist/SuppliersClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "تأمین‌کننده‌ها" };

export default function SuppliersPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">تأمین‌کننده‌ها</h1>
          <HelpButton topic="suppliers" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          فهرست مشترک برای ثبت کار و معامله. در فرم کار هم می‌شود تأمین‌کننده‌ی تازه را سریع اضافه کرد.
        </p>
      </div>
      <SuppliersClient />
    </div>
  );
}
