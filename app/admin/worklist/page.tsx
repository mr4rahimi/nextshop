import WorklistClient from "@/components/admin/worklist/WorklistClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "کارهای من" };

export default function MyWorklistPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">کارهای من</h1>
        <p className="text-xs text-gray-500 mt-1">
          کارهای امروز، عقب‌افتاده و پیش رو. نتیجه را همین‌جا ثبت کنید تا کار بسته شود.
        </p>
      </div>
      <WorklistClient scope="me" />
    </div>
  );
}
