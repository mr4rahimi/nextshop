/**
 * ردیاب آمار بازدید (Umami، هم‌دامنه) — در `<head>` لایه‌ی ریشه.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۳ و ۱۳.۴
 *
 * - تا در پنل روشن نشده و شناسه‌ی سایت معتبر نیست، هیچ چیزی رندر نمی‌شود.
 * - اسکریپت در لایه‌ی ریشه است، پس پنل ادمین را هم می‌بیند؛ `__nxBeforeSend`
 *   هر رویدادی با مسیر `/admin`، `/seller` یا `/api` را دور می‌ریزد.
 * - کلیک تلفن و واتساپ با **یک شنونده‌ی تفویضی** شمرده می‌شود نه
 *   `data-umami-event` روی تک‌تک لینک‌ها: لینک تلفن در متن مقاله و برگه و فوتر
 *   پراکنده است و لینک فردا از قلم می‌افتد (درس برتر).
 */

import { EVENTS } from "@/lib/analytics/events";
import { getAnalyticsSettings, UUID_RE } from "@/lib/analytics/umami";

const INLINE = `(function(){
var X=/^\\/(admin|seller|api)(\\/|$)/;
window.__nxBeforeSend=function(t,p){try{var u=new URL(p&&p.url||"/",location.origin);if(X.test(u.pathname)||X.test(location.pathname))return false}catch(e){}return p};
document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||!window.umami)return;var h=a.getAttribute("href")||"";
if(/^tel:/i.test(h))window.umami.track(${JSON.stringify(EVENTS.phoneClick)});
else if(/(^|\\/\\/)(wa\\.me|api\\.whatsapp\\.com|web\\.whatsapp\\.com|whatsapp\\.com)/i.test(h))window.umami.track(${JSON.stringify(EVENTS.whatsappClick)});
},{capture:true,passive:true});
})();`;

export default async function SiteTracker() {
  const s = await getAnalyticsSettings();
  if (!s.trackingEnabled || !s.umamiWebsiteId || !UUID_RE.test(s.umamiWebsiteId)) return null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INLINE }} />
      <script
        defer
        src="/tq/s.js"
        data-website-id={s.umamiWebsiteId}
        data-before-send="__nxBeforeSend"
      />
    </>
  );
}
