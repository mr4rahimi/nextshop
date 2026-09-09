import HelpButton from "@/components/admin/worklist/HelpButton";
import AttendanceClient from "@/components/admin/worklist/AttendanceClient";
import { jalaliToday } from "@/lib/club/jalali";

export const dynamic = "force-dynamic";

export const metadata = { title: "حضور" };

/**
 * ماهِ جاری روی سرور حساب می‌شود، نه در مرورگر.
 *
 * اگر ساعتِ سیستمِ کارمند عقب باشد، تقویمش ماه دیگری باز می‌کرد و عددها با
 * گزارش مدیر نمی‌خواند.
 */
export default function AttendancePage() {
  const today = jalaliToday();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">حضور</h1>
          <HelpButton topic="attendance" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          هر روز چقدر پنل باز بوده است. مبنا ورود و خروج خودتان به پنل است، نه
          دستگاه حضور و غیاب.
        </p>
      </div>
      <AttendanceClient initialYear={today.year} initialMonth={today.month} />
    </div>
  );
}
