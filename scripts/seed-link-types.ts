/**
 * انواع لینک و پلتفرم‌های پیش‌فرض
 *
 *   pnpm tsx scripts/seed-link-types.ts
 *
 * **نوع** و **پلتفرم** دو مفهوم جدا هستند: «وبلاگ Web 2.0» یک نوع است و
 * «ویرگول» یک پلتفرم از آن نوع. یکی‌کردنشان یعنی هر سرویس تازه یک نوع تازه
 * بسازد و گزارش‌ها خرد شوند — گزارش روی **نوع** جمع می‌شود.
 *
 * سید انواع را می‌سازد ولی **قفلشان نمی‌کند**: مدیر توضیح و آیکن هر کدام را
 * عوض می‌کند و نوع خودش را اضافه می‌کند. تنها چیزی که سید نگه می‌دارد `key`
 * است، چون گزارش‌های فاز آنالیز رویش می‌نشینند.
 *
 * ⚠️ **به اینترنت وصل نمی‌شود.** آیکن پلتفرم فایلی در `public/link-platforms/`
 * است که در گیت کامیت می‌شود؛ سید فقط وجودش را با `existsSync` بررسی می‌کند.
 * پس آیکن تازه‌ای که به مخزن اضافه شود، با اجرای دوباره‌ی سید هم می‌نشیند.
 *
 * ⚠️ متن `description` و `seoNote` هر نوع **آموزش کارمند تازه** است و در
 * پاپ‌اور علامت سؤال کنار همان نوع دیده می‌شود. تیم سئو عوض می‌شود و توضیح
 * شفاهی هر بار از نو گفته می‌شود.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۷.۲
 */

import "../lib/load-env";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import type { LinkContentKind } from "@prisma/client";

const ICON_DIR = path.join(process.cwd(), "public", "link-platforms");

interface PlatformSeed {
  title: string;
  domain: string;
}

interface TypeSeed {
  key: string;
  title: string;
  /** نام آیکن lucide-react */
  icon: string;
  description: string;
  seoNote: string;
  sampleSites?: string;
  contentKind?: LinkContentKind;
  /** پیش‌فرض فالو؛ فقط `false` نوشته می‌شود */
  follow?: boolean;
  ugc?: boolean;
  sponsored?: boolean;
  risky?: boolean;
  platforms?: PlatformSeed[];
}

const TYPES: TypeSeed[] = [
  {
    key: "WEB2", title: "وبلاگ Web 2.0", icon: "notebook-pen", contentKind: "TEXT",
    description: "وبلاگ رایگان روی دامنه‌ی دیگران که خودمان می‌سازیم و می‌نویسیم.",
    seoNote: "ارزان و پرحجم، ولی به‌تنهایی ضعیف است. کمپینی که صددرصدش Web 2.0 باشد خودش را لو می‌دهد.",
    sampleSites: "ویرگول، بلاگفا، بلاگ بیان، میهن‌بلاگ، WordPress.com، Blogger",
    platforms: [
      { title: "ویرگول", domain: "virgool.io" },
      { title: "بلاگفا", domain: "blogfa.com" },
      { title: "بلاگ بیان", domain: "blog.ir" },
      { title: "میهن‌بلاگ", domain: "mihanblog.com" },
      { title: "وردپرس", domain: "wordpress.com" },
      { title: "بلاگر", domain: "blogger.com" },
      { title: "روزبلاگ", domain: "rozblog.com" },
      { title: "مدیوم", domain: "medium.com" },
    ],
  },
  {
    key: "GUEST_POST", title: "مهمان‌نویسی", icon: "pen-line", contentKind: "TEXT",
    description: "مقاله‌ی واقعی در سایت دیگری، با لینک درون‌متنی به ما.",
    seoNote: "پرارزش‌ترین نوع رایج. ارتباط موضوعی سایت میزبان از قدرت دامنه‌اش مهم‌تر است.",
    sampleSites: "وبلاگ‌های تخصصی هم‌حوزه",
  },
  {
    key: "PRESS_RELEASE", title: "رپورتاژ خبری", icon: "newspaper", contentKind: "TEXT", sponsored: true,
    description: "مطلب پولی در خبرگزاری یا مجله‌ی آنلاین.",
    seoNote: "معمولاً پولی است، پس باید rel=\"sponsored\" بخورد. برداشتنش تصمیم آگاهانه‌ی مدیر است.",
    sampleSites: "خبرگزاری‌ها و مجله‌های آنلاین",
  },
  {
    key: "NICHE_EDIT", title: "درج در مقاله‌ی موجود", icon: "file-pen", contentKind: "NONE",
    description: "افزودن لینک به متنی که از قبل ایندکس و رتبه‌دار است.",
    seoNote: "سریع‌الاثرترین نوع، چون صفحه‌ی میزبان از قبل اعتبار دارد.",
    sampleSites: "مقاله‌های قدیمی سایت‌های هم‌حوزه",
  },
  {
    key: "PROFILE", title: "پروفایل لینک", icon: "user-round", contentKind: "NONE",
    description: "صفحه‌ی کاربری در سایتی که فیلد وب‌سایت دارد.",
    seoNote: "ارزش مستقیمش کم است؛ ارزشش در تنوع پروفایل لینک و کشف برند است.",
    sampleSites: "گیت‌هاب، انجمن‌ها، سایت‌های خدماتی",
    platforms: [
      { title: "گیت‌هاب", domain: "github.com" },
      { title: "اباوت‌می", domain: "about.me" },
      { title: "گراواتار", domain: "gravatar.com" },
    ],
  },
  {
    key: "COMMENT", title: "کامنت", icon: "message-square", contentKind: "TEXT", follow: false, ugc: true,
    description: "نظر زیر مطلب یک سایت دیگر، با لینک.",
    seoNote: "تقریباً همیشه ugc می‌خورد. فقط کامنت واقعاً مرتبط؛ کامنت بی‌ربط اسپم است.",
    sampleSites: "وبلاگ‌ها و سایت‌های خبری",
  },
  {
    key: "FORUM", title: "انجمن و امضا", icon: "messages-square", contentKind: "TEXT", ugc: true,
    description: "مشارکت در انجمن تخصصی، با لینک در پاسخ یا امضا.",
    seoNote: "ارزشش از مشارکت واقعی است نه از امضا. حساب تازه‌ای که فقط لینک می‌گذارد بن می‌شود.",
    sampleSites: "انجمن‌های تخصصی",
  },
  {
    key: "QA", title: "پرسش و پاسخ", icon: "circle-help", contentKind: "TEXT", ugc: true,
    description: "پاسخ مفید به یک سؤال، با لینک منبع.",
    seoNote: "ترافیک ارجاعی واقعی می‌آورد، حتی وقتی لینک نوفالو است.",
    sampleSites: "ویرگول پرسش، Quora، Stack Exchange",
  },
  {
    key: "DIRECTORY", title: "دایرکتوری و ثبت کسب‌وکار", icon: "list-tree", contentKind: "NONE",
    description: "ثبت کسب‌وکار در فهرست‌های صنفی و شهری.",
    seoNote: "برای کسب‌وکار محلی مهم‌تر از حجمش است. دایرکتوری بی‌کیفیت و انبوه ارزشی ندارد.",
    sampleSites: "دایرکتوری‌های صنفی و شهری",
  },
  {
    key: "LOCAL_CITATION", title: "نشانی محلی (NAP)", icon: "map-pin", contentKind: "NONE",
    description: "ثبت نام و نشانی و تلفن در نقشه‌ها و فهرست‌های محلی.",
    seoNote: "نام و نشانی و تلفن باید **دقیقاً یکسان** باشد؛ ناهمسانی بین دایرکتوری‌ها به سئوی محلی ضرر می‌زند.",
    sampleSites: "نقشه‌ی گوگل، بلد، نشان",
    platforms: [
      { title: "نقشه‌ی گوگل", domain: "google.com" },
      { title: "بلد", domain: "balad.ir" },
      { title: "نشان", domain: "neshan.org" },
    ],
  },
  {
    key: "SOCIAL", title: "شبکه‌ی اجتماعی", icon: "share-2", contentKind: "IMAGE", follow: false,
    description: "لینک در بایو یا پست شبکه‌های اجتماعی.",
    seoNote: "تقریباً همیشه نوفالو؛ ارزشش کشف برند و ترافیک است نه انتقال اعتبار.",
    sampleSites: "اینستاگرام، لینکدین، تلگرام، ایکس",
    platforms: [
      { title: "اینستاگرام", domain: "instagram.com" },
      { title: "لینکدین", domain: "linkedin.com" },
      { title: "تلگرام", domain: "telegram.org" },
      { title: "ایکس", domain: "x.com" },
    ],
  },
  {
    key: "VIDEO", title: "ویدئویی", icon: "video", contentKind: "VIDEO",
    description: "لینک در توضیح ویدئو و پروفایل کانال.",
    seoNote: "ویدئوی واقعاً مفید در نتایج گوگل هم دیده می‌شود، نه فقط در خود پلتفرم.",
    sampleSites: "آپارات، یوتیوب، نماشا",
    platforms: [
      { title: "آپارات", domain: "aparat.com" },
      { title: "یوتیوب", domain: "youtube.com" },
      { title: "نماشا", domain: "namasha.com" },
    ],
  },
  {
    key: "PODCAST", title: "پادکستی", icon: "mic", contentKind: "AUDIO",
    description: "لینک در صفحه‌ی اپیزود و پروفایل پادکست.",
    seoNote: "کم‌رقابت و پایدار؛ صفحه‌ی اپیزود معمولاً سریع ایندکس می‌شود.",
    sampleSites: "شنوتو، کست‌باکس، ناملیک",
    platforms: [
      { title: "شنوتو", domain: "shenoto.com" },
      { title: "کست‌باکس", domain: "castbox.fm" },
      { title: "ناملیک", domain: "namlik.ir" },
    ],
  },
  {
    key: "IMAGE", title: "تصویری", icon: "image", contentKind: "IMAGE",
    description: "تصویر با توضیح و لینک منبع.",
    seoNote: "نام فایل و alt تصویر همان‌قدر مهم‌اند که خود لینک.",
    sampleSites: "پینترست، فلیکر",
    platforms: [
      { title: "پینترست", domain: "pinterest.com" },
      { title: "فلیکر", domain: "flickr.com" },
    ],
  },
  {
    key: "SLIDE_DOC", title: "سند و اسلاید", icon: "file-text", contentKind: "TEXT",
    description: "PDF یا ارائه‌ی قابل ایندکس با لینک.",
    seoNote: "خودِ فایل ایندکس می‌شود؛ عنوان و متادیتای سند را جدی بگیر.",
    sampleSites: "اسلایدشیر، اسکریبد، ایسوو",
    platforms: [
      { title: "اسلایدشیر", domain: "slideshare.net" },
      { title: "اسکریبد", domain: "scribd.com" },
    ],
  },
  {
    key: "WIKI", title: "ویکی", icon: "book-open", contentKind: "TEXT", follow: false,
    description: "منبع در ویکی‌پدیا یا ویکی‌های تخصصی.",
    seoNote: "سخت‌ترین و پرارزش‌ترین. منبع باید واقعاً معتبر باشد وگرنه همان روز پاک می‌شود.",
    sampleSites: "ویکی‌پدیا و ویکی‌های تخصصی",
  },
  {
    key: "EDU", title: "دانشگاهی و آموزشی", icon: "graduation-cap", contentKind: "NONE",
    description: "لینک از دامنه‌های آموزشی و پژوهشی.",
    seoNote: "معمولاً از راه بورسیه، پژوهش یا معرفی به دست می‌آید. خریدنی نیست.",
    sampleSites: "دامنه‌های ac.ir و edu، سایت‌های پژوهشی",
  },
  {
    key: "GOV", title: "دولتی و صنفی", icon: "landmark", contentKind: "NONE",
    description: "لینک از سازمان‌ها و اتحادیه‌های رسمی.",
    seoNote: "نادر و معتبر. برای فروشگاه معمولاً از راه عضویت در اتحادیه یا نماد اعتماد.",
    sampleSites: "دامنه‌های gov، اتحادیه‌ها، سازمان‌های صنفی",
  },
  {
    key: "BANNER", title: "بنری", icon: "rectangle-horizontal", contentKind: "IMAGE", follow: false, sponsored: true,
    description: "تبلیغ نمایشی روی سایت دیگر.",
    seoNote: "تبلیغ است؛ sponsored اجباری. بدون آن، لینک خریداری‌شده حساب می‌شود.",
    sampleSites: "تبلیغات نمایشی سایت‌ها",
  },
  {
    key: "SPONSORSHIP", title: "حمایت مالی", icon: "hand-heart", contentKind: "NONE", sponsored: true,
    description: "حمایت از رویداد، پروژه‌ی متن‌باز یا خیریه با ذکر لینک.",
    seoNote: "sponsored می‌خورد. ارزش برندش معمولاً از ارزش سئویی‌اش بیشتر است.",
    sampleSites: "رویداد، پروژه‌ی متن‌باز، خیریه",
  },
  {
    key: "BROKEN_LINK", title: "جایگزینی لینک شکسته", icon: "unlink", contentKind: "NONE",
    description: "پیدا کردن ۴۰۴ در سایت دیگران و پیشنهاد صفحه‌ی خودمان به‌جایش.",
    seoNote: "نرخ موفقیتش پایین ولی کیفیت لینکش بالاست. پیشنهاد باید واقعاً جایگزین همان محتوا باشد.",
    sampleSites: "هر سایت هم‌حوزه",
  },
  {
    key: "RESOURCE_PAGE", title: "صفحه‌ی منابع", icon: "bookmark", contentKind: "NONE",
    description: "معرفی به فهرست «لینک‌های مفید» یک سایت.",
    seoNote: "باید واقعاً در فهرست جا داشته باشیم؛ درخواست انبوه ایمیلی جواب نمی‌دهد.",
    sampleSites: "صفحه‌های «لینک‌های مفید»",
  },
  {
    key: "TESTIMONIAL", title: "رضایت‌نامه", icon: "quote", contentKind: "TEXT",
    description: "نظر واقعی ما درباره‌ی ابزار یا تأمین‌کننده‌ای که استفاده می‌کنیم، با لینک.",
    seoNote: "آسان و کم‌ریسک، ولی باید تجربه‌ی واقعی باشد.",
    sampleSites: "سایت تأمین‌کننده‌ها و ابزارهایی که استفاده می‌کنیم",
  },
  {
    key: "MARKETPLACE", title: "صفحه‌ی فروشنده در بازارگاه", icon: "store", contentKind: "NONE",
    description: "صفحه‌ی غرفه یا فروشنده در بازارگاه‌ها، با لینک به سایت.",
    seoNote: "مخصوص فروشگاه. لینکش معمولاً نوفالو است ولی صفحه‌ی غرفه خودش برای نام برند رتبه می‌گیرد.",
    sampleSites: "باسلام، اسنپ‌شاپ، تپسی‌شاپ",
    platforms: [
      { title: "باسلام", domain: "basalam.com" },
      { title: "اسنپ‌شاپ", domain: "shop.snapp.ir" },
      { title: "تپسی‌شاپ", domain: "tapsi.shop" },
    ],
  },
  {
    key: "PRICE_COMPARISON", title: "مقایسه‌ی قیمت", icon: "scale", contentKind: "NONE",
    description: "ثبت فروشگاه در سایت‌های مقایسه‌ی قیمت.",
    seoNote: "مخصوص فروشگاه. ترافیک خریدار واقعی می‌آورد؛ ارزشش بیشتر فروش است تا رتبه.",
    sampleSites: "ترب، ایمالز",
    platforms: [
      { title: "ترب", domain: "torob.com" },
      { title: "ایمالز", domain: "emalls.ir" },
    ],
  },
  {
    key: "PBN", title: "شبکه‌ی وبلاگی خصوصی", icon: "triangle-alert", contentKind: "TEXT", risky: true,
    description: "شبکه‌ای از سایت‌های تحت کنترل خودمان که فقط برای لینک‌دادن ساخته شده‌اند.",
    seoNote: "⚠️ ریسک جریمه‌ی دستی گوگل. عمداً در فهرست هست تا اگر کسی ساخت **ثبت شود** — حذفش از فهرست چیزی را حل نمی‌کرد، فقط نمی‌دانستیم افت رتبه از کجاست.",
  },
];

/** `aparat.com` → `public/link-platforms/aparat-com.png` */
function iconPathFor(domain: string): string | null {
  const base = domain.replace(/\./g, "-");
  for (const ext of ["png", "svg", "ico", "webp"]) {
    if (existsSync(path.join(ICON_DIR, `${base}.${ext}`))) {
      return `/link-platforms/${base}.${ext}`;
    }
  }
  return null;
}

async function main() {
  let typesCreated = 0;
  let typesKept = 0;
  let platformsCreated = 0;
  let platformsKept = 0;
  let iconsFound = 0;
  const missingIcons: string[] = [];

  for (const [index, seed] of TYPES.entries()) {
    let type = await prisma.linkType.findUnique({
      where: { key: seed.key },
      select: { id: true, title: true },
    });

    if (type) {
      typesKept++;
      console.log(`= نوع از قبل بود: ${seed.key} → «${type.title}»`);
    } else {
      type = await prisma.linkType.create({
        data: {
          key: seed.key,
          title: seed.title,
          icon: seed.icon,
          description: seed.description,
          seoNote: seed.seoNote,
          sampleSites: seed.sampleSites ?? null,
          defaultContentKind: seed.contentKind ?? "NONE",
          defaultFollow: seed.follow ?? true,
          defaultUgc: seed.ugc ?? false,
          defaultSponsored: seed.sponsored ?? false,
          isRisky: seed.risky ?? false,
          sortOrder: index,
        },
        select: { id: true, title: true },
      });
      typesCreated++;
      console.log(`+ نوع ساخته شد: ${seed.key} → «${seed.title}»`);
    }

    for (const [pIndex, p] of (seed.platforms ?? []).entries()) {
      const icon = iconPathFor(p.domain);
      if (icon) iconsFound++;
      else missingIcons.push(p.domain);

      const existing = await prisma.linkPlatform.findUnique({
        where: { typeId_domain: { typeId: type.id, domain: p.domain } },
        select: { id: true, iconPath: true },
      });

      if (existing) {
        // آیکن تازه‌ای که به مخزن اضافه شده روی پلتفرم موجود هم می‌نشیند؛
        // بقیه‌ی فیلدها (عنوان و حساب کاربری) دست‌نخورده می‌مانند.
        if (icon && existing.iconPath !== icon) {
          await prisma.linkPlatform.update({
            where: { id: existing.id },
            data: { iconPath: icon },
          });
          console.log(`  ↻ آیکن نشست: ${p.domain}`);
        } else {
          platformsKept++;
        }
        continue;
      }

      await prisma.linkPlatform.create({
        data: {
          typeId: type.id,
          title: p.title,
          domain: p.domain,
          iconPath: icon,
          sortOrder: pIndex,
        },
      });
      platformsCreated++;
      console.log(`  + پلتفرم: ${p.title} (${p.domain})${icon ? "" : " — بدون آیکن"}`);
    }
  }

  console.log(
    `\nنوع: ساخته‌شده ${typesCreated} · از قبل موجود ${typesKept}` +
      `\nپلتفرم: ساخته‌شده ${platformsCreated} · از قبل موجود ${platformsKept} · آیکن‌دار ${iconsFound}`,
  );

  if (missingIcons.length) {
    console.log(
      `\n⚠️ آیکن این دامنه‌ها در public/link-platforms/ نیست:\n   ${missingIcons.join(", ")}` +
        `\n   فایل را با نام «دامنه با خط تیره» بگذارید و سید را دوباره اجرا کنید.` +
        `\n   تا آن موقع آیکن نوع نشان داده می‌شود و چیزی نمی‌شکند.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
