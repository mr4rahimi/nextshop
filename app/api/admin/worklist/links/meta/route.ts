import { can } from "@/lib/permissions";
import { usersWithPermission } from "@/lib/marketing/notifications";
import { listTypes } from "@/lib/marketing/link-service";
import { withLinkGuard, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * خوراک فرم‌های لینک‌سازی: انواع و پلتفرم‌های فعال، کارکنان لینک‌سازی و
 * محتوانویس‌ها، و دکمه‌هایی که این کاربر می‌بیند.
 *
 * ⚠️ فهرست کارکنان از **مجوز** می‌آید (`LINK_WORK` و `CONTENT_TASK_WORK`) —
 * همان قانونی که سرویس با آن اعتبارسنجی می‌کند (بخش ۴، قاعده‌ی ۲).
 */
export async function GET() {
  return withLinkGuard(LINK_ANY, async (access) => {
    const [types, linkStaff, contentStaff] = await Promise.all([
      listTypes(false),
      usersWithPermission("LINK_WORK"),
      usersWithPermission("CONTENT_TASK_WORK"),
    ]);
    return {
      types,
      linkStaff: linkStaff.map((s) => ({ ...s, isMe: s.id === access.userId })),
      contentStaff: contentStaff.map((s) => ({ ...s, isMe: s.id === access.userId })),
      can: {
        manage: can(access, "LINK_MANAGE"),
        work: can(access, "LINK_WORK"),
        viewAll: can(access, "MARKETING_VIEW_ALL"),
        settings: can(access, "MARKETING_SETTINGS_MANAGE"),
      },
      me: { id: access.userId, name: access.name },
    };
  });
}
