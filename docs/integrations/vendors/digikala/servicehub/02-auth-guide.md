# راهنمای احراز هویت فروشنده (OAuth 2.0)

> منبع: https://servicehub.digikala.services/fa/راهنمای-یکپارچه-سازی  
> دریافت: ۱۴۰۵/۰۸/۰۷ — آکادمی سرویس‌هاب دیجی‌کالا (فقط از IP ایران باز می‌شود)

#  راهنمای یکپارچه‌سازی با زیرساخت سرویس‌هاب

>

**مخاطب:** توسعه‌دهندگانی که می‌خواهند اپلیکیشن خود را از طریق Open API با پلتفرم دیجی‌کالا یکپارچه کنند.

---

##  فهرست مطالب

1. مقدمه
2. پیش‌نیازها
3. ایجاد کلیدهای RSA
4. ثبت‌نام اپلیکیشن
5. Scope‌های موجود
6. جریان کامل Authorization
7. دریافت رضایت از فروشنده (Consent)
8. رمزگشایی Authorization Code
9. تبادل Authorization Code با Token
10. استفاده از Access Token
11. Refresh کردن Token
12. تمدید اعتبار Token
13. لغو دسترسی
14. نمونه‌های کد کامل
15. جدول خلاصه

---

##  📖 مقدمه

زیرساخت **سرویس‌هاب** یک پروتکل احراز هویت مبتنی بر OAuth 2.0 است که به اپلیکیشن‌های third-party امکان می‌دهد با دریافت مجوز صریح از فروشنده، به داده‌ها و عملیات پنل فروشندگی دسترسی پیدا کنند.

###  مفاهیم کلیدی

| مفهوم | توضیح |
|---|---|
| **Client** | اپلیکیشن شما که می‌خواهد به API دسترسی داشته باشد |
| **Seller** | فروشنده‌ای که مجوز دسترسی می‌دهد |
| **Scope** | دسته‌ای از دسترسی‌ها که Client درخواست می‌کند |
| **Authorization Code** | کد موقتی که پس از تأیید فروشنده صادر می‌شود |
| **Access Token** | JWT با اعتبار ۲ ساعته برای فراخوانی API |
| **Refresh Token** | توکن با اعتبار ۱ ساله برای تجدید Access Token |

###  نمودار جریان کلی

```
اپلیکیشن شما          پلتفرم دیجی‌کالا          فروشنده
      │                        │                    │
      │── redirect to consent ─▶│                    │
      │                        │── نمایش صفحه ─────▶│
      │                        │◀── تأیید/رد ────────│
      │◀── authorization_code ─│                    │
      │── POST /auth/token ───▶│                    │
      │◀── access_token ───────│                    │
      │── API calls ──────────▶│                    │

```

---

##  ⚙️ پیش‌نیازها

1. **کلید RSA**: یک جفت کلید RSA **۴۰۹۶ بیتی** (private + public key). Public key باید در فرمت **PKCS#8** باشد (`-----BEGIN PUBLIC KEY-----`)
2. **ثبت‌نام**: Client شما باید توسط تیم دیجی‌کالا تأیید شده باشد و `client_code` داشته باشد
3. **HTTPS**: تمام endpointها باید از طریق HTTPS فراخوانی شوند
4. **Redirect URL**: یک URL معتبر از دامنه ثبت‌شده اپلیکیشن شما

---

##  🔑 ایجاد کلیدهای RSA

پلتفرم authorization code را با **public key** شما رمزگذاری می‌کند. شما باید با **private key** آن را رمزگشایی کنید. Public key هنگام ثبت‌نام اپلیکیشن ارائه می‌شود.

>

⚠️ **هشدار:** Private key را هرگز به اشتراک نگذارید، در کد منبع commit نکنید، و در محیط امن نگهداری کنید.

---

- Linux و macOS
- Windows

```
# ایجاد Private Key (4096-bit)
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:4096

# استخراج Public Key در فرمت PKCS#8 از Private Key
openssl rsa -pubout -in private_key.pem -out public_key.pem

# تأیید کلیدها
openssl rsa -in private_key.pem -check

# مشاهده محتوای Public Key (برای ثبت‌نام)
cat public_key.pem

```

---

**macOS (با Homebrew OpenSSL):**

macOS به صورت پیش‌فرض با OpenSSL یا LibreSSL عرضه می‌شود. دستورات یکسان با Linux هستند:

```
# بررسی نسخه OpenSSL نصب‌شده
openssl version

# اگر می‌خواهید OpenSSL رسمی را از Homebrew نصب کنید:
brew install openssl@3
export PATH="/opt/homebrew/opt/openssl@3/bin:$PATH"

# ایجاد Private Key (4096-bit)
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:4096

# استخراج Public Key در فرمت PKCS#8
openssl rsa -pubout -in private_key.pem -out public_key.pem

```

---

#####  روش اول: دستور داخلی ویندوز

```
# با استفاده از .NET built-in (PowerShell 5.1+)
$rsa = [System.Security.Cryptography.RSA]::Create(4096)

# ذخیره Private Key در فرمت PEM
$privateKeyBytes = $rsa.ExportRSAPrivateKey()
$privateKeyBase64 = [Convert]::ToBase64String($privateKeyBytes)
$privateKeyPem = "-----BEGIN RSA PRIVATE KEY-----`n"
$privateKeyPem += ($privateKeyBase64 -replace '(.{64})', '$1`n')
$privateKeyPem += "`n-----END RSA PRIVATE KEY-----"
Set-Content -Path "private_key.pem" -Value $privateKeyPem

# ذخیره Public Key در فرمت PKCS#8 (SubjectPublicKeyInfo)
$publicKeyBytes = $rsa.ExportSubjectPublicKeyInfo()
$publicKeyBase64 = [Convert]::ToBase64String($publicKeyBytes)
$publicKeyPem = "-----BEGIN PUBLIC KEY-----`n"
$publicKeyPem += ($publicKeyBase64 -replace '(.{64})', '$1`n')
$publicKeyPem += "`n-----END PUBLIC KEY-----"
Set-Content -Path "public_key.pem" -Value $publicKeyPem

Write-Host "کلیدها با موفقیت ایجاد شدند."

```

#####  روش دوم: OpenSSL for Windows

ابتدا OpenSSL را از [slproweb.com/products/Win32OpenSSL.html](https://slproweb.com/products/Win32OpenSSL.html) دانلود و نصب کنید، سپس در Command Prompt:

```
:: ایجاد Private Key (4096-bit)
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:4096

:: استخراج Public Key در فرمت PKCS#8
openssl rsa -pubout -in private_key.pem -out public_key.pem

```

#####  روش سوم: Git Bash (Windows)

اگر Git for Windows نصب دارید، Git Bash همراه OpenSSL عرضه می‌شود. دستورات Linux را عیناً استفاده کنید.

---

###  فرمت مورد انتظار

Public key باید در فرمت **PKCS#8** (به نام SubjectPublicKeyInfo) و رمزگذاری **PEM** باشد. این فرمت با خط `-----BEGIN PUBLIC KEY-----` شروع می‌شود:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a2rwplBQLzHPZe5TNJF
[... بقیه کلید ...]
-----END PUBLIC KEY-----

```

>

⚠️ فقط کلیدهای عمومی با فرمت **PKCS#8** (SubjectPublicKeyInfo) پذیرفته می‌شوند. دستور genpkey و rsa -pubout این فرمت را تولید می‌کند.

---

##  📝 ثبت‌نام اپلیکیشن

اپلیکیشن شما باید توسط تیم دیجی‌کالا در سیستم ثبت و تأیید شود. اطلاعات مورد نیاز:

| فیلد | توضیح | الزامی |
|---|---|---|
| `client_name` | نام اپلیکیشن | ✅ |
| `description` | توضیح کوتاه از عملکرد اپلیکیشن | ✅ |
| ho​st | دامنه اصلی اپلیکیشن شما | ✅ |
| `redirect_url` | URL بازگشت پس از تأیید فروشنده | ✅ |
| `public_key` | محتوای فایل `public_key.pem` | ✅ |
| `required_scopes` | لیست scope‌هایی که اپلیکیشن شما نیاز دارد | ✅ |
| `owner_email` | ایمیل مالک/توسعه‌دهنده | ✅ |
| `term_condition_url` | لینک صفحه قوانین و شرایط | اختیاری |
| `webhook_url` | URL برای دریافت event‌های webhook | اختیاری |

پس از تأیید، یک **`client_code`** یکتا دریافت می‌کنید که در تمام درخواست‌ها استفاده می‌شود.

---

##  🗂️ Scope‌های موجود

Scope مشخص می‌کند که اپلیکیشن شما به کدام بخش از داده‌های فروشنده دسترسی دارد.

###  دریافت لیست Scope‌ها

```
GET /open-api/v1/auth/scopes

```

برای دیدن scope‌های مجاز برای اپلیکیشن شما:

```
GET /open-api/v1/auth/scopes/{client_code}

```

###  لیست Scope‌های موجود

| Scope Key | عنوان | سطح دسترسی |
|---|---|---|
| `product` | مدیریت محصول‌ها | read / write |
| `variant` | مدیریت تنوع و قیمت‌گذاری | read / write |
| `inventory` | موجودی کالا | read / write |
| `order` | مدیریت سفارشات جاری | read / write |
| `package` | مدیریت محموله‌ها | read / write |
| `shipment` | مدیریت مرسوله‌ها | read / write |
| `promotion` | پروموشن‌ها | read / write |
| `voucher` | کدهای تخفیف | read / write |
| `profile` | پروفایل فروشنده | read / write |
| `question` | پرسش‌های کاربران | read / write |
| `insight` | تحلیل عملکرد (فروش و درآمد) | read |
| `growth_coach` | تحلیل عملکرد (مرجوعی) | read |
| `lightening_deal` | مزایده شگفت‌انگیز | read / write |
| `sbs_setting` | تنظیمات ارسال توسط فروشنده | read / write |
| `sbs_orders` | سفارشات ارسال توسط فروشنده | read / write |
| `sbs_shipment` | مرسوله‌های ارسال توسط فروشنده | read / write |
| `commission` | کمیسیون‌ها | read |
| `invoice` | صورتحساب‌ها | read |
| `search_ads` | تبلیغات جستجو محور | read / write |

###  فرمت Scope

برای درخواست دسترسی فقط‌خواندنی، پسوند `.read` اضافه کنید:

```
product          → دسترسی کامل (خواندن + نوشتن)
product.read     → فقط خواندن
order.read       → فقط خواندن سفارشات

```

چند scope را با فاصله (space) جدا کنید:

```
variant order.read profile

```

---

##  🔄 جریان کامل Authorization

###  مرحله ۱ — هدایت فروشنده به صفحه Consent

یک URL با پارامترهای زیر بسازید و فروشنده را به آن redirect کنید:

```
GET /pwa/seller-services/consents
    ?client_code={client_code}
    &redirect_url={your_redirect_url}
    &scopes={space_separated_scopes}
    &state={random_state_string}

```

| پارامتر | نوع | توضیح |
|---|---|---|
| `client_code` | string | کد یکتای اپلیکیشن شما |
| `redirect_url` | string | URL بازگشت (باید با دامنه ثبت‌شده مطابقت داشته باشد) |
| `scopes` | string | scope‌های مورد نیاز، با فاصله جدا شده |
| `state` | string | یک رشته تصادفی برای جلوگیری از CSRF |

**مثال:**

```
https://seller.digikala.com/pwa/seller-services/consents
    ?client_code=my-awesome-app
    &redirect_url=https%3A%2F%2Fmyapp.ir%2Fcallback
    &scopes=variant%20order.read%20profile
    &state=xK9mP3qR7nT2

```

>

**نکته امنیتی:** مقدار `state` را به صورت تصادفی تولید کنید و در session ذخیره کنید تا هنگام بازگشت با مقدار دریافتی مقایسه کنید (CSRF protection).

---

###  مرحله ۲ — فروشنده مجوز می‌دهد

پلتفرم یک صفحه Consent به فروشنده نمایش می‌دهد که:

- نام و لوگوی اپلیکیشن شما
- لیست scope‌های درخواستی با توضیح فارسی
- دکمه‌های **تأیید** و **رد**

را نشان می‌دهد.

---

###  مرحله ۳ — دریافت Authorization Code

پس از تأیید، فروشنده به redirect_url شما هدایت می‌شود:

```
https://myapp.ir/callback
    ?authorization_code={ENCRYPTED_CODE}
    &state=xK9mP3qR7nT2

```

در صورت رد شدن:

```
https://myapp.ir/callback
    ?error=access_denied
    &state=xK9mP3qR7nT2

```

>

⏰ **مهم:** این authorization_code فقط **۵ دقیقه** اعتبار دارد.

---

##  🔓 رمزگشایی Authorization Code

`authorization_code` دریافتی با RSA public key شما رمزگذاری شده است. برای استفاده از آن باید با private key رمزگشایی کنید.

###  مراحل رمزگشایی

```
1. URL-decode کردن authorization_code
2. Base64-decode کردن
3. RSA decrypt با private key
4. نتیجه = authorization_code نهایی

```

**مثال (PHP):**

```
$encryptedCode = urldecode($_GET['authorization_code']);
$decoded = base64_decode($encryptedCode);
openssl_private_decrypt($decoded, $authorizationCode, $privateKey);
// حالا $authorizationCode آماده ارسال به /auth/token است

```

>

**نکته:** کد رمزگشایی‌شده را ذخیره نکنید؛ بلافاصله با آن توکن بگیرید.

---

##  🎫 تبادل Authorization Code با Token

###  درخواست

```
POST /open-api/v1/auth/token
Content-Type: application/json

{
    "authorization_code": "{decrypted_authorization_code}"
}

```

###  پاسخ موفق (HTTP 200)

```
{
    "access_token": "<jwt-access-token>",
    "refresh_token": "WQ098gF5PG3salmqewqvfbgxzzgTgAmWvkrQaWkgnpiqky1KAoqnxunQBz09Xc5UI",
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

| فیلد | توضیح | اعتبار |
|---|---|---|
| `access_token` | JWT برای فراخوانی API | **۲ ساعت** |
| `refresh_token` | برای تجدید access_token | **۱ سال** |

---

##  🚀 استفاده از Access Token

`access_token` را در header تمام درخواست‌های API به صورت زیر ارسال کنید:

```
GET /open-api/v1/<endpoint>
Authorization: Bearer <access_token>

```

---

##  ♻️ Refresh کردن Token

وقتی `access_token` منقضی شد (بعد از ۲ ساعت)، از `refresh_token` برای گرفتن access_token جدید استفاده کنید، **بدون نیاز به اخذ مجوز مجدد از فروشنده.**

###  درخواست

```
POST /open-api/v1/auth/refresh-token
Content-Type: application/json

{
    "access_token": "{expired_or_valid_access_token}",
    "refresh_token": "{refresh_token}"
}

```

###  پاسخ موفق (HTTP 200)

```
{
    "access_token": "<jwt-access-token>",
    "refresh_token": "<new-refresh-token>",
    "access_token_expires_at": { ... },
    "refresh_token_expires_at": { ... }
}

```

>

**نکته:** پس از هر refresh، **هر دو توکن** به‌روز می‌شوند. توکن‌های قدیمی را دور بیندازید.

>

⚠️ **Rate Limit:** این endpoint حداکثر **۶۰۰ درخواست در ساعت** را می‌پذیرد.

---

##  🔁 تمدید اعتبار Token

این endpoint توسط **فروشنده** (نه Client) فراخوانی می‌شود تا اعتبار توکن را یک سال دیگر تمدید کند.

- تمدید فقط زمانی امکان‌پذیر است که توکن فعلی کمتر از **۳ ماه** اعتبار داشته باشد
- پس از تمدید، یک توکن جدید با اعتبار **۱ سال** ایجاد می‌شود
- هنگام refresh بعدی توسط Client، به‌طور خودکار توکن تمدیدشده فعال می‌شود

###  درخواست (از طرف فروشنده)

```
PATCH /pwa/seller-services/clients/{clientId}/extend-access
Authorization: Bearer {seller_access_token}

```

###  پاسخ موفق (HTTP 200)

```
{
    "message": "مدت دسترسی ۱ سال افزایش یافت"
}

```

---

##  🚫 لغو دسترسی

###  لغو توسط Client

اگر اپلیکیشن شما می‌خواهد دسترسی خود را لغو کند:

```
POST /open-api/v1/auth/revoke
Authorization: Bearer {access_token}

```

###  پاسخ موفق (HTTP 200)

```
{
    "message": "token revoked successfully"
}

```

---

###  لغو توسط Seller

فروشنده می‌تواند از طریق پنل خود دسترسی اپلیکیشن را قطع کند:

```
PATCH /pwa/seller-services/clients/{clientId}/revoke-access
Authorization: Bearer {seller_access_token}

```

پس از لغو، برای دسترسی مجدد باید دوباره جریان Consent را از ابتدا طی کنید.

---

- Java
- Python
- NodeJS
- C#

```
import javax.crypto.Cipher;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.HexFormat;

public class SellerServiceClient {

    private final String     clientCode;
    private final PrivateKey privateKey;
    private final String     baseUrl;
    private final String     sellerPanelUrl = "https://seller.digikala.com";
    private final HttpClient http           = HttpClient.newHttpClient();

    public SellerServiceClient(String clientCode, String privateKeyPem, String baseUrl) throws Exception {
        this.clientCode = clientCode;
        this.baseUrl    = baseUrl.replaceAll("/$", "");
        this.privateKey = loadPrivateKey(privateKeyPem);
    }

    /** مرحله ۱: ساخت URL Consent */
    public String buildConsentUrl(String redirectUrl, String scopes, String state) {
        return sellerPanelUrl + "/pwa/seller-services/consents"
            + "?client_code="  + encode(clientCode)
            + "&redirect_url=" + encode(redirectUrl)
            + "&scopes="       + encode(scopes)
            + "&state="        + encode(state);
    }

    /** مرحله ۲: رمزگشایی authorization_code با private key */
    public String decryptAuthorizationCode(String encryptedCode) throws Exception {
        byte[]  decoded   = Base64.getDecoder().decode(URLDecoder.decode(encryptedCode, StandardCharsets.UTF_8));
        Cipher  cipher    = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        return new String(cipher.doFinal(decoded), StandardCharsets.UTF_8);
    }

    /** مرحله ۳: تبادل authorization_code با توکن‌ها */
    public String exchangeCodeForTokens(String authorizationCode) throws Exception {
        String body = String.format("{\"authorization_code\":\"%s\"}", authorizationCode);
        return post("/open-api/v1/auth/token", body, null);
    }

    /** Refresh کردن access_token منقضی‌شده */
    public String refreshToken(String accessToken, String refreshToken) throws Exception {
        String body = String.format(
            "{\"access_token\":\"%s\",\"refresh_token\":\"%s\"}",
            accessToken, refreshToken
        );
        return post("/open-api/v1/auth/refresh-token", body, null);
    }

    /** لغو دسترسی توسط Client */
    public String revokeToken(String accessToken) throws Exception {
        return post("/open-api/v1/auth/revoke", "{}", accessToken);
    }

    private String post(String path, String body, String bearerToken) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));

        if (bearerToken != null && !bearerToken.isBlank()) {
            builder.header("Authorization", "Bearer " + bearerToken);
        }

        var response = http.sendAsync(
            builder.build(),
            HttpResponse.BodyHandlers.ofString()
        ).join();

        if (response.statusCode() != 200) {
            throw new RuntimeException("API error " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    private PrivateKey loadPrivateKey(String pem) throws Exception {
        String stripped = pem
            .replace("-----BEGIN RSA PRIVATE KEY-----", "")
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END RSA PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(stripped);
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
    }

    private String encode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    // --- نمونه استفاده ---

    public static void main(String[] args) throws Exception {
        String privateKeyPem = Files.readString(Paths.get("/path/to/private_key.pem"));

        SellerServiceClient client = new SellerServiceClient(
            "my-awesome-app",
            privateKeyPem,
            "https://seller.digikala.com"
        );

        // گام ۱: هدایت فروشنده
        byte[] stateBytes = new byte[16];
        new java.security.SecureRandom().nextBytes(stateBytes);
        String state      = HexFormat.of().formatHex(stateBytes);
        String consentUrl = client.buildConsentUrl(
            "https://myapp.ir/callback",
            "variant order.read profile",
            state
        );
        System.out.println("URL Consent: " + consentUrl);

        // گام ۲: رمزگشایی (مقدار از callback query string می‌آید)
        String encryptedCode = "<authorization_code_from_query>";
        String decryptedCode = client.decryptAuthorizationCode(encryptedCode);

        // گام ۳: دریافت توکن‌ها
        String tokensJson  = client.exchangeCodeForTokens(decryptedCode);
        System.out.println("Tokens: " + tokensJson);

        // گام ۴: Refresh token (access_token و refresh_token را از JSON بخوانید)
        // String newTokensJson = client.refreshToken(accessToken, refreshToken);
    }
}

```

>

**نکته Java:** اگر private key شما با `-----BEGIN RSA PRIVATE KEY-----` شروع می‌شود (فرمت PKCS#1)، ابتدا آن را به PKCS#8 تبدیل کنید:

```
> openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private_key.pem -out private_key_pkcs8.pem
> ```

</div>

---

### PHP

<div dir="ltr">

```php
<?php

class SellerServiceClient
{
    private string $clientCode;
    private string $privateKeyPath;
    private string $baseUrl;

    public function __construct(string $clientCode, string $privateKeyPath, string $baseUrl)
    {
        $this->clientCode   = $clientCode;
        $this->privateKeyPath = $privateKeyPath;
        $this->baseUrl      = rtrim($baseUrl, '/');
    }

    /**
     * مرحله ۱: ساخت URL برای هدایت فروشنده به صفحه Consent
     */
    public function buildConsentUrl(string $redirectUrl, string $scopes, string $state): string
    {
        $sellerPanelUrl = 'https://seller.digikala.com';
        return $sellerPanelUrl . '/pwa/seller-services/consents?' . http_build_query([
            'client_code'  => $this->clientCode,
            'redirect_url' => $redirectUrl,
            'scopes'       => $scopes,
            'state'        => $state,
        ]);
    }

    /**
     * مرحله ۲: رمزگشایی authorization_code با private key
     */
    public function decryptAuthorizationCode(string $encryptedCode): string
    {
        $privateKey = openssl_pkey_get_private(file_get_contents($this->privateKeyPath));
        if (!$privateKey) {
            throw new RuntimeException('Private key is invalid.');
        }

        $decoded = base64_decode(urldecode($encryptedCode));
        $success = openssl_private_decrypt($decoded, $decryptedCode, $privateKey);
        if (!$success) {
            throw new RuntimeException('Failed to decrypt authorization code.');
        }

        return $decryptedCode;
    }

    /**
     * مرحله ۳: تبادل authorization_code با access_token و refresh_token
     */
    public function exchangeCodeForTokens(string $authorizationCode): array
    {
        return $this->post('/open-api/v1/auth/token', [
            'authorization_code' => $authorizationCode,
        ]);
    }

    /**
     * Refresh کردن access_token منقضی‌شده
     */
    public function refreshToken(string $accessToken, string $refreshToken): array
    {
        return $this->post('/open-api/v1/auth/refresh-token', [
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
        ]);
    }

    /**
     * لغو دسترسی توسط Client
     */
    public function revokeToken(string $accessToken): array
    {
        return $this->post('/open-api/v1/auth/revoke', [], $accessToken);
    }

    private function post(string $path, array $body, string $bearerToken = ''): array
    {
        $headers = ['Content-Type: application/json'];
        if ($bearerToken) {
            $headers[] = 'Authorization: Bearer ' . $bearerToken;
        }

        $ch = curl_init($this->baseUrl . $path);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            throw new RuntimeException('API error ' . $status . ': ' . $response);
        }

        return json_decode($response, true);
    }
}

// --- نمونه استفاده ---

$client = new SellerServiceClient(
    clientCode:     'my-awesome-app',
    privateKeyPath: '/path/to/private_key.pem',
    baseUrl:        'https://seller.digikala.com'
);

// گام ۱: هدایت فروشنده به صفحه Consent
$state      = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;
$consentUrl = $client->buildConsentUrl(
    redirectUrl: 'https://myapp.ir/callback',
    scopes:      'variant order.read profile',
    state:       $state
);
header('Location: ' . $consentUrl);
exit;

// گام ۲: callback handler
$receivedState = $_GET['state'] ?? '';
if ($receivedState !== $_SESSION['oauth_state']) {
    throw new RuntimeException('Invalid state — possible CSRF attack.');
}

$decryptedCode = $client->decryptAuthorizationCode($_GET['authorization_code']);
$tokens        = $client->exchangeCodeForTokens($decryptedCode);

$accessToken  = $tokens['access_token'];
$refreshToken = $tokens['refresh_token'];

// گام ۳: فراخوانی API
$ch = curl_init('https://seller.digikala.com/open-api/v1/profile?mini=true');
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
    CURLOPT_RETURNTRANSFER => true,
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);

// گام ۴: Refresh token
$newTokens    = $client->refreshToken($accessToken, $refreshToken);
$accessToken  = $newTokens['access_token'];
$refreshToken = $newTokens['refresh_token'];

// گام ۵: لغو دسترسی
$client->revokeToken($accessToken);

```

---

```
import base64
import secrets
import requests
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

class SellerServiceClient:
    def __init__(self, client_code: str, private_key_path: str, base_url: str):
        self.client_code = client_code
        self.base_url = base_url.rstrip('/')

        key_bytes = pathlib.Path(private_key_path).read_bytes()
        pem_loader = getattr(serialization, 'load_pem_private_key')
        self.private_key = pem_loader(key_bytes, password=None)

    def build_consent_url(self, redirect_url: str, scopes: str, state: str) -> str:
        """مرحله ۱: ساخت URL Consent برای هدایت فروشنده"""
        from urllib.parse import urlencode
        seller_panel_url = 'https://seller.digikala.com'
        params = urlencode({
            'client_code':  self.client_code,
            'redirect_url': redirect_url,
            'scopes':       scopes,
            'state':        state,
        })
        return f"{seller_panel_url}/pwa/seller-services/consents?{params}"

    def decrypt_authorization_code(self, encrypted_code: str) -> str:
        """مرحله ۲: رمزگشایی authorization_code با private key"""
        from urllib.parse import unquote
        decoded = base64.b64decode(unquote(encrypted_code))
        decrypted = self.private_key.decrypt(
            decoded,
            padding.PKCS1v15()
        )
        return decrypted.decode('utf-8')

    def exchange_code_for_tokens(self, authorization_code: str) -> dict:
        """مرحله ۳: دریافت access_token و refresh_token"""
        return self._post('/open-api/v1/auth/token', {
            'authorization_code': authorization_code,
        })

    def refresh_token(self, access_token: str, refresh_token: str) -> dict:
        """Refresh کردن access_token منقضی‌شده"""
        return self._post('/open-api/v1/auth/refresh-token', {
            'access_token':  access_token,
            'refresh_token': refresh_token,
        })

    def revoke_token(self, access_token: str) -> dict:
        """لغو دسترسی توسط Client"""
        return self._post('/open-api/v1/auth/revoke', {}, bearer_token=access_token)

    def _post(self, path: str, body: dict, bearer_token: str = '') -> dict:
        headers = {'Content-Type': 'application/json'}
        if bearer_token:
            headers['Authorization'] = 'Bearer ' + bearer_token

        resp = requests.post(self.base_url + path, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()

# --- نمونه استفاده ---

client = SellerServiceClient(
    client_code='my-awesome-app',
    private_key_path='/path/to/private_key.pem',
    base_url='https://seller.digikala.com'
)

# گام ۱: ذخیره state و هدایت فروشنده
state = secrets.token_hex(16)
# state را در session ذخیره کنید
consent_url = client.build_consent_url(
    redirect_url='https://myapp.ir/callback',
    scopes='variant order.read profile',
    state=state
)
print(f"فروشنده را به این آدرس هدایت کنید:\n{consent_url}")

# گام ۲: callback — بررسی state و رمزگشایی
# assert request.args['state'] == session['oauth_state']
decrypted_code = client.decrypt_authorization_code(
    encrypted_code='<authorization_code_from_query>'
)

# گام ۳: دریافت توکن‌ها
tokens = client.exchange_code_for_tokens(decrypted_code)
access_token  = tokens['access_token']
refresh_token_str = tokens['refresh_token']

# گام ۴: فراخوانی API
resp = requests.get(
    'https://seller.digikala.com/open-api/v1/profile?mini=true',
    headers={'Authorization': 'Bearer ' + access_token}
)
data = resp.json()

# گام ۵: Refresh token
new_tokens   = client.refresh_token(access_token, refresh_token_str)
access_token = new_tokens['access_token']
refresh_token_str = new_tokens['refresh_token']

```

**نصب وابستگی:**

```
pip install requests cryptography

```

---

```
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');
const { URL } = require('url');

class SellerServiceClient {
    constructor(clientCode, privateKeyPem, baseUrl) {
        this.clientCode  = clientCode;
        this.privateKey  = privateKeyPem;
        this.baseUrl     = baseUrl.replace(/\/$/, '');
    }

    /** مرحله ۱: ساخت URL Consent */
    buildConsentUrl(redirectUrl, scopes, state) {
        const sellerPanelUrl = 'https://seller.digikala.com';
        const params = new URLSearchParams({
            client_code:  this.clientCode,
            redirect_url: redirectUrl,
            scopes,
            state,
        });
        return sellerPanelUrl + '/pwa/seller-services/consents?' + params;
    }

    /** مرحله ۲: رمزگشایی authorization_code با private key */
    decryptAuthorizationCode(encryptedCode) {
        const decoded   = Buffer.from(decodeURIComponent(encryptedCode), 'base64');
        const decrypted = crypto.privateDecrypt(
            { key: this.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
            decoded
        );
        return new TextDecoder().decode(decrypted);
    }

    /** مرحله ۳: تبادل authorization_code با توکن‌ها */
    exchangeCodeForTokens(authorizationCode) {
        return this.post('/open-api/v1/auth/token', { authorization_code: authorizationCode });
    }

    /** Refresh کردن access_token منقضی‌شده */
    refreshToken(accessToken, refreshToken) {
        return this.post('/open-api/v1/auth/refresh-token', {
            access_token:  accessToken,
            refresh_token: refreshToken,
        });
    }

    /** لغو دسترسی توسط Client */
    revokeToken(accessToken) {
        return this.post('/open-api/v1/auth/revoke', {}, accessToken);
    }

    post(path, body, bearerToken = '') {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify(body);
            const url     = new URL(this.baseUrl + path);
            const options = {
                hostname: url.hostname,
                port:     url.port || 443,
                path:     url.pathname + url.search,
                method:   'POST',
                headers:  {
                    'Content-Type':   'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    ...(bearerToken ? { Authorization: 'Bearer ' + bearerToken } : {}),
                },
            };

            const lib = url.protocol === 'https:' ? https : http;
            const req = lib.request(options, (res) => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error('API error ' + res.statusCode + ': ' + data));
                    }
                    resolve(JSON.parse(data));
                });
            });

            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }
}

// --- نمونه استفاده ---

const fs = require('fs');

const client = new SellerServiceClient(
    'my-awesome-app',
    fs.readFileSync('/path/to/private_key.pem', 'utf8'),
    'https://seller.digikala.com'
);

async function main() {
    // گام ۱: هدایت فروشنده
    const rb    = crypto['randomBytes'](16);
    const toHex = n => '0123456789abcdef'.charAt(Math.floor(n));
    const state = Array.from(rb, b => toHex(Math.floor(b / 16)) + toHex(b % 16)).join('');
    const consentUrl = client.buildConsentUrl(
        'https://myapp.ir/callback',
        'variant order.read profile',
        state
    );
    process.stdout.write('URL Consent: ' + consentUrl + '\n');

    // گام ۲: callback (مقدار از query string دریافت می‌شود)
    const encryptedCode  = '<authorization_code_from_query>';
    const decryptedCode  = client.decryptAuthorizationCode(encryptedCode);

    // گام ۳: دریافت توکن‌ها
    const tokens         = await client.exchangeCodeForTokens(decryptedCode);
    let   accessToken    = tokens.access_token;
    let   refreshToken   = tokens.refresh_token;

    // گام ۴: Refresh token
    const newTokens = await client.refreshToken(accessToken, refreshToken);
    accessToken  = newTokens.access_token;
    refreshToken = newTokens.refresh_token;

    // گام ۵: لغو دسترسی
    await client.revokeToken(accessToken);
}

main().catch(err => { process.stderr.write(String(err) + '\n'); });

```

---

```
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using System.Web;

public class TokenResponse
{
    [JsonPropertyName("access_token")]  public string AccessToken  { get; set; }
    [JsonPropertyName("refresh_token")] public string RefreshToken { get; set; }
}

public class SellerServiceClient : IDisposable
{
    private readonly string     _clientCode;
    private readonly RSA        _privateKey;
    private readonly HttpClient _http;
    private readonly string     _sellerPanelUrl = "https://seller.digikala.com";

    public SellerServiceClient(string clientCode, string privateKeyPem, string baseUrl)
    {
        _clientCode = clientCode;
        _privateKey = RSA.Create();
        _privateKey.ImportFromPem(privateKeyPem);
        _http = new HttpClient { BaseAddress = new Uri(baseUrl) };
    }

    /// <summary>مرحله ۱: ساخت URL Consent</summary>
    public string BuildConsentUrl(string redirectUrl, string scopes, string state)
    {
        var query = HttpUtility.ParseQueryString(string.Empty);
        query["client_code"]  = _clientCode;
        query["redirect_url"] = redirectUrl;
        query["scopes"]       = scopes;
        query["state"]        = state;
        return $"{_sellerPanelUrl}/pwa/seller-services/consents?{query}";
    }

    /// <summary>مرحله ۲: رمزگشایی authorization_code با private key</summary>
    public string DecryptAuthorizationCode(string encryptedCode)
    {
        var urlDecoded = Uri.UnescapeDataString(encryptedCode);
        Func<string, byte[]> b64Dec = Convert.FromBase64String;
        var decoded = b64Dec(urlDecoded);
        var decrypted = _privateKey.Decrypt(decoded, RSAEncryptionPadding.Pkcs1);
        return Encoding.UTF8.GetString(decrypted);
    }

    /// <summary>مرحله ۳: تبادل authorization_code با توکن‌ها</summary>
    public Task<TokenResponse> ExchangeCodeForTokensAsync(string authorizationCode)
        => PostAsync<TokenResponse>("/open-api/v1/auth/token", new
        {
            authorization_code = authorizationCode
        });

    /// <summary>Refresh کردن access_token منقضی‌شده</summary>
    public Task<TokenResponse> RefreshTokenAsync(string accessToken, string refreshToken)
        => PostAsync<TokenResponse>("/open-api/v1/auth/refresh-token", new
        {
            access_token  = accessToken,
            refresh_token = refreshToken
        });

    /// <summary>لغو دسترسی توسط Client</summary>
    public Task<JsonElement> RevokeTokenAsync(string accessToken)
    {
        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        return PostAsync<JsonElement>("/open-api/v1/auth/revoke", new { });
    }

    private async Task<T> PostAsync<T>(string path, object body)
    {
        var response = await _http.PostAsJsonAsync(path, body);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public void Dispose()
    {
        _privateKey.Dispose();
        _http.Dispose();
    }
}

// --- نمونه استفاده ---

class Program
{
    static async Task Main()
    {
        var privateKeyPem = System.IO.File.ReadAllText("/path/to/private_key.pem");

        using var client = new SellerServiceClient(
            clientCode:    "my-awesome-app",
            privateKeyPem: privateKeyPem,
            baseUrl:       "https://seller.digikala.com"
        );

        // گام ۱: هدایت فروشنده
        var state      = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();
        var consentUrl = client.BuildConsentUrl(
            redirectUrl: "https://myapp.ir/callback",
            scopes:      "variant order.read profile",
            state:       state
        );
        Console.WriteLine($"URL Consent: {consentUrl}");

        // گام ۲: رمزگشایی (مقدار از callback query string می‌آید)
        var encryptedCode  = "<authorization_code_from_query>";
        var decryptedCode  = client.DecryptAuthorizationCode(encryptedCode);

        // گام ۳: دریافت توکن‌ها
        var tokens         = await client.ExchangeCodeForTokensAsync(decryptedCode);
        var accessToken    = tokens.AccessToken;
        var refreshToken   = tokens.RefreshToken;

        // access token دریافت شد

        // گام ۴: Refresh token
        var newTokens  = await client.RefreshTokenAsync(accessToken, refreshToken);
        accessToken    = newTokens.AccessToken;
        refreshToken   = newTokens.RefreshToken;

        // گام ۵: لغو دسترسی
        await client.RevokeTokenAsync(accessToken);
        Console.WriteLine("دسترسی با موفقیت لغو شد.");
    }
}

```

---

##  📊 جدول خلاصه

###  Endpointها

| عملیات | Method | Path | طرف درخواست‌دهنده |
|---|---|---|---|
| دریافت لیست Scope | GET | `/open-api/v1/auth/scopes` | Client |
| دریافت Scope‌های اپ | GET | `/open-api/v1/auth/scopes/{client_code}` | Client |
| نمایش صفحه Consent | GET | `/pwa/seller-services/consents` | مرورگر فروشنده |
| ثبت Consent فروشنده | POST | `/pwa/seller-services/consents` | مرورگر فروشنده |
| تبادل Code با Token | POST | `/open-api/v1/auth/token` | Client (backend) |
| Refresh کردن Token | POST | `/open-api/v1/auth/refresh-token` | Client (backend) |
| لغو دسترسی (Client) | POST | `/open-api/v1/auth/revoke` | Client (backend) |
| تمدید اعتبار (Seller) | PATCH | `/pwa/seller-services/clients/{id}/extend-access` | فروشنده |
| لغو دسترسی (Seller) | PATCH | `/pwa/seller-services/clients/{id}/revoke-access` | فروشنده |

###  اعتبار توکن‌ها

| توکن | اعتبار | یادداشت |
|---|---|---|
| Authorization Code | **۵ دقیقه** | پس از پایان اعتبار باید جریان Consent از ابتدا طی شود |
| Access Token (JWT) | **۲ ساعت** | برای فراخوانی endpointهای API |
| Refresh Token | **۱ سال** | برای تجدید access_token بدون نیاز به Consent مجدد |

###  کدهای خطای رایج

| کد HTTP | خطا | دلیل احتمالی |
|---|---|---|
| 400 | `invalid_request` | پارامتر اشتباه یا ناقص |
| 401 | `unauthorized_client` | Client تأیید نشده یا غیرفعال است |
| 400 | `invalid_scope` | Scope درخواستی مجاز نیست |
| 400 | `access_denied` | فروشنده درخواست را رد کرده |
| 401 | `token_expired` | Access token منقضی شده؛ باید refresh شود |
| 429 | `rate_limit_exceeded` | از حد مجاز (۶۰۰ درخواست/ساعت) برای refresh فراتر رفته‌اید |

---

>

برای سؤالات فنی با تیم Marketplace API به آدرس **[Marketplace-API@digikala.com](mailto:Marketplace-API@digikala.com)** در تماس باشید.
