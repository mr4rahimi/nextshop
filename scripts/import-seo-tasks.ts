/**
 * ثبت دسته‌جمعی کار سئو و کار محتوا از یک فایل JSON — برای خروجی ممیزی سئو
 *
 *   pnpm tsx scripts/import-seo-tasks.ts <file.json>            # فقط نمایش (پیش‌فرض)
 *   pnpm tsx scripts/import-seo-tasks.ts <file.json> --apply    # ثبت واقعی
 *
 * کارها **از مسیر همان سرویس‌های پنل** ساخته می‌شوند (`createSeoTask` و
 * `createContentTask`)، نه با insert مستقیم؛ پس رویداد «ثبت شد»، اعلان به مسئول
 * و لاگ فعالیت دقیقاً مثل ثبت از فرم ساخته می‌شود و نام سازنده همان کاربری است
 * که در فایل آمده.
 *
 * idempotent است: کاری که عنوانش (حذف‌نشده) از قبل هست ساخته نمی‌شود، پس اجرای
 * دوباره‌ی همان فایل کار تکراری نمی‌سازد.
 *
 * قالب فایل:
 * {
 *   "createdById": "<شناسه‌ی کاربر ثبت‌کننده>",
 *   "seoTasks": [{ "categoryKey": "REDIRECTS", "title": "…", "description": "…",
 *                  "pageUrls": "…", "assigneeId": "…", "priority": "HIGH",
 *                  "dueAt": "2026-10-05", "reviewAt": "2026-11-05", "checklist": ["…"],
 *                  "doneReport": "…" }],
 *   "contentTasks": [{ "title": "…", "primaryKeyword": "…", "relatedKeywords": "…",
 *                      "brief": "…", "writerId": "…", "publisherId": "…",
 *                      "priority": "NORMAL", "dueAt": "2026-10-12" }],
 *   "linkCampaigns": [{ "title": "…", "note": "…", "weeklyQuota": 2, "buildPlan": true,
 *                       "targets": [{ "key": "printer", "url": "…", "label": "…", "primaryKeyword": "…" }],
 *                       "nodes": [{ "key": "r1", "typeKey": "PRESS_RELEASE", "platformDomain": null,
 *                                   "anchorText": "…", "anchorKind": "BRAND", "wordCount": 1000,
 *                                   "contentBrief": "…", "note": "…", "assigneeId": "…", "dueAt": "…",
 *                                   "to": ["target:printer", "node:r0"],
 *                                   "content": { "title": "…", "writerId": "…", "dueAt": "…" } }] }]
 * }
 *
 * `doneReport`: کاری که **قبلاً انجام شده** و فقط برای سابقه و مقایسه ثبت می‌شود —
 * بعد از ساخت، با همان سرویس پنل گزارش و تأیید می‌خورد (رویداد و لاگ کامل).
 *
 * کمپین لینک‌سازی با عنوانش idempotent است. گره‌ها به ترتیب فایل ساخته می‌شوند،
 * پس `node:<key>` فقط به گره‌ی **قبلی** اشاره می‌کند. `content` برای گره‌ی
 * رپورتاژ/مهمان‌نویسی یک کار محتوای بیرونی (EXTERNAL) می‌سازد و به گره وصل می‌کند.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵
 */

import "../lib/load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { ALL_PERMISSIONS, type StaffAccess } from "../lib/permissions";
import {
  createSeoTask,
  transitionSeoTask,
  type CreateSeoTaskInput,
} from "../lib/marketing/seo-task-service";
import {
  createContentTask,
  type CreateContentTaskInput,
} from "../lib/marketing/content-task-service";
import {
  addTarget,
  createCampaign,
  createNode,
  type Destination,
  type NodeInput,
} from "../lib/marketing/link-service";
import { buildPlan, createContentForNode } from "../lib/marketing/link-workflow";

interface SeoTaskRow extends Omit<CreateSeoTaskInput, "categoryId"> {
  categoryKey: string;
  doneReport?: string;
}

interface CampaignRow {
  title: string;
  note?: string;
  weeklyQuota?: number;
  buildPlan?: boolean;
  targets: { key: string; url: string; label?: string; primaryKeyword?: string }[];
  nodes: (Omit<NodeInput, "campaignId" | "typeId" | "platformId" | "destinations"> & {
    key: string;
    typeKey: string;
    platformDomain?: string | null;
    to: string[];
    content?: { title: string; writerId: string; dueAt?: string };
  })[];
}

interface ImportFile {
  createdById: string;
  seoTasks?: SeoTaskRow[];
  contentTasks?: CreateContentTaskInput[];
  linkCampaigns?: CampaignRow[];
}

/** همان منطق `getStaffAccess`، بدون کوکی جلسه */
async function accessFor(userId: string): Promise<StaffAccess> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    select: { id: true, firstName: true, lastName: true, phone: true, role: true, staffRoleId: true },
  });
  if (!user) throw new Error(`کاربر ثبت‌کننده (${userId}) پیدا نشد یا کارمند نیست`);

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone || "بدون نام";
  const base = { userId: user.id, name, phone: user.phone, role: user.role };

  if (!user.staffRoleId) {
    const unrestricted = user.role === "ADMIN";
    return {
      ...base,
      roleId: null,
      roleTitle: null,
      permissions: unrestricted ? ALL_PERMISSIONS : [],
      isUnrestricted: unrestricted,
    };
  }
  const role = await prisma.staffRole.findUnique({
    where: { id: user.staffRoleId },
    select: { id: true, title: true, permissions: true, isActive: true },
  });
  return {
    ...base,
    roleId: user.staffRoleId,
    roleTitle: role?.title ?? null,
    permissions: role?.isActive ? role.permissions : [],
    isUnrestricted: false,
  };
}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file) throw new Error("مسیر فایل JSON را بدهید");

  const data = JSON.parse(readFileSync(file, "utf8")) as ImportFile;
  const access = await accessFor(data.createdById);
  console.log(`ثبت‌کننده: ${access.name}${apply ? "" : "  (نمایشی — برای ثبت --apply بدهید)"}`);

  const categories = await prisma.seoTaskCategory.findMany({
    where: { isActive: true },
    select: { id: true, key: true },
  });
  const catByKey = new Map(categories.map((c) => [c.key, c.id]));

  let created = 0;
  let skipped = 0;

  for (const row of data.seoTasks ?? []) {
    const { categoryKey, doneReport, ...rest } = row;
    const categoryId = catByKey.get(categoryKey);
    if (!categoryId) throw new Error(`دسته‌ی «${categoryKey}» پیدا نشد (عنوان: ${row.title})`);

    const exists = await prisma.seoTask.findFirst({
      where: { title: row.title, deletedAt: null },
      select: { code: true },
    });
    if (exists) {
      console.log(`  = سئو ${exists.code} از قبل هست: ${row.title}`);
      skipped++;
      continue;
    }
    if (apply) {
      const t = await createSeoTask({ ...rest, categoryId }, access);
      if (doneReport) {
        await transitionSeoTask(t.id, "report", doneReport, access);
        await transitionSeoTask(t.id, "approve", null, access);
      }
      console.log(`  + سئو ${t.code}${doneReport ? " (انجام‌شده)" : ""}: ${row.title}`);
    } else {
      console.log(
        `  + سئو [${categoryKey}]${doneReport ? " ✓" : ""} ${row.title}  (${row.checklist?.length ?? 0} بند)`,
      );
    }
    created++;
  }

  for (const row of data.contentTasks ?? []) {
    const exists = await prisma.contentTask.findFirst({
      where: { title: row.title, deletedAt: null },
      select: { code: true },
    });
    if (exists) {
      console.log(`  = محتوا ${exists.code} از قبل هست: ${row.title}`);
      skipped++;
      continue;
    }
    if (apply) {
      const t = await createContentTask(row, access);
      console.log(`  + محتوا ${t.code}: ${row.title}`);
    } else {
      console.log(`  + محتوا ${row.title}  (کلمه: ${row.primaryKeyword ?? "—"})`);
    }
    created++;
  }

  if (data.linkCampaigns?.length) {
    const [types, platforms] = await Promise.all([
      prisma.linkType.findMany({ where: { isActive: true }, select: { id: true, key: true } }),
      prisma.linkPlatform.findMany({ select: { id: true, typeId: true, domain: true } }),
    ]);
    const typeByKey = new Map(types.map((t) => [t.key, t.id]));

    for (const camp of data.linkCampaigns) {
      // اعتبارسنجی کامل قبل از ساخت، تا خطای وسط کار کمپین نیمه‌کاره نسازد
      const keys = new Set<string>();
      for (const n of camp.nodes) {
        const typeId = typeByKey.get(n.typeKey);
        if (!typeId) throw new Error(`نوع لینک «${n.typeKey}» پیدا نشد (کمپین ${camp.title})`);
        if (n.platformDomain && !platforms.some((p) => p.typeId === typeId && p.domain === n.platformDomain)) {
          throw new Error(`پلتفرم ${n.platformDomain} برای نوع ${n.typeKey} ثبت نشده`);
        }
        for (const to of n.to) {
          const [kind, key] = to.split(":");
          const ok = kind === "target" ? camp.targets.some((t) => t.key === key) : keys.has(key);
          if (!ok) throw new Error(`مقصد «${to}» گره‌ی ${n.key} پیدا نشد`);
        }
        keys.add(n.key);
      }

      const exists = await prisma.linkCampaign.findFirst({
        where: { title: camp.title, deletedAt: null },
        select: { id: true },
      });
      if (exists) {
        console.log(`  = کمپین از قبل هست: ${camp.title}`);
        skipped++;
        continue;
      }
      const contents = camp.nodes.filter((n) => n.content).length;
      if (!apply) {
        console.log(
          `  + کمپین «${camp.title}»: ${camp.targets.length} صفحه‌ی هدف، ${camp.nodes.length} گره، ${contents} کار محتوای بیرونی`,
        );
        created++;
        continue;
      }

      const [first, ...others] = camp.targets;
      const c = await createCampaign(
        {
          title: camp.title,
          note: camp.note,
          weeklyQuota: camp.weeklyQuota,
          firstTarget: { url: first.url, label: first.label, primaryKeyword: first.primaryKeyword },
        },
        access,
      );
      const targetId = new Map<string, string>();
      const firstRow = await prisma.linkTarget.findFirst({
        where: { campaignId: c.id },
        select: { id: true },
      });
      targetId.set(first.key, firstRow!.id);
      for (const t of others) {
        const row = await addTarget(c.id, t, access);
        targetId.set(t.key, row.id);
      }

      const nodeId = new Map<string, string>();
      for (const n of camp.nodes) {
        const { key, typeKey, platformDomain, to, content, ...fields } = n;
        const typeId = typeByKey.get(typeKey)!;
        const destinations: Destination[] = to.map((d) => {
          const [kind, k] = d.split(":");
          return kind === "target" ? { toTargetId: targetId.get(k)! } : { toNodeId: nodeId.get(k)! };
        });
        const node = await createNode(
          {
            ...fields,
            campaignId: c.id,
            typeId,
            platformId: platformDomain
              ? platforms.find((p) => p.typeId === typeId && p.domain === platformDomain)!.id
              : null,
            destinations,
          },
          access,
        );
        nodeId.set(key, node!.id);
        if (content) await createContentForNode(node!.id, content, access);
      }

      const plan = camp.buildPlan ? await buildPlan(c.id, access) : null;
      console.log(
        `  + کمپین «${camp.title}»: ${camp.nodes.length} گره، ${contents} کار محتوا` +
          (plan ? `، ${plan.assigned} گره واگذار شد` : ""),
      );
      created++;
    }
  }

  console.log(`\n${apply ? "ثبت شد" : "ثبت می‌شود"}: ${created} · تکراری و ردشده: ${skipped}`);
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
