ف ثبت سفارش ن مستند

رسویس اطالع رسان (وب رسویس وندور – وب هوک )
احت ر با سالم و ام،
ن در پنل وندور، شما امکان فعالسازی سیستم ارسال تغی ت موجودی محصوالت و تنظیم اطالعات وب رسویس خود را دارید. یم
همچن ی توانید توکن مخصوص
جهت اعتبارسن یج درخواست های ارسال شده از سو ی ما را انتخاب نمایید.
که توک نن مرحله :۱ در مرحله ی یک ( ندارید
ر
درصورت ) در تب "درخواست توکن" بر روی دکمه ی "درخواست توکن جدید " کلیک و توکن ایجاد شده را ک ن نمایید :
مرحله :۲ سپس اطالعات رسویس خود (با متد Post (را وارد کرده و از لیست توکنهای فعال، توکن مورد نظر را جهت ارسال توسط تپس شاپ انتخاب و بر روی دکمهی
"ثبت درخواست " کلیک نمایید :
تار یخچه درخواست های فروشنده(WebService(
در این قسمت امکان مدیریت و مانیتورینگ فراخوات یس رصد و پیگ تی تمایم درخواست ن
ر
ها ایجاد شده است و دست های ارسال شده از سمت وبرسویس فروشنده به
یت رسی عتر تعامالت سیستیم است.
زیرساخت تپسشاپ فراهم شده است. هدف از این رسویس، ایجاد شفافیت در پردازش دادهها و عیبیا
قابلیتهای کلیدی :
ن مشاهده لیست درخواست
یت اجرا )موفق/خطا(.
ها: نمایش تمایم فراخواتها به همراه شناسه درخواست، شناسه محصول و وضعیت نها
جزئیات تغی تات: باکلیک بر روی هر رکورد،کاربر به صفحه جزئیات هدایت شده و یمتواند تغی تات دقیق اعمال شده بر روی قیمت اصیل، قیمت بعد از تخفیف و ظرفیت
موجودی محصول را مشاهده نماید.
تاریخچه وضعیت: در جزئیات درخواست، امکان مشاهده زمان دقیق ارسال و زمان پاسخ در سیستم تپسشاپ جهت تطبیق با الگ های سمت وندور در
وجود دارد. همچن ین
صورت دریافت خطا، امکان مشاهدهی علت آن فراهم شده است.
جزئيات تاریخچه درخواست فروشنده:
 اطالع
رسانهای تپیسشاپ(Webhook(
این بخش به منظور آگایه لحظهای فروشندگان از تعامالت تجاری و مدیریت بهینه سفارشات طرایح شده است. تمایم رویدادهای مربوط به چرخه حیات یک سفارش در این
قسمت به صورت متمرکز قابل رویت است.
قابلیتهای کلیدی :
اعالن خریدهای جدید: به محض ثبت موفقیت ی، تمایم جزئیات خرید شامل شماره سفارش، مشخصات اقالم و زمان ثبت در این بخش درج
آم تن سفارش توسط مشت ر
یمگردد.
در صورت لغو سفارش، جزئیات لغو سفارش قابل مشاهده است.
یت فروش و تخفیف
جزئیات تراکنش: امکان مشاهده قیمت نها های اعمال شده مربوط به هر سفارش جهت شفافیت مایل قابل مشاهده است.
نمونه درخواست ارسایل )در نمونه زیر آدرس رسویس به عنوان مثال آورده شده و با آدرس رسویس پیاده سازی شده توسط شما جایگزین میگردد(:
متد درخواست:
POST •
curl --location 'https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/webhook-test' \
--header 'accept: text/plain' \
--header 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
--header 'client-version: 1.0.0.0' \
--header 'TapsiShop.Hub.Webhook-Authorization: {{YOUR_TOKEN}}' \
--header 'Content-Type: application/json' \
--data '{
 "orderDetail": {
 "orderId": 1039417456193437696,
 "changeType": 1,
 "createdOnTimestamp": "2025-05-31T09:24:30.764Z",
 "receiverFullName": "string",
 "customerFullName": "string",
 "deliveryAddress": "string",
 "customerMobile": "string",
 "customerNationalCode": "string",
 "receiverMobile": "string",
 "orderNumber": "string",
 "customerFirstName": "string",
 "customerLastName": "string"
 },
 "items": [
 {
 "requestId": 2039417456193437696,
 "orderItemId": 1039417456193437775,
 "orderId": 1039417456193437696,
 "tapsiShopProductId": 1034024501253242880,
 "productId": "string",
 "quantity": 0,
 "changeType": 1,
 "createdOnTimestamp": "2025-05-31T09:24:30.764Z",
 "receiverFullName": "string",
 "customerFullName": "string",
 "deliveryAddress": "string",
 "finalPrice": 0,
 "originalPrice": 0,
 "customerMobile": "string",
 "customerNationalCode": "string",
 "receiverMobile": "string"
 }
 ]
}'
های
ر
پارامت ارسایل:
• orderDetail: اطالعات سفارش که شامل این موارد میباشد:
o orderId) long (: شناسه ی سفارش
 سفارش شماره :) String) orderNumber o
o createdOnTimeStamp) DateTimeOffset (: زمان ثبت سفارش
تنده تحویلگ :) String) receiverFullName o
ی
نام و نام خانوادگ
o receiverMobile) String (: شماره تلفن همراه تحویلگ تنده
o deliveryAddress) String (: آدرس تحویلگ تنده
خریدار :) String) customerFullName o
ی
نام و نام خانوادگ
 خریدار نام :)String) customerFirstName o
خریدار :) String) customerLastName o
ی
نام خانوادگ
o customerMobile) String (: شماره تلفن همراه خریدار
o customerNationalCode) String (: کد میل خریدار
o changeType) Enum (: دلیل نوتیفیکیشن ).1 خرید - .2کنسیل(
• به ازای هر درخواست ارسال شده توسط تپس شاپ (که مربوط به یک سفارش است) لیسرن از آیتم های آن سفارش با نام items داریم که شامل این اطالعات است:
o orderItemId) long (: شناسه آیتم سفارش در تپیس شاپ
o taspsiShopProductId) long (: شناسه محصول در تپیس شاپ
o createdOnTimeStamp) DateTimeOffset (: زمان ثبت رکورد در تپیس شاپ
o productId) String (: شناسه محصول در سیستم وندور )sku ثبت شده در تپیس شاپ(
o Quantity) Int (: تعداد تغی تیافته
▪ در صورت ثبت
ن
موفقیت آم ت سفارش: -1
▪ در صورت کنسل شدن آیتم بعد از ثبت سفارش: 1
o receiverFullName) String (: تحویلگ تنده ی مرسوله
ی
نام و نام خانوادگ
دهنده سفارش :) String) customerFullName o
ی
نام و نام خانوادگ
o deliveryAddress) String (: آدرس محل تحویل 
یتکاال )قیمت بعد از تخفیف(
نها قیمت :) Decimal) finalPrice o
o originalPrice) Decimal (: قیمت اصیل کاال
o customerMobile) String (: شماره تلفن همراه خریدار
o customerNationalCode) String (: کد میل خریدار
o receiverMobile) String (: شماره تلفن همراه تحویلگ تنده
o requestId) long (: شناسه درخواست، به منظور جلوگ تی از ارسال درخواست تکراری (هرچند ما هر درخواست را تنها یکبار ارسال میکنیم ).
 فرآیند نوع :) Enum) changeType o
▪ عدد 1 به معنای کاهش به دلیل خرید
▪ عدد 2 به معنای افزایش به دلیل کنسل شدن آیتم
public enum InventoryChangeTypeEnum : int
{
DeductedDueToPurchase = 1,
AddedDueToCancellation = 2,
}
 ت نوشت
ر :1
پارامت changeType در آیتم های سفارش و جزییات سفارش یکسان است و در آینده از آیتم های سفارش حذف خواهد شد .
 نوشت :2 با توجه به این که نام و نام ت
ی
خانوادگ خریدار برای ثبت سفارش الزایم نیست، ممکن است این
ر
پراپرت بدون مقدار باشد.
 نوشت :3 یس به اطالعات کد میل خریدار ت
دست و شماره همراه خریدار ، نیازمند تعریف تنظیمات الزم در قرارداد فروشنده ، یس در قرارداد ر
توسط تپس شاپ یم باشد. لذا اگر فروشنده ای دارای این دست ر
خود با تپس شاپ نباشد این اطالعات برای آن ارسال نیم شود.
توکن اعتبارسن ج:
توک که شما در پنل وندور انتخاب مینمایید، با کلید زیر در هدر درخواست ارسال میشود : نن
TapsiShop.Hub.Webhook-Authorization
انتظار پاسخ:
که پاسخ درخواست شماکد
ر
در صورت 200 و مقدار succeed برابر با true باشد، تمام محصوالت ارسال شده با موفقیت پردازش شده اند .
نمونه پاسخ مورد انتظار:
مدیریت خطا :
در صورت دریافت تعداد خطاهای بیش از حد مجاز، سیستم ما به طور خودکار ارسال تغی تات به سمت رسویس شما را غ تفعال خواهد کرد.
{
,"پیام شما اینجا قرار میگیرد !" :"message"
"succeed": true
}
احراز هویت و تحویل سفارش
.１ دریافت اطالعات سفرت:
برای مشاهده اطالعات سف تمراجعه است رسویس زیر را بامتد
ن
کننده،کاف GET و با استفاده از کد جمعآوری )pickupCode )کنید:
فراخوات ن
GET https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/courier/{pickupCode}
خرو ج رسویس:
{
 "success": true,
 "messages": [
 {
 "message": "string",
 "code": "string",
 "type": 1
 }
 ],
 "data": {
 "courierFirstname": "string",
 "courierLastname": "string",
 "courierAvatar": "string",
 "orderNumber": "string"
 }
}
و عکس سف ت
ی
این اطالعات شامل نام، نام خانوادگ و شماره سفارش است تا فروشنده بتواند احراز هویت را انجام دهد.
.２ تایید یا رد سفرت:
و بدنه مناسب فراخوات ن پس از برریس، برای اعالم نتیجه احراز هویت باید رسویس زیر را با متد POST کنید:
PUT https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/review-courier
نمونه Body:
{
 "pickupCode": "string",
 "isAcceptableCourier": true,
 "includeShippingBundleProductDetails": true
}
ها:
توضیحات پارامت ر
• pickupCode: کد جمعآوری
 :isAcceptableCourier •
o true: سف تتأیید شده و امکان جمعآوری وجود دارد.
تپس false o
ن
: سف تتأیید نشده؛کاالها نباید تحویل داده شوند و مغایرت باید به پشتیبات شاپ اطالع داده شود.
 :includeShippingBundleProductDetails •
که سف تاحراز نشود، تحت هیچ ررس o true: جزئیاتکاالهای سفارش در پاسخ رسویس نمایش داده یم اییط
شود. درصورت ر
کاالها در خروییح رسویس ارسال نخواهند شد.
o false: اطالعاتکاال در خروییح رسویس ارسال نیم شود.
:
سفرت
رد
/
یید
تأ
رسویس
خرو ج
نمونه
{
 "success": true,
 "messages": [

{
 "message": "string",
 "code": "string",
 "type": 1

}
 ],
 "data": {
 "isPickupUpdateSuccessful": true,
 "isDataRetrievalSuccessful": true,
 "pickuResult": {
 "isScheduled": true,
 "shipmentOrderBundleId": "string"
 },
 "shipmentBundleProductDetails": {
 "shippingProviderId": "string",
 "shipmentOrderId": "string",
 "shipmentOrderBundleId": "string",
 "isShippingByVendor": true,
 "pickupDate": "2025
-08
-04T07:53:58.860Z",
 "fromHour": "string",
 "toHour": "string",
 "itemCount": 0,
 "stateTitle": "string",
 "bundleNumber": "string",
 "customerFullName": "string",
 "customerMobileNumber": "string",
 "orderBundleProductDetails": [

{
 "productId": "string",
 "productName": "string",
 "categoryName": "string",
 "shouldDeliveryCount": 0,
 "originalPrice": 0,
 "finalPrice": 0,
 "productDefaultImage": "string"

}
 ],
 "recipientDelivery": {
 "fullName": "string",
 "phone": "string",
 "address": "string",
 "isShow": true

}

}

}
}
 ن مستند
ف ارسال تغیرت موجودی و قیمت محصوالت توسط وندور
ن در پنل وندور ، شما امکان رسویس
دریافت توکن جهت ارسال تغی تات موجودی قیمت خود از طریق فراخوات های مشخص شده در مستند را خواهید
داشت .
رسویس اول (Token Refresh(:
رین میتوانید در صورت خطای
گرف unauthorized از رسویس ذیل جهت دریافت توکن جدید بر اساس توکن قبیل استفاده نمایید .
های
ر
پارامت ارسایل:
• name: نام توکن – الزایم
• token: توکن جاری – الزایم
نض • revokeCurrentToken: مشخص کننده ی این که توکن جاری
منق بشود /نشود – غ ت الزایم
• expireAt: زمان انقضا – غ تالزایم – زمان انقضا
ر
نض در صورت مقداردیه نشدن حداکت (
در حال حا 6 ماه در نظر گرفته میشود)
خروج رسویس :
curl --location 'https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/refresh-token' \
--header 'accept: text/plain' \
--header 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
--header 'client-version: 1.0.0.0' \
--header 'Content-Type: application/json' \
--data '{
"token": "your token",
"name": "your token name",
"revokeCurrentToken": false,
"expiredAt": "2024-10-13T08:27:07.880Z"
}'
{
 "success": true,
 "messages": [
 {
 "message": "string",
 "code": "string",
 "type": 1
 }
 ],
 "data": {
 "token": "string",
 "expireDate": "2025-05-31T10:02:00.243Z"
 }
}
ن قیمت و موجودی):

رسویس دوم (بروزرسا
ن شما میتوانید با رسویس
فراخوات ذیل
ن
برای بروزرسات قیمت و موجودی محصوالت خود در تپس شاپ اقدام نمایید .
های
ر
پارامت ارسایل به ازای هر آیتم در لیست products:
• id: شناسه محصول سمت فروشنده – (SKU محصول در تپس شاپ)
• stock: موجودی
یت
نض • price: قیمت اصیل - قیمت وارد شده میبایست
م از 10 و به ریال باشد.
یت
یت - قیمت وارد شده میبایست
نض • specialPrice: قیمت نها
م از 10 و به ریال باشد.
یت وضعیت همان درخواست برای شما ارسال میشود .
• referenceCode: کد مرجع – در خروییح رسویس برای شناسا
curl --location --request PUT 'https://vendorgw.tapsi.shop/web/hub/vendors/v1/products' \
--header 'accept: text/plain' \
--header 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
--header 'client-version: 1.0.0.0' \
--header 'Content-Type: application/json' \
--header 'TapsiShop.Hub.Authorization: {{token}}' \
--data '{
"products": [
{
"id": "the sku of your product",
"stock": 10,
"price": 20000,
"specialprice": 10000,
"referenceCode": "your request reference code"
}
]
}'
خروج رسویس :
های
ر
پارامت مربوط به هر آیتم در لیست data:
• id: یا شناسه محصول در تپس شاپ
• sku یا شناسه محصول در پلتفرم فروشنده
• status: موفقیت
ن
آم ت بودن /نبودن فرآیند
• messages: لیست پیغام های مربوط به درخواست ارسال شده جهت این
بروزرسات این آیتم ن
currentOriginalPrice •
: قیمت اصیلکنوت ن
:currentFinalPrice •
یتکنوت ن
قیمت نها
:currentOnHandQty •
موجودیکنوت ن
• referenceCode: کد مرجع ارسال شده توسط شما به ازای این آیتم
{
"success": true,
"messages": [
{
"message": "string",
"code": "string",
"type": 1
}
],
"data": {
"status": true,
"data": [
{
"id": "string",
"sku": "string",
"status": true,
"messages": [
"string"
],
"currentOriginalPrice": 0,
"currentFinalPrice": 0,
"currentOnHandQuantity": 0,
"referenceCode": "string"
}
]
}
}
رسویس سوم (دریافت اطالعات فروشگاه):
با استفاده از این رسویس میتوانید اطالعات فروشگاه را دریافت نمایید.
curl --location 'https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/vendor-information' \
--header 'accept: text/plain' \
--header 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
--header 'client-version: 1.0.0.0' \
--header 'TapsiShop.Hub.Authorization: {{token}}' \
--header 'Cookie: BIGipServerHIT-Prod-HDS-K8s--443=624631724.47873.0000'
خروییح رسویس :
{
"data": {
,"شناسه فروشگاه" :"vendorId"
,"نام فروشنده" :"vendorName"
,"نام فروشگاه" :"storeName"
,"لینک فروشگاه" :"storeLink"
"شماره فروشگاه" :"storeNumber"
},
"success": true,
"messages": []
}
 ت نوشت : مقدار توکن برابر با توک نن استکه در بخش درخواست توکن پنل وندور دریافت یمکنید.
رسویس چهار م (دریافت لیست محصوالت):
این رسویس برای دریافت لیسرن شود. با استفاده از شماره صفحه و تعداد آیتمهای هر از محصوالت یک فروشنده استفاده یم
ر صفحه، یم توانید به محصوالت خود به صورت صفحه یس داشته باشید
بندی شده دست .
GET https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/products/{page}/{pageSize}
curl --location 'https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/products/1/10' \
--header 'accept: text/plain' \
--header 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
--header 'client-version: 1.0.0.0' \
--header 'TapsiShop.Hub.Authorization: TOKEN'
نمونه خروییح:
{
 "data": {
 "page": 1,
 "pageSize": 10,
 "totalCount": 3050,
 "items": [
 {
 "id": "string",
 "hsin": "string",
 "sku": "string",
 "originalPrice": 0,
 "finalPrice": 0,
 "minimalPerOrder": 0,
 "maximalPerOrder": 0,
 "onHandQuantity": 0
 }
 ]
 },
 "success": true,
 "messages": []
}
توضیحات فیلدها :
توضیح نوع داده نام فیلد
شناسه محصول در تپس شاپ string id
کد HSIN محصول در تپس شاپ string hsin
شناسه محصول در سیستم فروشنده string sku
قیمت اصیل محصول (nullable (decimal originalPrice
finalPrice decimal (nullable) محصول یت
قیمت نها
حداقل تعداد قابل خرید در هر سفارش (nullable (int minimalPerOrder
تعداد قابل خرید در هرسفارش (nullable (int maximalPerOrder
حداکت ر
موجودی فعیل محصول (nullable (int onHandQuantity
رسویس پنجم (دریافت لیست سفارش ها):
این رسویس برای دریافت لیست سفارش های فروشنده استفاده یمشود. با استفاده ازشماره صفحه و تعداد آیتمهای هر صفحه، یمتوانید به
ر سفارش های خود به صورت صفحه یس داشته باشید
بندی شده دست .
آدرس رسویس )با متد POST):
https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/orders
کرل درخواست:
curl -X 'POST' \
 'https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/orders' \
 -H 'accept: text/plain' \
 -H 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
 -H 'client-version: 1.0.0.0' \
 -H 'Content-Type: application/json' \
 -d '{
 "pageNumber": 0,
 "pageSize": 0,
 "dateFilterTypeCode": 0,
 "orderId": "string",
 "orderNumber": "string",
 "fromDate": "2026-04-26T07:41:29.627Z",
 "toDate": "2026-04-26T07:41:29.627Z",
 "bundleId": "string",
 "shippingStatusType": [
 "string"
 ],
 "productId": [
 "string"
 ],
 "categoryIds": [
 "string"
 ],
 "orderStatusId": [
 "string"
 ],
 "deliveryMethod": "string"
}'
ین نوشت:
لطفا توکن دریافت شده از بخش درخواست توکن پنل وندور را با کلید Authorization.Hub.TapsiShop در درخواست خود ارسال
نمایید.
پ های درخواست ورودی
ر
ارامت :
توضیح اجباری نوع فیلد
ررسوع از خ ت integer pageNumber
شماره صفحه ) ۰(
تعداد در هر صفحه )پیش فرض ۲۰( خ ت integer pageSize
ررسوع خ ت string fromDate
تاری خ (DATETIMEOFFSET(
تاری خ پایان(DATETIMEOFFSET (خ ت string toDate
شماره سفارش دقیق خ ت string orderNumber
شماره مرسوله خ ت string bundleId
4 = تایید سفارش
6 = لغو سفارش
9 = تحویل کامل
orderStatusId
لیست وضعیت سفارش خ ت array
لیست وضعیت مرسوله خ ت array shippingStatusType
1 = ارسال فروشنده
2 = ارسال پلتفرم
3 = تحویل حضوری
deliveryMethod
نوع تحویل خ ت string
یت خ ت array productId
لیسرن ازکاالهای انتخا
یت خ ت array categoryIds
لیسرن ازگروهکاالهای انتخا
لیست وضعیت مرسوله:
وضعیت Code
پیش سفارش 100
در انتظار تخصیص پیک 110
در انتظار جمع آوری 200
ارسال شده 310
ی 320
تحویل شده به مشت ر
عدم تحویل موفق 400
پیک در فروشگاه 210
آماده ارسال 300
لغو شده 410
نض 420
منق
در انتظار آماده سازی 120
در انتظار تغی ت نحوه ارسال 140
در انتظار استعالم مجدد 900
:
مدل خرو ج
{
 "success": true
,
 "messages": [

{
 "message": "string"
,
 "code": "string"
,
 "type":
1

}
 ],
 "data": {
 "pageNumber":
0
,
 "pageSize":
0
,
 "totalItems":
0
,
 "items": [

{
 "id": "string"
,
 "orderNumber": "string"
,
 "shipmentOrderBundleNumbers": [
 "string"
 ],
 "persianDateTime": "string"
,
 "stateCode": "string"
,
 "stateTitle": "string"
,
 "finalPrice":
0
,
 "serviceFee":
0
,
 "voucherTotalFee":
0
,
 "createdOn": "2026
-04
-26T07:43:49.117Z"

}

]

}
}
ررسح فیلدهای خرو ج )آیتم سفارش(:
توضیح فیلد
شناسه یکتای سفارش )برای دریافت جزئیات استفاده id
شود(
شماره سفارش قابل نمایش orderNumber
شماره مرسوله shipmentOrderBundleNumbers
تاری خ ثبت سفارش به شمس persianDateTime
عنوان وضعیت سفارش )مثل »تایید سفارش«( stateTitle
یت )ریال( finalPrice
مبلغ کل نها
)ریال( serviceFee
هزینه عملیات ر
تخفیف voucherTotalFee
رسویس ششم (دریافت جزئیات سفارش):
دریافت تمام اطالعات یک سفارش، شامل: اطالعات اصیل سفارش، صورتحساب ها، مرسوله ها، آیتم های کاال.
آدرس رسویس )با متد Get):
https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/orders/{orderId}
کرل ارسال درخواست:
curl -X 'GET' \
 'https://vendorgw.tapsi.shop/Web/Hub/vendors/v1/orders/1' \
 -H 'accept: text/plain' \
 -H 'client-name: Swagger on HIT.Hastim.Hub.Endpoints.WebApi' \
 -H 'client-version: 1.0.0.0'
های درخواست ورودی
ر
پارامت :
مس ت
توضیح نوع پارامت ر
شناسه سفارش )مقدار id از خروییح رسویس لیست) string orderId
ین نوشت:
لطفا توکن دریافت شده از بخش درخواست توکن پنل وندور را با کلید Authorization.Hub.TapsiShop در درخواست خود ارسال
نمایید.
:
خرو ج
ی
نمونه
{
 "success": true
,
 "messages": [

{
 "message": "string"
,
 "code": "string"
,
 "type":
1

}
 ],
 "data": {
 "order": {
 "orderNumber": "string"
,
 "orderDate": "string"
,
 "originalAmount": "string"
,
 "amountAfterDiscount": "string"
,
 "coupon": "string"
,
 "couponAmount": "string"
,
 "buyerCity": "string"
,
 "userRating": "string"
,
 "status": "string"
,
 "invoices": [

{
 "number": "string"
,
 "status": "string"
,
 "invoiceDate": "string"
,
 "settlementDate": "string"

}

]
 },
 "shipments": [

{
 "number": "string"
,
 "status": "string"
,
 "deliveryMethod": "string"
,
 "sendDate": "string"
,
 "fromHour": "string"
,
 "toHour": "string"

}
 ],
 "items": [

{
 "picture": "string"
,
 "name": "string"
,
 "sku": "string"
,
 "price": "string"
,
 "finalPrice": "string"
,
 "vendorVoucherAmount": "string"
,
 "vendorFinalPrice": "string"
,
 "commissionPrice": "string"
,
 "effectiveDate": "string"
,
 "firstMileLastMile": "string"
,
 "state": "string"
,
 "cancelReason": "string"

}

]

}
}
ررسح فیلدهای مهم خرو ج:
توضیح مس ت
مبلغ اصیل سفارش بدون تخفیف originalAmount.order
مبلغ پس از اعمال تخفیف ها amountAfterDiscount.order
وضعیت تسویه )تسویه شده / انتظار( text.status.[]invoices
مرسوله )ریال( operationalCost.[]shipments
هزینه عملیات ر
کمیسیون پرداخرن فروشنده commissionPrice.[]items
تاری خ مؤثر برای تسویه effectiveDate.[]items
دلیل لغو آیتم )در صورت لغو( cancelReason.[]items
لیستکامل خروییح رامیتوانید از پنل فروشنده دریافتکنید.
لینک مستند تغی ت موجودی و قیمت تپس شاپ
ف میان تیم های توسعه ارائه شده است. در صورت نیاز به توضیحات ، نن این مستند به منظور تسهیل همکاری
ر
بیشت

لطفا با ما در ارتباط باشید.
باتشکر،
ف تپیس شاپ. ن تیم 