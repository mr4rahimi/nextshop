import { Suspense } from "react";
import InstallmentsList from "@/components/admin/accounting/installments/InstallmentsList";

export const dynamic = "force-dynamic";
export const metadata = { title: "اقساط" };

export default function Page() {
  return (
    <Suspense>
      <InstallmentsList />
    </Suspense>
  );
}
