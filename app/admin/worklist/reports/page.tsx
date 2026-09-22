import HelpButton from "@/components/admin/worklist/HelpButton";
import TeamReportClient from "@/components/admin/worklist/TeamReportClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "گزارش عملکرد تیم" };

/**
 * گزارش عملکرد تیم — فاز ۶.
 *
 * ⚠️ این با `/admin/reports` یکی نیست و نباید بشود: آن **ممیزیِ تغییرات**
 * است (چه کسی چه چیزی را عوض کرد)، این **مدیریتِ کار** است. داده‌ی هر دو
 * اینجا کنار هم دیده می‌شود ولی در دو ستون جدا.
 */
export default function WorklistReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">گزارش عملکرد تیم</h1>
          <HelpButton topic="teamReport" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          کار دستی و کار خودکار، کنار هم و جدا از هم. هیچ عددی اینجا ذخیره
          نمی‌شود؛ هر بار از روی خودِ کارها حساب می‌شود.
        </p>
      </div>
      <TeamReportClient />
    </div>
  );
}
