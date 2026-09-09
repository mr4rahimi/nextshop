import HelpButton from "@/components/admin/worklist/HelpButton";
import RulesClient from "@/components/admin/worklist/RulesClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "تنظیمات کارتابل" };

export default function WorklistSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">
            قواعد تکرارشونده
          </h1>
          <HelpButton topic="rules" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          کارهای تکراری را اینجا تعریف کنید تا هر روز خودشان در کارتابل مسئولشان
          بیایند و کسی مجبور نباشد دستی ثبتشان کند.
        </p>
      </div>
      <RulesClient />
    </div>
  );
}
