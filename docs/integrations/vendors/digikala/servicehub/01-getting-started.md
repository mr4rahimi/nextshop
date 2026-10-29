# شروع کار با سرویس‌هاب — اولین درخواست API

> منبع: https://servicehub.digikala.services/fa/شروع-کار-با-سرویس-هاب  
> دریافت: ۱۴۰۵/۰۸/۰۷ — آکادمی سرویس‌هاب دیجی‌کالا (فقط از IP ایران باز می‌شود)

#  شروع کار با سرویس‌هاب — اولین درخواست API

>

**مخاطب:** توسعه‌دهندگانی که می‌خواهند برای اولین بار اپلیکیشن خود را با Marketplace API دیجی‌کالا یکپارچه کنند.

---

##  فهرست مطالب

1. مقدمه
2. پیش‌نیازها
3. مرور کلی جریان احراز هویت
4. مرحله ۱: هدایت فروشنده به صفحه رضایت
5. مرحله ۲: دریافت و رمزگشایی کد
6. مرحله ۳: دریافت توکن
7. مرحله ۴: اولین درخواست API
8. تمدید توکن
9. مدیریت خطاها
10. لینک‌های مرتبط

---

##  📖 مقدمه

**سرویس‌هاب** زیرساخت Open API دیجی‌کالا برای فروشندگان مارکت‌پلیس است. این پلتفرم بر پایه OAuth 2.0 ساخته شده و به اپلیکیشن‌های third-party اجازه می‌دهد با کسب رضایت صریح از فروشنده، به داده‌ها و عملیات پنل فروشندگی دسترسی پیدا کنند.

###  قابلیت‌های اصلی

| حوزه | توضیح |
|---|---|
| **محصولات و تنوع‌ها** | ایجاد، ویرایش و جستجوی محصولات و SKU‌ها |
| **سفارشات** | دریافت و مدیریت سفارشات فروشنده |
| **مرسوله‌ها و محموله‌ها** | پیگیری وضعیت ارسال و تحویل |
| **موجودی** | به‌روزرسانی موجودی انبار |
| **تخفیفات و تبلیغات** | مدیریت کمپین‌های قیمتی و تبلیغاتی |
| **گزارش‌های تحلیلی** | دسترسی به داده‌های فروش و عملکرد |
| **پروفایل فروشنده** | مشاهده و ویرایش اطلاعات فروشگاه |

برای پشتیبانی فنی با ایمیل [Marketplace-API@digikala.com](mailto:Marketplace-API@digikala.com) تماس بگیرید.

---

##  ⚙️ پیش‌نیازها

قبل از شروع، موارد زیر را آماده کنید:

**۱. ثبت‌نام اپلیکیشن** — اپلیکیشن شما باید توسط تیم دیجی‌کالا تأیید شده باشد. پس از تأیید، یک `client_code` منحصربه‌فرد دریافت خواهید کرد.

**۲. جفت کلید RSA (4096-bit)** — پلتفرم authorization code را با کلید عمومی شما رمزگذاری می‌کند. برای تولید کلید و فرمت مورد نیاز (PKCS#8) به [راهنمای احراز هویت — بخش ایجاد کلیدهای RSA](/fa/راهنمای-یکپارچه-سازی) مراجعه کنید.

>

⚠️ فایل کلید خصوصی را هرگز در repository کامیت نکنید و دسترسی فایل‌سیستم آن را محدود کنید (`chmod 600 private_pkcs8.pem`).

---

##  🔄 مرور کلی جریان احراز هویت

```
App  ──▶  Redirect to consent page  ──▶  Seller approves
 │
 ▼
Receive encrypted authorization_code in callback URL
 │
 ▼
Decrypt with RSA private key (PKCS#1 v1.5 padding)
 │
 ▼
POST /open-api/v1/auth/token  ──▶  Receive access_token + refresh_token
 │
 ▼
Call API with  Authorization: Bearer <access_token>

```

---

##  🔗 مرحله ۱: هدایت فروشنده به صفحه رضایت

فروشنده را به URL زیر ریدایرکت کنید تا مجوز دسترسی اپلیکیشن را تأیید کند:

```
https://seller.digikala.com/pwa/seller-services/consents
  ?client_code=YOUR_CLIENT_CODE
  &scopes=profile.read,order.read
  &redirect_uri=https://yourapp.com/callback
  &state=RANDOM_CSRF_TOKEN

```

###  پارامترها

| پارامتر | اجباری | توضیح |
|---|---|---|
| `client_code` | بله | کد اپلیکیشن دریافت‌شده هنگام ثبت‌نام |
| `scopes` | بله | لیست دسترسی‌های مورد نیاز، با کاما جدا شده |
| `redirect_uri` | بله | آدرس callback که پس از تأیید فروشنده ریدایرکت می‌شود |
| `state` | توصیه می‌شود | رشته تصادفی برای جلوگیری از CSRF |

>

لیست کامل scope‌های موجود را در [راهنمای احراز هویت — بخش Scope‌ها](/fa/راهنمای-یکپارچه-سازی) ببینید.

---

##  🔓 مرحله ۲: دریافت و رمزگشایی کد

پس از تأیید فروشنده، دیجی‌کالا به `redirect_uri` شما ریدایرکت می‌کند:

```
https://yourapp.com/callback?code=ENCRYPTED_CODE&state=RANDOM_CSRF_TOKEN

```

مقدار `code` با ترتیب **URL-encode ← Base64 ← RSA(PKCS#1 v1.5)** رمزگذاری شده است. مراحل رمزگشایی:

1. مقدار `code` را از query string استخراج کنید
2. آن را **URL-decode** کنید
3. نتیجه را **Base64-decode** کنید
4. خروجی را با کلید خصوصی RSA و padding از نوع **PKCS#1 v1.5** رمزگشایی کنید

>

نمونه کد رمزگشایی در تمام زبان‌های برنامه‌نویسی پشتیبانی‌شده را در [راهنمای احراز هویت — بخش رمزگشایی](/fa/راهنمای-یکپارچه-سازی) ببینید.

---

##  🎟️ مرحله ۳: دریافت توکن

پس از رمزگشایی کد، آن را با access_token تبادل کنید:

```
POST /open-api/v1/auth/token
Host: seller.digikala.com
Content-Type: application/json

{
  "authorization_code": "DECRYPTED_CODE_FROM_PREVIOUS_STEP"
}

```

###  پاسخ موفق (HTTP 200)

```
{
  "access_token": "<jwt-access-token>",
  "refresh_token": "<refresh-token>",
  "access_token_expires_at": {
    "date": "2025-02-07 02:00:00.000000",
    "timezone_type": 3,
    "timezone": "Asia/Tehran"
  },
  "refresh_token_expires_at": {
    "date": "2026-02-07 00:00:00.000000",
    "timezone_type": 3,
    "timezone": "Asia/Tehran"
  }
}

```

| فیلد | اعتبار |
|---|---|
| `access_token` | **۲ ساعت** |
| `refresh_token` | **۱ سال** |

>

⚠️ هر `authorization_code` فقط یک بار قابل استفاده است. نمونه کد تبادل توکن در تمام زبان‌ها را در [راهنمای احراز هویت](/fa/راهنمای-یکپارچه-سازی) ببینید.

---

##  🚀 مرحله ۴: اولین درخواست API

اکنون می‌توانید `access_token` را در هدر `Authorization` قرار دهید و API را فراخوانی کنید.

###  دریافت پروفایل فروشنده

```
GET /open-api/v1/profile?mini=true
Host: seller.digikala.com
Authorization: Bearer <access_token>

```

###  پاسخ نمونه

```
{
  "seller_id": 12345,
  "seller_name": "فروشگاه نمونه",
  "secondary_business_name": "شرکت نمونه",
  "seller_rating": 4.5,
  "wallet_credit": 50000,
  "new_notifications": 3,
  "new_questions": 2,
  "is_private": true,
  "registration_status": "active",
  "first_name": "علی",
  "last_name": "محمدی",
  "email": "seller@example.com",
  "phone": "09121234567",
  "state": "تهران",
  "city": "تهران"
}

```

- Java
- PHP
- Python
- NodeJS
- C#

```
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

var http    = HttpClient.newHttpClient();
var request = HttpRequest.newBuilder()
    .uri(URI.create("https://seller.digikala.com/open-api/v1/profile?mini=true"))
    .header("Authorization", "Bearer " + accessToken)
    .GET()
    .build();
var response = http.sendAsync(request, HttpResponse.BodyHandlers.ofString()).join();
System.out.println(response.body());

```

```
<?php

$ch = curl_init('https://seller.digikala.com/open-api/v1/profile?mini=true');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);
echo $data['seller_name'];

```

```
import requests

response = requests.get(
    'https://seller.digikala.com/open-api/v1/profile',
    params={'mini': 'true'},
    headers={'Authorization': 'Bearer ' + access_token},
)
response.raise_for_status()
print(response.json()['seller_name'])

```

```
const https = require('https');

function getProfile(accessToken) {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'seller.digikala.com',
            path:     '/open-api/v1/profile?mini=true',
            headers:  { Authorization: 'Bearer ' + accessToken },
        }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

const profile = await getProfile(accessToken);
process.stdout.write(profile.seller_name + '\n');

```

```
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", accessToken);
var resp = await client.GetAsync(
    "https://seller.digikala.com/open-api/v1/profile?mini=true"
);
var data = JsonSerializer.Deserialize<JsonElement>(
    await resp.Content.ReadAsStringAsync()
);
Console.WriteLine(data.GetProperty("seller_name").GetString());

```

---

##  🔤 هدر الزامی: User-Agent

علاوه بر هدر `Authorization`، تمام درخواست‌هایی که به Open API سرویس‌هاب ارسال می‌کنید باید هدر `User-Agent` را هم با فرمت مشخص زیر داشته باشند؛ در غیر این صورت درخواست شما رد می‌شود.

**برای سرویس دهنده ها:**

```
User-Agent: DigikalaTrustedBot/{service_name}

```

`{service_name}` را با نام انگلیسی اپلیکیشن/سرویس خودتان جایگزین کنید (بدون فاصله). برای مثال، اگر نام سرویس شما «MyAwesomeApp» باشد:

```
User-Agent: DigikalaTrustedBot/MyAwesomeApp

```

**برای توکن های شخصی:**

```
User-Agent: DigikalaTrustedBot/SelfToken/{seller_id}

```

`{seller_id}` را با نام کد فروشندگی خودتان جایگزین کنید. برای مثال، اگر کد فروشندگی شما «12345» باشد:

```
User-Agent: DigikalaTrustedBot/SelfToken/12345

```

مثال کامل درخواست:

```
GET /open-api/v1/profile?mini=true
Host: seller.digikala.com
Authorization: Bearer <access_token>
User-Agent: DigikalaTrustedBot/SelfToken/12345

```

⚠️ **خطاهای رایج که باعث رد شدن درخواست می‌شوند:**

- عدم ارسال هدر `User-Agent` (خیلی از کتابخانه‌های HTTP این هدر را با مقدار پیش‌فرض خودشان می‌فرستند، مثل `curl/8.x` یا `PostmanRuntime/7.x`، که مورد قبول نیست)
- ننوشتن پیشوند `DigikalaTrustedBot/`
- استفاده از `/` اشتباه یا فاصله‌ی اضافه بین `DigikalaTrustedBot` و نام سرویس
- نوشتن نام سرویس به فارسی یا با کاراکترهای غیرمجاز

اگر هدر `User-Agent` ارسال نشود یا با این فرمت مطابقت نداشته باشد، سرور با خطای زیر پاسخ می‌دهد:

```
HTTP/1.1 401 Unauthorized

```

```
{
    "status": "error",
    "message": "user-agent is invalid",
    "code": 401
}

```

##  🔁 تمدید توکن

`access_token` پس از ۲ ساعت منقضی می‌شود. از `refresh_token` برای دریافت توکن جدید بدون نیاز به ریدایرکت مجدد فروشنده استفاده کنید:

```
POST /open-api/v1/auth/refresh-token
Host: seller.digikala.com
Content-Type: application/json

{
  "access_token":  "<expired-or-valid-access-token>",
  "refresh_token": "<refresh-token>"
}

```

>

پس از هر refresh، **هر دو توکن** به‌روز می‌شوند. توکن‌های قدیمی را دور بیندازید.

برای پیاده‌سازی TokenManager (refresh خودکار پیش از انقضا) در تمام زبان‌ها به [راهنمای احراز هویت — بخش Refresh](/fa/راهنمای-یکپارچه-سازی) مراجعه کنید.

---

##  ⚠️ مدیریت خطاها

| کد HTTP | معنی | راه‌حل |
|---|---|---|
| `401` | توکن منقضی یا نامعتبر | `refresh_token` را فراخوانی کنید |
| `403` | دسترسی کافی ندارید | اسکوپ‌های لازم را بررسی و در صورت نیاز مجدداً consent بگیرید |
| `404` | منبع یافت نشد | شناسه endpoint یا resource را بررسی کنید |
| `422` | داده ارسالی نامعتبر | پیام خطا و مستندات endpoint مربوطه را بررسی کنید |
| `429` | محدودیت نرخ درخواست | با exponential backoff مجدداً تلاش کنید — [مستندات Rate Limiting](/fa/rate-limits) |
| `500` | خطای داخلی سرور | مجدداً تلاش کنید؛ اگر ادامه داشت با پشتیبانی تماس بگیرید |

---

##  🔗 لینک‌های مرتبط

| منبع | توضیح |
|---|---|
| [راهنمای احراز هویت](/fa/راهنمای-یکپارچه-سازی) | مرجع کامل: تولید کلید RSA، scope‌ها، رمزگشایی، توکن، لغو دسترسی، نمونه کد ۵ زبان |
| [محدودیت نرخ درخواست](/fa/rate-limits) | جزئیات Rate Limiting چندلایه و بهترین شیوه‌ها |
| [Marketplace-API@digikala.com](mailto:Marketplace-API@digikala.com) | ایمیل پشتیبانی فنی تیم API |

---

>

این راهنما شما را تا اولین درخواست موفق API همراهی می‌کند. برای جزئیات فنی هر مرحله به [راهنمای احراز هویت](/fa/راهنمای-یکپارچه-سازی) مراجعه کنید.
