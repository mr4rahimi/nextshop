# اسنپ‌شاپ (SnappShop)

> ⚠️ **مستندات رسمی اسنپ‌شاپ در پروژه موجود نیست.** این سند از روی کد آداپتور نوشته شده،
> پس **منبع حقیقت خود آداپتور است** نه این فایل:
> `lib/integration/adapters/marketplace/snappshop.adapter.ts`
>
> اگر مستندات رسمی را گرفتید، آن را در همین پوشه بگذارید و این هشدار را بردارید.

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
{ id, sku, product_number, active, stock, warehouse_stock, title, price }
```

توجه کنید که هم `stock` و هم `warehouse_stock` وجود دارد.

## قابلیت‌های پیاده‌شده

`testConnection` · `fetchProducts` · `updateStock` · `updatePrice` · `fetchOrders`

به‌روزرسانی قیمت و موجودی هر دو از مسیر `bulkUpdate` با متد `PATCH` انجام می‌شوند.
