import VouchersClient from "@/components/admin/accounting/VouchersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "اسناد حسابداری" };

export default function VouchersPage() {
  return <VouchersClient />;
}
