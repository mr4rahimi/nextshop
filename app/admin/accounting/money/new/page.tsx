import { Suspense } from "react";
import MoneyForm from "@/components/admin/accounting/cash/MoneyForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ثبت دریافت یا پرداخت" };

export default function Page() {
  return (
    <Suspense>
      <MoneyForm />
    </Suspense>
  );
}
