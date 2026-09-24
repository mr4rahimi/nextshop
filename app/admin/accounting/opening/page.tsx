import { Suspense } from "react";
import OpeningClient from "@/components/admin/accounting/OpeningClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "مانده‌های اول دوره" };

export default function OpeningPage() {
  return (
    <Suspense>
      <OpeningClient />
    </Suspense>
  );
}
