import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { orgGuard } from "@/lib/accounting/org-api";
import { periodList, periodOf } from "@/lib/accounting/org-installments";
import { writeXlsx } from "@/lib/accounting/import/xlsx-write";
import { todayKey } from "@/lib/accounting/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?period=1405-09[&format=xlsx] — فهرست کسر از حقوق یک ماه (برای سازمان یا ثبت دریافت) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await orgGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const u = new URL(req.url).searchParams;
    const period = u.get("period") || periodOf(todayKey());
    const list = await periodList(prisma, id, period);
    if (u.get("format") === "xlsx") {
      const org = await prisma.accInstallmentOrg.findUniqueOrThrow({ where: { id }, select: { name: true } });
      const rows = [
        ["ردیف", "نام و نام خانوادگی", "کد پرسنلی", "کد ملی", "موبایل", "کسر از حقوق این ماه", "قسط این ماه (پس از پورسانت)", "معوق ماه‌های قبل", "قابل پرداخت به فروشگاه", "مانده‌ی کل", "شماره‌ی قرارداد"],
        ...list.rows.map((r, i) => [i + 1, r.name, r.employeeCode ?? "", r.nationalId ?? "", r.mobile ?? "", r.dueGross, r.due, r.overdue, r.toPay, r.remaining, r.contracts.join("، ")]),
        ["", "جمع", "", "", "", list.totalGross, list.total, "", list.toPay, "", ""],
      ];
      const buf = writeXlsx([{ name: list.label, rows }]);
      const name = encodeURIComponent(`اقساط ${org.name} ${list.label}.xlsx`);
      return new NextResponse(new Uint8Array(buf), {
        headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename*=UTF-8''${name}` },
      });
    }
    return NextResponse.json(serialize(list));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-period]");
  }
}
