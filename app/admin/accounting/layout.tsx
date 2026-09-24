import type { ReactNode } from "react";
import AccountingShell from "@/components/admin/accounting/AccountingShell";

/** قاب مشترک بخش حسابداری — docs/plans/accounting.md بخش ۱۳ */
export default function AccountingLayout({ children }: { children: ReactNode }) {
  return <AccountingShell>{children}</AccountingShell>;
}
