"use client";

/**
 * خانه‌ی ابزارها — کاشی‌ها از `TOOLS_APPS` به تفکیک `group` و چند عدد خلاصه.
 * docs/features/tools.md
 */

import { useEffect, useMemo, useState } from "react";
import { Card, PageHeader, SectionTitle, Stat } from "../accounting/ui";
import { useAccess } from "../accounting/access";
import { TOOLS_APPS, TOOLS_GROUP_BUSINESS, TOOLS_GROUP_MARKETING } from "../apps";
import { AppGrid } from "../AppGrid";

interface Summary {
  links: number;
  qrs: number;
  landings: number;
  published: number;
  clicks30: number;
  reviewsSent30: number;
  reviewsEnabled: boolean;
  cartSent30: number;
  cartRecovered30: number;
  cartEnabled: boolean;
  stockWaiting: number;
}

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function ToolsHomeClient() {
  const [s, setS] = useState<Summary | null>(null);
  const { ready, can } = useAccess();
  const apps = useMemo(() => TOOLS_APPS.filter((a) => !ready || !a.perm || can(a.perm)), [ready, can]);
  const groups = useMemo(
    () =>
      [TOOLS_GROUP_MARKETING, TOOLS_GROUP_BUSINESS]
        .map((g) => ({ title: g, apps: apps.filter((a) => (a.group ?? TOOLS_GROUP_MARKETING) === g) }))
        .filter((g) => g.apps.length),
    [apps],
  );

  useEffect(() => {
    fetch("/api/admin/tools/summary").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ابزارها"
        help="tools"
        desc="کیوآر کد، لینک کوتاه، لندینگ، درخواست ثبت نظر، یادآوری سبد رهاشده و «موجود شد خبرم کن» روی دامنه‌ی خود فروشگاه با آمار — و ابزارهای سریع مثل کاراکترشمار، ماشین‌حساب قیمت و نقطه‌ی سربه‌سر."
      />

      {groups.map((g) => (
        <Card key={g.title} className="px-2 py-3 sm:px-4">
          <div className="px-2 pt-1">
            <SectionTitle title={g.title} />
          </div>
          <AppGrid apps={g.apps} />
        </Card>
      ))}

      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="لینک کوتاه" value={fa(s.links)} sub={`${fa(s.clicks30)} کلیک در ۳۰ روز`} href="/admin/tools/links" />
          <Stat label="کیوآر کد ذخیره‌شده" value={fa(s.qrs)} href="/admin/tools/qr" />
          <Stat label="لندینگ" value={fa(s.landings)} sub={`${fa(s.published)} منتشرشده`} href="/admin/tools/landings" />
          <Stat
            label="درخواست ثبت نظر"
            value={s.reviewsEnabled ? "روشن" : "خاموش"}
            tone={s.reviewsEnabled ? "green" : "gray"}
            sub={`${fa(s.reviewsSent30)} پیامک در ۳۰ روز`}
            href="/admin/tools/reviews"
          />
          <Stat
            label="یادآوری سبد رهاشده"
            value={s.cartEnabled ? "روشن" : "خاموش"}
            tone={s.cartEnabled ? "green" : "gray"}
            sub={`${fa(s.cartSent30)} پیامک · ${fa(s.cartRecovered30)} خرید در ۳۰ روز`}
            href="/admin/tools/cart-recovery"
          />
          <Stat label="منتظر موجود شدن" value={fa(s.stockWaiting)} tone="blue" sub="مشتری منتظر کالای ناموجود" href="/admin/tools/stock-alerts" />
        </div>
      )}
    </div>
  );
}
