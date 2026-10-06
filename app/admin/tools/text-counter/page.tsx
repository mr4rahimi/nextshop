import { Suspense } from "react";
import TextCounterClient from "@/components/admin/tools/TextCounterClient";

export const metadata = { title: "کاراکترشمار" };

/** کاراکترشمار و ویرایشگر متن — docs/features/tools.md بخش ۵ */
export default function ToolsTextCounterPage() {
  return (
    <Suspense>
      <TextCounterClient />
    </Suspense>
  );
}
