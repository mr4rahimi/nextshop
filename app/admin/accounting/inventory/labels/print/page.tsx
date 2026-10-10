import { Suspense } from "react";
import LabelsPrint from "@/components/admin/accounting/inventory/LabelsPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "چاپ برچسب کالا" };

export default function Page() {
  return (
    <Suspense>
      <LabelsPrint />
    </Suspense>
  );
}
