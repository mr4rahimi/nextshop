# برنامه جامع باشگاه مشتریان (Customer Club)

> نسخه سند: `0.2.0`
> تاریخ ایجاد: 1405/04/27
> آخرین به‌روزرسانی: 1405/04/27
> وضعیت: در حال برنامه‌ریزی — کدنویسی شروع نشده
> این سند بعد از هر فاز به‌روزرسانی می‌شود.

---

## ۱. هدف

افزودن سیستم باشگاه مشتریان به فروشگاه `mymonta/shop` با قابلیت:

- ثبت و مدیریت **مشتریان آنلاین** (خرید از سایت) و **مشتریان حضوری** (ثبت توسط فروشنده)
- ارسال **پیامک مناسبتی** و **کمپین هدفمند**
- ارسال **پیامک خودکار** بر اساس رویداد (تولد، عدم خرید، سالگرد و ...)
- **امتیاز و سطح‌بندی** مشتریان (فاز بعدی)
- استفاده مجدد روی نصب‌های مختلف همین کدبیس

---

## ۲. وضعیت فعلی پروژه (بررسی‌شده)

### موجود و قابل استفاده

| بخش | مسیر | توضیح |
| --- | --- | --- |
| ارسال پیامک | `lib/sms.ts` | ایران پیامک، ارسال **پترن**، خواندن تنظیمات از `StoreSettings` |
| OTP | `lib/otp.ts` + `app/api/auth/send-otp` | تولید، ذخیره، rate limit (۳ بار / ۱۰ دقیقه) |
| مدل OTP | `OtpCode` | `phone, code, expiresAt, used, attempts` |
| تنظیمات | `StoreSettings` (singleton) | تب «پیامک» در `/admin/site-settings` |
| پیامک سفارش | `app/api/admin/orders/[id]` | `STATUS_TO_SMS_EVENT` → `sendOrderSms` |
| احراز هویت | `lib/auth.ts` + `proxy.ts` | JWT دستی HMAC-SHA256، کوکی `auth_token` |
| کیف پول | `WalletTransaction` + `User.walletBalance` | تراکنش‌محور |
| کاربر | `User` | `phone @unique`، `role: UserRole`، `email` اختیاری |

### موجود ولی نیازمند اصلاح

- `User.passwordHash` **اجباری** است → برای مشتری حضوری باید `String?` شود
- `lib/sms.ts` فقط **پترن** می‌فرستد → برای کمپین به **ارسال متن آزاد/انبوه** نیاز داریم
- `OtpCode.code` به‌صورت **متن ساده** ذخیره می‌شود → بهتر است هش شود
- هیچ **صف (Queue)** یا **کرون** وجود ندارد
- `docker-compose.yml` فقط `postgres` دارد → `redis` باید اضافه شود
- **سیستم کد تخفیف وجود ندارد** → برای پیشنهاد تولد لازم است

### تصمیمات معماری قطعی‌شده

1. ✅ **تک‌مستأجری (Single-tenant) — تأییدشده.** هر دامنه دیتابیس و دیپلوی کاملاً جداگانه دارد؛ فقط سورس‌کد مشترک است. `storeId` اضافه **نمی‌شود**. الگوی `StoreSettings` با `id = "singleton"` حفظ می‌شود. فیلد `ChatConversation.siteId` مربوط به چت هوش مصنوعی است و در این پروژه دست‌کاری نمی‌شود.
2. ✅ **هویت واحد — تأییدشده.** مدل `Customer` جداگانه ساخته **نمی‌شود**. `User` تنها هویت است و `ClubProfile` (یک‌به‌یک) اطلاعات باشگاه را نگه می‌دارد. دلیل: `User.phone` یکتاست و همه ثبت‌نام‌ها با موبایل انجام می‌شود، پس مسئله ادغام رکورد اصلاً به‌وجود نمی‌آید. مزیت جانبی: مشتری حضوری اگر بعداً در سایت وارد شود، خودکار سابقه خرید حضوری‌اش را می‌بیند.
3. ✅ **ثبت حضوری بدون OTP — تأییدشده.** صفحه ثبت **پشت احراز هویت فروشنده** قرار می‌گیرد (نقش جدید `SELLER`) و تنها اعتبارسنجی، فرمت شماره است: `^09\d{9}$`. صفحه عمومی self-signup (QR) اگر اضافه شود، حتماً با OTP موجود.
4. ✅ **خط تبلیغاتی جدا — تأییدشده.** فیلد `smsMarketingLine` در `StoreSettings` و قابل تنظیم از `/admin/site-settings`. خط خدماتی فعلی (`smsLineNumber`) فقط برای OTP و وضعیت سفارش.
5. ✅ **تاریخ تولد — تأییدشده.** در دیتابیس میلادی، در UI شمسی، و `birthMonth`/`birthDay` شمسی جداگانه ایندکس می‌شود.
6. ✅ **عضویت خودکار مشتریان مارکت‌پلیس — تأییدشده.** هر مشتری با منبع دقیقش ثبت می‌شود (سایت / حضوری / باسلام / تپسی‌شاپ / شماره‌گیر / ورود فایل).
7. **صف پیامک با BullMQ + Redis** روی همان VPS. هیچ پیامکی در چرخه درخواست HTTP ارسال نمی‌شود.
8. **دفتر کل امتیاز:** موجودی امتیاز از جدول تراکنش محاسبه می‌شود، نه یک فیلد ساده.

---

## ۳. مدل داده پیشنهادی

```prisma
// ═══════════════════════════════════════════════
// CUSTOMER CLUB
// ═══════════════════════════════════════════════

enum ClubSource {
  ONLINE        // ثبت‌نام از سایت
  IN_STORE      // ثبت توسط فروشنده
  CALLER_ID     // دستگاه شماره‌گیر
  IMPORT        // ورود از فایل
  MARKETPLACE   // از سفارش‌های باسلام/تپسی‌شاپ/...
}

model ClubProfile {
  id             String      @id @default(cuid())
  userId         String      @unique
  birthDate      DateTime?
  birthMonth     Int?        // برای ایندکس سریع کمپین تولد (۱-۱۲ شمسی)
  birthDay       Int?
  gender         String?
  source         ClubSource  @default(ONLINE)
  sourcePlatform String?     // وقتی source = MARKETPLACE → IntegPlatform.code
                             // مثل "basalam" | "tapsi_shop"
  registeredById String?     // شناسه فروشنده‌ای که ثبت کرده
  tierId         String?
  totalSpent     BigInt      @default(0)
  orderCount     Int         @default(0)
  lastPurchaseAt DateTime?
  smsConsent     Boolean     @default(false)
  consentAt      DateTime?
  consentIp      String?
  isBlocked      Boolean     @default(false)
  tags           String[]    @default([])
  note           String?
  joinedAt       DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  tier           ClubTier?   @relation(fields: [tierId], references: [id])
  points         PointTransaction[]

  @@index([tierId])
  @@index([birthMonth, birthDay])
  @@index([lastPurchaseAt])
  @@index([smsConsent])
  @@index([source])
  @@index([sourcePlatform])
}

model ClubTier {
  id            String  @id @default(cuid())
  title         String
  slug          String  @unique
  minSpent      BigInt  @default(0)
  color         String?
  pointRate     Float   @default(1)   // ضریب کسب امتیاز
  benefits      Json    @default("[]")
  sortOrder     Int     @default(0)
  isActive      Boolean @default(true)
  profiles      ClubProfile[]
}

enum PointReason {
  PURCHASE
  MANUAL
  SIGNUP
  BIRTHDAY
  REFERRAL
  REVIEW
  REDEEM
  EXPIRE
  ADJUST
}

model PointTransaction {
  id         String      @id @default(cuid())
  profileId  String
  amount     Int         // مثبت = کسب، منفی = مصرف
  reason     PointReason
  refType    String?     // "order" | "campaign" | ...
  refId      String?
  note       String?
  expiresAt  DateTime?
  createdAt  DateTime    @default(now())

  profile    ClubProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@index([createdAt])
  @@index([expiresAt])
}

// ─── پیامک ───────────────────────────────────────

enum SmsKind    { TRANSACTIONAL  MARKETING }
enum SmsSendMode { PATTERN  TEXT }
enum SmsStatus  { QUEUED  SENT  DELIVERED  FAILED  SKIPPED }

model SmsTemplate {
  id          String      @id @default(cuid())
  key         String      @unique     // "birthday" | "welcome" | ...
  title       String
  kind        SmsKind     @default(MARKETING)
  mode        SmsSendMode @default(TEXT)
  patternCode String?                 // در حالت PATTERN
  body        String?                 // در حالت TEXT، با {name} {points}
  variables   Json        @default("[]")
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  campaigns   SmsCampaign[]
  automations ClubAutomation[]
}

enum CampaignStatus { DRAFT  SCHEDULED  RUNNING  PAUSED  DONE  CANCELED }

model SmsCampaign {
  id           String         @id @default(cuid())
  title        String
  templateId   String
  segment      Json           @default("{}")   // فیلتر بخش‌بندی
  status       CampaignStatus @default(DRAFT)
  scheduledAt  DateTime?
  startedAt    DateTime?
  finishedAt   DateTime?
  totalCount   Int            @default(0)
  sentCount    Int            @default(0)
  failedCount  Int            @default(0)
  estimatedCost BigInt        @default(0)
  createdAt    DateTime       @default(now())

  template     SmsTemplate    @relation(fields: [templateId], references: [id])
  messages     SmsMessage[]

  @@index([status])
  @@index([scheduledAt])
}

model SmsMessage {
  id            String     @id @default(cuid())
  userId        String?
  phone         String
  campaignId    String?
  automationId  String?
  templateKey   String?
  kind          SmsKind    @default(MARKETING)
  body          String?
  patternCode   String?
  provider      String     @default("iranpayamak")
  providerMsgId String?
  status        SmsStatus  @default(QUEUED)
  errorMessage  String?
  cost          BigInt     @default(0)
  queuedAt      DateTime   @default(now())
  sentAt        DateTime?
  deliveredAt   DateTime?

  campaign      SmsCampaign? @relation(fields: [campaignId], references: [id])

  @@index([userId])
  @@index([phone])
  @@index([status])
  @@index([campaignId])
  @@index([queuedAt])
}

model SmsOptOut {
  id        String   @id @default(cuid())
  phone     String   @unique
  reason    String?
  source    String?  // "sms_reply" | "panel" | "admin"
  createdAt DateTime @default(now())
}

// ─── اتوماسیون ───────────────────────────────────

enum ClubTrigger {
  WELCOME
  BIRTHDAY
  MEMBERSHIP_ANNIVERSARY
  AFTER_PURCHASE
  PURCHASE_FEEDBACK
  ABANDONED_CART
  DORMANT_CUSTOMER
  TIER_UPGRADE
  POINTS_EXPIRING
}

model ClubAutomation {
  id           String      @id @default(cuid())
  trigger      ClubTrigger @unique
  templateId   String
  delayMinutes Int         @default(0)
  conditions   Json        @default("{}")   // مثلا { "dormantDays": 60 }
  sendHour     Int         @default(10)     // ساعت ارسال برای کرون‌ها
  isActive     Boolean     @default(false)
  lastRunAt    DateTime?

  template     SmsTemplate @relation(fields: [templateId], references: [id])
}

// ─── خرید حضوری (فاز ۴) ──────────────────────────

model InStorePurchase {
  id         String   @id @default(cuid())
  userId     String
  amount     BigInt
  invoiceNo  String?
  sellerId   String?
  note       String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

### تغییرات لازم روی مدل‌های موجود

```prisma
enum UserRole {
  ADMIN
  CUSTOMER
  SELLER      // ← جدید: اپراتور ثبت مشتری حضوری
}

model User {
  passwordHash String?        // ← از اجباری به اختیاری
  clubProfile  ClubProfile?   // ← جدید
  // بقیه بدون تغییر
}

model StoreSettings {
  // ─── باشگاه مشتریان ───
  clubEnabled          Boolean @default(false)
  clubName             String?
  smsMarketingLine     String?   // خط تبلیغاتی (جدا از خط خدماتی)
  smsAllowedHourStart  Int     @default(9)
  smsAllowedHourEnd    Int     @default(21)
  smsMonthlyCapPerUser Int     @default(4)
  smsOptOutText        String? @default("لغو۱۱")
  pointPerToman        Float   @default(0.001)
  pointExpiryDays      Int     @default(365)
}

model OtpCode {
  code  String   // ← به هش تغییر کند (bcrypt یا sha256+salt)
}
```

---

## ۴. زیرساخت

### `docker-compose.yml` — افزودن Redis

```yaml
  redis:
    image: redis:7-alpine
    container_name: mymonta_redis
    command: redis-server --appendonly yes
    ports:
      - "63791:6379"
    volumes:
      - mymonta_redis_data:/data
```

### پروسه‌ها (PM2)

| پروسه | نقش |
| --- | --- |
| `web` | Next.js — فقط کار را در صف می‌گذارد |
| `worker` | مصرف‌کننده صف `sms-send` و `sms-status` |
| `scheduler` | کرون‌های تکرارشونده BullMQ |

### صف‌ها

| صف | نرخ | توضیح |
| --- | --- | --- |
| `sms-send` | محدودشده (مثلاً ۳۰/ثانیه) | ارسال تکی با retry ۳ باره |
| `sms-status` | هر ۱۵ دقیقه | استعلام وضعیت تحویل |
| `club-cron` | repeatable | تولد، خوابیده، کمپین زمان‌بندی‌شده |

### `jobId` یکتا (جلوگیری از ارسال تکراری)

```
birthday:{jalaliDate}:{userId}
dormant:{jalaliDate}:{userId}
campaign:{campaignId}:{userId}
```

---

## ۵. ساختار فایل‌ها

```
lib/club/
├── phone.ts               نرمال‌سازی شماره (تبدیل ارقام فارسی، +98، 0098)
├── profile.ts             ساخت/به‌روزرسانی ClubProfile
├── segment.ts             تبدیل فیلتر JSON به Prisma where
├── points.ts              کسب/مصرف/انقضای امتیاز
├── tier.ts                محاسبه و ارتقای سطح
└── sms/
    ├── types.ts           SmsProvider interface
    ├── providers/
    │   └── iranpayamak.ts پیاده‌سازی (بازنویسی lib/sms.ts فعلی)
    ├── guards.ts          optOut / consent / ساعت مجاز / سقف ماهانه
    ├── render.ts          جایگزینی متغیرها در قالب
    └── queue.ts           افزودن به BullMQ

workers/
├── index.ts               راه‌انداز worker
├── smsWorker.ts
├── statusWorker.ts
└── scheduler.ts

app/api/club/
├── register/route.ts          ثبت توسط فروشنده (نیازمند نقش SELLER)
├── profile/route.ts           پروفایل مشتری لاگین‌شده
├── consent/route.ts           تغییر وضعیت دریافت پیامک
├── caller-id/route.ts         Webhook دستگاه شماره‌گیر (با توکن)
└── webhooks/
    ├── incoming/route.ts      منشی پیامک (پردازش «لغو»)
    └── delivery/route.ts      وضعیت تحویل

app/api/admin/club/
├── members/route.ts
├── members/[id]/route.ts
├── templates/route.ts
├── campaigns/route.ts
├── campaigns/[id]/{start,pause,test}/route.ts
├── automations/route.ts
└── stats/route.ts

app/seller/
├── layout.tsx
└── register/page.tsx          صفحه فول‌اسکرین ثبت شماره

app/admin/club/
├── page.tsx                   داشبورد باشگاه
├── members/page.tsx
├── templates/page.tsx
├── campaigns/page.tsx
├── automations/page.tsx
└── sms-log/page.tsx

app/account/club/page.tsx      پنل مشتری

scripts/
├── backfill-club-profiles.ts  ساخت ClubProfile برای کاربران موجود
└── import-customers.ts        ورود از CSV/Excel
```

---

## ۶. فازبندی اجرا

### فاز ۰ — زیرساخت
- [ ] افزودن `redis` به `docker-compose.yml`
- [ ] نصب `bullmq` و `ioredis`
- [ ] `lib/redis.ts`
- [ ] `lib/club/phone.ts` + تست
- [ ] پیکربندی PM2 برای سه پروسه
- [ ] متغیرهای محیطی جدید در `.env.example`

### فاز ۱ — عضویت و پروفایل
- [ ] مایگریشن Prisma: `ClubProfile`, `ClubTier`, `PointTransaction`, نقش `SELLER`, `passwordHash` اختیاری
- [ ] `lib/club/profile.ts` — `ensureClubProfile(userId)`
- [ ] هوک روی ثبت‌نام آنلاین (`verify-otp`) → ساخت خودکار پروفایل با `source = ONLINE`
- [ ] هوک روی ورود سفارش مارکت‌پلیس → ساخت `User` + `ClubProfile` با `source = MARKETPLACE`
  - باسلام: `basalam.adapter.ts` → `customerPhone` / `customerName`
  - تپسی‌شاپ: `webhooks/tapsi/route.ts` → `customerMobile`
  - رضایت پیامک تبلیغاتی برای این‌ها **پیش‌فرض `false`**
- [ ] محافظت مسیر `/seller` و `/api/club/register` در `proxy.ts`
- [ ] صفحه `/seller/register` — فرم شماره + نام + تاریخ تولد + چک‌باکس رضایت پیامک
  - اعتبارسنجی تنها: `^09\d{9}$` (بدون OTP)
  - نرمال‌سازی ارقام فارسی/عربی قبل از اعتبارسنجی
  - اگر شماره از قبل عضو بود، پیام «قبلاً عضو است» + نمایش نام
  - فوکوس خودکار روی فیلد شماره + ریست سریع برای ثبت پشت‌سرهم
- [ ] اسکریپت `backfill-club-profiles.ts` (رضایت پیامک = `false` برای همه)
- [ ] `/admin/club/members` — لیست، جستجو، فیلتر بر اساس **منبع**، خروجی Excel
- [ ] `/account/club` — پنل مشتری: تاریخ تولد، تنظیم دریافت پیامک

### فاز ۲ — موتور پیامک
- [ ] مایگریشن: `SmsTemplate`, `SmsCampaign`, `SmsMessage`, `SmsOptOut`, فیلدهای جدید `StoreSettings`
- [ ] بازنویسی `lib/sms.ts` به `lib/club/sms/providers/iranpayamak.ts` با اینترفیس استاندارد
  - [ ] سازگاری با کد فعلی حفظ شود (پیامک سفارش نباید بشکند)
  - [ ] افزودن `sendText` و `sendBulk` و `getCredit` و `getDeliveryStatus`
- [ ] `guards.ts` — optOut، consent، ساعت مجاز، سقف ماهانه
- [ ] صف `sms-send` + worker + ثبت در `SmsMessage`
- [ ] `/admin/club/templates` — CRUD قالب با پیش‌نمایش متغیرها
- [ ] `lib/club/segment.ts` + UI فیلتر در `/admin/club/campaigns`
- [ ] ساخت کمپین: پیش‌نمایش، تعداد گیرنده، هزینه تخمینی، ارسال تست
- [ ] اجرا / توقف / لغو کمپین
- [ ] `/admin/club/sms-log` — گزارش ارسال‌ها

### فاز ۳ — اتوماسیون
- [ ] مایگریشن `ClubAutomation`
- [ ] `scheduler.ts` با jobهای تکرارشونده
- [ ] تریگرها: `WELCOME`, `BIRTHDAY`, `MEMBERSHIP_ANNIVERSARY`, `DORMANT_CUSTOMER`, `AFTER_PURCHASE`
- [ ] Webhook منشی پیامک برای «لغو» → ثبت در `SmsOptOut`
- [ ] Webhook وضعیت تحویل
- [ ] `/admin/club/automations` — فعال/غیرفعال + انتخاب قالب + شرایط

### فاز ۴ — امتیاز و سطح
- [ ] `lib/club/points.ts` — کسب امتیاز روی `CONFIRMED` شدن سفارش
- [ ] انقضای امتیاز با کرون
- [ ] `lib/club/tier.ts` — ارتقای خودکار سطح + پیامک اطلاع‌رسانی
- [ ] مصرف امتیاز در checkout (کنار کیف پول موجود)
- [ ] ثبت خرید حضوری توسط فروشنده → `InStorePurchase` + امتیاز
- [ ] نمایش امتیاز و سطح در `/account/club`

### فاز ۵ — کد تخفیف و معرفی دوست
- [ ] مدل `Coupon` + `CouponRedemption`
- [ ] اعمال کد تخفیف در checkout (`Order.discountTotal` موجود است)
- [ ] کد تخفیف تولد با انقضای کوتاه
- [ ] کد معرفی اختصاصی هر مشتری + امتیاز دوطرفه

### فاز ۶ — گزارش و بهبود
- [ ] داشبورد `/admin/club` — رشد اعضا، نرخ بازگشت، هزینه پیامک، ROI کمپین
- [ ] بخش‌بندی RFM
- [ ] تست A/B کمپین
- [ ] اتصال دستگاه شماره‌گیر از طریق `/api/club/caller-id`

---

## ۷. قوانین و ملاحظات

- ارسال تبلیغاتی فقط در بازه ساعت مجاز؛ خارج از بازه، پیام به صبح روز بعد موکول شود
- متن لغو در انتهای همه پیام‌های تبلیغاتی
- خط خدماتی برای OTP و وضعیت سفارش، خط تبلیغاتی برای کمپین — کاملاً جدا
- رضایت صریح با ثبت تاریخ و IP
- سقف پیامک ماهانه هر مشتری برای جلوگیری از بمباران
- `AuditLog` برای هر تغییر دستی ادمین روی مشتری یا امتیاز
- هرگز کلید API در پاسخ‌های سمت کلاینت ارسال نشود (الگوی فعلی چت رعایت شود)

---

## ۸. سؤالات باز

| # | سؤال | وضعیت |
| --- | --- | --- |
| ۱ | چند دامنه روی یک دیتابیس؟ | ✅ خیر — هر دامنه دیتابیس و دیپلوی جدا |
| ۲ | ثبت حضوری بدون OTP؟ | ✅ بله — فقط اعتبارسنجی `^09\d{9}$`، پشت لاگین فروشنده |
| ۳ | خط تبلیغاتی جدا؟ | ✅ بله — قابل تنظیم از پنل ادمین |
| ۴ | تاریخ تولد میلادی در DB و شمسی در UI؟ | ✅ تأیید شد |
| ۵ | عضویت خودکار مشتریان مارکت‌پلیس؟ | ✅ بله — با ثبت دقیق منبع |
| ۶ | **ارسال متن آزاد** (غیر پترن) — endpoint و پارامترها؟ | 🔴 **بلاک‌کننده فاز ۲** |
| ۷ | **ارسال انبوه** — endpoint و سقف گیرنده در هر درخواست؟ | 🔴 **بلاک‌کننده فاز ۲** |
| ۸ | **استعلام اعتبار** و **وضعیت تحویل** — endpoint؟ | 🔴 بلاک‌کننده فاز ۲ |
| ۹ | **منشی پیامک** — webhook دارد یا باید pull شود؟ | 🔴 بلاک‌کننده فاز ۳ |
| ۱۰ | امتیاز و کیف پول یکی شوند یا جدا بمانند؟ (پیشنهاد: جدا) | ⏳ فاز ۴ |
| ۱۱ | مدل دستگاه شماره‌گیر مشخص است؟ | ⏳ فاز ۶ |

**نکته:** موارد ۶ تا ۹ فقط فاز ۲ و ۳ را بلاک می‌کنند. فاز ۰ و ۱ بدون آن‌ها قابل شروع است.

---

## ۹. گزارش پیشرفت

| فاز | وضعیت | تاریخ | یادداشت |
| --- | --- | --- | --- |
| ۰ — زیرساخت | ⬜ شروع نشده | — | — |
| ۱ — عضویت | ⬜ شروع نشده | — | — |
| ۲ — پیامک | ⬜ شروع نشده | — | — |
| ۳ — اتوماسیون | ⬜ شروع نشده | — | — |
| ۴ — امتیاز | ⬜ شروع نشده | — | — |
| ۵ — تخفیف | ⬜ شروع نشده | — | — |
| ۶ — گزارش | ⬜ شروع نشده | — | — |

**راهنمای وضعیت:** ⬜ شروع نشده · 🟡 در حال انجام · ✅ تکمیل‌شده · ⛔ متوقف
