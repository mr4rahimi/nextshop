import { redirect } from "next/navigation";

/** پیشنهادها حالا زبانه‌ی خود صفحه‌ی نگاشت است (تأیید گروهی) */
export default function SuggestionsPage() {
  redirect("/admin/integration/mapping?tab=suggestions");
}
