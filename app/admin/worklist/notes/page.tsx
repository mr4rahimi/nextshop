import HelpButton from "@/components/admin/worklist/HelpButton";
import MyNotesClient from "@/components/admin/worklist/MyNotesClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "یادداشت‌های من" };

export default function MyNotesPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">یادداشت‌های من</h1>
          <HelpButton topic="myNotes" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          دفترچه‌ی شخصی شما. این یادداشت‌ها را فقط خودتان می‌بینید.
        </p>
      </div>
      <MyNotesClient />
    </div>
  );
}
