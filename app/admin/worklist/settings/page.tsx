import HelpButton from "@/components/admin/worklist/HelpButton";
import RulesClient from "@/components/admin/worklist/RulesClient";
import WorklistSettingsCard from "@/components/admin/worklist/WorklistSettingsCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "تنظیمات کارتابل" };

export default function WorklistSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">
            تنظیمات کارتابل
          </h1>
          <HelpButton topic="rules" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          کلید کارتابل، سقف حضور روزانه، و کارهای تکراری‌ای که هر روز خودشان در
          کارتابل مسئولشان می‌آیند تا کسی مجبور نباشد دستی ثبتشان کند.
        </p>
      </div>
      <WorklistSettingsCard />
      <RulesClient />
    </div>
  );
}
