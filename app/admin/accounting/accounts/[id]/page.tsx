import AccountLedgerClient from "@/components/admin/accounting/AccountLedgerClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "دفتر حساب" };

const dayParam = (v: string | string[] | undefined) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  return <AccountLedgerClient id={id} from={dayParam(sp.from)} to={dayParam(sp.to)} />;
}
