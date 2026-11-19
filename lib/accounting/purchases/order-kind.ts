/**
 * دو نوع سفارش روی یک جدول (`AccPurchaseOrder.kind`) — webhesab-parity.md بخش‌های ۱۳ و ۳۱.
 * بی‌وابستگی به پایگاه داده تا رابط کاربری هم بخواندش.
 *
 * سفارش خرید: «فاکتور خرید از روی سفارش» = دریافت کالا.
 * سفارش فروش: «فاکتور فروش از روی سفارش» = تحویل کالا (کسر از انبار) — تصمیم کاربر ۱۴۰۵/۰۸/۲۸.
 */

export type OrderKind = "PURCHASE" | "SALES";

export interface OrderKindInfo {
  kind: OrderKind;
  /** «سفارش خرید» / «سفارش فروش» */
  title: string;
  party: string;
  partyRole: "supplier" | "customer";
  /** برچسب `supplierRef` */
  ref: string;
  refHint: string;
  /** «رسیده» / «تحویل‌شده» */
  done: string;
  /** «دریافت» / «تحویل» */
  doneNoun: string;
  invoiceType: "PURCHASE" | "SALES";
  invoiceLabel: string;
  seqKey: string;
  page: string;
  api: string;
  help: "accountingPurchaseOrders" | "accountingSalesOrders";
  back: { href: string; label: string };
  priceFor: "purchase" | "sales";
  /** مجوز نوشتن */
  writePerm: "ACC_PURCHASE" | "ACC_SALES";
  viewPerms: readonly string[];
  /** نوع پیوست (`lib/accounting/attachments.ts`) */
  attachType: "AccPurchaseOrder" | "AccSalesOrder";
}

export const ORDER_KINDS: Record<OrderKind, OrderKindInfo> = {
  PURCHASE: {
    kind: "PURCHASE",
    title: "سفارش خرید",
    party: "عرضه‌کننده",
    partyRole: "supplier",
    ref: "کد پیگیری عرضه‌کننده",
    refHint: "شماره‌ی پیش‌فاکتور یا سفارش در سیستم او",
    done: "رسیده",
    doneNoun: "دریافت",
    invoiceType: "PURCHASE",
    invoiceLabel: "فاکتور خرید",
    seqKey: "purchase-order",
    page: "/admin/accounting/purchases/orders",
    api: "/api/admin/accounting/purchase-orders",
    help: "accountingPurchaseOrders",
    back: { href: "/admin/accounting/purchases", label: "خرید" },
    priceFor: "purchase",
    writePerm: "ACC_PURCHASE",
    viewPerms: ["ACC_VIEW", "ACC_PURCHASE", "ACC_INVENTORY"],
    attachType: "AccPurchaseOrder",
  },
  SALES: {
    kind: "SALES",
    title: "سفارش فروش",
    party: "مشتری",
    partyRole: "customer",
    ref: "کد پیگیری سفارش مشتری",
    refHint: "شماره‌ی درخواست یا سفارش در سیستم مشتری",
    done: "تحویل‌شده",
    doneNoun: "تحویل",
    invoiceType: "SALES",
    invoiceLabel: "فاکتور فروش",
    seqKey: "sales-order",
    page: "/admin/accounting/sales/orders",
    api: "/api/admin/accounting/sales-orders",
    help: "accountingSalesOrders",
    back: { href: "/admin/accounting/sales", label: "فروش" },
    priceFor: "sales",
    writePerm: "ACC_SALES",
    viewPerms: ["ACC_VIEW", "ACC_SALES", "ACC_INVENTORY"],
    attachType: "AccSalesOrder",
  },
};

export const isOrderKind = (k: unknown): k is OrderKind => k === "PURCHASE" || k === "SALES";
