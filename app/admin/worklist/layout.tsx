import type { ReactNode } from "react";
import WorklistShell from "@/components/admin/worklist/WorklistShell";

/** قاب مشترک کارتابل — شبکه‌ی بخش‌ها، نوار ماژول و فاصله‌ی صفحه */
export default function WorklistLayout({ children }: { children: ReactNode }) {
  return <WorklistShell>{children}</WorklistShell>;
}
