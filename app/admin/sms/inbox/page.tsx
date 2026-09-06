"use client";

import { useState } from "react";
import {
  Card,
  ErrorBox,
  Empty,
  Skeleton,
  Table,
  Button,
  PageHeader,
  faDate,
  useApi,
} from "@/components/admin/sms/ui";
import type { InboxMessage } from "@/lib/club/sms/types";

/**
 * پیام‌های دریافتی
 *
 * ⚠️ این پنل webhook ندارد؛ پیام‌ها باید pull شوند. عمداً polling خودکار
 *    نگذاشتیم — یک تب باز در ادمین نباید هر چند ثانیه به پنل درخواست بزند.
 *    همگام‌سازی واقعی (تشخیص «لغو۱۱») کار Worker باشگاه است، نه این صفحه.
 */
export default function InboxPage() {
  const [page, setPage] = useState(1);
  const list = useApi<{ messages: InboxMessage[] }>(`/api/admin/sms/inbox?page=${page}&limit=50`);

  const messages = list.data?.messages ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="پیام‌های دریافتی"
        hint="پاسخ‌های مشتریان روی خطوط شما. لغو عضویت خودکار توسط باشگاه مشتریان پردازش می‌شود."
        action={
          <Button variant="ghost" onClick={list.reload} disabled={list.loading}>
            {list.loading ? "..." : "بروزرسانی"}
          </Button>
        }
      />

      <Card>
        {list.loading ? (
          <Skeleton rows={4} />
        ) : list.err ? (
          <ErrorBox err={list.err} onRetry={list.reload} />
        ) : messages.length === 0 ? (
          <Empty text={page > 1 ? "پیام دیگری نیست" : "پیام دریافتی ثبت نشده است"} />
        ) : (
          <Table head={["فرستنده", "متن", "خط", "زمان"]}>
            {messages.map((m) => (
              <tr key={m.id}>
                <td
                  className="py-2.5 text-[11px] font-black text-gray-700 dark:text-gray-200 tabular-nums align-top"
                  dir="ltr"
                >
                  {m.from}
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 leading-relaxed">
                  {m.text}
                </td>
                <td
                  className="py-2.5 text-[11px] font-bold text-gray-400 tabular-nums align-top"
                  dir="ltr"
                >
                  {m.to ?? "—"}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-400 whitespace-nowrap align-top">
                  {faDate(m.receivedAt)}
                </td>
              </tr>
            ))}
          </Table>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            قبلی
          </Button>
          <Button variant="ghost" disabled={messages.length < 50} onClick={() => setPage((p) => p + 1)}>
            بعدی
          </Button>
        </div>
      </Card>
    </div>
  );
}
