import AccountingHomeClient from "@/components/admin/accounting/AccountingHomeClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "حسابداری" };

/** خانه‌ی حسابداری — docs/plans/accounting.md بخش ۴.۴ و ۱۳ */
export default function AccountingPage() {
  return <AccountingHomeClient />;
}
