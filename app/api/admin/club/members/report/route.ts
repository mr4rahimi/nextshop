import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { fromJalali, jalaliToday, jalaliMonthLength } from "@/lib/club/jalali";
import { ownerReport } from "@/lib/club/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * گزارش پخش مشتری بین کارکنان — بخش ۲۱.۶.
 *
 * `from` و `to` تاریخ شمسی «1405-06-01» و شامل هر دو روزند. پیش‌فرض ماه جاری.
 */
export async function GET(req: Request) {
  const guard = await requirePermission("CUSTOMER_VIEW_ALL");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const sp = new URL(req.url).searchParams;
  const today = jalaliToday();
  const parse = (v: string | null) => {
    const m = v?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? fromJalali(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  };

  const from = parse(sp.get("from")) ?? fromJalali(today.year, today.month, 1);
  const toDay =
    parse(sp.get("to")) ?? fromJalali(today.year, today.month, jalaliMonthLength(today.year, today.month));
  if (!from || !toDay || toDay < from) {
    return NextResponse.json({ error: "بازه‌ی تاریخ نامعتبر است" }, { status: 400 });
  }

  // مرز روز به وقت تهران: از نیمه‌شب «از» تا نیمه‌شبِ بعد از «تا»
  const OFFSET = 210 * 60_000;
  const start = new Date(from.getTime() - OFFSET);
  const end = new Date(toDay.getTime() - OFFSET + 86_400_000);

  const rows = await ownerReport(start, end);
  return NextResponse.json({ rows, from: start.toISOString(), to: end.toISOString() });
}
