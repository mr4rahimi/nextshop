import { Suspense } from "react";
import ChequesList from "@/components/admin/accounting/cash/ChequesList";

export const dynamic = "force-dynamic";
export const metadata = { title: "چک‌ها" };

export default function Page() {
  return (
    <Suspense>
      <ChequesList />
    </Suspense>
  );
}
