import { Suspense } from "react";
import PartyStatementPrint from "@/components/admin/accounting/PartyStatementPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "چاپ صورت‌حساب" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PartyStatementPrint id={id} />
    </Suspense>
  );
}
