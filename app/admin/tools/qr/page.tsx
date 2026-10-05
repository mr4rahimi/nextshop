import { Suspense } from "react";
import QrClient from "@/components/admin/tools/QrClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "کیوآر کد" };

/** کیوآر کد — docs/features/tools.md بخش ۲ */
export default function ToolsQrPage() {
  return (
    <Suspense>
      <QrClient />
    </Suspense>
  );
}
