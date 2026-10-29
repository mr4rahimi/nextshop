# محدودیت نرخ درخواست (Rate Limiting)

> منبع: https://servicehub.digikala.services/fa/rate-limits  
> دریافت: ۱۴۰۵/۰۸/۰۷ — آکادمی سرویس‌هاب دیجی‌کالا (فقط از IP ایران باز می‌شود)

#  محدودیت نرخ درخواست (Rate Limits) در سرویس‌هاب

>

**مخاطب:** توسعه‌دهندگانی که از طریق Open API با پلتفرم دیجی‌کالا یکپارچه‌سازی انجام می‌دهند.

---

##  فهرست مطالب

1. مقدمه
2. محدودیت‌های پایه
3. سطوح محدودیت
4. محدودیت پویا بر اساس فعالیت فروشنده
5. کلید rate_limit در پاسخ API
6. پاسخ هنگام تجاوز از حد مجاز
7. بهترین شیوه‌ها

---

##  مقدمه

سرویس‌هاب برای حفاظت از زیرساخت و تضمین کیفیت سرویس برای همه فروشندگان، یک سیستم **Rate Limiting چندلایه** اعمال می‌کند. این سیستم از دو سطح مستقل تشکیل شده است:

1. **لایه اول — محدودیت سراسری (General IP Limiter):** روی تمام درخواست‌های ورودی، بر اساس IP کلاینت اعمال می‌شود.
2. **لایه دوم — محدودیت سرویس‌هاب:** روی endpointهای Open API که نیاز به احراز هویت دارند، بر اساس ترکیب sellerId، clientId و route محاسبه می‌شود.

>

**نکته مهم:** هر دو لایه **به‌طور همزمان** اعمال می‌شوند. تجاوز از هر کدام منجر به دریافت خطای `429` می‌شود.

---

##  محدودیت‌های پایه

###  لایه اول — محدودیت سراسری (General)

| نوع Action | حداکثر درخواست | بازه زمانی |
|---|---|---|
| **View** (خواندن) | ۵۰ درخواست | ۳ دقیقه |
| **Form** (نوشتن) | ۷۰ درخواست | ۳۰ دقیقه |

این محدودیت بر اساس IP کلاینت اعمال می‌شود و شامل تمام route‌ها می‌شود.

###  لایه دوم — محدودیت سرویس‌هاب (Authenticated)

| نوع Action | حداکثر درخواست | بازه زمانی |
|---|---|---|
| **View** (خواندن) | ۳۰ درخواست | ۳۰ ثانیه |
| **Form** (نوشتن) | ۲۰۰ درخواست | ۱ ساعت |

این مقادیر **محدودیت پایه** هستند. محدودیت واقعی ممکن است بر اساس سطح فعالیت فروشنده به‌صورت پویا بالاتر محاسبه شود (به بخش بعد مراجعه کنید).

---

##  سطوح محدودیت

###  APIهای عمومی (Public Routes)

برای endpointهایی که نیاز به احراز هویت ندارند، محدودیت بر اساس **IP کلاینت** اعمال می‌شود.

###  APIهای احراز هویت‌شده

برای endpointهایی که با `access_token` فراخوانی می‌شوند، محدودیت بر اساس ترکیب `sellerId + clientId + route` محاسبه می‌شود. در این حالت ممکن است **محدودیت پویا** نیز اعمال شود.

---

##  محدودیت پویا بر اساس فعالیت فروشنده

سرویس‌هاب هر روز ساعت **۰۶:۰۰ به وقت تهران** آمار فعالیت هر فروشنده را محاسبه و ذخیره می‌کند. این مکانیزم تضمین می‌کند فروشندگان با فعالیت بیشتر، سهم متناسب‌تری از ظرفیت API دریافت کنند.

###  endpointهای مربوط به تنوع (Variant)

برای route‌هایی با scope مرتبط به `variant`، محدودیت بر اساس **تعداد تنوع‌های فعال** فروشنده محاسبه می‌شود:

- فروشندگان با تنوع فعال بیشتر، محدودیت بالاتری دریافت می‌کنند.
- یک حداقل تضمین‌شده وجود دارد تا فروشندگان تازه‌کار نیز بتوانند به‌راحتی کار کنند.
- بازه زمانی محاسبه: **هر ۱ دقیقه**

**مثال:** فروشنده‌ای با ۶۰۰ تنوع فعال می‌تواند انتظار داشته باشد تقریباً **۱۵ درخواست در دقیقه** برای endpointهای variant داشته باشد.

###  endpointهای SBS (Ship By Seller)

برای route‌هایی با scope مرتبط به `sbs_orders` یا `sbs_shipment`، محدودیت بر اساس **تعداد سفارشات فعال SBS** فروشنده محاسبه می‌شود:

- سفارشاتی که در وضعیت PENDING / PROCESSING / PROCESSED هستند و در بازه زمانی اخیر ایجاد شده‌اند محاسبه می‌شوند.
- فروشندگان با سفارشات SBS بیشتر، محدودیت بالاتری دریافت می‌کنند.
- بازه زمانی محاسبه: **هر ۱ دقیقه**

**مثال:** فروشنده‌ای با ۱۰۰ سفارش SBS فعال می‌تواند انتظار داشته باشد تقریباً **۱۷ درخواست در دقیقه** برای endpointهای SBS داشته باشد.

---

##  کلید `rate_limit` در پاسخ API

سرویس‌هاب در **تمام پاسخ‌های Open API** (چه موفق، چه ناموفق) یک کلید `rate_limit` برمی‌گرداند. این کلید وضعیت لحظه‌ای مصرف سهمیه را نشان می‌دهد و می‌توان از آن برای مدیریت هوشمند نرخ درخواست استفاده کرد.

###  ساختار کلید `rate_limit`

| فیلد | نوع | توضیح |
|---|---|---|
| `max` | `integer` | حداکثر تعداد درخواست مجاز در بازه زمانی جاری |
| `current` | `integer` | تعداد درخواست‌هایی که تاکنون در بازه جاری مصرف شده |
| `resetTime` | `object \\| null` | زمانی که پنجره محدودیت ریست می‌شود. در صورت عدم وجود محدودیت فعال، `null` است |

####  ساختار فیلد `resetTime`

| فیلد | نوع | توضیح |
|---|---|---|
| `date` | `string` | تاریخ و زمان ریست به فرمت `Y-m-d H:i:s.u` |
| `timezone_type` | `integer` | نوع timezone (معمولاً `3`) |
| `timezone` | `string` | نام timezone (مثلاً `Asia/Tehran`) |

###  جایگاه `rate_limit` در پاسخ‌ها

####  پاسخ موفق (HTTP 2xx)

`rate_limit` داخل آبجکت `data` قرار می‌گیرد:

```
{
    "status": "ok",
    "data": {
        "rate_limit": {
            "max": 33,
            "current": 7,
            "resetTime": {
                "date": "2026-05-16 14:32:00.000000",
                "timezone_type": 3,
                "timezone": "Asia/Tehran"
            }
        },
        // ... بقیه داده‌های پاسخ
    }
}

```

####  پاسخ ناموفق (HTTP 4xx)

`rate_limit` در سطح اول پاسخ قرار می‌گیرد (کنار `status` و `message`):

```
{
    "status": "error",
    "message": "Validation failed",
    "code": 400,
    "errors": { ... },
    "rate_limit": {
        "max": 33,
        "current": 7,
        "resetTime": {
            "date": "2026-05-16 14:32:00.000000",
            "timezone_type": 3,
            "timezone": "Asia/Tehran"
        }
    }
}

```

####  حالت `resetTime: null`

زمانی که سیستم نتواند اطلاعات ریست را بازیابی کند (مثلاً اولین درخواست در یک بازه جدید):

```
{
    "rate_limit": {
        "max": 33,
        "current": 1,
        "resetTime": null
    }
}

```

###  نحوه استفاده از `rate_limit`

به جای واکنش پس از دریافت خطای `429`، می‌توانید **پیش از ارسال درخواست بعدی** وضعیت سهمیه را بررسی کنید:
- PHP
- Java
- Node.js
- .NET (C#)
- Python

```
class RateLimitAwareClient
{
    private string $accessToken;
    private string $baseUrl;
    private ?array $lastRateLimit = null;

    public function __construct(string $accessToken, string $baseUrl)
    {
        $this->accessToken = $accessToken;
        $this->baseUrl     = rtrim($baseUrl, '/');
    }

    public function get(string $path): array
    {
        $this->waitIfNeeded();

        $ch = curl_init($this->baseUrl . $path);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$this->accessToken}"],
            CURLOPT_RETURNTRANSFER => true,
        ]);
        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode($body, true);

        // استخراج rate_limit از هر دو حالت پاسخ
        $this->lastRateLimit = $status < 400
            ? ($data['data']['rate_limit'] ?? null)
            : ($data['rate_limit'] ?? null);

        if ($status >= 400) {
            throw new RuntimeException("API error {$status}");
        }
        return $data;
    }

    private function waitIfNeeded(): void
    {
        if (!$this->lastRateLimit) return;

        $max     = $this->lastRateLimit['max'];
        $current = $this->lastRateLimit['current'];
        $reset   = $this->lastRateLimit['resetTime'];

        if ($current >= $max && $reset !== null) {
            $resetTime   = new DateTime($reset['date'], new DateTimeZone($reset['timezone']));
            $waitSeconds = $resetTime->getTimestamp() - time();
            if ($waitSeconds > 0) {
                sleep($waitSeconds + 1);
            }
        }
    }
}

```

```
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

public class RateLimitAwareClient {
    private final String       accessToken;
    private final String       baseUrl;
    private final HttpClient   http    = HttpClient.newHttpClient();
    private final ObjectMapper mapper  = new ObjectMapper();
    private JsonNode lastRateLimit     = null;

    public RateLimitAwareClient(String accessToken, String baseUrl) {
        if (accessToken != null) this.accessToken = accessToken;
        if (baseUrl     != null) this.baseUrl = baseUrl.endsWith("/") ? baseUrl.replaceFirst("/$", "") : baseUrl;
    }

    public JsonNode get(String path) throws Exception {
        waitIfNeeded();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build();

        var response = http.sendAsync(request, HttpResponse.BodyHandlers.ofString()).join();
        JsonNode data = mapper.readTree(response.body());

        // استخراج rate_limit از هر دو حالت پاسخ
        lastRateLimit = response.statusCode() < 400
            ? data.path("data").path("rate_limit")
            : data.path("rate_limit");

        if (response.statusCode() >= 400) {
            throw new RuntimeException("API error " + response.statusCode());
        }
        return data;
    }

    private void waitIfNeeded() throws InterruptedException {
        if (lastRateLimit == null || !lastRateLimit.has("max")) return;

        int      max       = lastRateLimit.path("max").asInt();
        int      current   = lastRateLimit.path("current").asInt();
        JsonNode resetNode = lastRateLimit.path("resetTime");

        if (current >= max && resetNode.isObject()) {
            String dateStr  = resetNode.path("date").asText().split("\\.")[0];
            String dtFormat = "yyyy-MM-dd" + " HH:mm:ss";
            LocalDateTime resetDt = LocalDateTime.parse(dateStr, DateTimeFormatter.ofPattern(dtFormat));
            long waitSec = ChronoUnit.SECONDS.between(
                LocalDateTime.now(ZoneId.of("Asia/Tehran")), resetDt
            );
            if (waitSec > 0) Thread.sleep((waitSec + 1) * 1000);
        }
    }
}

```

```
const https = require('https');
const sleep = require('util').promisify(setTimeout);

class RateLimitAwareClient {
    constructor(accessToken, baseUrl) {
        Object.assign(this, {
            accessToken,
            baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
            _lastRateLimit: null,
        });
    }

    async get(path) {
        await this._waitIfNeeded();

        const { statusCode, body } = await this._httpGet(path);
        const data = JSON.parse(body);

        // استخراج rate_limit از هر دو حالت پاسخ
        this._lastRateLimit = statusCode < 400
            ? (data?.data?.rate_limit ?? null)
            : (data?.rate_limit ?? null);

        if (statusCode >= 400) throw new Error('API error ' + statusCode);
        return data;
    }

    async _waitIfNeeded() {
        if (!this._lastRateLimit) return;
        const { max, current, resetTime } = this._lastRateLimit;

        if (current >= max && resetTime) {
            const resetDate = new Date(resetTime.date.replace(' ', 'T'));
            const waitMs    = resetDate - Date.now();
            if (waitMs > 0) await sleep(waitMs + 500);
        }
    }

    _httpGet(path) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + path);
            https.get(
                { hostname: url.hostname, path: url.pathname + url.search,
                  headers: { Authorization: 'Bearer ' + this.accessToken } },
                (res) => {
                    let body = '';
                    res.on('data', c => (body += c));
                    res.on('end', () => resolve({ statusCode: res.statusCode, body }));
                }
            ).on('error', reject);
        });
    }
}

```

```
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

public class RateLimitAwareClient
{
    private readonly HttpClient _http;
    private JsonElement?        _lastRateLimit;

    public RateLimitAwareClient(string accessToken, string baseUrl)
    {
        _http = new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/") };
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);
    }

    public async Task<JsonElement> GetAsync(string path)
    {
        await WaitIfNeededAsync();

        var response = await _http.GetAsync(path);
        var body     = await response.Content.ReadAsStringAsync();
        var data     = JsonSerializer.Deserialize<JsonElement>(body);

        // استخراج rate_limit از هر دو حالت پاسخ
        _lastRateLimit = response.IsSuccessStatusCode
            ? data.GetProperty("data").GetProperty("rate_limit")
            : data.TryGetProperty("rate_limit", out var rl) ? rl : (JsonElement?)null;

        response.EnsureSuccessStatusCode();
        return data;
    }

    private async Task WaitIfNeededAsync()
    {
        if (_lastRateLimit is not JsonElement rl) return;

        int max     = rl.GetProperty("max").GetInt32();
        int current = rl.GetProperty("current").GetInt32();

        if (current >= max
            && rl.TryGetProperty("resetTime", out var rt)
            && rt.ValueKind != JsonValueKind.Null)
        {
            var resetDt     = DateTime.Parse(rt.GetProperty("date").GetString()!);
            var waitSeconds = (resetDt - DateTime.UtcNow).TotalSeconds;
            if (waitSeconds > 0)
                await Task.Delay(TimeSpan.FromSeconds(waitSeconds + 1));
        }
    }
}

```

```
import time
from datetime import datetime, timezone
import requests

class RateLimitAwareClient:
    def __init__(self, access_token: str, base_url: str):
        self.access_token     = access_token
        self.base_url         = base_url
        self._last_rate_limit = None

    def get(self, path: str) -> dict:
        self._wait_if_needed()

        response = requests.get(
            self.base_url + path,
            headers={'Authorization': f'Bearer {self.access_token}'}
        )

        data = response.json()

        # استخراج rate_limit از هر دو حالت پاسخ (موفق و ناموفق)
        if response.ok:
            self._last_rate_limit = data.get('data', {}).get('rate_limit')
        else:
            self._last_rate_limit = data.get('rate_limit')

        response.raise_for_status()
        return data

    def _wait_if_needed(self):
        if not self._last_rate_limit:
            return

        max_tries      = self._last_rate_limit['max']
        current        = self._last_rate_limit['current']
        reset_time_raw = self._last_rate_limit.get('resetTime')

        # اگر سهمیه تمام شده، تا زمان ریست صبر کن
        if current >= max_tries and reset_time_raw:
            reset_dt = datetime.strptime(
                reset_time_raw['date'], '%Y-%m-%d %H:%M:%S.%f'
            ).replace(tzinfo=timezone.utc)
            wait_seconds = (reset_dt - datetime.now(timezone.utc)).total_seconds()
            if wait_seconds > 0:
                time.sleep(wait_seconds + 0.5)

```

---

##  پاسخ هنگام تجاوز از حد مجاز

هنگامی که از حد مجاز تجاوز کنید، سرور با **HTTP 429** پاسخ می‌دهد:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30

```

```
{
    "status": "error",
    "message": "Validation failed",
    "code": 429
}

```

###  هدر `Retry-After`

مقدار این هدر نشان می‌دهد چند **ثانیه** باید صبر کنید تا بتوانید دوباره درخواست ارسال کنید.

>

**توجه:** هدرهای استاندارد `X-RateLimit-*` در پاسخ‌ها ارسال نمی‌شوند. در صورت تجاوز از حد، از هدر `Retry-After` در پاسخ ۴۲۹ یا فیلد `resetTime` در پاسخ‌های قبلی استفاده کنید.

---

##  بهترین شیوه‌ها

###  ۱. استفاده فعال از `rate_limit` به جای واکنش به خطای ۴۲۹

بهترین رویکرد بررسی `current` در برابر `max` **قبل** از ارسال هر درخواست است تا اصلاً به خطای ۴۲۹ نرسید (مثال کامل در بخش قبل).

###  ۲. مدیریت خطای ۴۲۹ به عنوان fallback
- PHP
- Java
- Node.js
- .NET (C#)
- Python

```
function callApiWithRetry(string $url, string $accessToken, int $maxRetries = 3): array
{
    for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$accessToken}"],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
        ]);
        $raw        = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $status     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $hdrs       = substr($raw, 0, $headerSize);
        $body       = substr($raw, $headerSize);
        curl_close($ch);

        if ($status === 429) {
            preg_match('/Retry-After:\s*(\d+)/i', $hdrs, $m);
            sleep((int)($m[1] ?? 30) + 1);
            continue;
        }

        if ($status >= 400) {
            throw new RuntimeException("API error {$status}");
        }

        return json_decode($body, true);
    }
    throw new RuntimeException("Rate limit exceeded after {$maxRetries} retries.");
}

```

```
public JsonNode callApiWithRetry(String url, int maxRetries) throws Exception {
    for (int attempt = 0; attempt < maxRetries; attempt++) {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build();

        var response = http.sendAsync(request, HttpResponse.BodyHandlers.ofString()).join();

        if (response.statusCode() == 429) {
            long retryAfter = response.headers()
                .firstValue("Retry-After").map(Long::parseLong).orElse(30L);
            Thread.sleep((retryAfter + 1) * 1000);
            continue;
        }

        if (response.statusCode() >= 400) {
            throw new RuntimeException("API error " + response.statusCode());
        }

        return mapper.readTree(response.body());
    }
    throw new RuntimeException("Rate limit exceeded after " + maxRetries + " retries.");
}

```

```
const sleep = require('util').promisify(setTimeout);

async function callApiWithRetry(url, accessToken, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { statusCode, headers, body } = await httpGet(url, accessToken);

        if (statusCode === 429) {
            const retryAfter = parseInt(headers['retry-after'] ?? '30', 10);
            await sleep((retryAfter + 1) * 1000);
            continue;
        }

        if (statusCode >= 400) throw new Error('API error ' + statusCode);
        return JSON.parse(body);
    }
    throw new Error('Rate limit exceeded after ' + maxRetries + ' retries.');
}

```

```
async Task<JsonElement> CallApiWithRetryAsync(string url, int maxRetries = 3)
{
    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        var response = await _http.GetAsync(url);

        if ((int)response.StatusCode == 429)
        {
            int retryAfter = (int)(response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 30);
            await Task.Delay(TimeSpan.FromSeconds(retryAfter + 1));
            continue;
        }

        response.EnsureSuccessStatusCode();
        return JsonSerializer.Deserialize<JsonElement>(
            await response.Content.ReadAsStringAsync());
    }
    throw new Exception($"Rate limit exceeded after {maxRetries} retries.");
}

```

```
import time
import requests

def call_api_with_retry(url: str, access_token: str, max_retries: int = 3) -> dict:
    headers = {'Authorization': f'Bearer {access_token}'}
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)

        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 30))
            time.sleep(retry_after + 1)
            continue

        response.raise_for_status()
        return response.json()

    raise RuntimeError(f'Rate limit exceeded after {max_retries} retries.')

```

###  ۳. توزیع درخواست‌ها در طول زمان

به جای ارسال یک‌جا (burst)، درخواست‌ها را در بازه زمانی پخش کنید:
- PHP
- Java
- Node.js
- .NET (C#)
- Python

```
function processVariantsInBatches(array $variantIds, $apiClient): array
{
    $results      = [];
    $batchSize    = 10;
    $delaySeconds = 2;
    $chunks       = array_chunk($variantIds, $batchSize);

    foreach ($chunks as $i => $batch) {
        $results = array_merge($results, $apiClient->getVariants($batch));

        if ($i < count($chunks) - 1) {
            sleep($delaySeconds);
        }
    }
    return $results;
}

```

```
public List<JsonNode> processVariantsInBatches(List<String> variantIds) throws Exception {
    List<JsonNode> results      = new ArrayList<>();
    int            batchSize    = 10;
    int            delaySeconds = 2;

    for (int i = 0; i < variantIds.size(); i += batchSize) {
        List<String> batch = variantIds.subList(i, Math.min(i + batchSize, variantIds.size()));
        results.addAll(apiClient.getVariants(batch));

        if (i + batchSize < variantIds.size()) {
            Thread.sleep(delaySeconds * 1000L);
        }
    }
    return results;
}

```

```
const sleep = require('util').promisify(setTimeout);

async function processVariantsInBatches(variantIds, apiClient) {
    const results   = [];
    const batchSize = 10;
    const delayMs   = 2000;

    for (let i = 0; i < variantIds.length; i += batchSize) {
        const batch  = variantIds.slice(i, i + batchSize);
        const result = await apiClient.getVariants(batch);
        results.push(...result);

        if (i + batchSize < variantIds.length) {
            await sleep(delayMs);
        }
    }
    return results;
}

```

```
async Task<List<JsonElement>> ProcessVariantsInBatchesAsync(
    IReadOnlyList<string> variantIds, ApiClient apiClient)
{
    var results   = new List<JsonElement>();
    int batchSize = 10;
    int delayMs   = 2000;

    for (int i = 0; i < variantIds.Count; i += batchSize)
    {
        var batch  = variantIds.Skip(i).Take(batchSize).ToList();
        var result = await apiClient.GetVariantsAsync(batch);
        results.AddRange(result);

        if (i + batchSize < variantIds.Count)
            await Task.Delay(delayMs);
    }
    return results;
}

```

```
import time

def process_variants_in_batches(variant_ids: list, api_client) -> list:
    results       = []
    batch_size    = 10
    delay_seconds = 2

    for i in range(0, len(variant_ids), batch_size):
        batch = variant_ids[i:i + batch_size]
        result = api_client.get_variants(batch)
        results.extend(result)

        if i + batch_size < len(variant_ids):
            time.sleep(delay_seconds)

    return results

```

###  ۴. نکات کلی

- **از درخواست‌های موازی بیش از حد خودداری کنید.** اگر به ارسال درخواست‌های concurrent نیاز دارید، تعداد آن‌ها را محدود کنید (معمولاً حداکثر ۳–۵ درخواست موازی توصیه می‌شود).
- **داده‌های غیر real-time را cache کنید.** بسیاری از داده‌ها مانند لیست تنوع‌ها نیاز به فراخوانی مجدد هر چند ثانیه ندارند.
- **از webhook استفاده کنید.** برای دریافت تغییرات سفارش‌ها و موجودی، به جای polling مداوم از webhook استفاده کنید تا مصرف کمتری از سهمیه API داشته باشید.

---

##  خلاصه سریع

| سناریو | حداکثر درخواست | بازه |
|---|---|---|
| خواندن (View) — سراسری | ۵۰ | ۳ دقیقه |
| نوشتن (Form) — سراسری | ۷۰ | ۳۰ دقیقه |
| سرویس‌هاب — خواندن (پایه) | ۳۰ | ۳۰ ثانیه |
| سرویس‌هاب — نوشتن (پایه) | ۲۰۰ | ۱ ساعت |
| سرویس‌هاب — خواندن تنوع (پویا، مثال ۶۰۰ تنوع) | ~۱۵ | ۱ دقیقه |
| سرویس‌هاب — خواندن SBS (پویا، مثال ۱۰۰ سفارش) | ~۱۷ | ۱ دقیقه |
| Refresh Token | ۶۰۰ | ۱ ساعت |

---

>

برای سؤالات فنی با تیم Marketplace API به آدرس **[Marketplace-API@digikala.com](mailto:Marketplace-API@digikala.com)** در تماس باشید.
