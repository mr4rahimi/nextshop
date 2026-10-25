import AdjustmentsClient from "@/components/admin/accounting/inventory/AdjustmentsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود و خروج کالا" };

export default function Page() {
  return <AdjustmentsClient />;
}
