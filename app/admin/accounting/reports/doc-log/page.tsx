import DocLogReport from "@/components/admin/accounting/reports/DocLogReport";

export const dynamic = "force-dynamic";
export const metadata = { title: "اسناد باطل‌شده و ویرایش‌شده" };

export default function Page() {
  return <DocLogReport />;
}
