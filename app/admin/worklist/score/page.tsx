import HelpButton from "@/components/admin/worklist/HelpButton";
import ScoreClient from "@/components/admin/worklist/ScoreClient";
import { can, getStaffAccess } from "@/lib/permissions";
import { getScoreSettings } from "@/lib/worklist/score";

export const dynamic = "force-dynamic";

export const metadata = { title: "امتیاز عملکرد" };

/**
 * امتیاز عملکرد ماهانه — بخش ۱۵ مستندات کارتابل.
 *
 * ⚠️ این با پورسانت یکی نیست: امتیاز می‌گوید چطور کار کرد، پورسانت می‌گوید
 * چقدر فروخت. هر تب مجوز خودش را دارد و APIها هم جدا چک می‌کنند.
 */
export default async function ScorePage() {
  const [access, settings] = await Promise.all([getStaffAccess(), getScoreSettings()]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">امتیاز عملکرد</h1>
          <HelpButton topic="staffScore" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          ماهانه و نسبی: هر کس با هم‌گروه‌های خودش در همان ماه مقایسه می‌شود. عدد خام همیشه کنار امتیاز است.
        </p>
      </div>
      <ScoreClient
        canOwn={can(access, "SCORE_VIEW_OWN")}
        canAll={can(access, "SCORE_VIEW_ALL")}
        canManage={can(access, "SCORE_SETTINGS_MANAGE")}
        enabled={settings.enabled}
      />
    </div>
  );
}
