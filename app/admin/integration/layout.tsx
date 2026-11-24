import type { ReactNode } from "react";
import IntegrationShell from "@/components/admin/integration/IntegrationShell";
import { getHiddenSections } from "@/lib/integration/core/config";

export const dynamic = "force-dynamic";

/** قاب مشترک یکپارچه‌سازی — docs/integrations/settings-and-guide.md */
export default async function IntegrationLayout({ children }: { children: ReactNode }) {
  const hidden = await getHiddenSections().catch(() => new Set<never>());
  return <IntegrationShell hidden={[...hidden]}>{children}</IntegrationShell>;
}
