import SetupWizard from "@/components/admin/accounting/SetupWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "راه‌اندازی حسابداری" };

/** راه‌اندازی حسابداری داخلی — docs/plans/accounting.md بخش ۱۷ */
export default function SetupPage() {
  return <SetupWizard />;
}
