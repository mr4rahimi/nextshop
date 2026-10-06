"use client";

/**
 * خانه‌ی ابزارها — کاشی‌ها از `TOOLS_APPS` و چند عدد خلاصه.
 * docs/features/tools.md
 */

import { useEffect, useMemo, useState } from "react";
import { Card, PageHeader, Stat } from "../accounting/ui";
import { useAccess } from "../accounting/access";
import { TOOLS_APPS } from "../apps";
import { AppGrid } from "../AppGrid";

interface Summary {
  links: number;
  qrs: number;
  landings: number;
  published: number;
  clicks30: number;
  reviewsSent30: number;
  reviewsEnabled: boolean;
}

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function ToolsHomeClient() {
  const [s, setS] = useState<Summary | null>(null);
  const { ready, can } = useAccess();
  const apps = useMemo(() => TOOLS_APPS.filter((a) => !ready || !a.perm || can(a.perm)), [ready, can]);

  useEffect(() => {
    fetch("/api/admin/tools/summary").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ابزارها"
        help="tools"
        desc="کیوآر کد، لینک کوتاه، لندینگ و درخواست ثبت نظر روی دامنه‌ی خود فروشگاه با آمار — و ابزارهای سریع متن مثل کاراکترشمار."
      />

      <Card className="px-2 py-3 sm:px-4">
        <AppGrid apps={apps} />
      </Card>

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
        </div>
      )}
    </div>
  );
}
