import type { ReactNode } from "react";
import ToolsShell from "@/components/admin/tools/ToolsShell";

/** قاب مشترک ابزارها — docs/features/tools.md */
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <ToolsShell>{children}</ToolsShell>;
}
