import AccountLedgerClient from "@/components/admin/accounting/AccountLedgerClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "دفتر حساب" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountLedgerClient id={id} />;
}
