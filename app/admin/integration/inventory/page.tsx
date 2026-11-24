import InventoryClient from "./InventoryClient";
import { PageHeader } from "@/components/admin/accounting/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "موجودی محصولات نگاشت‌شده" };

export default function InventoryPage() {
  return (
    <div className="space-y-2">
      <PageHeader
        title="موجودی"
        help="integrationInventory"
        desc="یک موجودی برای هر محصول، در سایت و همه‌ی بازارگاه‌های نگاشت‌شده."
      />
      <InventoryClient />
    </div>
  );
}
