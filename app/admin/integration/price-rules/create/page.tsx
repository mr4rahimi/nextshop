import Link from "next/link";
import RuleFormClient from "../RuleFormClient";

export default function CreatePriceRulePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Link href="/admin/integration/price-rules"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← قوانین قیمت
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">قانون جدید</h1>
      </div>

      <RuleFormClient mode="create" />
    </div>
  );
}
