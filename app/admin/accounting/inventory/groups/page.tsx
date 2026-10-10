import ItemGroupsClient from "@/components/admin/accounting/inventory/ItemGroupsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "گروه‌های کالا" };

export default function Page() {
  return <ItemGroupsClient />;
}
