"use client";

/** ارزش موجودی کالا — تعداد × میانگین موزون، به تفکیک دسته/کالا/انبار (بخش ۱۱) */

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatJalali } from "@/lib/club/jalali";
import { todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import { api, Badge, Card, Chips, inputCls } from "../ui";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

type By = "category" | "product" | "warehouse";
interface Data {
  rows: { key: string; label: string; qty: number; inTransit: number; value: string; products: number }[];
  /** `qty` کالای در راه را هم دارد — جزو انبار مقصد */
  totals: { qty: number; inTransit: number; value: string };
  kardexValue: string;
  ledgerValue: string;
}

export default function InventoryValueReport() {
  const [by, setBy] = useState<By>("category");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const { data, error, loading } = useReport<Data>("inventory", { by, warehouseId: by === "warehouse" ? null : warehouseId });
  const label = by === "category" ? "دسته" : by === "product" ? "کالا" : "انبار";

  useEffect(() => {
    api<{ items: { id: string; name: string }[] }>("/api/admin/accounting/inventory/warehouses")
      .then((d) => setWarehouses(d.items))
      .catch(() => {});
  }, []);

  function exportCsv() {
    if (!data) return;
    downloadCsv(`inventory-value-${by}`, [label, "تعداد", "ارزش"], [...data.rows.map((r) => [r.label, r.qty, r.value]), ["جمع", data.totals.qty, data.totals.value]]);
  }
  const matched = data && data.kardexValue === data.ledgerValue;
  const transit = !!data?.totals.inTransit;
  const transitHref = (key?: string) => `/admin/accounting/inventory/transfers?view=transit${key && by === "warehouse" ? `&dst=${key}` : warehouseId && by !== "warehouse" ? `&dst=${warehouseId}` : ""}`;

  return (
    <ReportFrame
      title="ارزش موجودی کالا"
      help="accountingInventoryValue"
      desc="کالاهای در انبار با بهای میانگین خریدشان — پولی که به شکل کالا در انبار خوابیده. کالای در راه جزو انبار مقصد است."
      printSub={`${formatJalali(todayKey())} — به تفکیک ${label}`}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <Chips<By>
            value={by}
            onChange={setBy}
            options={[
              { value: "category", label: "دسته" },
              { value: "product", label: "کالا" },
              { value: "warehouse", label: "انبار" },
            ]}
          />
          {by !== "warehouse" && warehouses.length > 1 && (
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={`${inputCls} max-w-xs`}>
              <option value="">همه‌ی انبارها</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
      }
    >
      {data && (
        <>
          <Card className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span>
              ارزش کل کاردکس <Amt v={data.kardexValue} strong />
            </span>
            <span>
              حساب «موجودی کالا» در دفتر <Amt v={data.ledgerValue} strong />
            </span>
            {matched ? <Badge tone="green">✓ با دفتر می‌خواند</Badge> : <Badge tone="amber">اختلاف دارد — سند دستی روی حساب موجودی کالا؟</Badge>}
          </Card>
          <Table
            head={
              <tr>
                <th className={th}>{label}</th>
                {by !== "product" && <th className={thNum}>تعداد کالا</th>}
                <th className={thNum}>تعداد</th>
                {transit && <th className={thNum}>از آن در راه</th>}
                <th className={thNum}>ارزش</th>
              </tr>
            }
            foot={
              <tr>
                <td className={td}>جمع</td>
                {by !== "product" && <td />}
                <td className={tdNum}>{faNum(data.totals.qty)}</td>
                {transit && (
                  <td className={tdNum}>
                    <Link href={transitHref()} className="text-amber-600 hover:underline">
                      {faNum(data.totals.inTransit)}
                    </Link>
                  </td>
                )}
                <td className={tdNum}><Amt v={data.totals.value} strong /></td>
              </tr>
            }
          >
            {data.rows.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-white/5">
                <td className={`${td} max-w-[20rem] truncate`}>{r.label}</td>
                {by !== "product" && <td className={`${tdNum} tabular-nums text-gray-500`}>{faNum(r.products)}</td>}
                <td className={`${tdNum} tabular-nums ${r.qty < 0 ? "text-red-600" : ""}`}>{faNum(r.qty)}</td>
                {transit && (
                  <td className={`${tdNum} tabular-nums`}>
                    {r.inTransit ? (
                      <Link href={transitHref(r.key)} className="text-amber-600 hover:underline">
                        {faNum(r.inTransit)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={tdNum}><Amt v={r.value} /></td>
              </tr>
            ))}
            {!data.rows.length && (
              <tr>
                <td className={`${td} text-center text-xs text-gray-400 py-8`} colSpan={5}>
                  کالایی در انبار نیست.
                </td>
              </tr>
            )}
          </Table>
        </>
      )}
    </ReportFrame>
  );
}
