# پیام‌های باسلام در پنل یکپارچه‌سازی — نقشه راه

> وضعیت: **پیاده‌سازی شد**، در انتظار آزمون روی دمو. آخرین به‌روزرسانی: ۱۴۰۵/۰۶/۲۰
> پیش‌نیاز مطالعه: `docs/integrations/hub.md` و `docs/integrations/vendors/basalam.md`

## ۱. خلاصه

یک بخش تازه در «سیستم یکپارچه‌سازی» با نام **پیام‌ها** که گفت‌وگوهای باسلام
(لیست چت‌ها + متن پیام‌ها) را داخل پنل نشان می‌دهد و امکان پاسخ‌دادن می‌دهد.
مدل داده از ابتدا چندپلتفرمی طراحی می‌شود تا بعداً تپسی‌شاپ و اسنپ‌شاپ هم
روی همان جدول‌ها بنشینند، ولی در فاز اول فقط آداپتور باسلام پیاده می‌شود.

## ۲. آنچه از مستندات موجود درآمد

فایل `docs/integrations/vendors/basalam.md` فقط سطح SDK پایتون را پوشش می‌دهد
(خطوط ۳۶۶–۳۸۲ و ۱۴۴۱–۱۴۶۱) و هیچ endpoint REST برای سرویس گفت‌وگو ندارد.
جزئیات REST از OpenAPI رسمی باسلام در مخزن `basalam/php-sdk`
(`openapi_data/chat.json`) استخراج شد. خلاصه‌اش:

| متد | مسیر | کاربرد |
|-----|------|--------|
| GET | `/v1/chats` | لیست گفت‌وگوها |
| GET | `/v1/chats/{chat_id}/messages` | پیام‌های یک گفت‌وگو |
| POST | `/v1/chats/{chat_id}/messages` | ارسال پیام |
| POST | `/v1/chats` | ساخت یا گرفتن چت خصوصی با یک کاربر |
| GET | `/v1/chats/unseen-count` | تعداد خوانده‌نشده‌ها |
| PATCH / DELETE | `/v1/chats/messages` | ویرایش و حذف پیام |

نکات مهم:

- **دامنه همان `https://openapi.basalam.com` است** که آداپتور فعلی استفاده می‌کند.
  یعنی نیازی به کلاینت یا احراز هویت جدید نیست، همان `authedFetch` با refresh
  خودکار توکن کار می‌کند.
- صفحه‌بندی لیست چت‌ها زمانی است نه شماره‌ای: `limit`، `order_by` با مقدار
  `updated_at` یا `modified_at`، و بازه‌های `updated_from` / `updated_before`.
  فیلتر `filters` فقط دو مقدار `unseen` و `order` را می‌پذیرد.
- صفحه‌بندی پیام‌ها مبتنی بر شناسه است: `message_id` به‌علاوه `cmp` از میان
  `lt`, `lte`, `gt`, `gte`, `bt`، به‌همراه `limit` و `order`.
- ساختار پاسخ‌ها: `data.chats[]` و `data.messages[]`.
- فیلدهای هر چت: `id`، `chat_type`، `unseen_message_count`، `updated_at`،
  `contact` و `contact_id`، `last_seen_id`، `contact_last_seen_message_id`،
  `last_message`، و متادیتای `group` / `channel` / `bot`.
- فیلدهای هر پیام: `id`، `chat_id`، `sender` (شناسه، نام، آواتار، غرفه)،
  `content` با `text` و `files[]` و `links[]`، `message_type`، `seen_at`،
  `created_at`، `replied_message`.
- ارسال پیام: بدنه شامل `content.text`، `message_type` با مقدار `text`، و
  اختیاری `replied_message_id`.
- **اسکوپ‌های لازم**: `customer.chat.read` برای خواندن و
  `customer.chat.write` برای ارسال. با اسکریپت `scripts/basalam-chat-probe.mjs`
  روی نصب mymonta تست شد و هر دو اسکوپ روی توکن فعال‌اند.
  `GET /v1/chats` و `GET /v1/chats/unseen-count` هر دو ۲۰۰ برگرداندند.
- **همه گفت‌وگوها پیام مشتری نیستند.** در خروجی واقعی، کانال‌های اطلاع‌رسانی
  باسلام (مثل «سلام تامین») هم در همین لیست می‌آیند با `chat_type` برابر
  `channel` و `contact` برابر null. پنل باید به‌طور پیش‌فرض فقط گفت‌وگوهای
  خصوصی را نشان دهد و کانال‌ها را جدا یا پنهان کند.
- رخداد وب‌هوک `CHAT_RECEIVED_MESSAGE` وجود دارد و اسکوپ `customer.chat.read`
  می‌خواهد. نمونه payload آن در `basalam.md` خط ۱۴۴۱ آمده است.

## ۳. مدل داده

دو جدول تازه، هم‌سبک بقیه جدول‌های `Integ`:

```
IntegChat
  id            String  @id @default(cuid())
  platformCode  String              // "basalam"
  externalId    String              // chat_id سمت پلتفرم
  chatType      String?
  contactId     String?
  contactName   String?
  contactAvatar String?
  unseenCount   Int     @default(0)
  lastMessageAt DateTime?
  lastMessageText String?
  externalUpdatedAt DateTime?       // برای sync افزایشی
  raw           Json    @default("{}")
  createdAt / updatedAt
  @@unique([platformCode, externalId])

IntegChatMessage
  id            String  @id @default(cuid())
  chatId        String              // FK به IntegChat، onDelete Cascade
  externalId    String
  direction     String              // "IN" | "OUT"
  senderId      String?
  senderName    String?
  messageType   String  @default("text")
  text          String? @db.Text
  files         Json    @default("[]")
  seenAt        DateTime?
  sentAt        DateTime
  sendStatus    String  @default("SYNCED")  // PENDING | SENT | FAILED برای پیام‌های خروجی
  sendError     String?
  raw           Json    @default("{}")
  @@unique([chatId, externalId])
```

جهت پیام (`direction`) از مقایسه `sender.id` با شناسه کاربر غرفه محاسبه می‌شود.
شناسه کاربر از `GET /v1/users/me` می‌آید و بهتر است در `credentials` اتصال
(کنار `vendorId`) به‌نام `userId` ذخیره شود تا هر بار فراخوانی نشود.

به enum `IntegJobType` دو مقدار اضافه می‌شود: `FETCH_CHATS` و `SEND_MESSAGE`.
چون `IntegLog.operationType` از همین enum استفاده می‌کند، لاگ‌ها خودبه‌خود کار می‌کنند.

## ۴. لایه آداپتور

سه متد تازه روی `BasalamAdapter` در
`lib/integration/adapters/marketplace/basalam.adapter.ts`:

- `fetchChats({ updatedFrom, limit })` — لیست گفت‌وگوها
- `fetchMessages({ chatId, sinceMessageId, limit })` — پیام‌های یک گفت‌وگو
- `sendMessage({ chatId, text, repliedMessageId })` — ارسال پاسخ

سه متد اختیاری روی `BaseAdapter` تعریف می‌شوند (نه اجباری) تا آداپتورهای
بدون چت دست‌نخورده بمانند. منطق ذخیره در پایگاه داده داخل آداپتور نمی‌رود،
بلکه در یک ماژول تازه `lib/integration/core/chat.ts` می‌نشیند، دقیقاً مثل
کاری که `core/orders.ts` و `core/discount.ts` می‌کنند.

## ۵. همگام‌سازی

**کشیدن دوره‌ای (فاز اول).** یک job از نوع `FETCH_CHATS` که worker موجود
(`lib/integration/core/worker.ts`) اجرا می‌کند:

1. لیست چت‌ها با `updated_from` برابرِ بیشترین `externalUpdatedAt` ذخیره‌شده.
2. برای هر چتی که `updated_at` تازه‌تری دارد، پیام‌ها با
   `message_id` برابرِ بزرگ‌ترین شناسه ذخیره‌شده و `cmp=gt`.
3. upsert چت و پیام‌ها با کلید یکتای `(platformCode, externalId)`.

بازه اجرا از `syncIntervalMin` اتصال جدا باشد، چون پیام باید سریع‌تر از
موجودی برسد. پیشنهاد: هر ۵ دقیقه.

**وب‌هوک (فاز دوم، اختیاری).** یک مسیر `app/api/integration/webhooks/basalam/route.ts`
هم‌سبک `webhooks/tapsi/route.ts` که رخداد `CHAT_RECEIVED_MESSAGE` را می‌گیرد و
پیام را بدون انتظار برای دور بعدی sync درج می‌کند. این کار نیاز به ثبت وب‌هوک
از طریق `create_webhook` و یک آدرس عمومی HTTPS دارد.

**ارسال.** پاسخ ادمین ابتدا با `sendStatus = PENDING` در پایگاه داده درج می‌شود،
بعد job از نوع `SEND_MESSAGE` صف می‌شود. موفقیت یعنی `SENT` و ثبت `externalId`
واقعی؛ شکست یعنی `FAILED` با متن خطا و امکان تلاش دوباره از UI.

## ۶. رابط کاربری

مسیر تازه `app/admin/integration/messages/` با یک `page.tsx` سروری و
`MessagesClient.tsx` کلاینتی، و یک آیتم تازه در سایدبار
`components/admin/nav.tsx` بین «سفارش‌های بازارگاه» و «پیشنهادات».

چیدمان دو ستونی راست‌به‌چپ:

- ستون راست: لیست گفت‌وگوها با نام مخاطب، متن آخرین پیام، زمان، و نشان
  خوانده‌نشده. فیلتر پلتفرم و جست‌وجو روی نام مخاطب.
- ستون چپ: رشته پیام‌ها به‌ترتیب زمان، حباب‌های ورودی و خروجی از هم متمایز،
  فایل‌های پیوست به‌صورت تصویر یا لینک، و کادر پاسخ در پایین.

در موبایل همان دو ستون به دو نمای پشت‌سر‌هم تبدیل می‌شود.
روی داشبورد `app/admin/integration/page.tsx` یک کارت آمار «پیام خوانده‌نشده»
و در صورت وجود، یک هشدار اضافه می‌شود.

## ۷. مسیرهای API داخلی

| متد | مسیر | کار |
|-----|------|-----|
| GET | `/api/integration/messages` | لیست گفت‌وگوها با فیلتر و صفحه‌بندی |
| GET | `/api/integration/messages/[chatId]` | پیام‌های یک گفت‌وگو |
| POST | `/api/integration/messages/[chatId]` | ثبت پاسخ و صف‌کردن ارسال |
| POST | `/api/integration/messages/sync` | اجرای دستی همگام‌سازی |

## ۸. آنچه پیاده شد

| بخش | فایل |
|-----|------|
| مدل داده | `IntegChat` و `IntegChatMessage` در `prisma/schema.prisma` |
| مهاجرت | `prisma/migrations/20260911160000_integ_chat/` |
| متدهای پلتفرم | `fetchChats`، `fetchMessages`، `sendMessage`، `resolveSelfId` در آداپتور باسلام |
| قرارداد آداپتور | متدهای اختیاری در `lib/integration/adapters/base.adapter.ts` |
| هسته | `lib/integration/core/chat.ts` |
| صف و worker | نوع job جدید `FETCH_CHATS` و `SEND_MESSAGE` در `lib/integration/core/worker.ts` |
| API | `app/api/integration/messages/` |
| پنل | `app/admin/integration/messages/` و آیتم سایدبار |
| داشبورد | کارت «پیام خوانده‌نشده» و هشدار مربوطه |
| ابزار تست | `scripts/basalam-chat-probe.mjs` |

به enum `IntegEntityType` هم مقدار `CHAT` اضافه شد تا لاگ‌ها موضوع درست بگیرند.

حلقه `FETCH_CHATS` خودترمیم است: هر دور دور بعدی را با تأخیر پنج دقیقه صف می‌کند،
دقیقاً مثل حلقه `FETCH_ORDERS`. دکمه «همگام‌سازی» در پنل فقط job در انتظار را
جلو می‌اندازد و job تکراری نمی‌سازد.

باقی‌مانده برای فاز دوم: وب‌هوک بلادرنگ `CHAT_RECEIVED_MESSAGE`.

## ۹. تصمیم‌های تأییدشده

| موضوع | تصمیم |
|-------|-------|
| دامنه کار | نمایش گفت‌وگوها به‌علاوه پاسخ‌دادن از پنل |
| روش همگام‌سازی | کشیدن دوره‌ای هر ۵ دقیقه، وب‌هوک فعلاً خارج از دامنه |
| تاریخچه اولیه | فقط ۳۰ روز اخیر |
| دامنه پلتفرم | جدول‌ها چندپلتفرمی با `platformCode`، آداپتور فقط باسلام |

بر اساس این تصمیم‌ها، بند ۵ فقط بخش «کشیدن دوره‌ای» و «ارسال» را در فاز اول
اجرا می‌کند و بند وب‌هوک به پیوست آینده منتقل می‌شود.

## ۱۰. ریسک‌ها و نکات باز

- **اسکوپ توکن.** تا وقتی توکن فعلی `customer.chat.read` نداشته باشد همه‌چیز
  با HTTP 403 برمی‌گردد. این اولین چیزی است که باید تست شود.
- **حجم داده.** بار اول فقط ۳۰ روز اخیر کشیده می‌شود. اگر گفت‌وگویی در این
  بازه هم پرپیام بود، یک سقف ۲۰۰ پیامی روی هر چت در همان دور اول اعمال می‌شود.
- **فایل‌های پیوست.** آدرس فایل‌های باسلام ممکن است امضای زمان‌دار داشته باشند.
  اگر چنین باشد نمایش تصویر قدیمی در پنل خراب می‌شود و باید آینه شوند.
- **تفکیک چت‌های سفارش.** فیلتر `filters=order` نشان می‌دهد باسلام چت‌های مرتبط
  با سفارش را جدا می‌شناسد. اگر بتوان چت را به `IntegOrder` وصل کرد ارزش زیادی
  دارد، ولی کلید اتصال هنوز روشن نیست.
