# Integration Hub — پلن کامل پروژه

> **این فایل سند زنده پروژه Integration Hub است.**
> هر بار که کار روی این پروژه شروع می‌شود، این فایل اول خوانده شود.
> آخرین به‌روزرسانی: ۱۴۰۵/۰۴/۱۰

---

## ۱. خلاصه اجرایی

Integration Hub یک ماژول مستقل است که داخل پنل ادمین فروشگاه نمایش داده می‌شود و وظیفه یکپارچه‌سازی فروشگاه با نرم‌افزارهای حسابداری و مارکت‌پلیس‌ها را دارد.

**اصول اساسی طراحی:**
- فروشگاه (shop) هیچ کد مستقیمی به حسابداری/مارکت‌پلیس‌ها ندارد — همه چیز از طریق Integration Hub
- هر پلتفرم خارجی = یک Adapter مستقل
- Mapping بر اساس شناسه داخلی هر سیستم (نه عنوان یا SKU جدید)
- حسابداری = مرجع نهایی موجودی
- همه عملیات از طریق Queue پردازش می‌شوند
- همه عملیات در Log ثبت می‌شوند

---

## ۲. وضعیت فعلی

### ✅ تکمیل‌شده
- طراحی معماری کلی
- بررسی کدبیس فروشگاه
- طراحی Database Schema
- طراحی Adapter Interface

### 🔄 در انتظار تصمیم (سوالات باز)
- [ ] **کدام نرم‌افزار حسابداری هدف اول؟** — بر معماری Accounting Adapter تأثیر مستقیم دارد
- [ ] **Redis موجود است یا فقط PostgreSQL؟** — بر طراحی Queue تأثیر دارد
- [ ] **اولویت Adapter اول: Basalam یا Digikala؟**
- [ ] **آیا سفارشات مارکت‌پلیس به فروشگاه وارد می‌شوند؟** (bidirectional orders)
- [ ] **تعداد محصولات برای mapping؟** (مقیاس سیستم)

### 🔜 مرحله بعدی
وقتی سوالات بالا جواب گرفت → شروع پیاده‌سازی Phase 1

---

## ۳. معماری کلی

```
┌─────────────────────────────────────────────────────────┐
│                    Admin Dashboard                       │
│              (Integration Hub UI)                       │
└─────────────────────┬───────────────────────────────────┘
                      │ Next.js API Routes
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Integration Hub Core                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Sync     │  │ Mapping  │  │ Price    │  │  Log   │ │
│  │ Engine   │  │ Service  │  │ Rule     │  │Service │ │
│  └──────────┘  └──────────┘  │ Engine   │  └────────┘ │
│                               └──────────┘             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Queue Manager                      │   │
│  └─────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│Accounting │  │ Basalam   │  │ Digikala  │  ...
│ Adapter   │  │ Adapter   │  │ Adapter   │
│(Interface)│  │(Interface)│  │(Interface)│
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │               │              │
      ▼               ▼              ▼
  حسابداری        باسلام          دیجیکالا
```

### لایه‌بندی فایل‌ها (طراحی پیشنهادی)

```
lib/
  integration/
    core/
      sync-engine.ts        ← موتور اصلی sync
      queue-manager.ts      ← مدیریت Queue
      mapping-service.ts    ← مدیریت Mapping
      price-rule-engine.ts  ← Rule Engine قیمت
      log-service.ts        ← ثبت لاگ
    adapters/
      base.adapter.ts       ← Interface مشترک
      accounting/
        hesabfa.adapter.ts
        (آینده: sepidaar.adapter.ts)
      marketplace/
        basalam.adapter.ts
        digikala.adapter.ts
        divar.adapter.ts
        snappshop.adapter.ts
        tapsi-shop.adapter.ts
    types/
      integration.types.ts  ← TypeScript types
app/
  admin/
    integration/
      page.tsx              ← داشبورد کلی Integration Hub
      connections/
        page.tsx            ← لیست اتصالات + add new
        [platform]/
          page.tsx          ← تنظیمات هر پلتفرم
      mapping/
        page.tsx            ← مدیریت Mapping محصولات
        suggestions/
          page.tsx          ← پیشنهادهای auto-match
      price-rules/
        page.tsx            ← مدیریت Rule Engine
        create/page.tsx
        [id]/page.tsx
      queue/
        page.tsx            ← وضعیت Queue
      logs/
        page.tsx            ← گزارش لاگ‌ها
  api/
    integration/
      connections/route.ts
      sync/route.ts
      mapping/route.ts
      mapping/suggestions/route.ts
      price-rules/route.ts
      queue/route.ts
      logs/route.ts
      webhook/[platform]/route.ts
```

---

## ۴. طراحی Database Schema

این جداول به schema.prisma فروشگاه اضافه می‌شوند:

```prisma
// ── پلتفرم‌های تعریف‌شده (seeded — کاربر نمی‌سازد) ───────────────────────────

model IntegrationPlatform {
  code        String   @id   // "hesabfa" | "basalam" | "digikala" | ...
  name        String         // "حسابفا" | "باسلام" | "دیجیکالا"
  type        IntegPlatformType
  logoUrl     String?
  docsUrl     String?
  isActive    Boolean  @default(true)
  connections IntegrationConnection[]
  mappings    IntegrationProductMapping[]
  jobs        IntegrationJob[]
  logs        IntegrationLog[]
}

enum IntegPlatformType {
  ACCOUNTING
  MARKETPLACE
}

// ── اتصال کاربر به هر پلتفرم ─────────────────────────────────────────────────

model IntegrationConnection {
  id             String   @id @default(cuid())
  platformCode   String
  siteId         String?  // برای multi-site
  credentials    String   // JSON رمزنگاری‌شده (AES-256)
  status         IntegConnStatus @default(DISCONNECTED)
  lastSyncAt     DateTime?
  lastErrorAt    DateTime?
  lastError      String?
  config         Json     @default("{}")  // تنظیمات اضافی هر پلتفرم
  syncEnabled    Boolean  @default(true)
  syncInterval   Int      @default(60)    // دقیقه
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  platform       IntegrationPlatform @relation(fields: [platformCode], references: [code])

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

// ── Mapping محصولات ───────────────────────────────────────────────────────────
// هر ردیف = یک محصول فروشگاه ↔ یک محصول در پلتفرم خارجی

model IntegrationProductMapping {
  id                 String   @id @default(cuid())
  shopProductId      String
  platformCode       String
  platformProductId  String   // شناسه محصول در سیستم خارجی
  platformSku        String?  // SKU در سیستم خارجی (اختیاری)
  platformTitle      String?  // عنوان در آن سیستم (برای نمایش)
  isActive           Boolean  @default(true)
  meta               Json     @default("{}")  // داده‌های اضافی (مثلاً variant IDs)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  shopProduct        Product  @relation(fields: [shopProductId], references: [id], onDelete: Cascade)
  platform           IntegrationPlatform @relation(fields: [platformCode], references: [code])

  @@unique([shopProductId, platformCode])
  @@unique([platformCode, platformProductId])
  @@index([shopProductId])
  @@index([platformCode])
  @@index([isActive])
}

// ── پیشنهادهای auto-match (قبل از تأیید کاربر) ───────────────────────────────

model IntegrationMappingSuggestion {
  id                 String   @id @default(cuid())
  shopProductId      String
  platformCode       String
  platformProductId  String
  platformTitle      String?
  confidence         Float    // 0.0 - 1.0
  matchReason        String?  // "title_match" | "barcode" | "sku" | ...
  status             IntegSuggestionStatus @default(PENDING)
  reviewedAt         DateTime?
  createdAt          DateTime @default(now())

  @@index([shopProductId])
  @@index([platformCode])
  @@index([status])
  @@index([confidence])
}

enum IntegSuggestionStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

// ── Queue ─────────────────────────────────────────────────────────────────────

model IntegrationJob {
  id            String   @id @default(cuid())
  type          IntegJobType
  platformCode  String
  payload       Json     // داده‌های لازم برای اجرا
  status        IntegJobStatus @default(PENDING)
  priority      Int      @default(5)    // 1 = بالاترین اولویت
  attempts      Int      @default(0)
  maxAttempts   Int      @default(3)
  lastError     String?
  scheduledAt   DateTime @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  platform      IntegrationPlatform @relation(fields: [platformCode], references: [code])
  logs          IntegrationLog[]

  @@index([status, scheduledAt])
  @@index([platformCode, status])
  @@index([type])
  @@index([priority, scheduledAt])
}

enum IntegJobType {
  SYNC_STOCK         // همگام‌سازی موجودی
  SYNC_PRICE         // همگام‌سازی قیمت
  SYNC_PRODUCT       // همگام‌سازی اطلاعات محصول
  CREATE_PRODUCT     // ساخت محصول در پلتفرم
  FETCH_PRODUCTS     // دریافت محصولات از پلتفرم (برای mapping)
  SYNC_ORDER         // دریافت سفارش از مارکت‌پلیس
  SYNC_ALL_STOCK     // همگام‌سازی کل موجودی
  SYNC_ALL_PRICE     // همگام‌سازی کل قیمت‌ها
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

// ── Log ───────────────────────────────────────────────────────────────────────

model IntegrationLog {
  id             String   @id @default(cuid())
  jobId          String?
  platformCode   String
  operationType  IntegJobType
  direction      IntegLogDirection
  entityType     IntegEntityType
  entityId       String?  // shopProductId یا orderId
  requestData    Json?    // درخواست ارسال‌شده به API
  responseData   Json?    // پاسخ دریافت‌شده از API
  status         IntegLogStatus
  errorMessage   String?
  durationMs     Int?
  createdAt      DateTime @default(now())
  job            IntegrationJob? @relation(fields: [jobId], references: [id])
  platform       IntegrationPlatform @relation(fields: [platformCode], references: [code])

  @@index([platformCode, createdAt])
  @@index([entityType, entityId])
  @@index([status])
  @@index([jobId])
  @@index([createdAt])
}

enum IntegLogDirection {
  INBOUND   // دریافت از پلتفرم
  OUTBOUND  // ارسال به پلتفرم
}

enum IntegEntityType {
  PRODUCT
  STOCK
  PRICE
  ORDER
  CONNECTION
}

enum IntegLogStatus {
  SUCCESS
  ERROR
  PARTIAL
}

// ── قوانین قیمت‌گذاری (Rule Engine) ─────────────────────────────────────────

model IntegrationPriceRule {
  id             String   @id @default(cuid())
  name           String
  description    String?
  isActive       Boolean  @default(true)
  priority       Int      @default(100)  // عدد کمتر = اولویت بالاتر
  // scope: null = همه محصولات؛ وگرنه فیلتر می‌کند
  scopeCategoryIds  String[]  @default([])
  scopeBrandIds     String[]  @default([])
  // پلتفرم‌های هدف: [] = همه
  targetPlatforms   String[]  @default([])
  // فرمول: درخت JSON از شرط‌ها و عملیات
  formula        Json
  // مثال formula:
  // { "type": "add_percent", "base": "last_purchase_price", "percent": 20 }
  // { "type": "if_stock_low", "threshold": 5, "then": { "type": "add_percent", "base": "cost", "percent": 30 } }
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([isActive, priority])
}

// ── تنظیمات کلی Integration Hub ──────────────────────────────────────────────

model IntegrationSettings {
  id                    String   @id @default("singleton")
  workerEnabled         Boolean  @default(true)
  workerIntervalSeconds Int      @default(30)   // هر چند ثانیه queue پردازش شود
  maxConcurrentJobs     Int      @default(5)
  logRetentionDays      Int      @default(30)
  autoSyncStock         Boolean  @default(true)
  autoSyncPrice         Boolean  @default(false)
  updatedAt             DateTime @updatedAt
}
```

**توجه**: به `Product` در schema.prisma فعلی باید یک رابطه اضافه شود:
```prisma
// در model Product (فعلی):
integrationMappings IntegrationProductMapping[]
```

---

## ۵. Adapter Interface

هر Adapter باید این interface را پیاده کند:

```typescript
// lib/integration/adapters/base.adapter.ts

export interface ProductInfo {
  platformId:   string;
  title:        string;
  sku?:         string;
  barcode?:     string;
  categoryName?: string;
  brandName?:   string;
  price?:       number;
  stock?:       number;
  weight?:      number;
  attributes?:  Record<string, string>;
  imageUrls?:   string[];
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
  details?:  Record<string, unknown>;
}

export interface BaseAdapter {
  readonly platformCode: string;
  readonly platformName: string;

  // تست اتصال
  testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult>;

  // دریافت همه محصولات (برای initial mapping)
  fetchAllProducts(credentials: Record<string, string>): Promise<ProductInfo[]>;

  // به‌روزرسانی موجودی
  updateStock(credentials: Record<string, string>, updates: StockUpdate[]): Promise<void>;

  // به‌روزرسانی قیمت
  updatePrice(credentials: Record<string, string>, updates: PriceUpdate[]): Promise<void>;

  // ساخت محصول جدید (اختیاری - هر Adapter می‌تواند پیاده نکند)
  createProduct?(credentials: Record<string, string>, product: ProductInfo): Promise<string>;

  // دریافت سفارشات جدید (فقط مارکت‌پلیس‌ها)
  fetchOrders?(credentials: Record<string, string>, since?: Date): Promise<unknown[]>;
}
```

---

## ۶. فازبندی پیاده‌سازی

### فاز ۰ — زیرساخت (باید اول انجام شود)
**تخمین زمان: ۲-۳ روز**
- [ ] اضافه کردن جداول Integration به `schema.prisma`
- [ ] Migration و generate
- [ ] ساخت `BaseAdapter` interface و types
- [ ] Queue Worker: یک API route که هر N ثانیه job‌های pending را پردازش می‌کند (ساده‌ترین رویکرد: cron-like از طریق `/api/integration/worker` که pm2 آن را می‌زند یا یه setInterval ساده)
- [ ] LogService: تابع ثبت log
- [ ] صفحه ادمین `/admin/integration` (skeleton)
- [ ] اضافه کردن Integration Hub به منوی ادمین

### فاز ۱ — اتصال حسابداری
**تخمین زمان: ۳-۵ روز (بستگی به پلتفرم حسابداری)**
- [ ] Accounting Adapter (برای پلتفرم انتخاب‌شده)
- [ ] صفحه اتصال حسابداری (ورود credential‌ها + تست)
- [ ] Sync موجودی: حسابداری → فروشگاه
- [ ] Sync قیمت: حسابداری → فروشگاه
- [ ] dashboard نمایش وضعیت sync

### فاز ۲ — Mapping محصولات
**تخمین زمان: ۴-۶ روز**
- [ ] FetchAllProducts از حسابداری
- [ ] الگوریتم auto-match (similarity بر اساس عنوان + bارکد + ویژگی‌ها)
- [ ] صفحه مدیریت Mapping:
  - لیست محصولات matched / unmatched
  - تأیید/رد پیشنهادها
  - manual match
  - ایجاد محصول جدید در فروشگاه از حسابداری

### فاز ۳ — اتصال مارکت‌پلیس اول
**تخمین زمان: ۳-۵ روز**
- [ ] Adapter مارکت‌پلیس اول (اولویت: باسلام یا دیجیکالا)
- [ ] Sync موجودی: فروشگاه → مارکت‌پلیس
- [ ] Sync قیمت: فروشگاه → مارکت‌پلیس
- [ ] Mapping محصولات فروشگاه ↔ مارکت‌پلیس

### فاز ۴ — Rule Engine قیمت
**تخمین زمان: ۴-۶ روز**
- [ ] طراحی ساختار JSON فرمول‌ها
- [ ] موتور اجرای Rule (با input‌های قیمت خرید، موجودی، هزینه‌ها)
- [ ] UI ساخت و ویرایش قوانین در ادمین
- [ ] اعمال قوانین هنگام sync قیمت

### فاز ۵ — گسترش (ادامه Adapterها)
- [ ] Adapter مارکت‌پلیس‌های بعدی
- [ ] دریافت سفارشات از مارکت‌پلیس به فروشگاه
- [ ] داشبورد مانیتورینگ پیشرفته
- [ ] هشدارها و نوتیفیکیشن‌ها

---

## ۷. جزئیات Queue Worker

چون Redis نداریم (سوال باز)، ساده‌ترین رویکرد برای MVP:

```
Option A (بدون Redis — فقط PostgreSQL):
- یک setInterval در یه Singleton Service
- یا یه cron job که /api/integration/worker را می‌زند
- Worker هر N ثانیه job‌های PENDING را fetch و پردازش می‌کند
- برای جلوگیری از duplicate processing: atomic update با SELECT ... FOR UPDATE SKIP LOCKED
- برای multi-instance (چند process/سرور): همان مکانیسم FOR UPDATE کافی است

Option B (با Redis):
- Bull Queue یا BullMQ
- Worker process جدا
- بهتر برای scale بالا
```

**توصیه**: با Option A شروع کن. اگر load زیاد شد، به B مهاجرت کن.

```typescript
// lib/integration/core/queue-worker.ts (ساختار کلی)
async function processNextBatch(batchSize = 5) {
  const jobs = await prisma.$transaction(async (tx) => {
    const pending = await tx.$queryRaw`
      SELECT * FROM "IntegrationJob"
      WHERE status = 'PENDING' AND "scheduledAt" <= NOW()
      ORDER BY priority ASC, "scheduledAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;
    // mark as PROCESSING
    ...
    return pending;
  });
  
  await Promise.all(jobs.map(job => executeJob(job)));
}
```

---

## ۸. Auto-Match Algorithm

برای اتصال اولیه محصولات، similarity score محاسبه می‌شود:

```
score = 0

اگر barcode یکسان → score += 1.0 (قطعی)
اگر SKU یکسان → score += 0.9
اگر عنوان دقیقاً یکسان → score += 0.8
اگر عنوان similarity > 80% → score += 0.6
اگر برند یکسان → score += 0.1
اگر دسته‌بندی یکسان → score += 0.1
اگر وزن نزدیک (±۵٪) → score += 0.05

score >= 0.85 → نمایش به عنوان پیشنهاد قوی
score >= 0.6  → نمایش به عنوان پیشنهاد ضعیف
score < 0.6   → unmatched (نیاز به بررسی دستی)
```

برای similarity متن: جایزین فارسی داریم (نرمال‌سازی اعداد/حروف)

---

## ۹. Rule Engine قیمت — ساختار JSON

```json
// مثال: قیمت = آخرین خرید × ۱.۳ + هزینه ارسال، حداقل ۱۵٪ سود
{
  "type": "max",
  "args": [
    {
      "type": "add",
      "args": [
        { "type": "multiply", "args": [{ "type": "var", "name": "last_purchase_price" }, 1.3] },
        { "type": "var", "name": "shipping_cost" }
      ]
    },
    {
      "type": "multiply",
      "args": [{ "type": "var", "name": "last_purchase_price" }, 1.15]
    }
  ]
}

// متغیرهای قابل استفاده:
// last_purchase_price   → آخرین قیمت خرید از حسابداری
// avg_purchase_price    → میانگین قیمت خرید
// cost_price            → قیمت تمام‌شده
// current_stock         → موجودی فعلی
// shop_price            → قیمت فعلی فروشگاه
// shipping_cost         → هزینه ارسال (از StoreSettings)
// packaging_cost        → هزینه بسته‌بندی (قابل تعریف)

// عملیات پایه:
// add, subtract, multiply, divide
// max, min
// if_then_else
// percent_of (x درصد از y)
// round_up (گرد کردن به بالا — برای قیمت‌های زیبا)
```

---

## ۱۰. نکات مهم معماری

### ۱۰.۱ رمزنگاری Credentials
credentials هر پلتفرم (API key، token و ...) باید رمزنگاری شده در DB ذخیره شوند:
```typescript
// lib/integration/core/crypto.ts
// AES-256-GCM با کلید از env var INTEGRATION_SECRET
function encryptCredentials(data: Record<string, string>): string
function decryptCredentials(encrypted: string): Record<string, string>
```

### ۱۰.۲ Event از فروشگاه به Integration
وقتی موجودی یا قیمت در فروشگاه تغییر می‌کند، باید job به queue اضافه شود:
```typescript
// در API routes فروشگاه که موجودی را تغییر می‌دهند:
await integrationQueueManager.enqueue({
  type: "SYNC_STOCK",
  platformCode: "all", // همه پلتفرم‌های متصل
  payload: { shopProductId: "...", newStock: 10 }
});
```

این کار با کمترین وابستگی (فقط یک import از integration) انجام می‌شود.

### ۱۰.۳ Multi-site
این فروشگاه روی چند دامنه اجرا می‌شود (۴ دامنه با SITE_URL مختلف). باید مشخص شود که:
- آیا Integration Hub باید per-site باشد؟ (احتمالاً بله — هر سایت حسابداری و مارکت‌پلیس خودش را دارد)
- `siteId` در `IntegrationConnection` برای این منظور طراحی شده

### ۱۰.۴ Rate Limiting
هر API پلتفرم محدودیت دارد. در Adapter باید rate limiting رعایت شود:
- باسلام: بررسی کردن docs
- دیجیکالا: بررسی کردن docs
- Queue بخشی از این کنترل را انجام می‌دهد

---

## ۱۱. پیشنهادات اضافی Claude

### ۱۱.۱ شروع با Accounting-only
پیشنهاد می‌کنم فاز ۰ و ۱ را کامل کنیم قبل از هر مارکت‌پلیسی. دلیل:
- حسابداری مرجع است — اگر sync آن کار کند، بقیه راحت‌تر است
- Mapping اول از حسابداری انجام می‌شود

### ۱۱.۲ Worker بدون Redis
برای شروع، به جای Redis، از یک API route `/api/integration/worker` استفاده کنیم که:
- داخل `next start` با یک `setInterval` هر ۳۰ ثانیه اجرا می‌شود
- یا یک endpoint که pm2 با crontab آن را می‌زند
- بعداً اگر load زیاد شد می‌توان به BullMQ + Redis مهاجرت کرد

### ۱۱.۳ Rule Engine — شروع ساده
برای MVP، ۵ نوع rule ساده داشته باشیم:
1. `cost_plus_percent` — هزینه + درصد سود
2. `last_purchase_plus_percent` — آخرین خرید + درصد سود
3. `fixed_margin` — حداقل مارژین ثابت
4. `if_stock_low_increase` — اگر موجودی کم بود، قیمت را بالا ببر
5. `platform_specific` — قیمت متفاوت برای هر پلتفرم

Visual builder بعداً اضافه می‌شود.

### ۱۱.۴ Webhook (آینده)
اگر پلتفرم‌ها webhook داشتند:
- `/api/integration/webhook/[platform]` آماده است در طراحی
- برای الان، polling کافی است

---

## ۱۲. سوالات باز — نیاز به جواب قبل از شروع کد

| # | سوال | تأثیر بر چه چیزی |
|---|------|-----------------|
| 1 | کدام نرم‌افزار حسابداری؟ | Accounting Adapter — API کاملاً متفاوت است |
| 2 | Redis موجود است؟ | Queue Worker architecture |
| 3 | اولویت اول مارکت‌پلیس؟ | کدام Adapter اول نوشته شود |
| 4 | سفارشات مارکت‌پلیس وارد فروشگاه شوند؟ | جداول Order و نیاز به `fetchOrders` در Adapter |
| 5 | تعداد محصولات؟ | بهینه‌سازی auto-match و batch size |
| 6 | Integration Hub per-site باشد؟ | استفاده از `siteId` در Connection |

---

## ۱۳. تاریخچه تصمیمات

| تاریخ | تصمیم | دلیل |
|-------|-------|------|
| ۱۴۰۵/۰۴/۱۰ | طراحی اولیه schema و architecture | بررسی کدبیس فروشگاه |
| - | Queue بدون Redis (اولیه) | سادگی + عدم نیاز به Redis برای MVP |
| - | Mapping با confidence score | کاهش کار دستی کاربر |

---

*این فایل را هر بار که کار انجام می‌شود، آپدیت کنید.*
*بخش «وضعیت فعلی» و «تاریخچه تصمیمات» را به‌روز نگه دارید.*
