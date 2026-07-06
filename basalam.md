شروع سریع توسعه
شروع سریع توسعه
این سند راهنمای قدم اول تا اولین فراخوانی در مسیر توسعه برنامه‌تان را با استفاده از API باسلام ارائه می‌دهد.

توصیه مهم: استفاده از SDK باسلام

قبل از شروع کار با API مستقیم، قویاً توصیه می‌کنیم از SDK رسمی باسلام استفاده کنید. این SDK‌ها زمان توسعه را تا 70% کاهش می‌دهند و بسیاری از پیچیدگی‌ها را به صورت خودکار مدیریت می‌کنند.

مستندات SDK | نصب سریع SDK پایتون: pip install basalam-sdk

آنچه در این سند می‌خوانید
پیش‌نیازها
احراز هویت در API باسلام
توکن دسترسی شخصی
شروع سریع با SDK
جریان کد مجوز (OAuth)
اعتبارنامه کلاینت
فراخوانی اولین API: افزودن محصول جدید
خطاهای رایج و رفع مشکل
گام‌های بعدی
پیش‌نیازها
حساب کاربری در باسلام 
مشخصات کلاینت شامل Client ID و Client Secret یا توکن دسترسی شخصی (PAT) (از پنل توسعه‌دهندگان  دریافت کنید.)
احراز هویت در API باسلام
برای استفاده از API باسلام، بسته به نوع اپ و سطح دسترسی موردنیاز، سه روش اصلی برای احراز هویت وجود دارد. این روش‌ها بر اساس استاندارد OAuth 2.0 طراحی شده‌اند و امکان دسترسی ایمن و کنترل‌شده به سرویس‌های مختلف باسلام را فراهم می‌کنند.

سناریو	روش احراز هویت
توسعه اپلیکیشن اختصاصی برای یک غرفه یا کاربر
مثلاً یک پنل مدیریتی شخصی یا اسکریپت اتوماسیون برای یک غرفه یا حساب کاربری خاص	Personal Access Token
توسعه اپلیکیشن عمومی برای کاربران باسلام (Third-Party)
مثلاً یک ابزار تحلیلی یا پلاگین فروشگاهی که کاربران پس از احراز هویت، به شما اجازه‌ دسترسی به اطلاعات خود را بدهند	Authorization Code Flow
ارتباط سیستمی با سرویس‌های مالی/حقوقی باسلام که بدون دخالت مستقیم کاربر، نیاز به ارسال ریکوئست به API دارند
ارسال درخواست به سرویس‌هایی مانند کیف پول، امور مالی یا تسویه‌حساب که از طرف یک کاربر حقوقی، سازمان یا سیستم احراز هویت می‌شوند، نه کاربر نهایی	Client Credentials Flow
شروع سریع با SDK
SDK باسلام ساده‌ترین و سریع‌ترین راه برای کار با API های باسلام است. با استفاده از SDK، نیازی به مدیریت دستی توکن‌ها، هدرها، و خطاها ندارید.

نصب SDK پایتون

pip install basalam-sdk
مثال ساده: دریافت اطلاعات کاربر و لیست محصولات

from basalam import Client
 
# ایجاد کلاینت با توکن دسترسی شخصی
client = Client(token="YOUR_ACCESS_TOKEN")
 
# دریافت اطلاعات کاربر - بدون نیاز به مدیریت هدرها!
user = client.users.get_me()
print(f"سلام {user.name}!")
 
# دریافت لیست محصولات - خیلی ساده!
products = client.products.list(vendor_id=user.vendor.id)
for product in products:
    print(f"- {product.name}: {product.price} تومان")
 
# افزودن محصول جدید - بدون پیچیدگی!
new_product = client.products.create(
    vendor_id=user.vendor.id,
    name="محصول جدید",
    price=150000,
    stock=10,
    description="توضیحات محصول"
)
print(f"محصول {new_product.name} با موفقیت ایجاد شد!")
برای اطلاعات کامل درباره تمام قابلیت‌های SDK، به مستندات کامل SDK مراجعه کنید.

اگر ترجیح می‌دهید مستقیماً با API کار کنید، ادامه این مستند نحوه استفاده از API های باسلام را توضیح می‌دهد:

توکن دسترسی شخصی
برای دریافت توکن به پنل توسعه‌دهندگان مراجعه کرده و از بخش توکن دسترسی شخصی ، توکن دسترسی و رفرش توکن خود را با اسکوپ دسترسی موردنظر، دریافت کنید.

جریان کد مجوز
مرحله ۱: درخواست مجوز
برای دسترسی به منابع کاربر و شروع فرآیند احراز هویت، کاربر را به آدرس مجوز باسلام (با پارامترهای مشخص شده و مقادیر دریافت شده پس از ساخت کلاینت) هدایت کنید:


https://basalam.com/accounts/sso?client_id=[client_id]&scope=[scope]&redirect_uri=[client_redirect_uri]&state=[state]
توجه داشته باشید که لیست Scope‌ها با فاصله (space) از هم جدا شده باشند. به عنوان مثال: scope="vendor.product.read vendor.product.write customer.order.read"

برای مشاهده لیست کامل Scope‌ها، به صفحه مستندات دسترسی‌ها مراجعه کنید.

مرحله ۲: دریافت توکن دسترسی از کاربر
پس از اعطای دسترسی به برنامه توسط کاربر، کد تایید code ارسال شده به redirect_uri خود را برای دریافت توکن دسترسی ارسال کنید:


curl -X POST https://auth.basalam.com/oauth/token \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "grant_type": "authorization_code",
    "client_id": "[YOUR_CLIENT_ID]",
    "client_secret": "[YOUR_CLIENT_SECRET]",
    "redirect_uri": "[YOUR_REDIRECT_URI]",
    "code": "[CODE]"
  }'
نمونه پاسخ دریافتی:


{
  "token_type": "Bearer",
  "access_token": "eyJ0eXAiO...",
  "expires_in": 31622400,
  "refresh_token": "def502..."
}
مرحله ۳: دریافت اطلاعات کاربر

curl -X GET https://openapi.basalam.com/v1/users/me \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer [TOKEN]'
نمونه پاسخ دریافتی:


{
  "id": 0, // آی‌دی کاربر
  "hash_id": "string", // هش‌آی‌دی کاربر
  "username": "string",
  "name": "string",
  "vendor": {
    "id": 0, // آی‌دی غرفه کاربر
    "identifier": "string", // آی‌دی غرفه
    "title": "string"
  }
}
اعتبارنامه‌ کلاینت
برای APIهایی که نیازمند دسترسی و کاربر از نوع حقوقی است، برای نمونه، دریافت تراز غرفه یا تاریخچه کیف پول، باید از احراز هویت کلاینت استفاده کنید:


curl -X POST https://auth.basalam.com/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{
      "grant_type": "client_credentials",
      "client_id": "YOUR_CLIENT_ID",
      "client_secret": "YOUR_CLIENT_SECRET",
      "scope": "*"
  }'
اعتبارسنجی اطلاعات توکن کاربر
برای اعتبارسنجی توکن دریافتی نیز می‌توانید از اندپوینت /whoami استفاده کنید:


curl -X GET https://auth.basalam.com/whoami \
-H 'Accept: application/json' \
-H 'Authorization: Bearer [TOKEN]'
نمونه پاسخ دریافتی:


{
  "id": "...",
  "name": "....",
  "mobile": "09xxxxxxxxx",
  "hash_id": "xxx",
  "client": {
    "id": "...",
    "name": "...",
    "image_url": "..."
  }
}
فراخوانی اولین API: افزودن محصول جدید
قبل از افزودن محصول، باید تصاویر آن را با استفاده از اندپوینت /v3/files آپلود کرده و شناسه‌های تصاویر را در درخواست افزودن محصول قرار دهید:

آپلود تصاویر محصول

curl -X POST https://openapi.basalam.com/v1/files \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-F "file=@test-image.jpg" \
-F "file_type=product.photo" 
نمونه پاسخ دریافتی:


{
  "id": "238300331",
  "file_name": "string",
  "path": "string",
  "mime_type": "string",
  "size": 102400,
  "created_at": "2025-05-17T14:25:39Z",
  "creator_user_id": 1
}
مستندات API سرویس آپلود

افزودن محصول
برای افزودن محصول جدید، اطلاعات محصول را به اندپوینت /vendors/{vendor_id}/products ارسال کنید:


curl -X POST https://openapi.basalam.com/v1/vendors/{vendor_id}/products \
-H 'Accept: application/json' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-d '{
"name": "محصول نمونه",
"photo": 238300331,
"photos": [238300331],
"brief": "توضیحات کوتاه محصول",
"description": "توضیحات کامل محصول نمونه",
"preparation_days": 3,
"weight": 500,
"package_weight": 600,
"primary_price": 150000,
"stock": 10,
"sku": "PRODUCT-SKU-001",
"is_wholesale": false
}'
API افزودن محصول، دو فیلد مرتبط با تصویر به نام‌های photoو photos دارد که فیلد اول تنها یک آ‌ی‌دی و فیلد دوم لیستی از آی‌دی‌ها (که آلبوم محصول را تشکیل می‌دهند) را می‌پذیرد. توصیه می‌شود آی‌دی‌ای که به فیلد photo پاس می‌دهید را نیز اولین ‌آی‌دی فیلد photos قرار دهید.

دریافت لیست محصولات
با استفاده از اندپوینت /vendors/{vendor_id}/products برای دریافت فهرست محصولات یک غرفه ریکوئست بزنید:


curl -X GET https://openapi.basalam.com/v1/vendors/{vendor_id}/products \
-H 'Accept: application/json' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
نمونه پاسخ دریافتی


{
    "data": [
        {
            "id": 24018670,
            "title": "تیشرت پسرانه تابستانی",
            "price": 100000,
            "photo": {
                "id": 236016433,
                "original": "...",
                "xs": "...",
                "sm": "...",
                "md": "...",
                "lg": "..."
            },
            "status": {
                "name": "در دسترس",
                "value": 2976,
            },
            "inventory": 10,
            "is_wholesale": false
        }
    ],
    ...,
    "total_count": 5319,
    "result_count": 10,
    "total_page": 532,
    "page": 1,
    "per_page": 10
}
خطاهای رایج و رفع مشکل
در اینجا برخی از خطاهای رایج که ممکن است با آنها مواجه شوید و نحوه حل آنها آمده است:

خطا	توضیح	راه حل
invalid_client	مشخصات کلاینت نادرست است	شناسه و رمز کلاینت را بررسی کنید
redirect_uri_mismatch	آدرس بازگشت اشتباه است	باید دقیقاً با آدرس ثبت‌شده مطابقت داشته باشد
invalid_grant	کد تأیید اشتباه یا منقضی است	فرآیند ورود کاربر را تکرار کنید
invalid_scope	دسترسی‌ درخواستی نامعتبر است	مستندات را برای دسترسی‌های معتبر بررسی کنید
401 Unauthorized	توکن نامعتبر یا منقضی شده است	یک توکن جدید دریافت کنید
گام‌های بعدی
اما این فقط شروع ماجراست! برای ادامه مسیر، پیشنهاد می‌کنیم موارد زیر را بررسی کنید:

استفاده از SDK (توصیه اکید): به جای فراخوانی مستقیم API، استفاده از SDK باسلام را قویاً توصیه می‌کنیم.

سرویس‌های دیگر را مرور کنید: شامل مجموعه‌ای از سرویس‌های متنوع است. برای آشنایی با عملکرد هرکدام، سری به مستندات کامل API بزنید.

وب‌هوک‌ها را راه‌اندازی کنید: اگر می‌خواهید هنگام وقوع رویدادها، مثل ثبت سفارش یا تغییر موجودی، به‌صورت خودکار نوتیفیکیشن دریافت کنید، حتماً بخش مربوط به وب‌هوک‌ها در مستندات را بخوانید.

مستندات توسعه‌دهندگان همیشه در دسترس شماست تا هر زمان که نیاز داشتید، به جزئیات دقیق‌تری دست پیدا کنید و تجربه توسعه‌ سریع‌تری داشته باشید.

SDK چیست و چطور به توسعه‌دهندگان کمک می‌کند؟
کیت توسعه نرم‌افزار باسلام، مجموعه‌ای از ابزارها، کتابخانه‌ها و مستندات است که طراحی شده تا تجربه توسعه شما را بهینه‌تر و کارآمد کند. این SDK از تمام سرویس‌های مورد نیاز توسعه‌دهندگان پشتیبانی می‌کند و شامل ویژگی‌های کلیدی مانند احراز هویت چندگانه (توکن دسترسی شخصی، جریان کد مجوز، اعتبارنامه‌های کلاینت)، پشتیبانی از Async/Sync و اعتبارسنجی خودکار داده‌ها می‌باشد.

این SDK با کاهش ۷۰٪ زمان توسعه، کد کمتر و خوانا‌تر و خطای کمتر، زندگی توسعه‌دهندگان را بسیار ساده‌تر می‌کند و امکان ساخت اپلیکیشن‌های قدرتمند با باسلام را فراهم می‌آورد.

مراحل بعدی
Python SDK - راهنمای کامل Python SDK
PHP SDK - راهنمای کامل PHP SDK

به SDK پایتون باسلام خوش آمدید - یک کتابخانه جامع برای تعامل با APIهای سرویس‌های باسلام. این SDK رابطی ساده، تمیز و توسعه‌دهنده‌پسند برای تمام سرویس‌های باسلام با پشتیبانی کامل Sync/Async فراهم می‌کند. این SDK پایتون طراحی شده تا ادغام با سرویس‌های باسلام را تا حد ممکن ساده و کارآمد کند. چه در حال ساخت یک ارتباط سرور به سرور باشید و چه در حال توسعه‌ یک اپلیکیشن کاربرمحور، این SDK ابزارهای مورد نیاز شما را فراهم می‌کند.

نسخه‌های پایتون پشتیبانی شده: Python 3.8+, Python 3.9+, Python 3.10+, Python 3.11+

ویژگی‌های کلیدی:

پوشش جامع سرویس‌ها: دسترسی به تمام سرویس‌های باسلام شامل کیف پول، سفارش‌ها، گفت‌وگو و موارد دیگر
روش‌های مختلف احراز هویت: پشتیبانی از گواهی‌نامه‌های کاربر (Client Credentials)، جریان کد مجوز (Authorization Code Flow) و توکن‌های دسترسی شخصی (PAT)
تضمین نوع داده‌ها: استفاده از Pydantic برای بررسی و اعتبارسنجی دقیق نوع داده‌ها
پشتیبانی کامل Async/Sync: پشتیبانی تمام متدها از الگوهای Sync و Async
مدیریت خطا: کلاس‌های خطای دقیق برای انواع مختلف خطاها
مناسب برای توسعه‌دهندگان: طراحی ساده و استاندارد API به‌همراه مستندات کامل و جامع
فهرست مطالب
نصب
شروع سریع
روش‌های احراز هویت
نمای کلی سرویس‌ها
نصب
SDK را با استفاده از pip نصب کنید:


pip install basalam-sdk
شروع سریع
۱. تنظیم احراز هویت

from basalam_sdk import BasalamClient, PersonalToken
 
# توکن دسترسی شخصی (PAT)
auth = PersonalToken(
    token="your-access-token",
    refresh_token="your-refresh-token"
)
 
# ایجاد کلاینت
client = BasalamClient(auth=auth)
۲. اولین فراخوانی‌های API شما
دریافت محصولات

# دریافت محصولات
products = client.get_products()
print(f"Found {len(products)} products")
ارسال پیام و دریافت گفت‌وگوها

# ایجاد یک پیام
from basalam_sdk.chat.models import MessageRequest
 
message = client.create_message(
    request=MessageRequest(
        chat_id=123,
        content="سلام، چطور می‌توانم کمکتان کنم؟",
        message_type=MessageTypeEnum.TEXT
    )
)
 
# دریافت پیام‌ها از یک گفت‌وگو
messages = client.get_messages(
    chat_id=123,
    limit=20,
    order="DESC"
)
نمای کلی سرویس‌ها
در SDK پایتون باسلام از تمامی ریسورس‌های سرویس‌های زیر به صورت یکپارچه‌سازی‌شده پشتیبانی شده است:

سرویس مرکزی (کاربر، غرفه و محصول) - غرفه‌داران، محصولات، روش‌های ارسال و اطلاعات کاربر
سرویس سفارش - مدیریت سبد خرید، پرداخت‌ها و فاکتورها
سرویس رهگیری سفارش - سفارشات مشتری و غرفه‌داران
سرویس کیف پول - مدیریت موجودی‌ها، هزینه‌ها و بازپرداخت‌های کاربر
سرویس گفت‌وگو - عملکردهای پیام‌رسانی و چت باسلام
سرویس آپلود - آپلود فایل
سرویس سرچ - جست‌وجوی محصول
سرویس وب‌هوک - مدیریت رخدادها و وب‌هوک



راهنمای احراز هویت
SDK از سه روش اصلی احراز هویت پشتیبانی می‌کند و تمام احراز هویت از طریق آبجکت‌های احراز هویت که رابط BaseAuth را پیاده‌سازی می‌کنند، مدیریت می‌شود.

توکن دسترسی شخصی - برای برنامه‌های شخصی و اختصاصی
جریان کد مجوز - برای سناریوهای احراز هویت کاربر در پلتفرم‌های Third-Party
اعتبارنامه‌های کلاینت - برای برنامه‌های با ماهیت و دسترسی حقوقی
برای توضیحات بیشتر درمورد روش‌‌های احراز هویت به سند احراز هویت در API باسلام مراجعه کنید.

فهرست مطالب
توکن دسترسی شخصی
جریان کد مجوز
اعتبارنامه‌ کلاینت
مدیریت توکن
محدوده‌های دسترسی
توکن دسترسی شخصی
در توسعه برنامه‌های شخصی برای یک غرفه و کاربر، بعد از دریافت توکن دسترسی از پنل توسعه‌دهندگان ، می‌توانید مشخصات توکن دریافت شده را توسط PersonalToken مدیریت کنید.


from basalam_sdk import BasalamClient, PersonalToken
 
def personal_token_example():
    # مقداردهی اولیه با توکن‌های موجود
    auth = PersonalToken(
        token="your_access_token",
        refresh_token="your_refresh_token",
    )
 
    # ایجاد کلاینت احراز هویت شده
    client = BasalamClient(auth=auth)
 
    # دریافت اطلاعات کاربر جاری
    user = client.get_current_user()
    return user
جریان کد مجوز (برای احراز هویت کاربر)
در زمان پیاده‌سازی یک برنامه Third-Party که نیازمند دریافت مجوز و دسترسی از کاربران است، بعد از ساخت کلاینت برنامه در پنل توسعه‌دهندگان ، از طریق کلاس AuthorizationCode برای مدیریت فرآیند دریافت مجوز از کاربر اقدام کنید.


from basalam_sdk import BasalamClient, AuthorizationCode, Scope
 
# مرحله ۱: ایجاد شیء احراز هویت
auth = AuthorizationCode(
    client_id="your-client-id",
    client_secret="your-client-secret",
    redirect_uri="https://your-app.com/callback",
    scopes=[
      Scope.CUSTOMER_WALLET_READ,
      Scope.CUSTOMER_ORDER_READ
    ]
)
 
# مرحله ۲: دریافت URL مجوز
auth_url = auth.get_authorization_url(state="optional_state_parameter")
print(f"Visit: {auth_url}")
 
# مرحله ۳: تبادل کد با توکن‌ها (بعد از دریافت کد از کاربر از آدرس برگشتی ثبت‌شده در کلاینت)
token_info = auth.get_token(code="authorization_code_from_callback")
 
# مرحله ۴: ایجاد کلاینت احراز هویت شده
client = BasalamClient(auth=auth)
مثال استفاده

from flask import Flask, request, redirect
 
app = Flask(__name__)
 
@app.route('/login')
def login():
    auth = AuthorizationCode(
        client_id="your-client-id",
        client_secret="your-client-secret",
        redirect_uri="https://your-app.com/callback"
    )
 
    auth_url = auth.get_authorization_url(state="user_session_id")
    return redirect(auth_url)
 
@app.route('/callback')
async def callback():
    code = request.args.get('code')
    state = request.args.get('state')
 
    auth = AuthorizationCode(
        client_id="your-client-id",
        client_secret="your-client-secret",
        redirect_uri="https://your-app.com/callback"
    )
 
    # تبادل کد با توکن‌ها
    token_info = await auth.get_token(code=code)
 
    # ذخیره امن توکن‌ها
    # ... ذخیره token_info.access_token, token_info.refresh_token
 
    return "Authentication successful!"
اعتبارنامه کلاینت
برای استفاده از APIهایی با ماهیت حقوقی مانند کیف پول، پس از احراز هویت کلاینت ساخته شده با grant_type="client_credentials" با استفاده از کلاس ClientCredentials برای استفاده از متدهای مربوطه اقدام کنید.

پیکربندی اولیه

from basalam_sdk import BasalamClient, ClientCredentials
 
# احراز هویت پایه
auth = ClientCredentials(
    client_id="your-client-id",
    client_secret="your-client-secret",
    scopes=[
      Scope.CUSTOMER_WALLET_READ,
      Scope.VENDOR_PRODUCT_WRITE
    ]
)
 
# ایجاد کلاینت
client = BasalamClient(auth=auth)
مثال استفاده

async def client_credentials_example():
  auth = ClientCredentials(
    client_id="your-client-id",
    client_secret="your-client-secret"
  )
  client = BasalamClient(auth=auth)
 
  # دریافت موجودی کاربر
  balance = await client.get_balance(user_id=123)
 
  return balance
مدیریت توکن
دریافت اطلاعات توکن

def token_management_example():
    auth = ClientCredentials(
        client_id="your-client-id",
        client_secret="your-client-secret"
    )
 
    # دریافت توکن - اگر منقضی نشده باشد از توکن موجود استفاده می‌کند
    token_info = auth.get_token()
 
    return token_info
محدوده‌های دسترسی
محدوده‌های دسترسی تعریف می‌کنند که برنامه شما چه مجوزهایی دارد. علاوه بر سند دسترسی‌ها، در SDK نیز لیست دسترسی‌ها توسط کلاس Scope فراهم شده است. محدوده‌های موجود شامل:


from basalam_sdk import Scope
 
# محدوده‌های رایج
Scope.CUSTOMER_WALLET_READ      # خواندن کیف پول مشتری
Scope.CUSTOMER_WALLET_WRITE     # نوشتن در کیف پول مشتری
Scope.VENDOR_PRODUCT_READ       # خواندن محصولات غرفه‌دار
Scope.VENDOR_PRODUCT_WRITE      # نوشتن محصولات غرفه‌دار
Scope.CUSTOMER_ORDER_READ       # خواندن سفارشات مشتری
Scope.CUSTOMER_ORDER_WRITE      # نوشتن سفارشات مشتری
استفاده از محدوده‌ها

from basalam_sdk import ClientCredentials, Scope
 
auth = ClientCredentials(
    client_id="your-client-id",
    client_secret="your-client-secret",
    scopes=[
        Scope.CUSTOMER_WALLET_READ,
        Scope.VENDOR_PRODUCT_WRITE,
        Scope.CUSTOMER_ORDER_READ
    ]
)



سرویس غرفه، کاربر و محصول (مرکزی)
مدیریت غرفه‌داران، محصولات، روش‌های ارسال، اطلاعات کاربران و موارد دیگر با استفاده از سرویس اصلی. این سرویس امکانات جامعی برای مدیریت موجودیت‌های اصلی کسب‌وکار فراهم می‌کند؛ از جمله ایجاد و مدیریت غرفه‌داران، مدیریت محصولات، روش‌های ارسال، احراز هویت و اطلاعات کاربران، حساب‌های بانکی و دسته‌بندی‌ها و ویژگی‌ها.

فهرست مطالب
متدهای غرفه و محصول
مثال‌ها
متدهای غرفه و محصول
متد	توضیحات	پارامترها
create_vendor()	ایجاد غرفه‌دار جدید	user_id, request: CreateVendorSchema
update_vendor()	بروزرسانی غرفه‌دار	vendor_id, request: UpdateVendorSchema
get_vendor()	دریافت جزئیات غرفه‌دار	vendor_id, prefer
get_default_shipping_methods()	دریافت روش‌های ارسال پیش‌فرض	None
get_shipping_methods()	دریافت روش‌های ارسال	ids, vendor_ids, include_deleted, page, per_page
get_working_shipping_methods()	دریافت روش‌های ارسال فعال	vendor_id
update_shipping_methods()	بروزرسانی روش‌های ارسال	vendor_id, request: UpdateShippingMethodSchema
get_vendor_products()	دریافت محصولات غرفه‌دار	vendor_id, query_params: GetVendorProductsSchema
update_vendor_status()	بروزرسانی وضعیت غرفه‌دار	vendor_id, request: UpdateVendorStatusSchema
create_vendor_mobile_change_request()	ایجاد درخواست تغییر موبایل غرفه‌دار	vendor_id, request: ChangeVendorMobileRequestSchema
create_vendor_mobile_change_confirmation()	تأیید تغییر موبایل غرفه‌دار	vendor_id, request: ChangeVendorMobileConfirmSchema
create_product()	ایجاد محصول جدید (پشتیبانی از آپلود فایل)	vendor_id, request: ProductRequestSchema, photo_files, video_file
update_bulk_products()	بروزرسانی چندین محصول	vendor_id, request: BatchUpdateProductsRequest
update_product()	بروزرسانی محصول (پشتیبانی از آپلود فایل)	product_id, request: ProductRequestSchema, photo_files, video_file
get_product()	دریافت جزئیات محصول	product_id, prefer
get_products()	دریافت لیست محصولات	query_params: GetProductsQuerySchema, prefer
create_products_bulk_action_request()	ایجاد بروزرسانی‌های انبوه محصولات	vendor_id, request: BulkProductsUpdateRequestSchema
update_product_variation()	بروزرسانی تنوع محصول	product_id, variation_id, request: UpdateProductVariationSchema
get_products_bulk_action_requests()	دریافت وضعیت بروزرسانی انبوه	vendor_id, page, per_page
get_products_bulk_action_requests_count()	دریافت تعداد بروزرسانی‌های انبوه	vendor_id
get_products_unsuccessful_bulk_action_requests()	دریافت بروزرسانی‌های ناموفق	request_id, page, per_page
get_product_shelves()	دریافت قفسه‌های محصول	product_id
create_discount()	ایجاد تخفیف برای محصولات	vendor_id, request: CreateDiscountRequestSchema
delete_discount()	حذف تخفیف برای محصولات	vendor_id, request: DeleteDiscountRequestSchema
get_current_user()	دریافت اطلاعات کاربر فعلی	None
create_user_mobile_confirmation_request()	ایجاد درخواست تأیید موبایل	user_id
verify_user_mobile_confirmation_request()	تأیید موبایل کاربر	user_id, request: ConfirmCurrentUserMobileConfirmSchema
create_user_mobile_change_request()	ایجاد درخواست تغییر موبایل	user_id, request: ChangeUserMobileRequestSchema
verify_user_mobile_change_request()	تأیید تغییر موبایل	user_id, request: ChangeUserMobileConfirmSchema
get_user_bank_accounts()	دریافت حساب‌های بانکی کاربر	user_id, prefer
create_user_bank_account()	ایجاد حساب بانکی کاربر	user_id, request: UserCardsSchema, prefer
verify_user_bank_account_otp()	تأیید رمز یکبار مصرف حساب بانکی	user_id, request: UserCardsOtpSchema
verify_user_bank_account()	تأیید حساب‌های بانکی	user_id, request: UserVerifyBankInformationSchema
delete_user_bank_account()	حذف حساب بانکی	user_id, bank_account_id
update_user_bank_account()	بروزرسانی حساب بانکی	user_id, bank_account_id, request: UpdateUserBankInformationSchema
update_user_verification()	بروزرسانی تأیید کاربر	user_id, request: UserVerificationSchema
get_category_attributes()	دریافت ویژگی‌های دسته‌بندی	category_id, product_id, vendor_id, exclude_multi_selects
get_categories()	دریافت همه دسته‌بندی‌ها	None
get_category()	دریافت دسته‌بندی خاص	category_id
create_shelve()	ایجاد قفسه جدید	request: ShelveSchema
update_shelve()	به‌روزرسانی قفسه	shelve_id, request: ShelveSchema
delete_shelve()	حذف قفسه	shelve_id
get_shelve_products()	دریافت محصولات در یک قفسه	shelve_id, title
update_shelve_products()	به‌روزرسانی محصولات در یک قفسه	shelve_id, request: UpdateShelveProductsSchema
delete_shelve_product()	حذف محصول از قفسه	shelve_id, product_id
مثال‌ها
پیکربندی اولیه

from basalam_sdk import BasalamClient, PersonalToken
 
auth = PersonalToken(
    token="your_access_token",
    refresh_token="your_refresh_token"
)
client = BasalamClient(auth=auth)
ایجاد غرفه‌دار

from basalam_sdk.core.models import CreateVendorSchema
 
 
async def create_vendor_example():
    vendor = await client.create_vendor(
        user_id=123,
        request=CreateVendorSchema(
            title="My Store",
            identifier="store123",
            category_type=1,
            city=1,
            summary="A great store for all your needs"
        )
    )
 
    return vendor
به‌روزرسانی غرفه‌دار

from basalam_sdk.core.models import UpdateVendorSchema
 
 
async def update_vendor_example():
    updated_vendor = await client.update_vendor(
        vendor_id=456,
        request=UpdateVendorSchema(
            title="Updated Store Name",
            summary="Updated description",
        )
    )
 
    return updated_vendor
دریافت غرفه‌دار

async def get_vendor_example():
    vendor = await client.get_vendor(
        vendor_id=456,
        prefer="return=minimal"
    )
 
    return vendor
دریافت روش‌های ارسال پیش‌فرض

async def get_default_shipping_methods_example():
    shipping_methods = await client.get_default_shipping_methods()
 
    return shipping_methods
دریافت روش‌های ارسال

async def get_shipping_methods_example():
    shipping_methods = await client.get_shipping_methods()
 
    return shipping_methods
دریافت روش‌های ارسال فعال

async def get_working_shipping_methods_example():
    working_methods = await client.get_working_shipping_methods(
        vendor_id=456
    )
 
    return working_methods
پاسخ نمونه


[
  ShippingMethodResponse(
    id=6124304, method=ShippingMethodInfo(name='سفارشی', value=3197, description=None),
    base_cost=460000, additional_cost=105000, is_private=False, additional_dimensions_cost=None, vendor_id=None, deleted_at=None
  ), 
  ShippingMethodResponse(
    id=6124301, method=ShippingMethodInfo(name='پیشتاز', value=3198, description=None),
    base_cost=570000, additional_cost=120000, is_private=False, additional_dimensions_cost=None, vendor_id=None, deleted_at=None
  ), 
  ShippingMethodResponse(
    id=6124305, method=ShippingMethodInfo(name='پیک', value=3259, description=None), 
    base_cost=320000, additional_cost=35000, is_private=False, additional_dimensions_cost=None, vendor_id=None, deleted_at=None
  )
]
به‌روزرسانی روش‌های ارسال

from basalam_sdk.core.models import UpdateShippingMethodSchema
 
 
async def update_shipping_methods_example():
    updated_methods = await client.update_shipping_methods(
        vendor_id=456,
        request=UpdateShippingMethodSchema(
            shipping_methods=[
                {
                    "method_id": 3198,
                    "is_customized": True,
                    "base_cost": 50000
                }
            ]
        )
    )
 
    return updated_methods
دریافت محصولات غرفه‌دار

from basalam_sdk.core.models import GetVendorProductsSchema, ProductStatusInputEnum
 
 
async def get_vendor_products_example():
    products = await client.get_vendor_products(
        vendor_id=456,
        query_params=GetVendorProductsSchema(
            statuses=[ProductStatusInputEnum.PUBLISHED],
            page=1,
            per_page=10
        )
    )
 
    return products
به‌روزرسانی وضعیت غرفه‌دار

from basalam_sdk.core.models import UpdateVendorStatusSchema
 
 
async def update_vendor_status_example():
    status_update = await client.update_vendor_status(
        vendor_id=456,
        request=UpdateVendorStatusSchema(
            status=VendorStatusInputEnum.SEMI_ACTIVE,
            description="Vendor is Semi Active"
        )
    )
 
    return status_update
ایجاد درخواست تغییر موبایل غرفه‌دار

from basalam_sdk.core.models import ChangeVendorMobileRequestSchema
 
 
async def create_vendor_mobile_change_request_example():
    result = await client.create_vendor_mobile_change_request(
        vendor_id=456,
        request=ChangeVendorMobileRequestSchema(
            mobile="09123456789"
        )
    )
 
    return result
تایید تغییر موبایل غرفه‌دار

from basalam_sdk.core.models import ChangeVendorMobileConfirmSchema
 
 
async def create_vendor_mobile_change_confirmation_example():
    result = await client.create_vendor_mobile_change_confirmation(
        vendor_id=456,
        request=ChangeVendorMobileConfirmSchema(
            mobile="09123456789",
            verification_code=123456
        )
    )
 
    return result
ایجاد محصول

from basalam_sdk.core.models import ProductRequestSchema, ProductStatusInputEnum, UnitTypeInputEnum
import io
 
 
async def create_product_example():
    try:
        with open("test1.png", "rb") as photo1,
                open("test2.png", "rb") as photo2:
            request = ProductRequestSchema(
                name="Product 01",
                description="The material of this product is very high quality and made of silk.",
                category_id=238,
                primary_price=100000,
                weight=300,
                package_weight=500,
                stock=10,
                status=ProductStatusInputEnum.PUBLISHED,
                unit_quantity=10,
                unit_type=UnitTypeInputEnum.NUMERIC
            )
            product = await client.core.create_product(456, request, photo_files=[photo1, photo2])
 
    return product
به‌روزرسانی چندین محصول

from basalam_sdk.core.models import BatchUpdateProductsRequest, UpdateProductRequestItem
 
 
async def update_bulk_products_example():
    updated_products = await client.core.update_bulk_products(
        vendor_id=456,
        request=BatchUpdateProductsRequest(
            data=[
                UpdateProductRequestItem(
                    id=1,
                    name="Updated Product 01",
                    stock=25
                ),
                UpdateProductRequestItem(
                    id=1,
                    stock=5,
                    primary_price=21000
                )
            ]
        )
    )
 
    return updated_products
به‌روزرسانی یک محصول

from basalam_sdk.core.models import ProductRequestSchema
 
import io
 
 
async def update_product_example():
    updated_product = await client.update_product(
        product_id=789,
        request=ProductRequestSchema(
            status=3790,
            product_attribute = [
              {
                "attribute_id": 219,
                "value": "Suitable for formal ceremonies",
              },
              {
                "attribute_id": 221,
                "value": "Silk",
              },
              {
                "attribute_id": 222,
                "value": "Burgundy, Black, Turquoise",
              },
              {
                "attribute_id": 1319,
                "value": "Due to its sensitivity, this fabric should be hand washed gently with cold water.",
              }
            ]
        )
    )
 
    return updated_product
از این متد برای دریافت لیست ویژگی‌های دسته‌بندی استفاده کنید.

دریافت جزئیات محصول

async def get_product_example():
    product = await client.get_product(
        product_id=24835037,
        prefer="return=minimal"
    )
 
    return product
دریافت لیست محصولات

from basalam_sdk.core.models import GetProductsQuerySchema
 
 
async def get_products_example():
    products = await client.get_products(
        query_params=GetProductsQuerySchema(
            page=1,
            per_page=20,
            sort="price:asc"
        )
    )
 
    return products
ایجاد درخواست به‌روزرسانی دسته‌ای محصولات

from basalam_sdk.core.models import (
    BulkProductsUpdateRequestSchema,
    ProductFilterSchema,
    BulkActionItem,
    RangeFilterItem,
    ProductBulkActionTypeEnum,
    ProductBulkFieldInputEnum
)
 
 
async def create_products_bulk_action_request_example():
    bulk_request = await client.core.create_products_bulk_action_request(
        vendor_id=456,
        request=BulkProductsUpdateRequestSchema(
            product_filter=ProductFilterSchema(
                stock=RangeFilterItem(
                    start=1,
                    end=5
                )
            ),
            action=[
                BulkActionItem(
                    field=ProductBulkFieldInputEnum.STOCK,
                    action=ProductBulkActionTypeEnum.SET,
                    value=50
                )
            ]
        )
    )
 
    return bulk_request
به‌روزرسانی تنوع محصول

from basalam_sdk.core.models import UpdateProductVariationSchema
 
 
async def update_product_variation_example():
    updated_variation = await client.update_product_variation(
        product_id=789,
        variation_id=6639697,
        request=UpdateProductVariationSchema(
            primary_price=150000,
            stock=100
        )
    )
 
    return updated_variation
دریافت وضعیت به‌روزرسانی دسته‌ای

async def get_products_bulk_action_requests_example():
    bulk_requests = await client.get_products_bulk_action_requests(
        vendor_id=456,
        page=1,
        per_page=30
    )
 
    return bulk_requests
دریافت تعداد به‌روزرسانی‌های دسته‌ای

async def get_products_bulk_action_requests_count_example():
    counts = await client.get_products_bulk_action_requests_count(
        vendor_id=456
    )
 
    return counts
دریافت درخواست‌های عمل انبوه ناموفق محصولات

async def get_products_unsuccessful_bulk_action_requests_example():
    unsuccessful_products = await client.get_products_unsuccessful_bulk_action_requests(
        request_id=123
    )
 
    return unsuccessful_products
دریافت قفسه‌های محصول

async def get_product_shelves_example():
    shelves = await client.get_product_shelves(
        product_id=789
    )
 
    return shelves
ایجاد تخفیف

from basalam_sdk.core.models import CreateDiscountRequestSchema, DiscountProductFilterSchema
 
 
async def create_discount_example():
    discount = await client.create_discount(
        vendor_id=456,
        request=CreateDiscountRequestSchema(
            product_filter=DiscountProductFilterSchema(
                product_ids=[25010883, 24835037],
            ),
            discount_percent=20,
            active_days=5
        )
    )
 
    return discount
حذف تخفیف

from basalam_sdk.core.models import DeleteDiscountRequestSchema, DiscountProductFilterSchema
 
 
async def delete_discount_example():
    result = await client.create_discount(
        vendor_id=456,
        request=DeleteDiscountRequestSchema(
            product_filter=DiscountProductFilterSchema(
                product_ids=[25010883],
            )
        )
    )
 
    return result
دریافت اطلاعات کاربر جاری

async def get_current_user_example():
    user = await client.get_current_user()
 
    return user
ایجاد درخواست تایید موبایل کاربر

async def create_user_mobile_confirmation_request_example():
    result = await client.create_user_mobile_confirmation_request(
        user_id=123
    )
 
    return result
تایید درخواست تایید موبایل کاربر

from basalam_sdk.core.models import ConfirmCurrentUserMobileConfirmSchema
 
 
async def verify_user_mobile_confirmation_request_example():
    result = await client.verify_user_mobile_confirmation_request(
        user_id=123,
        request=ConfirmCurrentUserMobileConfirmSchema(
            verification_code=123456
        )
    )
 
    return result
ایجاد درخواست تغییر موبایل کاربر

from basalam_sdk.core.models import ChangeUserMobileRequestSchema
 
 
async def create_user_mobile_change_request_example():
    result = await client.create_user_mobile_change_request(
        user_id=123,
        request=ChangeUserMobileRequestSchema(
            mobile="09123456789"
        )
    )
 
    return result
تایید درخواست تغییر موبایل کاربر

from basalam_sdk.core.models import ChangeUserMobileConfirmSchema
 
 
async def verify_user_mobile_change_request_example():
    result = await client.verify_user_mobile_change_request(
        user_id=123,
        request=ChangeUserMobileConfirmSchema(
            mobile="09123456789",
            verification_code=123456
        )
    )
 
    return result
دریافت حساب‌های بانکی کاربر

async def get_user_bank_accounts_example():
    bank_accounts = await client.get_user_bank_accounts(
        user_id=123
    )
 
    return bank_accounts
ایجاد حساب بانکی کاربر

from basalam_sdk.core.models import UserCardsSchema
 
 
async def create_user_bank_account_example():
    bank_account = await client.create_user_bank_account(
        user_id=123,
        request=UserCardsSchema(
            card_number="1234567890123456"
        )
    )
 
    return bank_account
رمز یک‌بار مصرف تأیید حساب بانکی کاربر

from basalam_sdk.core.models import UserCardsOtpSchema
 
 
async def verify_user_bank_account_otp_example():
    result = await client.verify_user_bank_account_otp(
        user_id=123,
        request=UserCardsOtpSchema(
            card_number="1234567890123456",
            otp_code="123456"
        )
    )
 
    return result
تایید حساب بانکی کاربر
bank_information_id در خروجی متد verify_user_bank_account_otp قرار دارد و باید به متد verify_user_bank_account ارسال شود تا اطلاعات بانکی جدید که به‌تازگی اضافه شده است، تأیید گردد.


from basalam_sdk.core.models import UserVerifyBankInformationSchema
 
 
async def verify_user_bank_account_example():
    result = await client.verify_user_bank_account(
        user_id=123,
        request=UserVerifyBankInformationSchema(
            bank_information_id=1,
            national_code="1234567890",
            birthday="1990-01-01"
        )
    )
 
    return result
حذف حساب بانکی کاربر

async def delete_user_bank_account_example():
    result = await client.delete_user_bank_account(
        user_id=123,
        bank_account_id=1
    )
 
    return result
به‌روزرسانی حساب بانکی کاربر

from basalam_sdk.core.models import UpdateUserBankInformationSchema
 
 
async def update_user_bank_account_example():
    result = await client.update_user_bank_account(
        bank_account_id=1,
        request=UpdateUserBankInformationSchema(
            user_id=123
        )
    )
 
    return result
به‌روزرسانی تایید کاربر

from basalam_sdk.core.models import UserVerificationSchema
 
 
async def update_user_verification_example():
    user = await client.update_user_verification(
        user_id=123,
        request=UserVerificationSchema(
            national_code="1234567890",
            birthday="1990-01-01"
        )
    )
 
    return user
دریافت ویژگی‌های یک دسته‌بندی

async def get_category_attributes_example():
    attributes = await client.get_category_attributes(
        category_id=1066
    )
 
    return attributes
دریافت دسته‌بندی‌ها

async def get_categories_example():
    categories = await client.get_categories()
 
    return categories
دریافت جزئیات یک دسته‌بندی

async def get_category_example():
    category = await client.get_category(
        category_id=1066
    )
 
    return category
ایجاد قفسه

from basalam_sdk.core.models import ShelveSchema
 
 
async def create_shelve_example():
    shelve = await client.core.create_shelve(
        request=ShelveSchema(
            title="مجموعه تابستانه",
            description="محصولات برای فصل تابستان"
        )
    )
 
    return shelve
به‌روزرسانی قفسه

from basalam_sdk.core.models import ShelveSchema
 
 
async def update_shelve_example():
    shelve = await client.core.update_shelve(
        shelve_id=123,
        request=ShelveSchema(
            title="مجموعه تابستانه به‌روزرسانی‌شده",
            description="توضیحات به‌روزرسانی‌شده برای محصولات تابستانی"
        )
    )
 
    return shelve
حذف قفسه

async def delete_shelve_example():
    result = await client.core.delete_shelve(
        shelve_id=123
    )
 
    return result
دریافت محصولات قفسه

async def get_shelve_products_example():
    # دریافت تمام محصولات در یک قفسه
    products = await client.core.get_shelve_products(
        shelve_id=123
    )
 
    return products
به‌روزرسانی محصولات قفسه

from basalam_sdk.core.models import UpdateShelveProductsSchema
 
 
async def update_shelve_products_example():
    # اضافه کردن محصولات به قفسه
    result = await client.core.update_shelve_products(
        shelve_id=123,
        request=UpdateShelveProductsSchema(
            include_products=[456, 789, 101112],  # شناسه محصولات برای اضافه کردن
            exclude_products=[]
        )
    )
 
    # حذف محصولات از قفسه
    result = await client.core.update_shelve_products(
        shelve_id=123,
        request=UpdateShelveProductsSchema(
            include_products=[],
            exclude_products=[456, 789]  # شناسه محصولات برای حذف
        )
    )
 
    return result
حذف محصول از قفسه

async def delete_shelve_product_example():
    result = await client.core.delete_shelve_product(
        shelve_id=123,
        product_id=456
    )
 
    return result


سرویس سفارش
مدیریت سبدهای خرید، پرداخت‌ها و فاکتورها با سرویس سفارش. این سرویس عملکرد جامعی برای مدیریت عملیات‌های مرتبط با سفارش و پردازش پرداخت ارائه می‌دهد: مدیریت سبدهای خرید، مدیریت callback‌های پرداخت و تأیید، ردیابی وضعیت تنوع محصول، و مدیریت فاکتورهای قابل پرداخت و پرداخت‌نشده.

فهرست مطالب
متدهای سرویس سفارش
مثال‌ها
متدهای سفارش
متد	توضیحات	پارامترها
get_baskets()	دریافت سبدهای خرید فعال	refresh
get_product_variation_status()	دریافت وضعیت تنوع محصول	product_id
get_payable_invoices()	دریافت فاکتورهای قابل پرداخت	page, per_page
get_unpaid_invoices()	دریافت فاکتورهای پرداخت‌نشده	invoice_id, status, page, per_page, sort
مثال‌ها
پیکربندی اولیه

from basalam_sdk import BasalamClient, PersonalToken
 
auth = PersonalToken(
    token="your_access_token",
    refresh_token="your_refresh_token"
)
client = BasalamClient(auth=auth)
دریافت سبدهای خرید

async def get_baskets_example():
    baskets = await client.get_baskets()
 
    return baskets
دریافت وضعیت تنوع محصول

async def get_product_variation_status_example():
    status = await client.get_product_variation_status(
        product_id=123456
    )
    
    return status
دریافت فاکتورهای قابل پرداخت

async def get_payable_invoices_example():
    invoices = await client.get_payable_invoices(
        page=1,
        per_page=20
    )
    
    return invoices
دریافت فاکتورهای پرداخت‌نشده

from basalam_sdk.order.models import UnpaidInvoiceStatusEnum
 
async def get_unpaid_invoices_example():
    invoices = await client.get_unpaid_invoices(
        invoice_id=123456,
        status=UnpaidInvoiceStatusEnum.UNPAID,
        page=1,
        per_page=20,
        sort=OrderEnum.DESC
    )
    
    return invoices

    سرویس وب‌هوک
با استفاده از سرویس وب‌هوک، امکان دریافت اعلان‌های لحظه‌ای از رخدادهای مرتبط با حساب باسلام خود را خواهید داشت. ایجاد و مدیریت اشتراک‌های وب‌هوک، مدیریت انواع مختلف رخدادها، نظارت بر لاگ‌ها و وضعیت تحویل وب‌هوک و ایجاد و حذف کلاینت‌ها در وب‌هوک.

فهرست مطالب
متد‌های وب‌هوک
مثال‌ها
متد‌های وب‌هوک
متد	توضیحات	پارامترها
get_webhook_services()	دریافت سرویس‌های وب‌هوک	None
create_webhook_service()	ایجاد یک سرویس وب‌هوک جدید	request
get_webhooks()	دریافت لیست وب‌هوک‌ها	service_id، event_ids
create_webhook()	ایجاد یک وب‌هوک جدید	request
update_webhook()	به‌روزرسانی یک وب‌هوک	webhook_id، request
delete_webhook()	حذف یک وب‌هوک	webhook_id
get_webhook_events()	دریافت رویدادهای قابل استفاده	None
get_webhook_customers()	دریافت مشتریان متصل به وب‌هوک	page، per_page، webhook_id
get_webhook_logs()	دریافت لاگ‌های یک وب‌هوک	webhook_id
register_webhook()	ثبت مشتری در یک وب‌هوک	request
unregister_webhook()	لغو ثبت مشتری از یک وب‌هوک	request
get_registered_webhooks()	دریافت وب‌هوک‌هایی که مشتری در آن‌ها ثبت شده است	page، per_page، service_id
مثال‌ها
پیکربندی اولیه

from basalam_sdk import BasalamClient, PersonalToken
 
auth = PersonalToken(
    token="your_access_token",
    refresh_token="your_refresh_token"
)
client = BasalamClient(auth=auth)
دریافت سرویس‌های وب‌هوک

async def get_webhook_services_example():
    services = await client.get_webhook_services()
    
    return services
ایجاد سرویس وب‌هوک

from basalam_sdk.webhook.models import CreateServiceRequest
 
async def create_webhook_service_example():
    service = await client.create_webhook_service(
        request=CreateServiceRequest(
            title="My Webhook Service",
            description="Service for handling order notifications"
        )
    )
    
    return service
دریافت وب‌هوک‌ها

async def get_webhooks_example():
    webhooks = await client.get_webhooks(
        service_id=1,
        event_ids="1,2,3"
    )
    
    return webhooks
ایجاد وب‌هوک

from basalam_sdk.webhook.models import CreateWebhookRequest
 
async def create_webhook_example():
    webhook = await client.create_webhook(
        request=CreateWebhookRequest(
            service_id=1,
            event_ids=[1, 2],
            request_headers="Content-Type: application/json",
            request_method=RequestMethodType.POST,  # Enum: POST, PUT, PATCH
            url="https://your-app.com/webhook",
            is_active=True
        )
    )
 
    return webhook
به‌روزرسانی وب‌هوک

from basalam_sdk.webhook.models import UpdateWebhookRequest
 
async def update_webhook_example():
    updated_webhook = await client.update_webhook(
        webhook_id=123,
        request=UpdateWebhookRequest(
            event_ids=[1, 2, 3],
            request_headers="Content-Type: application/json",
            request_method=RequestMethodType.POST,
            url="https://your-app.com/webhook",
            is_active=False
        )
    )
 
    return updated_webhook
حذف وب‌هوک

async def delete_webhook_example():
    result = await client.delete_webhook(webhook_id=123)
    
    return result
دریافت رخدادهای وب‌هوک

async def get_webhook_events_example():
    events = await client.get_webhook_events()
    
    return events
نمونه پاسخ


EventListResource(
  data=[
    EventResource(
      id=1, 
      name='CHAT_RECEIVED_MESSAGE', 
      description='پیام دریافتی گفتگوی باسلام', 
      sample_data={
        'id': 0,
        'chat_id': 0, 
        'message': {
          'text': 'string',
          'files': [
            {'id': 0, 'url': 'string', 'width': 0, 'height': 0}
          ],
          'links': {},
          'entity_id': 0
        }, 
        'seen_at': None, 
        'sender_id': 0, 
        'created_at': 'string', 
        'updated_at': 'string', 
        'message_type': MessageTypeEnum.TEXT, 
        'message_source': None
      }, 
        scopes='customer.chat.read'
      )
    ], 
  result_count=9, 
  total_count=None, 
  total_page=None, 
  page=1, 
  per_page=10
)
برای مطالعه دسترسی موردنیاز برای هر نوع رخداد به این سند مراجعه کنید.

دریافت مشتریان وب‌هوک

async def get_webhook_customers_example():
    customers = await client.get_webhook_customers(
        page=1,
        per_page=10,
        webhook_id=123
    )
    
    return customers
دریافت لاگ‌های وب‌هوک

async def get_webhook_logs_example():
    logs = await client.get_webhook_logs(webhook_id=123)
    
    return logs
عضویت کاربر در وب‌هوک

from basalam_sdk.webhook.models import RegisterClientRequest
 
async def register_webhook_example():
    result = await client.register_webhook(
        request=RegisterClientRequest(
            webhook_id=123
        )
    )
 
    return result
لغو عضویت کاربر از وب‌هوک

from basalam_sdk.webhook.models import UnRegisterClientRequest
 
async def unregister_webhook_example():
    result = await client.unregister_webhook(
        request=UnRegisterClientRequest(
            webhook_id=123,
            customer_id=456
        )
    )
    
    return result
دریافت وب‌هوک‌های عضوشده

async def get_registered_webhooks_example():
    webhooks = await client.get_registered_webhooks(
        page=1,
        per_page=10,
        service_id=1
    )
    
    return webhooks



Create Product
post
https://core.basalam.com/v3/vendors/{vendor_id}/products
Request
Path Parameters
vendor_id
integer
required
Body

application/json

application/json
name
string
required
photo
PhotoPhoto

any of: Photo
photos
array[integer]Photos

any of: array[integer]
video
VideoVideo

any of: Video
brief
BriefBrief

any of: Brief
description
DescriptionDescription

any of: Description
order
OrderOrder

any of: Order
category_id
integer
required
status
integer
required
وضعیت محصول. مقادیر مجاز: 2976 = منتشر شده, 3790 = منتشر نشده, 4184 = غیرقانونی, 3568 = در انتظار تأیید

preparation_days
integer
required
keywords
array[string]Keywords

any of: array[string]
weight
WeightWeight

any of: Weight
package_weight
integer
required
price
PricePrice

any of: Price
stock
StockStock

any of: Stock
shipping_city_ids
array[integer]Shipping City Ids

any of: array[integer]
shipping_method_ids
array[integer]Shipping Method Ids

any of: array[integer]
wholesale_prices
array[WholePrice]Wholesale Prices

any of: array[WholePrice]
price
integer
required
> 9999
< 10000000000
min_quantity
integer
required
> 1
product_attribute
array[ProductAttributes]Product Attribute

any of: array[ProductAttributes]
attribute_id
integer
required
value
ValueValue

any of: Value
selected_values
array[integer]Selected Values

any of: array[integer]
virtual
VirtualVirtual

any of: Virtual
variants
array[ProductVariants]Variants

any of: array[ProductVariants]
price
integer
required
stock
integer
required
sku
SkuSku

any of: Sku
properties
array[PropertyVariant]
required
shipping_data
ProductShippingDatanull

any of: ProductShippingData
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
unit_type
Unit TypeUnit Type

any of: Unit Type
واحد اندازه‌گیری محصول. مقادیر مجاز: 6375=مترمربع, 6374=میلی‌متر, 6373=جلد, 6332=فوت, 6331=اینچ, 6330=سیر, 6329=اصله, 6328=کلاف, 6327=قالب, 6326=شاخه, 6325=بوته, 6324=دست, 6323=بطری, 6322=تخته, 6321=کارتن, 6320=توپ, 6319=بسته, 6318=جفت, 6317=جین, 6316=طاقه, 6315=قواره, 6314=انس, 6313=سی‌سی, 6312=میلی‌لیتر, 6311=لیتر, 6310=تکه (اسلایس), 6309=مثقال, 6308=سانتی‌متر, 6307=متر, 6306=گرم, 6305=کیلو‌گرم, 6304=عددی, 6392=رول, 6438=سوت, 6466=قیراط

sku
SkuSku

any of: Sku
packaging_dimensions
ProductDimensionsSchemanull

any of: ProductDimensionsSchema
height
integer
required
length
integer
required
width
integer
required
is_wholesale
boolean
Responses
201
404
422
Successful Response

Body

application/json

application/json
responses
/
201
id
integer
required
title
string
required
price
PricePrice

any of: Price
required
photo
PhotoResponsenull

any of: PhotoResponse
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
photos
array[PhotoResponse]Photos

any of: array[PhotoResponse]
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
video
VideoResponsenull

any of: VideoResponse
required
id
integer
required
url
string
required
original
OriginalOriginal

any of: Original
required
thumbnail
ThumbnailThumbnail

any of: Thumbnail
required
hls
HlsHls

any of: Hls
required
width
WidthWidth

any of: Width
required
height
HeightHeight

any of: Height
required
duration
DurationDuration

any of: Duration
required
status
EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
vendor
PublicVendorResponse
required
id
integer
required
identifier
string
required
title
string
required
logo
PhotoResponsenull

any of: PhotoResponse
required
covers
array[PhotoResponse]Covers

any of: array[PhotoResponse]
required
available_cities
array[CityResponse]Available Cities

any of: array[CityResponse]
required
summary
SummarySummary

any of: Summary
required
status
EnumResponse
required
city
CityResponse
required
category_type
array[anyOf]Category Type

any of: array[anyOf]
required
user
PublicUserResponse
required
is_active
boolean
required
notice
NoticeNotice

any of: Notice
required
gallery
array[PhotoResponse]Gallery

any of: array[PhotoResponse]
required
product_count
Product CountProduct Count

any of: Product Count
free_shipping_to_iran
Free Shipping To IranFree Shipping To Iran

any of: Free Shipping To Iran
required
free_shipping_to_same_city
Free Shipping To Same CityFree Shipping To Same City

any of: Free Shipping To Same City
required
about_your_life
About Your LifeAbout Your Life

any of: About Your Life
required
about_your_place
About Your PlaceAbout Your Place

any of: About Your Place
required
worth_buy
Worth BuyWorth Buy

any of: Worth Buy
required
telegram_id
Telegram IdTelegram Id

any of: Telegram Id
telegram_channel
Telegram ChannelTelegram Channel

any of: Telegram Channel
instagram
InstagramInstagram

any of: Instagram
eitaa
EitaaEitaa

any of: Eitaa
order_count
Order CountOrder Count

any of: Order Count
last_activity
Last ActivityLast Activity

any of: Last Activity
created_at
string
required
elapsed_time_from_creation
Elapsed Time From CreationElapsed Time From Creation

any of: Elapsed Time From Creation
score
ScoreScore

any of: Score
video
VideoResponsenull

any of: VideoResponse
required
shipping_methods
array[EnumResponse]Shipping Methods

any of: array[EnumResponse]
required
product_sort_type
EnumResponsenull

any of: EnumResponse
required
home_tab_settings
array[VendorSettingResponse]Home Tab Settings

any of: array[VendorSettingResponse]
required
shipping_version
Shipping VersionShipping Version

any of: Shipping Version
pro_enabled
Pro EnabledPro Enabled

any of: Pro Enabled
summary
SummarySummary

any of: Summary
required
category
CategoryResponsenull

any of: CategoryResponse
required
id
integer
required
title
string
required
placeholder
PlaceholderPlaceholder

any of: Placeholder
parent
CategoryResponsenull

any of: CategoryResponse
unit_type_id
EnumResponsenull

any of: EnumResponse
category_list
array[CategoryListResponse]Category List

any of: array[CategoryListResponse]
required
id
integer
required
title
string
required
slug
string
required
inventory
integer
required
net_weight
integer
required
net_weight_decimal
Net Weight DecimalNet Weight Decimal

any of: Net Weight Decimal
required
created_at
string
required
updated_at
string
required
description
DescriptionDescription

any of: Description
required
is_saleable
boolean
required
is_showable
boolean
required
is_available
boolean
required
primary_price
Primary PricePrimary Price

any of: Primary Price
required
shipping_area
array[CityResponse]Shipping Area

any of: array[CityResponse]
required
name
string
required
value
integer
required
province
EnumResponsenull

any of: EnumResponse
packaged_weight
Packaged WeightPackaged Weight

any of: Packaged Weight
required
preparation_day
Preparation DayPreparation Day

any of: Preparation Day
required
attribute_groups
array[AttributeGroupResponse]Attribute Groups

any of: array[AttributeGroupResponse]
required
title
string
required
attributes
array[AttributeResponse]
required
is_free_shipping
boolean
required
location_deployment
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
is_product_for_revision
Is Product For RevisionIs Product For Revision

any of: Is Product For Revision
required
has_selectable_variation
Has Selectable VariationHas Selectable Variation

any of: Has Selectable Variation
required
revision
RevisionResponsenull

any of: RevisionResponse
required
rejection_reasons
array[EnumResponse]Rejection Reasons

any of: array[EnumResponse]
required
data
RevisionDataResponse
required
rejected_at
Rejected AtRejected At

any of: Rejected At
required
metadata
RevisionMetadataResponsenull

any of: RevisionMetadataResponse
view_count
View CountView Count

any of: View Count
required
can_add_to_cart
boolean
required
review_count
Review CountReview Count

any of: Review Count
required
rating
RatingRating

any of: Rating
required
sales_count
Sales CountSales Count

any of: Sales Count
required
navigation
NavigationResponsenull

any of: NavigationResponse
required
slug
string
required
title
string
required
categoryIds
array[integer]
required
parent
NavigationResponsenull

any of: NavigationResponse
variants
array[VariantResponse]Variants

any of: array[VariantResponse]
required
id
IdId

any of: Id
price
PricePrice

any of: Price
primary_price
Primary PricePrimary Price

any of: Primary Price
stock
integer
required
order
OrderOrder

any of: Order
properties
array[VariantPropertiesResponse]
required
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
variants_selected_index
Variants Selected IndexVariants Selected Index

any of: Variants Selected Index
required
shipping_data
ShippingDataResponsenull

any of: ShippingDataResponse
required
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
free_shipping
FreeShippingResponsenull

any of: FreeShippingResponse
required
result
boolean
required
meta_data
Meta DataMeta Data

any of: Meta Data
required
allow_category_change
Allow Category ChangeAllow Category Change

any of: Allow Category Change
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
required
unit_type
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
packaging_dimensions
ProductDimensionResponsenull

any of: ProductDimensionResponse
height
integer
required
width
integer
required
length
integer
required
is_wholesale
Is WholesaleIs Wholesale

any of: Is Wholesale
attributes
array[NewAttributeResponse]Attributes

any of: array[NewAttributeResponse]
id
IdId

any of: Id
key
string
required
value
string



  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}


curl --request POST \
  --url https://core.basalam.com/v3/vendors/{vendor_id}/products \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}'


Read Product
get
https://core.basalam.com/v3/products/{product_id}
Request
Path Parameters
product_id
integer
required
Headers
prefer
stringnull

any of: string
Default:
return=minimal
Responses
200
404
422
Successful Response

Body

application/json

application/json
responses
/
200
/
packaging_dimensions
id
integer
required
title
string
required
price
PricePrice

any of: Price
required
photo
PhotoResponsenull

any of: PhotoResponse
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
photos
array[PhotoResponse]Photos

any of: array[PhotoResponse]
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
video
VideoResponsenull

any of: VideoResponse
required
id
integer
required
url
string
required
original
OriginalOriginal

any of: Original
required
thumbnail
ThumbnailThumbnail

any of: Thumbnail
required
hls
HlsHls

any of: Hls
required
width
WidthWidth

any of: Width
required
height
HeightHeight

any of: Height
required
duration
DurationDuration

any of: Duration
required
status
EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
vendor
PublicVendorResponse
required
id
integer
required
identifier
string
required
title
string
required
logo
PhotoResponsenull

any of: PhotoResponse
required
covers
array[PhotoResponse]Covers

any of: array[PhotoResponse]
required
available_cities
array[CityResponse]Available Cities

any of: array[CityResponse]
required
summary
SummarySummary

any of: Summary
required
status
EnumResponse
required
city
CityResponse
required
category_type
array[anyOf]Category Type

any of: array[anyOf]
required
user
PublicUserResponse
required
is_active
boolean
required
notice
NoticeNotice

any of: Notice
required
gallery
array[PhotoResponse]Gallery

any of: array[PhotoResponse]
required
product_count
Product CountProduct Count

any of: Product Count
free_shipping_to_iran
Free Shipping To IranFree Shipping To Iran

any of: Free Shipping To Iran
required
free_shipping_to_same_city
Free Shipping To Same CityFree Shipping To Same City

any of: Free Shipping To Same City
required
about_your_life
About Your LifeAbout Your Life

any of: About Your Life
required
about_your_place
About Your PlaceAbout Your Place

any of: About Your Place
required
worth_buy
Worth BuyWorth Buy

any of: Worth Buy
required
telegram_id
Telegram IdTelegram Id

any of: Telegram Id
telegram_channel
Telegram ChannelTelegram Channel

any of: Telegram Channel
instagram
InstagramInstagram

any of: Instagram
eitaa
EitaaEitaa

any of: Eitaa
order_count
Order CountOrder Count

any of: Order Count
last_activity
Last ActivityLast Activity

any of: Last Activity
created_at
string
required
elapsed_time_from_creation
Elapsed Time From CreationElapsed Time From Creation

any of: Elapsed Time From Creation
score
ScoreScore

any of: Score
video
VideoResponsenull

any of: VideoResponse
required
shipping_methods
array[EnumResponse]Shipping Methods

any of: array[EnumResponse]
required
product_sort_type
EnumResponsenull

any of: EnumResponse
required
home_tab_settings
array[VendorSettingResponse]Home Tab Settings

any of: array[VendorSettingResponse]
required
shipping_version
Shipping VersionShipping Version

any of: Shipping Version
pro_enabled
Pro EnabledPro Enabled

any of: Pro Enabled
summary
SummarySummary

any of: Summary
required
category
CategoryResponsenull

any of: CategoryResponse
required
id
integer
required
title
string
required
placeholder
PlaceholderPlaceholder

any of: Placeholder
parent
CategoryResponsenull

any of: CategoryResponse
unit_type_id
EnumResponsenull

any of: EnumResponse
category_list
array[CategoryListResponse]Category List

any of: array[CategoryListResponse]
required
id
integer
required
title
string
required
slug
string
required
inventory
integer
required
net_weight
integer
required
net_weight_decimal
Net Weight DecimalNet Weight Decimal

any of: Net Weight Decimal
required
created_at
string
required
updated_at
string
required
description
DescriptionDescription

any of: Description
required
is_saleable
boolean
required
is_showable
boolean
required
is_available
boolean
required
primary_price
Primary PricePrimary Price

any of: Primary Price
required
shipping_area
array[CityResponse]Shipping Area

any of: array[CityResponse]
required
name
string
required
value
integer
required
province
EnumResponsenull

any of: EnumResponse
packaged_weight
Packaged WeightPackaged Weight

any of: Packaged Weight
required
preparation_day
Preparation DayPreparation Day

any of: Preparation Day
required
attribute_groups
array[AttributeGroupResponse]Attribute Groups

any of: array[AttributeGroupResponse]
required
title
string
required
attributes
array[AttributeResponse]
required
is_free_shipping
boolean
required
location_deployment
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
is_product_for_revision
Is Product For RevisionIs Product For Revision

any of: Is Product For Revision
required
has_selectable_variation
Has Selectable VariationHas Selectable Variation

any of: Has Selectable Variation
required
revision
RevisionResponsenull

any of: RevisionResponse
required
rejection_reasons
array[EnumResponse]Rejection Reasons

any of: array[EnumResponse]
required
data
RevisionDataResponse
required
rejected_at
Rejected AtRejected At

any of: Rejected At
required
metadata
RevisionMetadataResponsenull

any of: RevisionMetadataResponse
view_count
View CountView Count

any of: View Count
required
can_add_to_cart
boolean
required
review_count
Review CountReview Count

any of: Review Count
required
rating
RatingRating

any of: Rating
required
sales_count
Sales CountSales Count

any of: Sales Count
required
navigation
NavigationResponsenull

any of: NavigationResponse
required
slug
string
required
title
string
required
categoryIds
array[integer]
required
parent
NavigationResponsenull

any of: NavigationResponse
variants
array[VariantResponse]Variants

any of: array[VariantResponse]
required
id
IdId

any of: Id
price
PricePrice

any of: Price
primary_price
Primary PricePrimary Price

any of: Primary Price
stock
integer
required
order
OrderOrder

any of: Order
properties
array[VariantPropertiesResponse]
required
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
variants_selected_index
Variants Selected IndexVariants Selected Index

any of: Variants Selected Index
required
shipping_data
ShippingDataResponsenull

any of: ShippingDataResponse
required
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
free_shipping
FreeShippingResponsenull

any of: FreeShippingResponse
required
result
boolean
required
meta_data
Meta DataMeta Data

any of: Meta Data
required
allow_category_change
Allow Category ChangeAllow Category Change

any of: Allow Category Change
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
required
unit_type
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
packaging_dimensions
ProductDimensionResponsenull

any of: ProductDimensionResponse
height
integer
required
width
integer
required
length
integer
required
is_wholesale
Is WholesaleIs Wholesale

any of: Is Wholesale
attributes
array[NewAttributeResponse]Attributes

any of: array[NewAttributeResponse]
id
IdId

any of: Id
key
string
required
value
string


Read Products List
get
https://core.basalam.com/v3/products
Request
Query Parameters
category_id
integernull

any of: integer
created_at
stringnull

any of: string
ids
arraynull

any of: array
page
integernull

any of: integer
Default:
1
per_page
integernull

any of: integer
Default:
10
price
stringnull

any of: string
product_title
stringnull

any of: string
sort
stringnull

any of: string
Default:
id:desc
status
integernull

any of: integer
vendor_ids
arraynull

any of: array
vendor_mobile
stringnull

any of: string
vendor_title
stringnull

any of: string
Headers
prefer
stringnull

any of: string
Default:
return=minimal
Responses
200
404
422
Successful Response

Body

application/json

application/json
responses
/
200
/
data
.
0[]
.
is_set_for_reminder
PublicProductListResponse
(any of)
data
array[PublicProductListItemResponse]null

any of: array[PublicProductListItemResponse]
required
id
integer
required
title
string
required
price
integer
required
photo
PhotoResponsenull

any of: PhotoResponse
required
photos
array[PhotoResponse]Photos

any of: array[PhotoResponse]
required
video
VideoResponsenull

any of: VideoResponse
required
status
EnumResponse
required
vendor
PublicVendorResponse
required
summary
SummarySummary

any of: Summary
required
category
CategoryResponsenull

any of: CategoryResponse
required
inventory
integer
required
net_weight
integer
required
created_at
Created AtCreated At

any of: Created At
required
updated_at
Updated AtUpdated At

any of: Updated At
required
description
DescriptionDescription

any of: Description
required
primary_price
Primary PricePrimary Price

any of: Primary Price
required
packaged_weight
Packaged WeightPackaged Weight

any of: Packaged Weight
required
preparation_day
Preparation DayPreparation Day

any of: Preparation Day
required
net_weight_decimal
Net Weight DecimalNet Weight Decimal

any of: Net Weight Decimal
required
location_deployment
EnumResponsenull

any of: EnumResponse
required
url
UrlUrl

any of: Url
required
published
PublishedPublished

any of: Published
required
review_count
Review CountReview Count

any of: Review Count
required
rating
RatingRating

any of: Rating
required
sales_count
Sales CountSales Count

any of: Sales Count
required
view_count
View CountView Count

any of: View Count
required
can_add_to_cart
boolean
required
has_variation
boolean
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
required
unit_type
EnumResponsenull

any of: EnumResponse
required
discount
DiscountDiscount

any of: Discount
is_set_for_reminder
Is Set For ReminderIs Set For Reminder

any of: Is Set For Reminder
sku
SkuSku

any of: Sku
total_count
Total CountTotal Count

any of: Total Count
result_count
integer
required
total_page
Total PageTotal Page

any of: Total Page
page
PagePage

any of: Page
per_page
Per PagePer Page

any of: Per Page

category_id
:
created_at
:
ids
:
page
:
defaults to: 1
per_page
:
defaults to: 10
price
:
product_title
:
sort
:
defaults to: id:desc
status
:
vendor_ids
:
vendor_mobile
:
vendor_title
:
prefer
:
defaults to: return=minimal
Send API Request


curl --request GET \
  --url https://core.basalam.com/v3/products \
  --header 'Accept: application/json' \
  --header 'prefer: '
{
  "data": [
    {
      "id": 0,
      "title": "string",
      "price": 0,
      "photo": {
        "id": 0,
        "original": "string",
        "xs": "string",
        "sm": "string",
        "md": "string",
        "lg": "string"
      },
      "photos": [
        {
          "id": 0,
          "original": "string",
          "xs": "string",
          "sm": "string",
          "md": "string",
          "lg": "string"
        }
      ],
      "video": {
        "id": 0,
        "url": "string",
        "original": "string",
        "thumbnail": "string",
        "hls": "string",
        "width": 0,
        "height": 0,
        "duration": 0
      },
      "status": {
        "name": "string",
        "value": 0,
        "description": "string"
      },
      "vendor": {
        "id": 0,
        "identifier": "string",
        "title": "string",
        "logo": {
          "id": 0,
          "original": "string",
          "xs": "string",
          "sm": "string",
          "md": "string",
          "lg": "string"
        },
        "covers": [
          {
            "id": 0,
            "original": "string",
            "xs": "string",
            "sm": "string",
            "md": "string",
            "lg": "string"
          }
        ],
        "available_cities": [
          {
            "name": "string",
            "value": 0,
            "province": {
              "name": "string",
              "value": 0,
              "description": "string"
            }
          }
        ],
        "summary": "string",
        "status": {
          "name": "string",
          "value": 0,
          "description": "string"
        },
        "city": {
          "name": "string",
          "value": 0,
          "province": {
            "name": "string",
            "value": 0,
            "description": "string"
          }
        },
        "category_type": [
          {
            "name": "string",
            "value": 0,
            "description": "string"
          }
        ],
        "user": {
          "id": 0,
          "hash_id": "string",
          "username": "string",
          "name": "string",
          "avatar": {
            "id": 0,
            "original": "string",
            "xs": "string",
            "sm": "string",
            "md": "string",
            "lg": "string"
          },
          "marked_type": {
            "name": "string",
            "value": 0,
            "description": "string"
          },
          "user_follower_count": 0,
          "user_following_count": 0,
          "gender": {
            "name": "string",
            "value": 0,
            "description": "string"
          },
          "bio": "string",
          "city": {
            "name": "string",
            "value": 0,
            "province": {
              "name": "string",
              "value": 0,
              "description": "string"
            }
          },
          "created_at": "string",
          "last_activity": "string",
          "referral_journey_enum": {
            "name": "string",
            "value": 0,
            "description": "string"
          },
          "is_banned_in_social": true,
          "ban_user": {},
          "pro_enabled": true,
          "vendor": {
            "id": 0,
            "identifier": "string",
            "title": "string",
            "description": "string",
            "is_active": true,
            "free_shipping_to_iran": 0,
            "free_shipping_to_same_city": 0,
            "worth_buy": "string",
            "created_at": "string",
            "activated_at": "string",
            "order_count": 0,
            "status": 0
          }
        },
        "is_active": true,
        "notice": "string",
        "gallery": [
          {
            "id": 0,
            "original": "string",
            "xs": "string",
            "sm": "string",
            "md": "string",
            "lg": "string"
          }
        ],
        "product_count": 0,
        "free_shipping_to_iran": 0,
        "free_shipping_to_same_city": 0,
        "about_your_life": "string",
        "about_your_place": "string",
        "worth_buy": "string",
        "telegram_id": "string",
        "telegram_channel": "string",
        "instagram": "string",
        "eitaa": "string",
        "order_count": 0,
        "last_activity": "string",
        "created_at": "string",
        "elapsed_time_from_creation": "string",
        "score": 0,
        "video": {
          "id": 0,
          "url": "string",
          "original": "string",
          "thumbnail": "string",
          "hls": "string",
          "width": 0,
          "height": 0,
          "duration": 0
        },
        "shipping_methods": [
          {
            "name": "string",
            "value": 0,
            "description": "string"
          }
        ],
        "product_sort_type": {
          "name": "string",
          "value": 0,
          "description": "string"
        },
        "home_tab_settings": [
          {
            "name": "string",
            "order": 0,
            "is_active": true,
            "extra_data": {}
          }
        ],
        "shipping_version": 0,
        "pro_enabled": true
      },
      "summary": "string",
      "category": {
        "id": 0,
        "title": "string",
        "placeholder": "string",
        "parent": {},
        "unit_type_id": {
          "name": "string",
          "value": 0,
          "description": "string"
        }
      },
      "inventory": 0,
      "net_weight": 0,
      "created_at": "string",
      "updated_at": "string",
      "description": "string",
      "primary_price": 0,
      "packaged_weight": 0,
      "preparation_day": 0,
      "net_weight_decimal": 0,
      "location_deployment": {
        "name": "string",
        "value": 0,
        "description": "string"
      },
      "url": "string",
      "published": true,
      "review_count": 0,
      "rating": 0,
      "sales_count": 0,
      "view_count": 0,
      "can_add_to_cart": true,
      "has_variation": true,
      "unit_quantity": 0,
      "unit_type": {
        "name": "string",
        "value": 0,
        "description": "string"
      },
      "discount": {},
      "is_set_for_reminder": true,
      "sku": "string"
    }
  ],
  "total_count": 0,
  "result_count": 0,
  "total_page": 0,
  "page": 0,
  "per_page": 0
}

Read Product Shelves
get
https://core.basalam.com/v3/products/{product_id}/shelves
Request
Path Parameters
product_id
integer
required
Responses
200
404
422
Successful Response

Body

application/json

application/json
array of:
id
integer
required
title
string
required
description
DescriptionDescription

any of: Description
required
vendor_id
integer



curl --request GET \
  --url https://core.basalam.com/v3/products/{product_id}/shelves \
  --header 'Accept: application/json'
[
  {
    "id": 0,
    "title": "string",
    "description": "string",
    "vendor_id": 0
  }
]


Create Product
post
https://core.basalam.com/v3/vendors/{vendor_id}/products
Request
Path Parameters
vendor_id
integer
required
Body

application/json

application/json
name
string
required
photo
PhotoPhoto

any of: Photo
photos
array[integer]Photos

any of: array[integer]
video
VideoVideo

any of: Video
brief
BriefBrief

any of: Brief
description
DescriptionDescription

any of: Description
order
OrderOrder

any of: Order
category_id
integer
required
status
integer
required
وضعیت محصول. مقادیر مجاز: 2976 = منتشر شده, 3790 = منتشر نشده, 4184 = غیرقانونی, 3568 = در انتظار تأیید

preparation_days
integer
required
keywords
array[string]Keywords

any of: array[string]
weight
WeightWeight

any of: Weight
package_weight
integer
required
price
PricePrice

any of: Price
stock
StockStock

any of: Stock
shipping_city_ids
array[integer]Shipping City Ids

any of: array[integer]
shipping_method_ids
array[integer]Shipping Method Ids

any of: array[integer]
wholesale_prices
array[WholePrice]Wholesale Prices

any of: array[WholePrice]
price
integer
required
> 9999
< 10000000000
min_quantity
integer
required
> 1
product_attribute
array[ProductAttributes]Product Attribute

any of: array[ProductAttributes]
attribute_id
integer
required
value
ValueValue

any of: Value
selected_values
array[integer]Selected Values

any of: array[integer]
virtual
VirtualVirtual

any of: Virtual
variants
array[ProductVariants]Variants

any of: array[ProductVariants]
price
integer
required
stock
integer
required
sku
SkuSku

any of: Sku
properties
array[PropertyVariant]
required
shipping_data
ProductShippingDatanull

any of: ProductShippingData
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
unit_type
Unit TypeUnit Type

any of: Unit Type
واحد اندازه‌گیری محصول. مقادیر مجاز: 6375=مترمربع, 6374=میلی‌متر, 6373=جلد, 6332=فوت, 6331=اینچ, 6330=سیر, 6329=اصله, 6328=کلاف, 6327=قالب, 6326=شاخه, 6325=بوته, 6324=دست, 6323=بطری, 6322=تخته, 6321=کارتن, 6320=توپ, 6319=بسته, 6318=جفت, 6317=جین, 6316=طاقه, 6315=قواره, 6314=انس, 6313=سی‌سی, 6312=میلی‌لیتر, 6311=لیتر, 6310=تکه (اسلایس), 6309=مثقال, 6308=سانتی‌متر, 6307=متر, 6306=گرم, 6305=کیلو‌گرم, 6304=عددی, 6392=رول, 6438=سوت, 6466=قیراط

sku
SkuSku

any of: Sku
packaging_dimensions
ProductDimensionsSchemanull

any of: ProductDimensionsSchema
height
integer
required
length
integer
required
width
integer
required
is_wholesale
boolean
Responses
201
404
422
Successful Response

Body

application/json

application/json
responses
/
201
/
is_wholesale
id
integer
required
title
string
required
price
PricePrice

any of: Price
required
photo
PhotoResponsenull

any of: PhotoResponse
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
photos
array[PhotoResponse]Photos

any of: array[PhotoResponse]
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
video
VideoResponsenull

any of: VideoResponse
required
id
integer
required
url
string
required
original
OriginalOriginal

any of: Original
required
thumbnail
ThumbnailThumbnail

any of: Thumbnail
required
hls
HlsHls

any of: Hls
required
width
WidthWidth

any of: Width
required
height
HeightHeight

any of: Height
required
duration
DurationDuration

any of: Duration
required
status
EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
vendor
PublicVendorResponse
required
id
integer
required
identifier
string
required
title
string
required
logo
PhotoResponsenull

any of: PhotoResponse
required
covers
array[PhotoResponse]Covers

any of: array[PhotoResponse]
required
available_cities
array[CityResponse]Available Cities

any of: array[CityResponse]
required
summary
SummarySummary

any of: Summary
required
status
EnumResponse
required
city
CityResponse
required
category_type
array[anyOf]Category Type

any of: array[anyOf]
required
user
PublicUserResponse
required
is_active
boolean
required
notice
NoticeNotice

any of: Notice
required
gallery
array[PhotoResponse]Gallery

any of: array[PhotoResponse]
required
product_count
Product CountProduct Count

any of: Product Count
free_shipping_to_iran
Free Shipping To IranFree Shipping To Iran

any of: Free Shipping To Iran
required
free_shipping_to_same_city
Free Shipping To Same CityFree Shipping To Same City

any of: Free Shipping To Same City
required
about_your_life
About Your LifeAbout Your Life

any of: About Your Life
required
about_your_place
About Your PlaceAbout Your Place

any of: About Your Place
required
worth_buy
Worth BuyWorth Buy

any of: Worth Buy
required
telegram_id
Telegram IdTelegram Id

any of: Telegram Id
telegram_channel
Telegram ChannelTelegram Channel

any of: Telegram Channel
instagram
InstagramInstagram

any of: Instagram
eitaa
EitaaEitaa

any of: Eitaa
order_count
Order CountOrder Count

any of: Order Count
last_activity
Last ActivityLast Activity

any of: Last Activity
created_at
string
required
elapsed_time_from_creation
Elapsed Time From CreationElapsed Time From Creation

any of: Elapsed Time From Creation
score
ScoreScore

any of: Score
video
VideoResponsenull

any of: VideoResponse
required
shipping_methods
array[EnumResponse]Shipping Methods

any of: array[EnumResponse]
required
product_sort_type
EnumResponsenull

any of: EnumResponse
required
home_tab_settings
array[VendorSettingResponse]Home Tab Settings

any of: array[VendorSettingResponse]
required
shipping_version
Shipping VersionShipping Version

any of: Shipping Version
pro_enabled
Pro EnabledPro Enabled

any of: Pro Enabled
summary
SummarySummary

any of: Summary
required
category
CategoryResponsenull

any of: CategoryResponse
required
id
integer
required
title
string
required
placeholder
PlaceholderPlaceholder

any of: Placeholder
parent
CategoryResponsenull

any of: CategoryResponse
unit_type_id
EnumResponsenull

any of: EnumResponse
category_list
array[CategoryListResponse]Category List

any of: array[CategoryListResponse]
required
id
integer
required
title
string
required
slug
string
required
inventory
integer
required
net_weight
integer
required
net_weight_decimal
Net Weight DecimalNet Weight Decimal

any of: Net Weight Decimal
required
created_at
string
required
updated_at
string
required
description
DescriptionDescription

any of: Description
required
is_saleable
boolean
required
is_showable
boolean
required
is_available
boolean
required
primary_price
Primary PricePrimary Price

any of: Primary Price
required
shipping_area
array[CityResponse]Shipping Area

any of: array[CityResponse]
required
name
string
required
value
integer
required
province
EnumResponsenull

any of: EnumResponse
packaged_weight
Packaged WeightPackaged Weight

any of: Packaged Weight
required
preparation_day
Preparation DayPreparation Day

any of: Preparation Day
required
attribute_groups
array[AttributeGroupResponse]Attribute Groups

any of: array[AttributeGroupResponse]
required
title
string
required
attributes
array[AttributeResponse]
required
is_free_shipping
boolean
required
location_deployment
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
is_product_for_revision
Is Product For RevisionIs Product For Revision

any of: Is Product For Revision
required
has_selectable_variation
Has Selectable VariationHas Selectable Variation

any of: Has Selectable Variation
required
revision
RevisionResponsenull

any of: RevisionResponse
required
rejection_reasons
array[EnumResponse]Rejection Reasons

any of: array[EnumResponse]
required
data
RevisionDataResponse
required
rejected_at
Rejected AtRejected At

any of: Rejected At
required
metadata
RevisionMetadataResponsenull

any of: RevisionMetadataResponse
view_count
View CountView Count

any of: View Count
required
can_add_to_cart
boolean
required
review_count
Review CountReview Count

any of: Review Count
required
rating
RatingRating

any of: Rating
required
sales_count
Sales CountSales Count

any of: Sales Count
required
navigation
NavigationResponsenull

any of: NavigationResponse
required
slug
string
required
title
string
required
categoryIds
array[integer]
required
parent
NavigationResponsenull

any of: NavigationResponse
variants
array[VariantResponse]Variants

any of: array[VariantResponse]
required
id
IdId

any of: Id
price
PricePrice

any of: Price
primary_price
Primary PricePrimary Price

any of: Primary Price
stock
integer
required
order
OrderOrder

any of: Order
properties
array[VariantPropertiesResponse]
required
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
variants_selected_index
Variants Selected IndexVariants Selected Index

any of: Variants Selected Index
required
shipping_data
ShippingDataResponsenull

any of: ShippingDataResponse
required
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
free_shipping
FreeShippingResponsenull

any of: FreeShippingResponse
required
result
boolean
required
meta_data
Meta DataMeta Data

any of: Meta Data
required
allow_category_change
Allow Category ChangeAllow Category Change

any of: Allow Category Change
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
required
unit_type
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
packaging_dimensions
ProductDimensionResponsenull

any of: ProductDimensionResponse
height
integer
required
width
integer
required
length
integer
required
is_wholesale
Is WholesaleIs Wholesale

any of: Is Wholesale
attributes
array[NewAttributeResponse]Attributes

any of: array[NewAttributeResponse]
id
IdId

any of: Id
key
string
required
value
string



vendor_id*
:
integer
{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}
{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}
Send API Request
curl --request POST \
  --url https://core.basalam.com/v3/vendors/{vendor_id}/products \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}'


Batch Update
patch
https://core.basalam.com/v3/vendors/{vendor_id}/products
Request
Path Parameters
vendor_id
integer
required
Body

application/json

application/json
data
array[MinimalProductSchema]
required
id
integer
required
name
NameName

any of: Name
price
PricePrice

any of: Price
order
OrderOrder

any of: Order
stock
StockStock

any of: Stock
status
StatusStatus

any of: Status
preparation_days
Preparation DaysPreparation Days

any of: Preparation Days
variants
array[MinimalProductVariants]Variants

any of: array[MinimalProductVariants]
product_attribute
array[ProductAttributes]Product Attribute

any of: array[ProductAttributes]
shipping_data
ProductShippingDatanull

any of: ProductShippingData
Responses
202
404
422
Successful Response

Body

application/json

application/json
array of:
id
integer
required
is_product_for_revision
boolean
required
has_error
boolean
required
error_message
Error MessageError Message

any of: Error Message


vendor_id*
:
integer
{
  "data": [
    {
      "id": 0,
      "name": "string",
      "price": 0,
      "order": 0,
      "stock": 0,
      "status": 0,
      "preparation_days": 0,
      "variants": [
        {
          "id": 0,
          "price": 0,
          "stock": 0
        }
      ],
      "product_attribute": [
        {
          "attribute_id": 0,
          "value": "string",
          "selected_values": [
            0
          ]
        }
      ],
      "shipping_data": {
        "illegal_for_iran": true,
        "illegal_for_same_city": true
      }
    }
  ]
}
{
  "data": [
    {
      "id": 0,
      "name": "string",
      "price": 0,
      "order": 0,
      "stock": 0,
      "status": 0,
      "preparation_days": 0,
      "variants": [
        {
          "id": 0,
          "price": 0,
          "stock": 0
        }
      ],
      "product_attribute": [
        {
          "attribute_id": 0,
          "value": "string",
          "selected_values": [
            0
          ]
        }
      ],
      "shipping_data": {
        "illegal_for_iran": true,
        "illegal_for_same_city": true
      }
    }
  ]
}
Send API Request
curl --request PATCH \
  --url https://core.basalam.com/v3/vendors/{vendor_id}/products \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "data": [
    {
      "id": 0,
      "name": "string",
      "price": 0,
      "order": 0,
      "stock": 0,
      "status": 0,
      "preparation_days": 0,
      "variants": [
        {
          "id": 0,
          "price": 0,
          "stock": 0
        }
      ],
      "product_attribute": [
        {
          "attribute_id": 0,
          "value": "string",
          "selected_values": [
            0
          ]
        }
      ],
      "shipping_data": {
        "illegal_for_iran": true,
        "illegal_for_same_city": true
      }
    }
  ]
}'
[
  {
    "id": 0,
    "is_product_for_revision": true,
    "has_error": true,
    "error_message": "string"
  }
]


Patch Update Product
patch
https://core.basalam.com/v3/products/{product_id}
Request
Path Parameters
product_id
integer
required
Body

application/json

application/json
name
NameName

any of: Name
photo
PhotoPhoto

any of: Photo
photos
array[integer]Photos

any of: array[integer]
video
VideoVideo

any of: Video
brief
BriefBrief

any of: Brief
description
DescriptionDescription

any of: Description
order
OrderOrder

any of: Order
category_id
Category IdCategory Id

any of: Category Id
status
StatusStatus

any of: Status
preparation_days
Preparation DaysPreparation Days

any of: Preparation Days
keywords
array[string]Keywords

any of: array[string]
weight
WeightWeight

any of: Weight
package_weight
Package WeightPackage Weight

any of: Package Weight
price
PricePrice

any of: Price
stock
StockStock

any of: Stock
shipping_city_ids
array[integer]Shipping City Ids

any of: array[integer]
shipping_method_ids
array[integer]Shipping Method Ids

any of: array[integer]
wholesale_prices
array[WholePrice]Wholesale Prices

any of: array[WholePrice]
price
integer
required
> 9999
< 10000000000
min_quantity
integer
required
> 1
product_attribute
array[ProductAttributes]Product Attribute

any of: array[ProductAttributes]
attribute_id
integer
required
value
ValueValue

any of: Value
selected_values
array[integer]Selected Values

any of: array[integer]
virtual
VirtualVirtual

any of: Virtual
variants
array[ProductVariants]Variants

any of: array[ProductVariants]
price
integer
required
stock
integer
required
sku
SkuSku

any of: Sku
properties
array[PropertyVariant]
required
shipping_data
ProductShippingDatanull

any of: ProductShippingData
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
unit_type
Unit TypeUnit Type

any of: Unit Type
واحد اندازه‌گیری محصول. مقادیر مجاز: 6375=مترمربع, 6374=میلی‌متر, 6373=جلد, 6332=فوت, 6331=اینچ, 6330=سیر, 6329=اصله, 6328=کلاف, 6327=قالب, 6326=شاخه, 6325=بوته, 6324=دست, 6323=بطری, 6322=تخته, 6321=کارتن, 6320=توپ, 6319=بسته, 6318=جفت, 6317=جین, 6316=طاقه, 6315=قواره, 6314=انس, 6313=سی‌سی, 6312=میلی‌لیتر, 6311=لیتر, 6310=تکه (اسلایس), 6309=مثقال, 6308=سانتی‌متر, 6307=متر, 6306=گرم, 6305=کیلو‌گرم, 6304=عددی, 6392=رول, 6438=سوت, 6466=قیراط

sku
SkuSku

any of: Sku
packaging_dimensions
ProductDimensionsSchemanull

any of: ProductDimensionsSchema
height
integer
required
length
integer
required
width
integer
required
is_wholesale
boolean
Responses
200
404
422
Successful Response

Body

application/json

application/json
responses
/
200
/
unit_type
.
description
id
integer
required
title
string
required
price
PricePrice

any of: Price
required
photo
PhotoResponsenull

any of: PhotoResponse
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
photos
array[PhotoResponse]Photos

any of: array[PhotoResponse]
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
video
VideoResponsenull

any of: VideoResponse
required
id
integer
required
url
string
required
original
OriginalOriginal

any of: Original
required
thumbnail
ThumbnailThumbnail

any of: Thumbnail
required
hls
HlsHls

any of: Hls
required
width
WidthWidth

any of: Width
required
height
HeightHeight

any of: Height
required
duration
DurationDuration

any of: Duration
required
status
EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
vendor
PublicVendorResponse
required
id
integer
required
identifier
string
required
title
string
required
logo
PhotoResponsenull

any of: PhotoResponse
required
covers
array[PhotoResponse]Covers

any of: array[PhotoResponse]
required
available_cities
array[CityResponse]Available Cities

any of: array[CityResponse]
required
summary
SummarySummary

any of: Summary
required
status
EnumResponse
required
city
CityResponse
required
category_type
array[anyOf]Category Type

any of: array[anyOf]
required
user
PublicUserResponse
required
is_active
boolean
required
notice
NoticeNotice

any of: Notice
required
gallery
array[PhotoResponse]Gallery

any of: array[PhotoResponse]
required
product_count
Product CountProduct Count

any of: Product Count
free_shipping_to_iran
Free Shipping To IranFree Shipping To Iran

any of: Free Shipping To Iran
required
free_shipping_to_same_city
Free Shipping To Same CityFree Shipping To Same City

any of: Free Shipping To Same City
required
about_your_life
About Your LifeAbout Your Life

any of: About Your Life
required
about_your_place
About Your PlaceAbout Your Place

any of: About Your Place
required
worth_buy
Worth BuyWorth Buy

any of: Worth Buy
required
telegram_id
Telegram IdTelegram Id

any of: Telegram Id
telegram_channel
Telegram ChannelTelegram Channel

any of: Telegram Channel
instagram
InstagramInstagram

any of: Instagram
eitaa
EitaaEitaa

any of: Eitaa
order_count
Order CountOrder Count

any of: Order Count
last_activity
Last ActivityLast Activity

any of: Last Activity
created_at
string
required
elapsed_time_from_creation
Elapsed Time From CreationElapsed Time From Creation

any of: Elapsed Time From Creation
score
ScoreScore

any of: Score
video
VideoResponsenull

any of: VideoResponse
required
shipping_methods
array[EnumResponse]Shipping Methods

any of: array[EnumResponse]
required
product_sort_type
EnumResponsenull

any of: EnumResponse
required
home_tab_settings
array[VendorSettingResponse]Home Tab Settings

any of: array[VendorSettingResponse]
required
shipping_version
Shipping VersionShipping Version

any of: Shipping Version
pro_enabled
Pro EnabledPro Enabled

any of: Pro Enabled
summary
SummarySummary

any of: Summary
required
category
CategoryResponsenull

any of: CategoryResponse
required
id
integer
required
title
string
required
placeholder
PlaceholderPlaceholder

any of: Placeholder
parent
CategoryResponsenull

any of: CategoryResponse
unit_type_id
EnumResponsenull

any of: EnumResponse
category_list
array[CategoryListResponse]Category List

any of: array[CategoryListResponse]
required
id
integer
required
title
string
required
slug
string
required
inventory
integer
required
net_weight
integer
required
net_weight_decimal
Net Weight DecimalNet Weight Decimal

any of: Net Weight Decimal
required
created_at
string
required
updated_at
string
required
description
DescriptionDescription

any of: Description
required
is_saleable
boolean
required
is_showable
boolean
required
is_available
boolean
required
primary_price
Primary PricePrimary Price

any of: Primary Price
required
shipping_area
array[CityResponse]Shipping Area

any of: array[CityResponse]
required
name
string
required
value
integer
required
province
EnumResponsenull

any of: EnumResponse
packaged_weight
Packaged WeightPackaged Weight

any of: Packaged Weight
required
preparation_day
Preparation DayPreparation Day

any of: Preparation Day
required
attribute_groups
array[AttributeGroupResponse]Attribute Groups

any of: array[AttributeGroupResponse]
required
title
string
required
attributes
array[AttributeResponse]
required
is_free_shipping
boolean
required
location_deployment
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
is_product_for_revision
Is Product For RevisionIs Product For Revision

any of: Is Product For Revision
required
has_selectable_variation
Has Selectable VariationHas Selectable Variation

any of: Has Selectable Variation
required
revision
RevisionResponsenull

any of: RevisionResponse
required
rejection_reasons
array[EnumResponse]Rejection Reasons

any of: array[EnumResponse]
required
data
RevisionDataResponse
required
rejected_at
Rejected AtRejected At

any of: Rejected At
required
metadata
RevisionMetadataResponsenull

any of: RevisionMetadataResponse
view_count
View CountView Count

any of: View Count
required
can_add_to_cart
boolean
required
review_count
Review CountReview Count

any of: Review Count
required
rating
RatingRating

any of: Rating
required
sales_count
Sales CountSales Count

any of: Sales Count
required
navigation
NavigationResponsenull

any of: NavigationResponse
required
slug
string
required
title
string
required
categoryIds
array[integer]
required
parent
NavigationResponsenull

any of: NavigationResponse
variants
array[VariantResponse]Variants

any of: array[VariantResponse]
required
id
IdId

any of: Id
price
PricePrice

any of: Price
primary_price
Primary PricePrimary Price

any of: Primary Price
stock
integer
required
order
OrderOrder

any of: Order
properties
array[VariantPropertiesResponse]
required
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
variants_selected_index
Variants Selected IndexVariants Selected Index

any of: Variants Selected Index
required
shipping_data
ShippingDataResponsenull

any of: ShippingDataResponse
required
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
free_shipping
FreeShippingResponsenull

any of: FreeShippingResponse
required
result
boolean
required
meta_data
Meta DataMeta Data

any of: Meta Data
required
allow_category_change
Allow Category ChangeAllow Category Change

any of: Allow Category Change
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
required
unit_type
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
packaging_dimensions
ProductDimensionResponsenull

any of: ProductDimensionResponse
height
integer
required
width
integer
required
length
integer
required
is_wholesale
Is WholesaleIs Wholesale

any of: Is Wholesale
attributes
array[NewAttributeResponse]Attributes

any of: array[NewAttributeResponse]
id
IdId

any of: Id
key
string
required
value
string


{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}

curl --request PATCH \
  --url https://core.basalam.com/v3/products/{product_id} \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "wholesale_prices": [
    {
      "price": 10000,
      "min_quantity": 2
    }
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "virtual": true,
  "variants": [
    {
      "price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true
}'

Create Product
post
https://core.basalam.com/v4/vendors/{vendor_id}/products
Request
Path Parameters
vendor_id
integer
required
Body

application/json

application/json
name
string
required
photo
PhotoPhoto

any of: Photo
photos
array[integer]Photos

any of: array[integer]
video
VideoVideo

any of: Video
brief
BriefBrief

any of: Brief
description
DescriptionDescription

any of: Description
order
OrderOrder

any of: Order
category_id
integer
required
status
integer
required
وضعیت محصول. مقادیر مجاز: 2976 = منتشر شده, 3790 = منتشر نشده, 4184 = غیرقانونی, 3568 = در انتظار تأیید

preparation_days
integer
required
keywords
array[string]Keywords

any of: array[string]
weight
WeightWeight

any of: Weight
package_weight
integer
required
primary_price
Primary PricePrimary Price

any of: Primary Price
stock
StockStock

any of: Stock
shipping_city_ids
array[integer]Shipping City Ids

any of: array[integer]
shipping_method_ids
array[integer]Shipping Method Ids

any of: array[integer]
product_attribute
array[ProductAttributes]Product Attribute

any of: array[ProductAttributes]
attribute_id
integer
required
value
ValueValue

any of: Value
selected_values
array[integer]Selected Values

any of: array[integer]
attributes
array[NewProductAttributes]Attributes

any of: array[NewProductAttributes]
key
string
required
value
string
required
virtual
VirtualVirtual

any of: Virtual
variants
array[ProductVariants]Variants

any of: array[ProductVariants]
primary_price
integer
required
stock
integer
required
sku
SkuSku

any of: Sku
properties
array[PropertyVariant]
required
shipping_data
ProductShippingDatanull

any of: ProductShippingData
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
unit_type
Unit TypeUnit Type

any of: Unit Type
واحد اندازه‌گیری محصول. مقادیر مجاز: 6375=مترمربع, 6374=میلی‌متر, 6373=جلد, 6332=فوت, 6331=اینچ, 6330=سیر, 6329=اصله, 6328=کلاف, 6327=قالب, 6326=شاخه, 6325=بوته, 6324=دست, 6323=بطری, 6322=تخته, 6321=کارتن, 6320=توپ, 6319=بسته, 6318=جفت, 6317=جین, 6316=طاقه, 6315=قواره, 6314=انس, 6313=سی‌سی, 6312=میلی‌لیتر, 6311=لیتر, 6310=تکه (اسلایس), 6309=مثقال, 6308=سانتی‌متر, 6307=متر, 6306=گرم, 6305=کیلو‌گرم, 6304=عددی, 6392=رول, 6438=سوت, 6466=قیراط

sku
SkuSku

any of: Sku
packaging_dimensions
ProductDimensionsSchemanull

any of: ProductDimensionsSchema
height
integer
required
length
integer
required
width
integer
required
is_wholesale
boolean
kalabarg
KalabargKalabarg

any of: Kalabarg
barcode
BarcodeBarcode

any of: Barcode
Responses
201
404
422
Successful Response

Body

application/json

application/json
responses
/
201
/
barcode
id
integer
required
title
string
required
price
PricePrice

any of: Price
required
photo
PhotoResponsenull

any of: PhotoResponse
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
photos
array[PhotoResponse]Photos

any of: array[PhotoResponse]
required
id
integer
required
original
string
required
xs
string
required
sm
string
required
md
string
required
lg
string
required
video
VideoResponsenull

any of: VideoResponse
required
id
integer
required
url
string
required
original
OriginalOriginal

any of: Original
required
thumbnail
ThumbnailThumbnail

any of: Thumbnail
required
hls
HlsHls

any of: Hls
required
width
WidthWidth

any of: Width
required
height
HeightHeight

any of: Height
required
duration
DurationDuration

any of: Duration
required
status
EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
vendor
PublicVendorResponse
required
id
integer
required
identifier
string
required
title
string
required
logo
PhotoResponsenull

any of: PhotoResponse
required
covers
array[PhotoResponse]Covers

any of: array[PhotoResponse]
required
available_cities
array[CityResponse]Available Cities

any of: array[CityResponse]
required
summary
SummarySummary

any of: Summary
required
status
EnumResponse
required
city
CityResponse
required
category_type
array[anyOf]Category Type

any of: array[anyOf]
required
user
PublicUserResponse
required
is_active
boolean
required
notice
NoticeNotice

any of: Notice
required
gallery
array[PhotoResponse]Gallery

any of: array[PhotoResponse]
required
product_count
Product CountProduct Count

any of: Product Count
free_shipping_to_iran
Free Shipping To IranFree Shipping To Iran

any of: Free Shipping To Iran
required
free_shipping_to_same_city
Free Shipping To Same CityFree Shipping To Same City

any of: Free Shipping To Same City
required
about_your_life
About Your LifeAbout Your Life

any of: About Your Life
required
about_your_place
About Your PlaceAbout Your Place

any of: About Your Place
required
worth_buy
Worth BuyWorth Buy

any of: Worth Buy
required
telegram_id
Telegram IdTelegram Id

any of: Telegram Id
telegram_channel
Telegram ChannelTelegram Channel

any of: Telegram Channel
instagram
InstagramInstagram

any of: Instagram
eitaa
EitaaEitaa

any of: Eitaa
last_activity
Last ActivityLast Activity

any of: Last Activity
created_at
string
required
elapsed_time_from_creation
Elapsed Time From CreationElapsed Time From Creation

any of: Elapsed Time From Creation
score
ScoreScore

any of: Score
video
VideoResponsenull

any of: VideoResponse
required
shipping_methods
array[EnumResponse]Shipping Methods

any of: array[EnumResponse]
required
product_sort_type
EnumResponsenull

any of: EnumResponse
required
home_tab_settings
array[VendorSettingResponse]Home Tab Settings

any of: array[VendorSettingResponse]
required
shipping_version
Shipping VersionShipping Version

any of: Shipping Version
summary
SummarySummary

any of: Summary
required
category
CategoryResponsenull

any of: CategoryResponse
required
id
integer
required
title
string
required
placeholder
PlaceholderPlaceholder

any of: Placeholder
parent
CategoryResponsenull

any of: CategoryResponse
unit_type_id
EnumResponsenull

any of: EnumResponse
category_list
array[CategoryListResponse]Category List

any of: array[CategoryListResponse]
required
id
integer
required
title
string
required
slug
string
required
inventory
integer
required
net_weight
integer
required
net_weight_decimal
Net Weight DecimalNet Weight Decimal

any of: Net Weight Decimal
required
created_at
string
required
updated_at
string
required
description
DescriptionDescription

any of: Description
required
is_saleable
boolean
required
is_showable
boolean
required
is_available
boolean
required
primary_price
Primary PricePrimary Price

any of: Primary Price
required
shipping_area
array[CityResponse]Shipping Area

any of: array[CityResponse]
required
name
string
required
value
integer
required
province
EnumResponsenull

any of: EnumResponse
packaged_weight
Packaged WeightPackaged Weight

any of: Packaged Weight
required
preparation_day
Preparation DayPreparation Day

any of: Preparation Day
required
attribute_groups
array[AttributeGroupResponse]Attribute Groups

any of: array[AttributeGroupResponse]
required
title
string
required
attributes
array[AttributeResponse]
required
is_free_shipping
boolean
required
location_deployment
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
is_product_for_revision
Is Product For RevisionIs Product For Revision

any of: Is Product For Revision
required
has_selectable_variation
Has Selectable VariationHas Selectable Variation

any of: Has Selectable Variation
required
revision
RevisionResponsenull

any of: RevisionResponse
required
rejection_reasons
array[EnumResponse]Rejection Reasons

any of: array[EnumResponse]
required
data
RevisionDataResponse
required
rejected_at
Rejected AtRejected At

any of: Rejected At
required
metadata
RevisionMetadataResponsenull

any of: RevisionMetadataResponse
view_count
View CountView Count

any of: View Count
required
can_add_to_cart
boolean
required
review_count
Review CountReview Count

any of: Review Count
required
rating
RatingRating

any of: Rating
required
navigation
NavigationResponsenull

any of: NavigationResponse
required
slug
string
required
title
string
required
categoryIds
array[integer]
required
parent
NavigationResponsenull

any of: NavigationResponse
variants
array[VariantResponse]Variants

any of: array[VariantResponse]
required
id
IdId

any of: Id
price
PricePrice

any of: Price
primary_price
Primary PricePrimary Price

any of: Primary Price
stock
integer
required
order
OrderOrder

any of: Order
properties
array[VariantPropertiesResponse]
required
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
variants_selected_index
Variants Selected IndexVariants Selected Index

any of: Variants Selected Index
required
shipping_data
ShippingDataResponsenull

any of: ShippingDataResponse
required
illegal_for_iran
boolean
required
illegal_for_same_city
boolean
required
free_shipping
FreeShippingResponsenull

any of: FreeShippingResponse
required
result
boolean
required
meta_data
Meta DataMeta Data

any of: Meta Data
required
allow_category_change
Allow Category ChangeAllow Category Change

any of: Allow Category Change
required
unit_quantity
Unit QuantityUnit Quantity

any of: Unit Quantity
required
unit_type
EnumResponsenull

any of: EnumResponse
required
name
string
required
value
ValueValueValueValue

any of: Value
required
description
DescriptionDescription

any of: Description
sku
SkuSku

any of: Sku
discount
DiscountDiscount

any of: Discount
packaging_dimensions
ProductDimensionResponsenull

any of: ProductDimensionResponse
height
integer
required
width
integer
required
length
integer
required
is_wholesale
Is WholesaleIs Wholesale

any of: Is Wholesale
attributes
array[NewAttributeResponse]Attributes

any of: array[NewAttributeResponse]
id
IdId

any of: Id
key
string
required
value
string
required
status_changes
array[object]Status Changes

any of: array[object]
barcode
BarcodeBarcode

any of: Barcode
kalabarg
ProductKalabargResponsenull

any of: ProductKalabargResponse
enable
boolean
required
is_bulk
boolean


{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "primary_price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "attributes": [
    {
      "key": "string",
      "value": "string"
    }
  ],
  "virtual": true,
  "variants": [
    {
      "primary_price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true,
  "kalabarg": true,
  "barcode": "string"
}

curl --request POST \
  --url https://core.basalam.com/v4/vendors/{vendor_id}/products \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "string",
  "photo": 0,
  "photos": [
    0
  ],
  "video": 0,
  "brief": "string",
  "description": "string",
  "order": 0,
  "category_id": 0,
  "status": 0,
  "preparation_days": 0,
  "keywords": [
    "string"
  ],
  "weight": 0,
  "package_weight": 0,
  "primary_price": 0,
  "stock": 0,
  "shipping_city_ids": [
    0
  ],
  "shipping_method_ids": [
    0
  ],
  "product_attribute": [
    {
      "attribute_id": 0,
      "value": "string",
      "selected_values": [
        0
      ]
    }
  ],
  "attributes": [
    {
      "key": "string",
      "value": "string"
    }
  ],
  "virtual": true,
  "variants": [
    {
      "primary_price": 0,
      "stock": 0,
      "sku": "string",
      "properties": [
        {
          "value": "string",
          "property": "string"
        }
      ]
    }
  ],
  "shipping_data": {
    "illegal_for_iran": true,
    "illegal_for_same_city": true
  },
  "unit_quantity": 0,
  "unit_type": 0,
  "sku": "string",
  "packaging_dimensions": {
    "height": 0,
    "length": 0,
    "width": 0
  },
  "is_wholesale": true,
  "kalabarg": true,
  "barcode": "string"
}'



order service

Get Product Variation Status
get
https://order.basalam.com/v2/basket/product/{product_id}/status
Request
Path Parameters
product_id
integer
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

product_id*
:
integer
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/basket/product/{product_id}/status \
  --header 'Accept: application/json'

  Get Product Variation Status
get
https://order.basalam.com/v2/basket/product/{product_id}/status
Request
Path Parameters
product_id
integer
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

product_id*
:
integer
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/basket/product/{product_id}/status \
  --header 'Accept: application/json'


  Create Payment
post
https://order.basalam.com/v2/invoice/{invoice_id}/payment
Request
Path Parameters
invoice_id
integer
required
Body

application/json

application/json
pay_drivers
dictionary[string, PaymentDriver]
required
amount
integer
required
option_code
string
>= 2 characters
<= 50 characters
callback
string
required
option_code
string
>= 2 characters
<= 50 characters
national_id
string
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

invoice_id*
:
integer
{
  "pay_drivers": {
    "property1": {
      "amount": 0,
      "option_code": "string"
    },
    "property2": {
      "amount": 0,
      "option_code": "string"
    }
  },
  "callback": "string",
  "option_code": "string",
  "national_id": "string"
}
{
  "pay_drivers": {
    "property1": {
      "amount": 0,
      "option_code": "string"
    },
    "property2": {
      "amount": 0,
      "option_code": "string"
    }
  },
  "callback": "string",
  "option_code": "string",
  "national_id": "string"
}
Send API Request
curl --request POST \
  --url https://order.basalam.com/v2/invoice/{invoice_id}/payment \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "pay_drivers": {
    "property1": {
      "amount": 0,
      "option_code": "string"
    },
    "property2": {
      "amount": 0,
      "option_code": "string"
    }
  },
  "callback": "string",
  "option_code": "string",
  "national_id": "string"
}'

Get Payable Invoices
get
https://order.basalam.com/v2/invoice/payable
Request
Query Parameters
page
integer
required
per_page
integer
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined


page*
:
integer
per_page*
:
integer
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/invoice/payable \
  --header 'Accept: application/json'

  Get Payable Invoices
get
https://order.basalam.com/v2/invoice/unpaid
Request
Query Parameters
invoice_id
integer
page
integer
Default:
1
per_page
integer
Default:
20
sort
any
An enumeration.

Allowed values:
ASC
DESC
Default:
DESC
status
any
An enumeration.

Allowed values:
saleable
payable
unpaid
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

invoice_id
:
integer
page
:
defaults to: 1
per_page
:
defaults to: 20
sort
:
defaults to: DESC
status
:
Not Setsaleablepayableunpaid

select an option
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/invoice/unpaid \
  --header 'Accept: application/json'

  Payment Callback
get
https://order.basalam.com/v2/payment/{pay_id}/callback
Request
Path Parameters
pay_id
integer
required
Query Parameters
callback
string
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

pay_id*
:
integer
callback*
:
string
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/payment/{pay_id}/callback \
  --header 'Accept: application/json'


  Payment Callback
get
https://order.basalam.com/v2/payment/{pay_id}/callback
Request
Path Parameters
pay_id
integer
required
Query Parameters
callback
string
required
Responses
200
422
Successful Response

Body

application/json

application/json


pay_id*
:
integer
callback*
:
string
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/payment/{pay_id}/callback \
  --header 'Accept: application/json'

  Get Active Basket
get
https://order.basalam.com/v2/basket
Request
Query Parameters
refresh
boolean
Default:
false
source_page
string
Allowed values:
basket
address
checkout
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

refresh
:
Not SetFalseTrue

select an option (defaults to: false)
source_page
:
Not Setbasketaddresscheckout

select an option
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/basket \
  --header 'Accept: application/json'


  Create Payment
post
https://order.basalam.com/v2/invoice/{invoice_id}/payment
Request
Path Parameters
invoice_id
integer
required
Body

application/json

application/json
pay_drivers
dictionary[string, PaymentDriver]
required
amount
integer
required
option_code
string
>= 2 characters
<= 50 characters
callback
string
required
option_code
string
>= 2 characters
<= 50 characters
national_id
string
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined


invoice_id*
:
integer
{
  "pay_drivers": {
    "property1": {
      "amount": 0,
      "option_code": "string"
    },
    "property2": {
      "amount": 0,
      "option_code": "string"
    }
  },
  "callback": "string",
  "option_code": "string",
  "national_id": "string"
}
{
  "pay_drivers": {
    "property1": {
      "amount": 0,
      "option_code": "string"
    },
    "property2": {
      "amount": 0,
      "option_code": "string"
    }
  },
  "callback": "string",
  "option_code": "string",
  "national_id": "string"
}
Send API Request
curl --request POST \
  --url https://order.basalam.com/v2/invoice/{invoice_id}/payment \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "pay_drivers": {
    "property1": {
      "amount": 0,
      "option_code": "string"
    },
    "property2": {
      "amount": 0,
      "option_code": "string"
    }
  },
  "callback": "string",
  "option_code": "string",
  "national_id": "string"
}'

Payment Callback
get
https://order.basalam.com/v2/payment/{pay_id}/callback
Request
Path Parameters
pay_id
integer
required
Query Parameters
callback
string
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

pay_id*
:
integer
callback*
:
string
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/payment/{pay_id}/callback \
  --header 'Accept: application/json'

  Payment Callback
get
https://order.basalam.com/v2/payment/{pay_id}/callback
Request
Path Parameters
pay_id
integer
required
Query Parameters
callback
string
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

pay_id*
:
integer
callback*
:
string
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/payment/{pay_id}/callback \
  --header 'Accept: application/json'

  Get Payable Invoices
get
https://order.basalam.com/v2/invoice/payable
Request
Query Parameters
page
integer
required
per_page
integer
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

Get Payable Invoices
get
https://order.basalam.com/v2/invoice/unpaid
Request
Query Parameters
invoice_id
integer
page
integer
Default:
1
per_page
integer
Default:
20
sort
any
An enumeration.

Allowed values:
ASC
DESC
Default:
DESC
status
any
An enumeration.

Allowed values:
saleable
payable
unpaid
Responses
200
422
Successful Response

Body

application/json



Get Active Basket
get
https://order.basalam.com/v2/basket
Request
Query Parameters
refresh
boolean
Default:
false
source_page
string
Allowed values:
basket
address
checkout
Responses
200
422
Successful Response

Body

application/json

application/json
refresh
:
Not SetFalseTrue

select an option (defaults to: false)
source_page
:
Not Setbasketaddresscheckout

select an option
Send API Request
curl --request GET \
  --url https://order.basalam.com/v2/basket \
  --header 'Accept: application/json'

  Get Product Variation Status
  get
https://openapi.basalam.com/v1/baskets/products/{product_id}/status
Request
Path Parameters
product_id
integer
required
Responses
200
422
Successful Response

Body

application/json

application/json
No schema defined

product_id*
:
integer
Send API Request
curl --request GET \
  --url https://openapi.basalam.com/v1/baskets/products/{product_id}/status \
  --header 'Accept: application/json'