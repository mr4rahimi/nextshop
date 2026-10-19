import { Suspense } from "react";
import PosHub from "@/components/admin/accounting/pos/PosHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "صندوق فروشگاه" };

export default function Page() {
  return (
    <Suspense>
      <PosHub />
    </Suspense>
  );
}
