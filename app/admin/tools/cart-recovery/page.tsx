import CartRecoveryClient from "@/components/admin/tools/CartRecoveryClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "یادآوری سبد رهاشده" };

/** یادآوری سبد رهاشده — docs/plans/store-tools-2.md بخش ۱ */
export default function ToolsCartRecoveryPage() {
  return <CartRecoveryClient />;
}
