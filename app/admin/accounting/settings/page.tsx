import { Suspense } from "react";
import AccSettingsClient from "@/components/admin/accounting/AccSettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "تنظیمات حسابداری" };

export default function AccSettingsPage() {
  return (
    <Suspense>
      <AccSettingsClient />
    </Suspense>
  );
}
