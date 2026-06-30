# Integration Hub — پلن کامل پروژه

> **این فایل سند زنده پروژه Integration Hub است.**
> هر بار که کار روی این پروژه شروع می‌شود، این فایل اول خوانده شود.
> آخرین به‌روزرسانی: ۱۴۰۵/۰۴/۱۲

---

## ۱. خلاصه اجرایی

Integration Hub یک ماژول مستقل است که داخل پنل ادمین فروشگاه نمایش داده می‌شود
(سایدبار جدید: «سیستم یکپارچه‌سازی») و وظیفه یکپارچه‌سازی فروشگاه با
نرم‌افزارهای حسابداری و مارکت‌پلیس‌ها را دارد.

**اصول اساسی طراحی:**
- فروشگاه هیچ کد مستقیمی به حسابداری / مارکت‌پلیس‌ها ندارد — همه چیز از Integration Hub
- هر پلتفرم خارجی = یک Adapter مستقل با interface یکسان
- Mapping بر اساس شناسه داخلی هر سیستم (نه عنوان یا SKU جدید)
- حسابداری = مرجع نهایی موجودی و قیمت خرید
- همه عملیات از طریق Queue (PostgreSQL-based) پردازش می‌شوند
- همه عملیات در Log ثبت می‌شوند

---

## ۲. تصمیمات قطعی شده

| موضوع | تصمیم | دلیل |
|-------|-------|------|
| **حسابداری هدف** | وب‌حسابان (Hesaban) | مستندات API بعداً ارائه می‌شود |
| **مارکت‌پلیس اول** | باسلام | مستندات API بعداً ارائه می‌شود |
| **Database** | همان PostgreSQL فروشگاه — جداول با پیشوند `Integ` | هر deployment DB مستقل دارد؛ JOIN با Product بدون overhead؛ یک Prisma client |
| **Queue** | PostgreSQL-based (بدون Redis) | بدون نیاز به infrastructure اضافه؛ در صورت scale بالا migrate می‌شود |
| **sync scope فعلی** | فقط موجودی + قیمت | سفارشات در آینده اضافه می‌شود |
| **مشاهده سفارشات** | view‌only از همه پلتفرم‌ها در آینده | نه import به فروشگاه |
| **مقیاس محصول** | ۲۰۰ تا چند هزار (متنوع) | بدون نیاز به بهینه‌سازی خاص؛ pagination استاندارد کافی است |
| **جایگاه UI** | سایدبار ادمین — گروه «سیستم یکپارچه‌سازی» | مستقل از گروه‌های فروشگاه/محتوا/تنظیمات |
| **isolation** | منطقی (کد جدا) نه فیزیکی (DB جدا) | کافی است؛ migration به DB جدا بعداً ممکن است |

---

## ۳. وضعیت فعلی

### ✅ تکمیل‌شده
- تمام تصمیمات معماری قطعی شد
- طراحی Database Schema (کامل)
- طراحی Adapter Interface (TypeScript)
- طراحی Queue Worker (PostgreSQL-based)
- طراحی الگوریتم Auto-Match
- طراحی Rule Engine (ساختار JSON)
- فازبندی پیاده‌سازی

### ✅ مستندات API دریافت و استخراج شد
- [x] مستندات API وب‌حسابان — بخش ۱۵ این فایل
- [x] مستندات API باسلام — بخش ۱۶ این فایل

### 🔜 مرحله بعدی
→ **فاز ۱**: HesabanAdapter — ساخت adapter + صفحه اتصال + job handlers

---

## ۴. معماری کلی

```
┌─────────────────────────────────────────────────────────────┐
│          Admin Panel — سایدبار «سیستم یکپارچه‌سازی»         │
│  /admin/integration/*  (Next.js pages)                      │
└─────────────────────────────┬───────────────────────────────┘
                              │ API Routes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Integration Hub Core                      │
│  lib/integration/core/                                      │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │ Queue      │ │ Mapping      │ │ Price Rule Engine     │ │
│  │ Worker     │ │ Service      │ │                       │ │
│  └────────────┘ └──────────────┘ └───────────────────────┘ │
│  ┌────────────┐ ┌──────────────┐                           │
│  │ Sync       │ │ Log          │                           │
│  │ Engine     │ │ Service      │                           │
│  └────────────┘ └──────────────┘                           │
└──────────┬──────────────────┬──────────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────┐
│ Accounting       │  │ Marketplace      │
│ Adapters         │  │ Adapters         │
│                  │  │                  │
│ hesaban.adapter  │  │ basalam.adapter  │
│ (آینده: دیگران)  │  │ (آینده: دیگران)  │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         ▼                     ▼
    وب‌حسابان                باسلام / دیجیکالا / ...
```

### ساختار فایل‌ها

```
lib/
  integration/
    core/
      sync-engine.ts           ← موتور اصلی sync
      queue-worker.ts          ← Queue PostgreSQL-based
      queue-manager.ts         ← enqueue / dequeue API
      mapping-service.ts       ← مدیریت Mapping + auto-match
      price-rule-engine.ts     ← اجرای Rule Engine
      log-service.ts           ← ثبت Log
      crypto.ts                ← رمزنگاری credentials (AES-256-GCM)
    adapters/
      base.adapter.ts          ← Interface مشترک
      accounting/
        hesaban.adapter.ts     ← وب‌حسابان
      marketplace/
        basalam.adapter.ts     ← باسلام
        digikala.adapter.ts    ← (آینده)
        divar.adapter.ts       ← (آینده)
        snappshop.adapter.ts   ← (آینده)
        tapsi-shop.adapter.ts  ← (آینده)
    types/
      integration.types.ts     ← همه TypeScript types

app/
  admin/
    integration/
      page.tsx                 ← داشبورد کلی (health + stats)
      connections/
        page.tsx               ← لیست اتصالات
        [platform]/page.tsx    ← تنظیمات + credential هر پلتفرم
      mapping/
        page.tsx               ← مدیریت Mapping
        suggestions/page.tsx   ← تأیید/رد پیشنهادهای auto-match
      price-rules/
        page.tsx               ← لیست قوانین قیمت
        create/page.tsx
        [id]/page.tsx
      queue/page.tsx           ← وضعیت Queue (pending/failed jobs)
      logs/page.tsx            ← گزارش لاگ‌ها با فیلتر

  api/
    integration/
      worker/route.ts          ← POST — اجرای Queue (توسط setInterval)
      connections/route.ts     ← CRUD اتصالات
      connections/test/route.ts ← تست اتصال
      sync/route.ts            ← trigger دستی sync
      mapping/route.ts         ← CRUD Mapping
      mapping/suggestions/route.ts ← تأیید/رد پیشنهادها
      price-rules/route.ts     ← CRUD قوانین
      queue/route.ts           ← وضعیت + cancel job
      logs/route.ts            ← گزارش با فیلتر
      webhook/[platform]/route.ts ← آماده برای آینده
```

---

## ۵. Database Schema — جداول Prisma

این جداول به `schema.prisma` فروشگاه اضافه می‌شوند.
همه با پیشوند `Integ` و در همان DB فروشگاه.

```prisma
// ════════════════════════════════════════════════════════════
// INTEGRATION HUB TABLES
// ════════════════════════════════════════════════════════════

// ── پلتفرم‌های تعریف‌شده (seeded — کاربر نمی‌سازد) ──────────

model IntegPlatform {
  code        String   @id
  // مقادیر: "hesaban" | "basalam" | "digikala" | "divar" | "snappshop" | "tapsi_shop"
  name        String         // "وب‌حسابان" | "باسلام" | "دیجیکالا" | ...
  type        IntegPlatformType
  logoUrl     String?
  isActive    Boolean  @default(true)

  connections IntegConnection[]
  mappings    IntegProductMapping[]
  jobs        IntegJob[]
  logs        IntegLog[]
  suggestions IntegMappingSuggestion[]
}

enum IntegPlatformType {
  ACCOUNTING
  MARKETPLACE
}

// ── اتصال به هر پلتفرم (credential ها) ──────────────────────

model IntegConnection {
  id             String   @id @default(cuid())
  platformCode   String
  siteId         String?  // برای آینده — فعلاً null (هر deployment یک سایت)
  credentials    String   // JSON رمزنگاری‌شده با AES-256-GCM
  status         IntegConnStatus @default(DISCONNECTED)
  lastSyncAt     DateTime?
  lastErrorAt    DateTime?
  lastError      String?
  config         Json     @default("{}")  // تنظیمات اضافی per-platform
  syncEnabled    Boolean  @default(true)
  syncStockEnabled  Boolean @default(true)
  syncPriceEnabled  Boolean @default(false)
  syncIntervalMin   Int    @default(60)   // هر چند دقیقه sync شود
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  platform IntegPlatform @relation(fields: [platformCode], references: [code])

  @@unique([platformCode, siteId])
  @@index([status])
  @@index([platformCode])
}

enum IntegConnStatus {
  CONNECTED
  DISCONNECTED
  ERROR
  SYNCING
}

// ── Mapping محصولات ───────────────────────────────────────────
// هر ردیف = محصول فروشگاه ↔ محصول در یک پلتفرم خارجی

model IntegProductMapping {
  id                String   @id @default(cuid())
  shopProductId     String
  platformCode      String
  platformProductId String   // شناسه محصول در سیستم خارجی
  platformSku       String?  // SKU در سیستم خارجی (اختیاری)
  platformTitle     String?  // عنوان در آن سیستم (فقط برای نمایش)
  isActive          Boolean  @default(true)
  meta              Json     @default("{}")  // داده‌های اضافی
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  shopProduct Product       @relation(fields: [shopProductId], references: [id], onDelete: Cascade)
  platform    IntegPlatform @relation(fields: [platformCode], references: [code])

  @@unique([shopProductId, platformCode])
  @@unique([platformCode, platformProductId])
  @@index([shopProductId])
  @@index([platformCode])
  @@index([isActive])
}

// ── پیشنهادهای auto-match (قبل از تأیید کاربر) ──────────────

model IntegMappingSuggestion {
  id                String   @id @default(cuid())
  shopProductId     String
  platformCode      String
  platformProductId String
  platformTitle     String?
  confidence        Float    // 0.0 تا 1.0
  matchReason       String?  // "barcode" | "sku" | "title_exact" | "title_fuzzy"
  status            IntegSuggestionStatus @default(PENDING)
  reviewedAt        DateTime?
  createdAt         DateTime @default(now())

  platform IntegPlatform @relation(fields: [platformCode], references: [code])

  @@index([shopProductId])
  @@index([platformCode, status])
  @@index([confidence])
}

enum IntegSuggestionStatus {
  PENDING    // در انتظار بررسی کاربر
  APPROVED   // تأیید شد → mapping ساخته شد
  REJECTED   // رد شد
  EXPIRED    // منقضی شد (محصول تغییر کرد)
}

// ── Queue ─────────────────────────────────────────────────────

model IntegJob {
  id            String   @id @default(cuid())
  type          IntegJobType
  platformCode  String
  payload       Json
  status        IntegJobStatus @default(PENDING)
  priority      Int      @default(5)    // 1 = بالاترین
  attempts      Int      @default(0)
  maxAttempts   Int      @default(3)
  lastError     String?
  scheduledAt   DateTime @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())

  platform IntegPlatform @relation(fields: [platformCode], references: [code])
  logs     IntegLog[]

  @@index([status, scheduledAt])
  @@index([platformCode, status])
  @@index([priority, scheduledAt])
  @@index([type])
}

enum IntegJobType {
  SYNC_STOCK         // sync موجودی یک محصول
  SYNC_PRICE         // sync قیمت یک محصول
  SYNC_ALL_STOCK     // sync کل موجودی
  SYNC_ALL_PRICE     // sync کل قیمت‌ها
  FETCH_PRODUCTS     // دریافت لیست محصولات (برای mapping)
  CREATE_PRODUCT     // ساخت محصول در پلتفرم
  TEST_CONNECTION    // تست اتصال
}

enum IntegJobStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
  RETRYING
  CANCELLED
}

// ── Log ───────────────────────────────────────────────────────

model IntegLog {
  id             String   @id @default(cuid())
  jobId          String?
  platformCode   String
  operationType  IntegJobType
  direction      IntegLogDirection
  entityType     IntegEntityType
  entityId       String?   // shopProductId
  requestData    Json?
  responseData   Json?
  status         IntegLogStatus
  errorMessage   String?
  durationMs     Int?
  createdAt      DateTime @default(now())

  job      IntegJob?     @relation(fields: [jobId], references: [id])
  platform IntegPlatform @relation(fields: [platformCode], references: [code])

  @@index([platformCode, createdAt])
  @@index([entityType, entityId])
  @@index([status])
  @@index([jobId])
  @@index([createdAt])
}

enum IntegLogDirection {
  INBOUND    // دریافت از پلتفرم
  OUTBOUND   // ارسال به پلتفرم
}

enum IntegEntityType {
  PRODUCT
  STOCK
  PRICE
  CONNECTION
}

enum IntegLogStatus {
  SUCCESS
  ERROR
  PARTIAL
}

// ── قوانین قیمت‌گذاری (Rule Engine) ──────────────────────────

model IntegPriceRule {
  id               String   @id @default(cuid())
  name             String
  description      String?
  isActive         Boolean  @default(true)
  priority         Int      @default(100)  // عدد کمتر = اجرا اول
  scopeCategoryIds String[] @default([])   // خالی = همه دسته‌ها
  scopeBrandIds    String[] @default([])   // خالی = همه برندها
  targetPlatforms  String[] @default([])   // خالی = همه پلتفرم‌ها
  formula          Json                    // ساختار JSON فرمول (ببینید بخش ۹)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([isActive, priority])
}

// ── تنظیمات کلی Integration Hub ──────────────────────────────

model IntegSettings {
  id                    String   @id @default("singleton")
  workerEnabled         Boolean  @default(true)
  workerIntervalSec     Int      @default(30)
  maxConcurrentJobs     Int      @default(5)
  logRetentionDays      Int      @default(30)
  updatedAt             DateTime @updatedAt
}
```

**اضافه کردن به model فعلی Product:**
```prisma
// در model Product — اضافه کردن این خط:
integMappings IntegProductMapping[]
```

---

## ۶. Adapter Interface

```typescript
// lib/integration/adapters/base.adapter.ts

export interface IntegProductInfo {
  platformId:    string;
  title:         string;
  sku?:          string;
  barcode?:      string;
  categoryName?: string;
  brandName?:    string;
  purchasePrice?: number;  // قیمت خرید (فقط حسابداری)
  salePrice?:    number;
  stock?:        number;
  unit?:         string;   // واحد (عدد / کیلوگرم / ...)
  weight?:       number;
  attributes?:   Record<string, string>;
  imageUrls?:    string[];
}

export interface StockUpdate {
  platformProductId: string;
  stock:             number;
}

export interface PriceUpdate {
  platformProductId: string;
  price:             number;
  salePrice?:        number;
}

export interface ConnectionTestResult {
  success:   boolean;
  message?:  string;
  shopInfo?: Record<string, unknown>;  // اطلاعات کسب‌وکار (نام، کد ...)
}

export interface PaginatedProducts {
  items:    IntegProductInfo[];
  total:    number;
  page:     number;
  hasMore:  boolean;
}

export abstract class BaseAdapter {
  abstract readonly platformCode: string;
  abstract readonly platformName: string;

  // تست اتصال — همیشه پیاده‌سازی می‌شود
  abstract testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult>;

  // دریافت محصولات (برای initial mapping)
  abstract fetchProducts(
    credentials: Record<string, string>,
    page: number,
    pageSize: number
  ): Promise<PaginatedProducts>;

  // به‌روزرسانی موجودی (batch)
  abstract updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[]
  ): Promise<{ success: string[]; failed: { id: string; error: string }[] }>;

  // به‌روزرسانی قیمت (batch) — اختیاری
  updatePrice?(
    credentials: Record<string, string>,
    updates: PriceUpdate[]
  ): Promise<{ success: string[]; failed: { id: string; error: string }[] }>;

  // ساخت محصول جدید — اختیاری (نه همه پلتفرم‌ها support دارند)
  createProduct?(
    credentials: Record<string, string>,
    product: IntegProductInfo
  ): Promise<string>;  // platformProductId ساخته‌شده

  // Rate limit helper — هر Adapter می‌تواند override کند
  protected async rateLimit(): Promise<void> {
    // پیاده‌سازی پیش‌فرض: بدون تأخیر
  }
}
```

---

## ۷. Queue Worker — روش کار

بدون Redis — فقط PostgreSQL با `SELECT ... FOR UPDATE SKIP LOCKED`:

```typescript
// lib/integration/core/queue-worker.ts (ساختار کلی)

export async function runWorkerCycle(maxJobs = 5): Promise<void> {
  // ۱. گرفتن job‌های pending به صورت atomic
  const jobs = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<IntegJob[]>`
      SELECT * FROM "IntegJob"
      WHERE status = 'PENDING'
        AND "scheduledAt" <= NOW()
      ORDER BY priority ASC, "scheduledAt" ASC
      LIMIT ${maxJobs}
      FOR UPDATE SKIP LOCKED
    `;
    if (!rows.length) return [];

    const ids = rows.map(r => r.id);
    await tx.integJob.updateMany({
      where: { id: { in: ids } },
      data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
    });
    return rows;
  });

  // ۲. اجرای موازی
  await Promise.allSettled(jobs.map(job => executeJob(job)));
}

// در app startup (lib/integration/core/worker-bootstrap.ts):
// setInterval(() => runWorkerCycle(), settings.workerIntervalSec * 1000)
// یا: یک API route که pm2 هر 30 ثانیه صدا می‌زند
```

**Retry logic:**
- هر job حداکثر `maxAttempts` (پیش‌فرض ۳) بار تلاش می‌کند
- بعد از هر شکست: `scheduledAt = now + (attempts² × 60s)` — exponential backoff
- بعد از `maxAttempts`: status → `FAILED`، دست کاربر برای Retry دستی

---

## ۸. Auto-Match Algorithm

برای matching اولیه محصولات فروشگاه با محصولات پلتفرم:

```
confidence = 0

اگر barcode یکسان:            → confidence = 1.0  (قطعی، بلافاصله mapping)
اگر SKU یکسان:                → confidence = 0.95 (قطعی)
اگر عنوان دقیقاً یکسان:       → confidence = 0.85
اگر عنوان similarity > 80%:   → confidence = 0.65
  + برند یکسان:               → +0.10
  + دسته‌بندی یکسان:          → +0.10
  + وزن نزدیک (±10%):         → +0.05

آستانه نمایش به کاربر: confidence >= 0.60
آستانه auto-approve:   confidence >= 0.95 (barcode/SKU)
```

برای similarity متن فارسی:
- نرمال‌سازی: حذف فاصله‌های اضافی، یکسان‌سازی ی/ک عربی و فارسی، حذف اعراب
- الگوریتم: Jaro-Winkler (سریع، بدون dependency اضافه)

---

## ۹. Rule Engine — ساختار فرمول JSON

```typescript
// انواع node در فرمول:

// متغیرها (ورودی)
{ "type": "var", "name": "last_purchase_price" }
{ "type": "var", "name": "avg_purchase_price" }
{ "type": "var", "name": "current_stock" }
{ "type": "var", "name": "shop_price" }
{ "type": "var", "name": "shipping_cost" }   // از StoreSettings
{ "type": "const", "value": 50000 }

// عملیات ریاضی
{ "type": "add",      "args": [nodeA, nodeB] }
{ "type": "subtract", "args": [nodeA, nodeB] }
{ "type": "multiply", "args": [nodeA, nodeB] }
{ "type": "divide",   "args": [nodeA, nodeB] }
{ "type": "max",      "args": [nodeA, nodeB] }
{ "type": "min",      "args": [nodeA, nodeB] }
{ "type": "percent_of", "percent": 20, "of": node }  // 20% از X
{ "type": "round_up", "to": 1000, "arg": node }      // گرد کردن به ۱۰۰۰

// شرطی
{
  "type": "if",
  "condition": { "type": "lt", "args": [{ "type": "var", "name": "current_stock" }, 5] },
  "then": { "type": "percent_of", "percent": 35, "of": { "type": "var", "name": "last_purchase_price" } },
  "else": { "type": "percent_of", "percent": 25, "of": { "type": "var", "name": "last_purchase_price" } }
}
```

**مثال کامل**: قیمت = آخرین خرید + ۲۸٪، حداقل ۱۵٪ سود، گرد شده به ۱۰۰۰ تومان
```json
{
  "type": "round_up",
  "to": 1000,
  "arg": {
    "type": "max",
    "args": [
      {
        "type": "multiply",
        "args": [
          { "type": "var", "name": "last_purchase_price" },
          1.28
        ]
      },
      {
        "type": "multiply",
        "args": [
          { "type": "var", "name": "last_purchase_price" },
          1.15
        ]
      }
    ]
  }
}
```

---

## ۱۰. UI — سایدبار ادمین

در `app/admin/layout.tsx`، یه گروه جدید اضافه می‌شود:

```typescript
{
  label: "یکپارچه‌سازی",
  items: [
    {
      href: "/admin/integration", label: "داشبورد", icon: "integration",
    },
    {
      href: "/admin/integration/connections", label: "اتصالات", icon: "plug",
      children: [
        { href: "/admin/integration/connections", label: "همه اتصالات" },
        // per-platform links داینامیک
      ],
    },
    {
      href: "/admin/integration/mapping", label: "نگاشت محصولات", icon: "mapping",
      children: [
        { href: "/admin/integration/mapping", label: "لیست Mapping" },
        { href: "/admin/integration/mapping/suggestions", label: "پیشنهادهای اتصال" },
      ],
    },
    { href: "/admin/integration/price-rules", label: "قوانین قیمت", icon: "price" },
    { href: "/admin/integration/queue", label: "صف عملیات", icon: "queue" },
    { href: "/admin/integration/logs", label: "گزارش لاگ‌ها", icon: "logs" },
  ],
}
```

### صفحات UI

| مسیر | توضیح |
|------|-------|
| `/admin/integration` | داشبورد: health پلتفرم‌ها، آمار sync، آخرین job‌ها |
| `/admin/integration/connections` | لیست پلتفرم‌های موجود + وضعیت اتصال |
| `/admin/integration/connections/hesaban` | ورود API key وب‌حسابان + تست |
| `/admin/integration/connections/basalam` | ورود credential باسلام + تست |
| `/admin/integration/mapping` | جدول: محصولات فروشگاه + ستون هر پلتفرم |
| `/admin/integration/mapping/suggestions` | لیست پیشنهادها با confidence + دکمه تأیید/رد |
| `/admin/integration/price-rules` | لیست قوانین + فعال/غیرفعال |
| `/admin/integration/price-rules/create` | سازنده قانون جدید |
| `/admin/integration/queue` | job‌های pending/failed + retry دستی |
| `/admin/integration/logs` | لاگ‌ها با فیلتر پلتفرم/تاریخ/وضعیت |

---

## ۱۱. نکات مهم پیاده‌سازی

### ۱۱.۱ رمزنگاری Credentials
```typescript
// lib/integration/core/crypto.ts
// کلید: env var INTEGRATION_ENCRYPTION_KEY (32 bytes, hex)
// الگوریتم: AES-256-GCM
// هر encrypt یه IV جدید تولید می‌کند
function encryptCredentials(data: Record<string, string>): string
function decryptCredentials(encrypted: string): Record<string, string>
```
باید `INTEGRATION_ENCRYPTION_KEY` به `.env` هر deployment اضافه شود.

### ۱۱.۲ ارتباط با فروشگاه
فروشگاه به هیچ‌وجه import مستقیم از `lib/integration` نمی‌کند.
تنها نقطه تماس: وقتی موجودی یا قیمت در فروشگاه تغییر می‌کند، یک job به queue اضافه می‌شود:
```typescript
// این تابع داخل lib/integration/core/queue-manager.ts است
// و فروشگاه می‌تواند آن را import کند (نه برعکس)
export async function enqueueStockSync(shopProductId: string, newStock: number)
export async function enqueuePriceSync(shopProductId: string)
```
**مهم:** این import یک‌طرفه است. integration از shop import نمی‌کند.

### ۱۱.۳ Worker bootstrap
```typescript
// lib/integration/core/worker-bootstrap.ts
// این فایل در app/layout.tsx یا یه server component اجرا می‌شود
// یا از طریق یک cron endpoint که pm2 می‌زند

let workerStarted = false;
export function startWorkerIfNeeded() {
  if (workerStarted || typeof window !== "undefined") return;
  workerStarted = true;
  setInterval(() => runWorkerCycle(), 30_000);
}
```

### ۱۱.۴ Pagination برای Fetch Products
چون تعداد محصولات بین ۲۰۰ تا چند هزار است، `fetchProducts` صفحه‌به‌صفحه کار می‌کند:
- pageSize پیش‌فرض: ۱۰۰
- در `FETCH_PRODUCTS` job، از `meta.nextPage` برای ادامه استفاده می‌شود

---

## ۱۲. فازبندی پیاده‌سازی

### فاز ۰ — زیرساخت ✅ تکمیل شد (۱۴۰۵/۰۴/۱۰)
- [x] اضافه کردن جداول Integ به `schema.prisma` + migration
- [x] Seed کردن `IntegPlatform` (hesaban, basalam, digikala, divar, snappshop, tapsi_shop)
- [x] `BaseAdapter` abstract class + TypeScript types
- [x] `CryptoService` — AES-256-GCM با dev fallback
- [x] `LogService` — writeLog، withLog، cleanOldLogs
- [x] `QueueManager` — enqueue، cancelJob، retryJob، getQueueStats
- [x] `QueueWorker` — runWorkerCycle با FOR UPDATE SKIP LOCKED + exponential backoff
- [x] `AdapterRegistry` — Map-based registry
- [x] Worker bootstrap — startIntegrationWorker در instrumentation.ts
- [x] API route /api/integration/worker
- [x] گروه «یکپارچه‌سازی» در سایدبار ادمین
- [x] صفحات skeleton: dashboard، connections، mapping، suggestions، price-rules، queue، logs

### فاز ۱ — اتصال وب‌حسابان (نیاز به مستندات API)
**تخمین: ۳-۵ روز**
- [ ] `HesabanAdapter` (testConnection + fetchProducts + updateStock + updatePrice)
- [ ] صفحه تنظیمات `/admin/integration/connections/hesaban`
- [ ] job: `TEST_CONNECTION`
- [ ] job: `SYNC_ALL_STOCK` از حسابداری به فروشگاه
- [ ] job: `SYNC_ALL_PRICE` از حسابداری به فروشگاه
- [ ] داشبورد: نمایش آخرین sync

### فاز ۲ — Mapping محصولات ✅ تکمیل شد (۱۴۰۵/۰۴/۱۱)
- [x] job: `FETCH_PRODUCTS` از حسابداری → auto-match
- [x] الگوریتم auto-match (bigram similarity فارسی) در `lib/integration/core/mapping.ts`
- [x] صفحه `/admin/integration/mapping/suggestions` با approve/reject کاربردی
- [x] صفحه `/admin/integration/mapping` با جدول + دکمه fetch
- [x] API: `/api/integration/mapping` (GET/POST/DELETE)
- [x] API: `/api/integration/mapping/suggestions` (GET/PATCH)

### فاز ۳ — باسلام ✅ تکمیل شد (۱۴۰۵/۰۴/۱۱)
- [x] `BasalamAdapter` در `lib/integration/adapters/marketplace/basalam.adapter.ts`
  - testConnection → `GET /v1/users/me` + auto-extract vendorId
  - fetchProducts → `GET /v1/vendors/{vendorId}/products?page=&per_page=`
  - updateStock → `PATCH core.basalam.com/v3/vendors/{vendorId}/products` (batch 50)
  - updatePrice → همان endpoint با `primary_price`
- [x] ثبت در `adapter-registry.ts`
- [x] صفحه تنظیمات `/admin/integration/connections/basalam` با auto-fill vendorId
- [x] Mapping: صفحه `/admin/integration/mapping` حالا چند-پلتفرمی با تب‌ها
- [x] Sync موجودی: فروشگاه → باسلام (PUSH — worker.ts از قبل پشتیبانی می‌کند)
- [x] Sync قیمت: فروشگاه → باسلام با `primary_price`

### فاز ۴ — Rule Engine قیمت ✅ تکمیل شد (۱۴۰۵/۰۴/۱۱)
- [x] `evaluateFormula` + `applyRulesToPrices` در `lib/integration/core/price-rule-engine.ts`
  - انواع node: var, const, add, subtract, multiply, divide, max, min, percent_of, round_up, if
  - انواع condition: lt, gt, lte, gte, eq, and, or
- [x] ۵ template آماده: shop_as_is, cost_plus_30, shop_plus_5, fixed_margin_20, dynamic_stock
- [x] worker.ts: قبل از updatePrice برای MARKETPLACE، applyRulesToPrices فراخوانی می‌شود
- [x] worker.ts: هنگام SYNC_ALL_STOCK از حسابان، lastPurchasePrice در mapping.meta ذخیره می‌شود
- [x] API: GET/POST `/api/integration/price-rules` + GET/PUT/DELETE `/api/integration/price-rules/[id]`
- [x] Admin `/admin/integration/price-rules`: لیست + toggle + حذف
- [x] Admin `/admin/integration/price-rules/create`: فرم با formula editor + templates + preview زنده
- [x] Admin `/admin/integration/price-rules/[id]`: ویرایش قانون

### فاز ۵ — گسترش
- [ ] Adapterهای بعدی (Digikala، Divar، SnappShop، TapsiShop)
- [ ] داشبورد مانیتورینگ پیشرفته
- [ ] مشاهده سفارشات از مارکت‌پلیس‌ها (view-only)
- [ ] هشدارها و نوتیفیکیشن (sync شکست خورد، موجودی صفر شد، ...)

---

## ۱۳. تاریخچه تصمیمات

| تاریخ | تصمیم | دلیل |
|-------|-------|------|
| ۱۴۰۵/۰۴/۱۰ | طراحی اولیه schema و architecture | بررسی کدبیس |
| ۱۴۰۵/۰۴/۱۰ | DB: همان PostgreSQL فروشگاه، پیشوند Integ | JOIN با Product، یک Prisma client، هر deployment مستقل |
| ۱۴۰۵/۰۴/۱۰ | Queue: PostgreSQL بدون Redis | بدون infrastructure اضافه، کافی برای این scale |
| ۱۴۰۵/۰۴/۱۰ | حسابداری: وب‌حسابان | اولین هدف — مستندات API بعداً |
| ۱۴۰۵/۰۴/۱۰ | مارکت‌پلیس اول: باسلام | اولین هدف — مستندات API بعداً |
| ۱۴۰۵/۰۴/۱۰ | scope فعلی: فقط موجودی + قیمت | سفارشات view-only در آینده |
| ۱۴۰۵/۰۴/۱۰ | Adapter import یک‌طرفه | فروشگاه از Integration import می‌کند، نه برعکس |

---

## ۱۴. env vars جدید مورد نیاز

```bash
# در .env هر deployment اضافه شود:
INTEGRATION_ENCRYPTION_KEY="..."   # 32-byte hex — برای رمزنگاری credentials
```

---

## ۱۵. API Reference — وب‌حسابان

> مستندات: `https://hesabanweb.com/swagger/index.html`  
> OpenAPI JSON: `hesabanweb.json` (نسخه v3)

### احراز هویت
- **نوع**: JWT Bearer Token
- **هدر**: `Authorization: Bearer {token}`
- **دریافت توکن**: کاربر از پنل وب‌حسابان توکن خودش رو کپی می‌کند
- فرمت credentials در DB: `{ "token": "...", "storageId": "..." }` (storageId اختیاری)

### اندپوینت‌های کلیدی

| Method | Path | توضیح |
|--------|------|-------|
| GET | `/User/GetUserInfo` | تست اتصال + اطلاعات کاربر |
| GET | `/Product/GetProductsCount` | تعداد کل کالاها |
| GET | `/Product/PRODUCTS/{only_stock}/{per_page}/{page}` | لیست کالاها (با moujodi اگه only_stock=true) |
| GET | `/Product/GetProductByCode?code=` | کالا با کد |
| GET | `/Product/GetProductByBarcode?barcode=` | کالا با بارکد |
| GET | `/Product/GetProductStock?productCode=&storageId=` | موجودی یک کالا |
| POST | `/Product/Add` | ساخت کالای جدید |
| POST | `/Product/Edit` | ویرایش کالا (برای update قیمت) |
| POST | `/Product/Inquiry` | استعلام batch کالاها با کد → `[{code, status, id}]` |
| POST | `/SalesInvoice/AddInvoice` | ثبت فاکتور فروش (آینده) |
| GET | `/Storage/GetAllStorages` | لیست انبارها |

### `ProductResponseModel` — فیلدهای مهم
```typescript
{
  id: number;              // شناسه داخلی حسابان
  name: string;            // نام کالا
  code: string;            // کد کالا (unique identifier)
  barcode: string;         // بارکد
  price: number;           // قیمت فروش (ریال)
  buyPrice: number;        // قیمت خرید
  oneAmount: number;       // ارزش میانگین هر واحد
  count: number;           // موجودی کل در همه انبارها
  stocks: [{storageId, count}][];  // موجودی per انبار
  enumerationUnit: string; // واحد (عدد / کیلوگرم / ...)
  disabled: boolean;       // فعال/غیرفعال
  taxPercent: number;
}
```

### نکات پیاده‌سازی
- **Pagination**: `GET /Product/PRODUCTS/false/{pageSize}/{page}` — آرایه برمی‌گردد، اندازه آرایه < pageSize یعنی صفحه آخر
- **stock sync**: مقدار `count` در `ProductResponseModel` = موجودی کل همه انبارها
- **price update**: از `POST /Product/Edit` با `ProductViewModel` — فقط فیلدهای تغییرکرده ارسال می‌شود
- **matching key**: `code` (کد کالا) مطمئن‌ترین key برای auto-match با barcode و SKU فروشگاه

---

## ۱۶. API Reference — باسلام

> مستندات SDK: `basalam.md`

### Base URLs
- احراز هویت: `https://auth.basalam.com`
- API عمومی: `https://openapi.basalam.com/v1/`
- API کالا (جدید): `https://core.basalam.com/v3/`

### احراز هویت
- **نوع**: Personal Access Token (PAT) — برای single-store integration بهترین گزینه
- **هدر**: `Authorization: Bearer {accessToken}`
- **دریافت**: از پنل توسعه‌دهندگان باسلام → "توکن دسترسی شخصی"
- فرمت credentials در DB: `{ "accessToken": "...", "refreshToken": "...", "vendorId": "123456" }`
- Refresh: `POST https://auth.basalam.com/oauth/token` با `grant_type=refresh_token`

### اندپوینت‌های کلیدی

| Method | Path | توضیح |
|--------|------|-------|
| GET | `openapi.basalam.com/v1/users/me` | اطلاعات کاربر + vendor.id |
| GET | `openapi.basalam.com/v1/vendors/{vendor_id}/products` | لیست محصولات غرفه (paginated) |
| GET | `core.basalam.com/v3/products/{product_id}` | جزئیات محصول |
| GET | `core.basalam.com/v3/products?vendor_ids=[id]&page=&per_page=` | لیست محصولات با فیلتر |
| POST | `core.basalam.com/v3/vendors/{vendor_id}/products` | ساخت محصول جدید |
| PUT | `update_product(product_id, request)` | ویرایش یک محصول |
| POST | `update_bulk_products(vendor_id, data)` | ویرایش batch محصولات |

### Update موجودی/قیمت (batch)
```typescript
// POST endpoint (از SDK)
update_bulk_products(vendor_id, {
  data: [
    { id: 24018670, stock: 15 },
    { id: 24018671, stock: 0, primary_price: 250000 }
  ]
})
```

### `Product` — فیلدهای مهم (response)
```typescript
{
  id: number;            // Basalam product ID
  title: string;
  price: number;         // قیمت نمایشی (ریال)
  primary_price: number; // قیمت اصلی
  inventory: number;     // موجودی
  status: { value: number, name: string };
    // 2976=منتشر شده, 3790=منتشر نشده
  photo: { id, original, xs, sm, md, lg };
  sku: string;           // SKU (اگه تنظیم شده)
  is_wholesale: boolean;
  slug: string;
}
```

### نکات پیاده‌سازی
- **vendorId** باید از `/v1/users/me` گرفته شود (response: `vendor.id`) و در credentials ذخیره شود
- **stock sync**: از `update_bulk_products` با `{id, stock}` — به ازای هر محصول یک آیتم
- **price sync**: از `update_bulk_products` با `{id, primary_price}` — قیمت اصلی تغییر می‌کند
- **matching key**: `sku` اگه موجود باشد، وگرنه `title` برای fuzzy match
- **Pagination**: `per_page` max ≈ 100، `page` از ۱ شروع، وقتی `result_count < per_page` صفحه آخر است

---

## ۱۷. سوالات باقیمانده

| # | سوال | وضعیت |
|---|------|--------|
| 3 | آیا وب‌حسابان webhook دارد؟ | مستندات webhook نداشت — polling فعلاً کافیه |
| 4 | rate limit وب‌حسابان؟ | در مستندات ذکر نشده — محافظه‌کارانه: ۱۰۰ms بین request‌ها |
| 6 | آیا باسلام قیمت update می‌گیرد؟ | **بله** — `update_bulk_products` با `primary_price` |

---

*آخرین به‌روزرسانی: ۱۴۰۵/۰۴/۱۱ — API Reference وب‌حسابان و باسلام اضافه شد، آماده فاز ۱*
