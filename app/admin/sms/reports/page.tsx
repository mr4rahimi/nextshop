"use client";

import { useState } from "react";
import {
  Card,
  Button,
  ErrorBox,
  Empty,
  Skeleton,
  Table,
  Pager,
  Badge,
  PageHeader,
  fa,
  faDate,
  useApi,
} from "@/components/admin/sms/ui";
import { statusLabel, statusTone } from "@/components/admin/sms/status";
import type { SendRequestRow, Paged } from "@/lib/club/sms/panel-types";
import type { SendRequestInfo, DeliveryItem } from "@/lib/club/sms/types";

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  const list = useApi<Paged<SendRequestRow>>(`/api/admin/sms/reports?page=${page}&limit=20`);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="گزارش ارسال"
        hint="همه‌ی ارسال‌های این حساب — از فروشگاه و از خود پنل"
      />

      <Card>
        {list.loading ? (
          <Skeleton rows={5} />
        ) : list.err ? (
          <ErrorBox err={list.err} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <Empty text="هنوز ارسالی ثبت نشده است" />
        ) : (
          <>
            <Table head={["شناسه", "وضعیت", "نوع", "خط", "کل", "تحویل", "زمان", ""]}>
              {list.data.items.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 text-[11px] font-black text-gray-700 dark:text-gray-200 tabular-nums">
                    {r.id}
                  </td>
                  <td className="py-2.5">
                    <Badge text={statusLabel(r.status)} tone={statusTone(r.status)} />
                  </td>
                  <td className="py-2.5 text-[11px] font-bold text-gray-500">{r.type || "—"}</td>
                  <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums" dir="ltr">
                    {r.lineNumber ?? "—"}
                  </td>
                  <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                    {r.counts ? fa(r.counts.total) : "—"}
                  </td>
                  <td className="py-2.5 text-[11px] font-bold text-emerald-600 tabular-nums">
                    {r.counts ? fa(r.counts.delivered) : "—"}
                  </td>
                  <td className="py-2.5 text-[10px] font-bold text-gray-400 whitespace-nowrap">
                    {faDate(r.createdAt ?? r.schedule)}
                  </td>
                  <td className="py-2.5 text-left">
                    <button
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="text-[10px] font-black text-primary-600 hover:underline whitespace-nowrap"
                    >
                      {open === r.id ? "بستن" : "جزئیات"}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
            <Pager
              page={list.data.page}
              lastPage={list.data.lastPage}
              total={list.data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      {open !== null && <Detail requestId={open} />}
    </div>
  );
}

/**
 * جزئیات یک ارسال
 *
 * ⚠️ وضعیت تک‌تک گیرنده‌ها فقط با کلیک صریح گرفته می‌شود. برای ارسال‌های بزرگ
 *    این چند رفت‌وبرگشت صفحه‌بندی‌شده است و نباید خودکار اجرا شود.
 */
function Detail({ requestId }: { requestId: number }) {
  const [wantItems, setWantItems] = useState(false);

  const detail = useApi<{ request: SendRequestInfo | null; items: DeliveryItem[] | null }>(
    `/api/admin/sms/reports/${requestId}${wantItems ? "?items=1" : ""}`
  );

  const c = detail.data?.request?.counts;

  return (
    <Card title={`جزئیات ارسال ${requestId}`}>
      {detail.loading ? (
        <Skeleton rows={2} />
      ) : detail.err ? (
        <ErrorBox err={detail.err} onRetry={detail.reload} />
      ) : !detail.data?.request ? (
        <Empty text="اطلاعاتی برای این ارسال یافت نشد" />
      ) : (
        <>
          {detail.data.request.rejectedDue && (
            <p className="text-[11px] font-bold text-red-500 leading-relaxed">
              علت رد: {detail.data.request.rejectedDue}
            </p>
          )}

          {c && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="کل" value={c.total} />
              <Stat label="ارسال‌شده" value={c.sent} />
              <Stat label="تحویل‌شده" value={c.delivered} tone="ok" />
              <Stat label="ناموفق" value={c.deliveryFailure + c.sendFailure} tone="bad" />
              <Stat label="در صف" value={c.inQueue} />
              <Stat label="شروع‌نشده" value={c.notStarted} />
              <Stat label="لیست سیاه" value={c.blacklist} />
              <Stat label="نامشخص" value={c.deliveryUndetermined} />
            </div>
          )}

          {!wantItems ? (
            <Button variant="ghost" onClick={() => setWantItems(true)}>
              نمایش وضعیت تک‌تک گیرنده‌ها
            </Button>
          ) : !detail.data.items?.length ? (
            <Empty text="جزئیات گیرنده‌ها در دسترس نیست" />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table head={["شماره", "وضعیت", "صفحه", "خطا"]}>
                {detail.data.items.map((it, i) => (
                  <tr key={`${it.mobile}-${i}`}>
                    <td
                      className="py-2 text-[11px] font-black text-gray-700 dark:text-gray-200 tabular-nums"
                      dir="ltr"
                    >
                      {it.mobile}
                    </td>
                    <td className="py-2">
                      <Badge text={statusLabel(it.status)} tone={statusTone(it.status)} />
                    </td>
                    <td className="py-2 text-[11px] font-bold text-gray-500 tabular-nums">
                      {fa(it.pages ?? 1)}
                    </td>
                    <td className="py-2 text-[10px] font-bold text-red-500">{it.error ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const color =
    tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-red-500" : "text-gray-900 dark:text-white";

  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
      <p className="text-[10px] font-black text-gray-400">{label}</p>
      <p className={`text-lg font-black tabular-nums mt-0.5 ${color}`}>{fa(value)}</p>
    </div>
  );
}
