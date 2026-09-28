/**
 * ثبت این فروشگاه در Umami همین سرور و نوشتن شناسه و کد اشتراک در
 * `SeoAnalyticsSettings`.
 *
 *   UMAMI_ADMIN_USER=admin UMAMI_ADMIN_PASSWORD='…' npx tsx scripts/umami-register.ts
 *   … --force     تنظیمات موجود را بازنویسی کن
 *   … --dry-run   فقط بگو چه می‌کرد
 *
 * روی سرور، در پوشه‌ی همان سایت اجرا شود. رمز ادمین Umami **فقط در همان
 * ترمینال** داده می‌شود و هرگز وارد `.env` فروشگاه نمی‌شود — پنل با کد اشتراک
 * فقط‌خواندنی کار می‌کند (docs/plans/seo-marketing.md بخش ۱۳.۲).
 *
 * قابل اجرای مجدد: سایتی با همین دامنه در Umami باشد همان را برمی‌دارد، کد
 * اشتراکی داشته باشد همان را. اگر تنظیمات فروشگاه از قبل پر باشد و با نتیجه
 * فرق کند، بدون `--force` دست نمی‌زند و صریح می‌گوید.
 *
 * API رسمی Umami ۳: `POST /api/auth/login`، `POST /api/websites`،
 * `POST /api/websites/:id/shares`.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const BASE = (process.env.UMAMI_BASE_URL || "http://127.0.0.1:3043").replace(/\/$/, "");
const SITE = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} ← ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function main() {
  const user = process.env.UMAMI_ADMIN_USER;
  const password = process.env.UMAMI_ADMIN_PASSWORD;
  if (!user || !password) throw new Error("UMAMI_ADMIN_USER و UMAMI_ADMIN_PASSWORD را در همین ترمینال بدهید");
  if (!SITE) throw new Error("SITE_URL در .env این سایت نیست");

  const domain = new URL(SITE).hostname.replace(/^www\./, "");
  console.log(`Umami: ${BASE} · فروشگاه: ${domain}`);

  const { token } = await api<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: user, password }),
  });

  // سایت
  const list = await api<{ data?: { id: string; name: string; domain: string | null }[] }>(
    `/api/websites?search=${encodeURIComponent(domain)}&pageSize=50`,
    { token },
  );
  let website = (list.data ?? []).find((w) => (w.domain ?? "").replace(/^www\./, "") === domain);
  if (website) {
    console.log(`= سایت از قبل در Umami بود: ${website.id}`);
  } else if (dryRun) {
    console.log(`+ (dry-run) سایت «${domain}» ساخته می‌شد`);
  } else {
    website = await api("/api/websites", { method: "POST", token, body: JSON.stringify({ name: domain, domain }) });
    console.log(`✓ سایت ساخته شد: ${website!.id}`);
  }

  // کد اشتراک
  let slug: string | null = null;
  if (website) {
    const shares = await api<{ data?: { slug: string; name: string }[] }>(`/api/websites/${website.id}/shares`, { token });
    slug = shares.data?.[0]?.slug ?? null;
    if (slug) {
      console.log(`= کد اشتراک از قبل بود: ${slug}`);
    } else if (dryRun) {
      console.log("+ (dry-run) کد اشتراک ساخته می‌شد");
    } else {
      const share = await api<{ slug: string }>(`/api/websites/${website.id}/shares`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: `nextshop-${domain}` }),
      });
      slug = share.slug;
      console.log(`✓ کد اشتراک ساخته شد: ${slug}`);
    }
  }

  if (!website || !slug) {
    console.log("\n(dry-run) چیزی در تنظیمات فروشگاه نوشته نشد");
    return;
  }

  // تنظیمات فروشگاه
  const current = await prisma.seoAnalyticsSettings.findUnique({ where: { id: "singleton" } });
  const differs =
    current &&
    ((current.umamiWebsiteId && current.umamiWebsiteId !== website.id) ||
      (current.umamiShareSlug && current.umamiShareSlug !== slug));
  if (differs && !force) {
    console.log(
      `\n⚠️  تنظیمات فروشگاه مقدار دیگری دارد (سایت ${current!.umamiWebsiteId}، کد ${current!.umamiShareSlug}) — دست نخورد. برای جایگزینی: --force`,
    );
    return;
  }
  if (dryRun) {
    console.log("\n(dry-run) تنظیمات فروشگاه نوشته و ردیاب روشن می‌شد");
    return;
  }
  const data = {
    umamiWebsiteId: website.id,
    umamiShareSlug: slug,
    trackingEnabled: true,
    updatedByName: "اسکریپت umami-register",
  };
  await prisma.seoAnalyticsSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  console.log("\n✓ تنظیمات فروشگاه نوشته شد و ردیاب روشن است (اثرش حداکثر یک دقیقه بعد).");
  console.log("  بررسی: کارتابل ← آمار بازدید ← تنظیمات ← آزمایش اتصال");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
