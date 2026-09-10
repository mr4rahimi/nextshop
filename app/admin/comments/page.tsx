"use client";

/**
 * مدیریت نظرات — دو تب: نظرات فروشگاه (روی محصول) و نظرات مقالات (بلاگ).
 *
 * تب فعال در آدرس می‌نشیند (`?tab=blog`) تا لینک‌دادن به یک تب ممکن باشد
 * و رفرش صفحه کاربر را به تب اول برنگرداند.
 *
 * مستندات: docs/features/reviews.md
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ShopReviews from "@/components/admin/comments/ShopReviews";
import BlogComments from "@/components/admin/comments/BlogComments";

const TABS = [
  { key: "shop", label: "نظرات فروشگاه" },
  { key: "blog", label: "نظرات مقالات" },
];

function CommentsTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("tab") === "blog" ? "blog" : "shop";
  const [tab, setTab] = useState(initial);

  function select(key: string) {
    setTab(key);
    router.replace(key === "shop" ? "/admin/comments" : `/admin/comments?tab=${key}`, {
      scroll: false,
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">نظرات</h1>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-6">
          هر نظر تازه در وضعیت «در انتظار تأیید» می‌نشیند و تا تأیید شما در سایت دیده نمی‌شود.
          تأیید یک نظر، میانگین امتیاز محصول را همان لحظه به‌روز می‌کند.
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              tab === t.key
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "shop" ? <ShopReviews /> : <BlogComments />}
    </div>
  );
}

export default function CommentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">در حال بارگذاری…</div>}>
      <CommentsTabs />
    </Suspense>
  );
}
