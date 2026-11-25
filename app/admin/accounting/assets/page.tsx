import { Suspense } from "react";
import AssetsClient from "@/components/admin/accounting/assets/AssetsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "دارایی ثابت و پیش‌پرداخت" };

export default function AssetsPage() {
  return (
    <Suspense>
      <AssetsClient />
    </Suspense>
  );
}
