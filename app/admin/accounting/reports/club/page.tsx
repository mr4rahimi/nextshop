import ClubCreditReport from "@/components/admin/accounting/reports/ClubCreditReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "اعتبار باشگاه مشتریان" };

export default function Page() {
  return <ClubCreditReport />;
}
