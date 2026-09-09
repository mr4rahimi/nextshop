import HelpButton from "@/components/admin/worklist/HelpButton";
import RolesClient from "@/components/admin/worklist/RolesClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "نقش‌ها و دسترسی‌ها" };

export default function RolesPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">
            نقش‌ها و دسترسی‌ها
          </h1>
          <HelpButton topic="roles" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          نقش بسازید و مشخص کنید هر نقش به چه چیزی دسترسی دارد. دادن نقش به هر
          کارمند از صفحه‌ی مدیریت ادمین‌ها انجام می‌شود.
        </p>
      </div>
      <RolesClient />
    </div>
  );
}
