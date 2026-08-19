# اسنپ‌شاپ (SnappShop)

> ✅ **مستندات رسمی اسنپ‌شاپ (نسخه ۲.۱.۲) در انتهای همین فایل ضمیمه شده است.**
> بخش «مستندات بروز شده اسنپ شاپ» را ببینید — منبع حقیقت همان است.
> خلاصه‌ی زیر برای مرور سریع است.
>
> ⚠️ محصولات اسنپ‌شاپ **تخفیف** دارند (`discount.special_price`) و در `PATCH`
> فیلدهای `price` و `stock` اجباری‌اند — ارسال ناقص، تخفیف را پاک می‌کند.
> جزئیات در [orders-and-invoicing.md](../orders-and-invoicing.md).

## اتصال

| | |
|---|---|
| نوع | بازارگاه (marketplace) |
| Base URL | `https://apix.snappshop.ir/automation/v1` |
| فرم ادمین | `/admin/integration/connections/snappshop` |
| آداپتور | `lib/integration/adapters/marketplace/snappshop.adapter.ts` |

## احراز هویت

دو مقدار لازم است، نه یکی:

```
Authorization: Bearer <token>
User-Agent:    <uniqueCode>
Accept:        application/json
Content-Type:  application/json
```

> **نکته‌ی مهم:** اسنپ‌شاپ «کد یکتای شناسایی» را در هدر `User-Agent` می‌خواهد — نه در
> هدر اختصاصی. اگر `User-Agent` را دستکاری کنید اتصال می‌شکند.

علاوه بر این دو، `vendorId` هم لازم است که در بیشتر مسیرها در خود URL می‌آید.

## مسیرها

| مسیر | کاربرد |
|------|--------|
| `GET /vendors` | فهرست فروشندگان — برای تست اتصال هم استفاده می‌شود |
| `GET /vendors/{vendorId}/products` | فهرست محصولات (صفحه‌بندی با `?page=`) |
| `PATCH /vendors/{vendorId}/products` | به‌روزرسانی گروهی قیمت و موجودی |
| `GET /vendors/{vendorId}/orders/events` | رویدادهای سفارش (پشتیبانی از cursor) |
| `GET /vendors/{vendorId}/orders/{orderNo}` | جزئیات یک سفارش |

## فیلدهای محصول

```ts
{ id, sku, product_number, parent_product_number, active, capacity,
  stock, warehouse_stock, title, price, warranty, promotion,
  discount: { id, special_price, stock, percent, start_at, end_at } | null,
  variation_attributes, buy_box, reference_price }
```

- هم `stock` و هم `warehouse_stock` وجود دارد
- `price` قیمت **پایه** است و `discount.special_price` قیمت بعد از تخفیف
- قیمت‌ها **تومان** هستند (برخلاف باسلام و تپسی که ریال می‌دهند)

## قابلیت‌های پیاده‌شده

`testConnection` · `fetchProducts` · `updateStock` · `updatePrice` · `fetchOrders`

به‌روزرسانی قیمت و موجودی هر دو از مسیر `bulkUpdate` با متد `PATCH` انجام می‌شوند.



## مستندات بروز شده اسنپ شاپ
پیوست فنی یکپارچه سازی فروشندگان اسنپ شاپ
تاریخچه نسخه ها
1
نسخه توضیحات
1.0.0
- احراز هویت بر پایه توکن معرفی شد.
- اندپوینت های مربوط به آپدیت قیمت و موجودی معرفی شدند.
1.1.0 - قابلیت ویرایش قیمت و موجودی از طریق کد فروشنده ممکن شد.
1.2.0
- بخش های مربوط به ورود و خروج از حساب حذف شدند.
- اطالعات اضافی از پاسخ های سیستم حذف شدند.
1.3.0 - کد یکتای شناسایی به روند احراز هویت افزوده شد.
2.1.0
- بخش مدیریت سفارشات افزوده شد. )رویدادها، جزئیات و تاریخچه سفارشات( معرفی شدند.
- مجموع آیتمهای لغوشده در رویداد فعلی و رویدادهای قبلی )اندپوینت رویدادها( نمایش داده شد.
- تعداد محصوالت در اندپوینت مربوطه اصالح شد.
2.1.1
- فیلتر date_start و date_end به تاریخچه سفارشات افزوده شد.
- آدرس اندپوینت مربوط به تاریخچه سفارشات اصالح شد.
2.1.2 - پارامتر کد محصول به پاسخ اندپوینت های بخش محصوالت و سفارشات افزودن

-۱ احراز هویت
-۱ -۱ نشانی پایه )BaseUrl)
برای استفاده از هرکدام از اندپوینت ها می توانید درخواست خود را به نشانی زیر ارسال کنید. آدرس زیر به عنوان آدرس پایه برای تمامی
درخواست ها استفاده می شود.
baseUrl = https://apix.snappshop.ir/automation/v1
-۱ -۲ کد یکتای شناسایی
به منظور شناسایی درخواست دهنده در ارتباط با API های این سند، الزم است مقدار کد یکتای خود را به عنوان Agent User را در
قسمت Header استفاده کنید.
{کد یکتای شما} :Agent-User
-۱ -۳ توکن دسترسی )Token)
برای ارتباط با API های ذکر شده در این سند ابتدا باید یک توکن مربوط به مجموعه ی مورد نظر را دریافت کنید و در ادامه برای تمامی
درخواست ها در قسمت Header از آن استفاده کنید
Authorization: Bearer {Token}
توکن دریافتی از نوع Token Bearer است و برای دریافت آن می بایست وارد پنل فروشندگان شوید و از بخش تنظیمات فروشگاه،
اقدام به دریافت توکن کنید.
● در صورتی که توکن مورد استفاده شما معتبر نباشد برای هر یک از درخواست ها پاسخ زیر را دریافت می کنید:
Response Sample (401 Unauthorized):
{
, .عدم دسترسی! ابتدا ل گین نمایید" :"message "
 "code": 301008,
 "trackId": "fr451727a1",
 "status": false,
 "errors": []
}
● توکن های دریافتی مدت زمان طوالنی قابل استفاده هستند و در صورتی که منقضی شوند و یا توکن را حذف کردید می توانید
توکن جدید درخواست کنید

-۲ اندپوینت های در دسترس
-۲ -۱ فروشندگان )Vendors)
-۲ -۱ -۱ دریافت اطالعات مربوط به تمامی فروشگاه ها
با استفاده از این اندپوینت میتوانید لیستی از تمامی فروشگاه های مربوط به توکن احراز هویت شده را دریافت کنید.
URL
GET: baseUrl/vendors
Response Sample (200 OK):
{
 "status": true,
 "data": [
 {
 "id": "nel61b",
,"تهران شاپ" :"title "
 "title_en": "tehranshop",
 "status": "ACTIVE"
 },
 {
 "id": "fre4gf",
,"تهران بوک" :"title "
 "title_en": "tehranbook",
 "status": "ACTIVE"
 }
 ]
}
-۲ -۱ -۲ دریافت جزئیات مربوط به یک فروشگاه
با استفاده از این اندپوینت می توانید جزئیات مربوط به یک فروشگاه را مشاهده کنید.
● برای مقدار }id_vendor }می توانید از فیلد id که از بخش 1-3 دریافت کرده اید استفاده کنید.
URL
GET: baseUrl/vendors/{vendor_id}

Response Sample (200 OK):
{
 "status": true,
 "data": {
 "id": "nel61b",
,"تهران شاپ " :"title "
 "title_en": " tehranshop ",
 "status": "ACTIVE"
 }
}
-۲ -۲ محصوالت )Products)
-۲ -۲ -۱ دریافت لیست محصوالت یک فروشگاه )Products Vendor)
با استفاده از این اندپوینت می توانید لیست تمامی محصوالت مربوط به یک فروشگاه را دریافت کنید.
● برای مقدار }id_vendor }می توانید از فیلد id که از بخش 1-3 دریافت کرده اید استفاده کنید.
● تعداد کاالهای دریافتی در هر ریکوئست 20 عدد می باشد و می توانید با استفاده از کوئری page صفحات دیگر را دریافت کنید
)baseUrl/vendors/{vendor_id}/products?page=2(
URL
GET: baseUrl/vendors/{vendor_id}/products
Response Sample (200 OK):
{
 "status": true,
 "data": [
 {
 "id": "65M5J1",
 "sku": "44ed8300-ed75-11ju-bc26-5b9fm866a82f",
 "product_number": 135412856172254,
 "parent_product_number": 135354856172246,
 "active": true,
 "capacity": null,
 "stock": 7,
 "warehouse_stock": 8,
," مدل XLسایز 4 -2405-01M04D02RAتیشرت آستین کوتاه مردانه کد 22" :"title "
 "title_en": "Tyshrt-Astyn-Kotah-Mrdanh-Kd-22Ra02D04M-2405-01-Sayz-4Xl-Mdl ",
 "thumbnail": null,
 "price": 84233,


 ll,
 "discount": {
 "id": "cdXw34",
 "special_price": 77494,
 "stock": 8,
 "vendor_share": 228,
 "percent": 8,
 "start_at": "2023-05-06",
 "end_at": "2023-05-11",
 "created_at": "2023-05-08 15:41:59",
 "updated_at": "2023-05-08 15:41:59"
 },
 "variation_attributes": [
 {
 "attribute": {
 "id": "45g6r1",
,"رنگ" :"title "
 "unit": null
 },
 "value": {
 "id": "eSz70",
,"سبز" :"title "
 "icon": https://cdn-icons-png.flaticon.com/512/616/616532.png
 }
 }
 ],
 "created_at": "2023-05-08 15:40:06"
 },
 ],
 "meta": {
 "pagination": {
 "total": 2201,
 "count": 20,
 "per_page": 20,
 "current_page": 1,
 "total_pages": 111,
 "links": {
 "next": "baseUrl/vendors/{vendor_id}/products?page=2",
 "previous": null
 }
 }
 }
}
-۲ -۲ -۲ دریافت اطالعات مربوط به یک محصول )Product Vendor)
با استفاده از این اندپوینت می توانید جزئیات مربوط به یکی از محصوالت یک فروشگاه را مشاهده کنید.
● برای مقدار }id_vendor }می توانید از فیلد id که از بخش 1-3 دریافت کرده اید استفاده کنید

● برای مقدار }id }می توانید از فیلد id که از بخش 3-3 دریافت کرده اید استفاده کنید.
URL
GET: baseUrl/vendors/{vendor_id}/products/{id}.
Response Sample (200 OK):
{
 "status": true,
 "data": {
 "id": "65M5J1",
 "sku": "44ed8300-ed75-11ju-bc26-5b9fm866a82f",
 "product_number": 135412856172254,
 "parent_product_number": 135354856172246,
 "active": true,
 "capacity": null,
 "stock": 7,
 "warehouse_stock": 8,
," مدل XLسایز 4 -2405-01M04D02RAتیشرت آستین کوتاه مردانه کد 22" :"title "
 "title_en": "Tyshrt-Astyn-Kotah-Mrdanh-Kd-22Ra02D04M-2405-01-Sayz-4Xl-Mdl ",
 "thumbnail": null,
 "price": 84233,
 "warranty": null,
 "discount": {
 "id": "cdXw34",
 "special_price": 77494,
 "stock": 8,
 "vendor_share": 228,
 "percent": 8,
 "start_at": "2023-05-06",
 "end_at": "2023-05-11",
 "created_at": "2023-05-08 15:41:59",
 "updated_at": "2023-05-08 15:41:59"
 },
 "variation_attributes": [
 {
 "attribute": {
 "id": "45g6r1",
,"رنگ" :"title "
 "unit": null
 },
 "value": {
 "id": "eSz70",
,"سبز" :"title "
 "icon": https://cdn-icons-png.flaticon.com/512/616/616532.png
 }
 }
 ],

3-05-08 15:40:06"
 }
}
-۲ -۲ -۳ آپدیت محصول مربوط به یک فروشگاه
با استفاده از این اندپوینت می توانید اطالعاتی که در ادامه ذکر شده است را آپدیت کنید
● برای مقدار }id_vendor }می توانید از فیلد id که از بخش 1-3 دریافت کرده اید استفاده کنید.
● مقادیر مربوط به قیمت باید به تومان وارد شوند
● حداکثر امکان ارسال 50 محصول در هر ریکوئست وجود دارد
فیلدهایی که می توانند ارسال شوند به شرح زیر هستند:
● id( رشته(: شناسه ی منحصر به فرد محصول - قابل دریافت از بخش 3-3 )اجباری(
● stock( عدد صحیح(: موجودی )اجباری(
● price( عدد صحیح(: قیمت پایه )اجباری(
● capacity( عدد صحیح(: ظرفیت فروش برای هر سفارش
● price_special( عدد صحیح(: قیمت پس از تخفیف
● at_start_price_special( رشته(: تاریخ شروع اعمال تخفیف – مانند نمونه به میالدی وارد شود
● at_end_price_special( رشته(: تاریخ پایان اعمال تخفیف – مانند نمونه به میالدی وارد شود
● stock_price_special( عدد صحیح(: موجودی محصوالت دارای تخفیف
در صورتی که برای محصول sku ثبت شده باشد می توانید به جای فیلد id فیلد sku را ارسال کنید
اگر برای یک محصول هر دو مقدار id و sku ارسال شود مقدار sku آپدیت می شود
URL
PATCH: baseUrl/vendors/{vendor_id}/products
Request Body Sample 1
{
 "products": [
 {
 "id": "9ernro",
 "stock": 15,
 "price": 15000,
 "capacity": 5,
 "special_price": 12000,
 "special_price_start_at": "2023-04-26",

 special_price_end_at": "2023-05-16",
 "special_price_stock": 5
 },
 {
 "id": "3r3not",
 "stock": 5,
 "price": 5000,
 }
 ]
}
Request Body Sample 2
{
 "products": [
 {
 "sku": "31fea170-ed99-34ed-b08d-f7g54e2626a",
 "stock": 15,
 "price": 15000,
 "capacity": 5,
 "special_price": 12000,
 "special_price_start_at": "2023-04-26",
 "special_price_end_at": "2023-05-16",
 "special_price_stock": 5
 },
 {
 "sku": "44dea170-ed99-33ed-b08d-f72b2de626a",
 "stock": 5,
 "price": 5000,
 }
 ]
}
Response Sample (200 OK):
{
 "status": true,
 "data": [
 {
 "d": "zrXw70",
 "sku": "31fea170-ed99-34ed-b08d-f7g54e2626a",
 "status" : true,
 "messages": []
 },
 {
 "id": "trCw30",
 "sku": "44dea170-ed99-33ed-b08d-f72b2de626a",
 "status": false,
 "messages": [
    "Invalid id/sku!"
 ]
 },
 ]
}
Response Sample 2 (422 Unprocessable Entity):
{
 "message": "the hashed field can not convert",
 "code": 221004,
 "trackId": "1af2df1c7b",
 "status": false,
 "errors": []
}

-۲ -۳ سفارشات )Orders)
-۲ -۳ -۱ اندپوینت دریافت رویدادهای مربوط به سفارشات )Events Order)
از طریق این اندپوینت میتوانید آخرین سفارشات ثبتشده و همچنین تغییرات وضعیت یا لغو سفارشات را بهصورت
پیوسته دریافت نمایید.
URL
GET: baseUrl/vendors/{vendor_id}/orders/events
Response Sample (200 OK):
{
 "status": true,
 "data": [
 {
 "event_type": "NEW_ORDER",
 "order_number": 1216515253,
 "event_at": "2025-11-01 17:51:47",
 "items": [
 {
 "sku": null,
 "vendor_product_info_id": "gvARRA",
 "product_number": 135412856172254,
 "parent_product_number": 135354856172246,
 "canceled_quantity": 0,
 eled_quantity": 0,
 "deliverable_quantity": 1,
 "final_price": 3020000,
 "item_status": "CONFIRMED"
 }
 ]
 },
 {
 "event_type": "CANCELLATION",
 "order_number": 727971837,
 "event_at": "2025-11-01 23:02:39",
 "items": [
 {
 "sku": null,
 "vendor_product_info_id": "geW1VB",
 "product_number": 135654856172254,
 "parent_product_number": 135125856172246,
 "canceled_quantity": 1,
 "total_canceled_quantity": 1,
 "deliverable_quantity": 0,
 "final_price": 0,
 "item_status": "CANCELED"
 }
 ]
 },
 {
 "event_type": "CHANGE_STATUS",
 "order_number": 727971837,
 "event_at": "2025-11-01 23:02:39",
 "new_status": "CANCELED"
 }
 ],
 "meta": {
 "pagination": {
 "path": "{base_url}/vendors/{vendor_id}/orders/events",
 "per_page": 20,
 "count": 3,
 "links": {
 "next": "{base_url}/vendors/{vendor_id}/orders/events?cursor=eyJpZCI6MzgsIl9wb2ludHNUb05le"
 },
 "has_more": false,
 "next_cursor": "eyJpZCI6MzgsIl9wb2ludHNUb05le"
 }
 }
}
توضیحات:
● با اولین درخواست به این اندپوینت، قدیمیترین رویدادهای مربوط به سفارشات برای شما بازگردانده میشود.
● در هر فراخوانی، حداکثر ۵۰ رویداد اخیر بازگردانده خواهد شد

● در صورتی که تعداد کل رویدادها بیش از ۵۰ عدد باشد، مقدار more_has در بخش
pagination.meta برابر با true خواهد بود.
● برای دریافت ادامه رویدادها، مقدار cursor_next که در همان بخش قرار دارد باید در درخواست بعدی بهصورت
parameter query ارسال شود.
URL
GET: baseUrl/vendors/{vendor_id}/orders/events?cursor=eyJpZCI6MzgsIl9wb2ludHNUb05le
● هر پاسخ دریافتی شامل مقدار cursor_next جدید است که مخصوص صفحه ی بعدی است. بنابراین در هر
درخواست بعدی باید آخرین مقدار cursor_next دریافتی از پاسخ قبلی ارسال شود.
● همچنین آدرس کامل درخواست صفحه بعدی از طریق فیلد next.links.pagination.meta در پاسخ در دسترس
است و نیازی به ساخت دستی URL بعدی نمیباشد.
نکات مهم در مورد فیلد آیتم ها )items )در اندپوینت رویدادها:
● فیلد quantity_canceled تعداد آیتمهایی از این محصول که در رویداد جاری لغو شدهاند.
● فیلد number_product_parent شماره محصول اصلی یا همان کد SNP مربوط به آیتم هست که در واقع برابر با
شماره محصول درج شده در وبسایت اصلی اسنپ شاپ است. این شماره به ازای هر محصول اصلی یکتاست و
برای تنوع های مختلف یک محصول، مقدار یکسانی دارد.
● فیلد number_product شماره محصول مربوط به آیتم هست که در واقع برابر با شماره محصول درج شده در مرکز
فروشندگان اسنپ شاپ است. این شماره به ازای هر تنوع از یک محصول اصلی یکتاست.
● فیلد quantity_canceled_total مجموع تعداد آیتمهای لغوشده از این محصول در رویداد جاری و تمامی
رویدادهای قبلی مربوط به سفارش.
● فیلد quantity_deliverable تعداد آیتمهایی از این محصول که هنوز برای تحویل به خریدار باقی ماندهاند.
● فیلد price_final مجموع قیمت آیتمهای باقیمانده برای تحویل به خریدار. در صورتی که تمامی آیتمها لغو شده
باشند، مقدار این فیلد برابر با صفر خواهد بود.
● فیلد status_item وضعیت فعلی آیتم در سفارش. در صورتی که تمام آیتمها لغو شده باشند مقدار این فیلد
CANCELED را خواهد داشت در غیر اینصورت مقدار CONFIRMED خواهد بود
● فیلد id_info_product_vendor شناسهی یکتای محصول در پلتفرم اسنپشاپ که برای شناسایی دقیق محصول
در سیستم مرکزی استفاده میشود.
● فیلد sku شناسهی داخلی اختصاصی که فروشنده برای هر یک از محصوالت خود تعریف کرده است

-۲ -۳ -۲ دریافت آخرین جزئیات یک سفارش با استفاده از شماره سفارش )number_order)
از طریق این اندپوینت میتوانید آخرین وضعیت سفارش ثبتشده و همچنین آیتم های خریداری شده ، مشخصات خریدار
، آدرس خریدار و ... را مشاهده نمایید.
URL
GET: baseUrl/vendors/{vendor_id}/orders/{order_number}
Response Sample (200 OK):
{
 "data": {
 "order_number": {order_number},
 "created_at": "2025-11-01 11:39:54",
 "delivery_type": "NORMAL",
 "order_status": "CONFIRMED",
 "item_origin": "VENDOR",
 "point_of_sales_at": null,
 "pickup_time": {
 "start": "2025-11-01 11:00:00",
 "end": "2025-11-01 18:00:00"
 },
 "customer": {
 "first_name": "مهسا",
 "last_name": "رضایی",
 "phone": null,
 "national_id": null,
 },
 "items": [
 {
 "sku": null,
 "product_number": 1564841615164,
 "parent_product_number": 1564841615160,
 "item_status": "CONFIRMED",
 "quantity": 1,
 "canceled_quantity": 0,
 "discount_amount": 13800000,
 "final_price": 13799990
 }
 ]
 }
}
توضیحات مربوط به اندپوینت جزئیات سفارش:
● این اندپوینت اطالعات کامل یک سفارش را بر اساس شماره سفارش )number_order )بازمیگرداند
● اطالعات شامل مشخصات سفارش، وضعیت، زمان تحویل، اطالعات مشتری و آیتمهای سفارش است.
● فیلد address در بخش customer تنها در صورتی دارای مقدار خواهد بود که نوع ارسال سفارش، ارسال توسط
فروشنده باشد در غیر این صورت مقدار آن برابر آرایهی خالی ] [ خواهد بود.
● فیلدهای phone و id_national تنها در صورتی نمایش داده میشوند که دسترسی مشاهدهی اطالعات خریدار
برای شما فعال شده باشد در غیر این صورت مقدار این فیلدها برابر با null خواهد بود


-۲ -۳ -۳ اندپوینت دریافت تاریخچه سفارشات
از طریق این اندپوینت میتوانید تاریخچهی کامل سفارشات خود را مشاهده کنید.
خروجی شامل لیستی از سفارشات از قدیمیترین تا جدیدترین سفارش است و برای هر سفارش آخرین وضعیت آیتمهای
خریداریشده، تغییرات زمان تحویل، مشخصات خریدار، آدرس خریدار و سایر اطالعات مرتبط نمایش داده میشود.
URL
GET: baseUrl/vendors/{vendor_id}/orders/
Response Sample (200 OK):
{
"status": true,
"data": [
{
"order_number": 1885177654,
"created_at": "2025-10-04 13:32:27",
"delivery_type": "EXPRESS",
"order_status": "CONFIRMED",
"item_origin": "VENDOR",
"point_of_sales_at": null,
"pickup_time": {
"start": "2025-10-04 13:00:00",
"end": "2025-10-04 14:51:00"
},
"customer": {
"first_name": "مهسا",
"last_name": "رضایی",
"phone": null,
"national_id": null,
"address": []
},
"items": [
{
"sku": null,
"vendor_product_info_id": "gwpGMM",
"product_number": 98456101161,
"parent_product_number": "68456101195",

"item_status": "CONFIRMED",
"quantity": 1,
"canceled_quantity": 0,
"original_price": 4500000,
"discount_amount": 13800000,
"final_price": 9300000
}
]
}
],
"meta": {
"pagination": {
"path": "{baseUrl}/vendors/{vendor_id}/orders",
"per_page": 20,
"count": 20,
"links": {
"next":
"{baseUrl}/vendors/{vendor_id}/orders?cursor=eyJvcC5pZCI6MTA0MDk3MDksIl9wb2ludHNUb05leHRJd
GVtcyI6dHJ1ZX0"
},
"has_more": true,
"next_cursor": "eyJvcC5pZCI6MTA0MDk3MDksIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0"
}
}
}
نحوه دریافت دادهها
● در اولین فراخوانی، سفارشات موجود از ۱۴ روز اخیر برای شما ارسال خواهد شد.
● در هر درخواست، حداکثر ۲۰ سفارش برای شما برگردانده میشود.
● اگر تعداد سفارشات بیشتر از ۲۰ عدد باشد، در پاسخ مقدار more_has.pagination.meta برابر با true خواهد
بود.
● برای دریافت ادامهی سفارشها، مقدار cursor موجود در پاسخ را به صورت پارامتر در درخواست بعدی ارسال
نمایید.
● توجه: لینک کامل درخواست صفحهی بعدی از طریق next.links.pagination.meta نیز در پاسخ قابل دسترسی است و
نیازی به ساخت دستی آدرس وجود ندارد

URL
GET: {baseUrl}/vendors/{vendor_id}/orders?cursor=eyJvcC5pZCI6MTA
دریافت لیست سفارشات در بازه خاص:
● در صورتی که نیاز به دریافت سفارشات یک بازه خاص دارید می توانید از فیلتر های date_start و date_end
استفاده نمایید.
به عنوان مثال اگر قصد دریافت سفارشات از ۱ مهر ۱۴۰۴ تا ۳۱ مهر ۱۴۰۴ را دارید درخواست شما باید به صورت زیر
باشد.
GET: {baseUrl}/vendors/{vendor_id}/orders?start_date=2025-09-23&end_date=2025-10-22
● بعد از دریافت id_cursor می توانید از این پارامتر برای ادامه لیست سفارشات استفاده نمایید.
در درخواست های بعدی در صورتی که "false :"more_has دریافت شود یعنی سفارشات بازه تاریخی به پایان
رسیده است.
● در صورتی که می خواهید لیست سفارشات از یک تاریخ خاص به بعد تا اخرین سفارش دریافتی تا االن را دریافت
کنید کافی است فقط فیلتر date_start را ارسال نمایید.
نکات مهم در مورد اطالعات مشتری
● فیلد address تنها در صورتی دارای مقدار خواهد بود که روش ارسال، ارسال توسط فروشنده باشد.
در غیر این صورت مقدار آن برابر آرایهی خالی ] [ خواهد بود.
● فیلدهای phone و id_national تنها در صورتی نمایش داده میشوند که دسترسی مشاهده اطالعات خریدار برای
شما فعال شده باشد.
در غیر این صورت مقدار این فیلدها برابر با null خواهند بود

