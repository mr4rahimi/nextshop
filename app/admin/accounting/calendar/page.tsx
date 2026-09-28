import CalendarClient from "@/components/admin/accounting/CalendarClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "تقویم سررسیدها" };

export default function Page() {
  return <CalendarClient />;
}
