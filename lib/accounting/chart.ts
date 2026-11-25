/**
 * سرفصل پیش‌فرض فروشگاهی — docs/plans/accounting.md بخش ۷.
 *
 * هر ردیف: [کد، نام، سطح، کلاس، ماهیت، تفصیلی، کلید سیستمی]. پدر از روی کد
 * پیدا می‌شود (کل = یک رقم اول، معین = دو رقم اول). کسب‌وکار می‌تواند کل و معین
 * اضافه کند؛ ردیف‌های با کلید سیستمی فقط نامشان عوض می‌شود.
 */

import type { AccClass, AccDetailKind, AccLevel, AccNature } from "@prisma/client";

export type ChartRow = [
  code: string,
  name: string,
  level: AccLevel,
  cls: AccClass,
  nature: AccNature,
  detail: AccDetailKind,
  systemKey: string | null,
];

const G = "GROUP" as const;
const L = "LEDGER" as const;
const S = "SUBLEDGER" as const;

export const DEFAULT_CHART: ChartRow[] = [
  ["1", "دارایی‌های جاری", G, "ASSET", "DEBIT", "NONE", null],
  ["11", "موجودی نقد و بانک", L, "ASSET", "DEBIT", "NONE", null],
  ["1101", "صندوق", S, "ASSET", "DEBIT", "TREASURY", "CASH"],
  ["1102", "بانک‌ها", S, "ASSET", "DEBIT", "TREASURY", "BANK"],
  ["1103", "کارتخوان در راه", S, "ASSET", "DEBIT", "TREASURY", "POS_CLEARING"],
  ["1104", "درگاه پرداخت در راه", S, "ASSET", "DEBIT", "TREASURY", "GATEWAY_CLEARING"],
  ["12", "دریافتنی‌ها", L, "ASSET", "DEBIT", "NONE", null],
  ["1201", "حساب‌های دریافتنی", S, "ASSET", "DEBIT", "PARTY", "AR"],
  ["1202", "اسناد دریافتنی", S, "ASSET", "DEBIT", "PARTY", "CHEQUE_RECEIVABLE"],
  ["1203", "اسناد در جریان وصول", S, "ASSET", "DEBIT", "PARTY", "CHEQUE_IN_COLLECTION"],
  ["13", "موجودی کالا", L, "ASSET", "DEBIT", "NONE", null],
  ["1301", "موجودی کالا", S, "ASSET", "DEBIT", "NONE", "INVENTORY"],
  ["1302", "ذخیره‌ی کاهش ارزش موجودی", S, "ASSET", "CREDIT", "NONE", "INVENTORY_PROVISION"],
  ["14", "پیش‌پرداخت‌ها", L, "ASSET", "DEBIT", "NONE", null],
  ["1401", "مالیات بر ارزش افزوده‌ی خرید", S, "ASSET", "DEBIT", "NONE", "VAT_PURCHASE"],
  ["1402", "پیش‌پرداخت‌ها", S, "ASSET", "DEBIT", "PARTY", "PREPAYMENT"],
  ["1403", "پیش‌پرداخت کارمزد خرید اقساطی", S, "ASSET", "DEBIT", "NONE", "INSTALLMENT_PREPAID"],
  ["1404", "پیش‌پرداخت هزینه‌ها", S, "ASSET", "DEBIT", "NONE", "PREPAID_EXPENSE"],

  ["2", "دارایی‌های غیرجاری", G, "ASSET", "DEBIT", "NONE", null],
  ["21", "دارایی‌های ثابت", L, "ASSET", "DEBIT", "NONE", null],
  ["2101", "اثاثه و تجهیزات", S, "ASSET", "DEBIT", "NONE", null],
  ["2102", "وسایل نقلیه", S, "ASSET", "DEBIT", "NONE", null],
  ["2103", "دکوراسیون و بهسازی مغازه", S, "ASSET", "DEBIT", "NONE", null],
  ["2104", "رایانه و تجهیزات الکترونیکی", S, "ASSET", "DEBIT", "NONE", null],
  ["2190", "استهلاک انباشته‌ی دارایی‌های ثابت", S, "ASSET", "CREDIT", "NONE", "ACCUM_DEPRECIATION"],
  ["22", "ودایع و سپرده‌ها", L, "ASSET", "DEBIT", "NONE", null],
  ["2201", "ودیعه‌ی اجاره (رهن)", S, "ASSET", "DEBIT", "NONE", "DEPOSITS"],
  ["2202", "سپرده‌ها و ضمانت‌نامه‌ها", S, "ASSET", "DEBIT", "NONE", null],

  ["3", "بدهی‌های جاری", G, "LIABILITY", "CREDIT", "NONE", null],
  ["31", "پرداختنی‌ها", L, "LIABILITY", "CREDIT", "NONE", null],
  ["3101", "حساب‌های پرداختنی", S, "LIABILITY", "CREDIT", "PARTY", "AP"],
  ["3102", "اسناد پرداختنی", S, "LIABILITY", "CREDIT", "PARTY", "CHEQUE_PAYABLE"],
  ["3103", "حقوق و دستمزد پرداختنی", S, "LIABILITY", "CREDIT", "NONE", "SALARY_PAYABLE"],
  ["3104", "بیمه‌ی پرداختنی", S, "LIABILITY", "CREDIT", "NONE", "INSURANCE_PAYABLE"],
  ["32", "مالیات", L, "LIABILITY", "CREDIT", "NONE", null],
  ["3201", "مالیات بر ارزش افزوده‌ی فروش", S, "LIABILITY", "CREDIT", "NONE", "VAT_SALES"],
  ["3202", "مالیات تکلیفی پرداختنی (حقوق و اجاره)", S, "LIABILITY", "CREDIT", "NONE", "WITHHOLDING_TAX"],
  ["3203", "ذخیره‌ی مالیات عملکرد", S, "LIABILITY", "CREDIT", "NONE", "INCOME_TAX_PROVISION"],
  ["33", "پیش‌دریافت‌ها", L, "LIABILITY", "CREDIT", "NONE", null],
  ["3301", "کیف پول مشتریان", S, "LIABILITY", "CREDIT", "PARTY", "WALLET_LIABILITY"],
  ["3302", "پیش‌دریافت فروش", S, "LIABILITY", "CREDIT", "PARTY", "CUSTOMER_ADVANCE"],
  ["3303", "بن کارت فروخته‌شده", S, "LIABILITY", "CREDIT", "NONE", "GIFT_LIABILITY"],
  ["3304", "اعتبار باشگاه مشتریان", S, "LIABILITY", "CREDIT", "NONE", "CLUB_LIABILITY"],
  ["3305", "درآمد تحقق‌نیافته‌ی اقساط", S, "LIABILITY", "CREDIT", "NONE", "INSTALLMENT_DEFERRED"],
  ["34", "تسهیلات مالی", L, "LIABILITY", "CREDIT", "NONE", null],
  ["3401", "تسهیلات دریافتی", S, "LIABILITY", "CREDIT", "NONE", "LOAN_PAYABLE"],

  ["4", "بدهی‌های غیرجاری", G, "LIABILITY", "CREDIT", "NONE", null],
  ["41", "بدهی‌های بلندمدت", L, "LIABILITY", "CREDIT", "NONE", null],
  ["4101", "ذخیره‌ی مزایای پایان خدمت کارکنان", S, "LIABILITY", "CREDIT", "NONE", "END_OF_SERVICE"],

  ["5", "حقوق صاحبان سرمایه", G, "EQUITY", "CREDIT", "NONE", null],
  ["51", "سرمایه", L, "EQUITY", "CREDIT", "NONE", null],
  ["5101", "سرمایه", S, "EQUITY", "CREDIT", "PARTY", "CAPITAL"],
  ["5102", "برداشت", S, "EQUITY", "DEBIT", "PARTY", "DRAWINGS"],
  ["52", "سود انباشته", L, "EQUITY", "CREDIT", "NONE", null],
  ["5201", "سود (زیان) انباشته", S, "EQUITY", "BOTH", "NONE", "RETAINED_EARNINGS"],
  ["5202", "خلاصه‌ی سود و زیان", S, "EQUITY", "BOTH", "NONE", "PL_SUMMARY"],
  ["5203", "تراز افتتاحیه", S, "EQUITY", "BOTH", "NONE", "OPENING_BALANCE"],

  ["6", "درآمدها", G, "REVENUE", "CREDIT", "NONE", null],
  ["61", "فروش", L, "REVENUE", "CREDIT", "NONE", null],
  ["6101", "فروش کالا", S, "REVENUE", "CREDIT", "NONE", "SALES"],
  ["6102", "برگشت از فروش", S, "REVENUE", "DEBIT", "NONE", "SALES_RETURN"],
  ["6103", "تخفیفات فروش", S, "REVENUE", "DEBIT", "NONE", "SALES_DISCOUNT"],
  ["62", "سایر درآمدها", L, "REVENUE", "CREDIT", "NONE", null],
  ["6201", "درآمد ارسال", S, "REVENUE", "CREDIT", "NONE", "SHIPPING_REVENUE"],
  ["6202", "درآمد خدمات و تعمیرات", S, "REVENUE", "CREDIT", "NONE", "SERVICE_REVENUE"],
  ["6203", "سایر درآمدها", S, "REVENUE", "CREDIT", "NONE", "OTHER_INCOME"],
  ["6204", "اضافات و کسورات گرد کردن", S, "REVENUE", "BOTH", "NONE", "ROUNDING"],
  ["6205", "درآمد فروش اقساطی", S, "REVENUE", "CREDIT", "NONE", "INSTALLMENT_INCOME"],
  ["6206", "سود (زیان) فروش دارایی ثابت", S, "REVENUE", "BOTH", "NONE", "ASSET_DISPOSAL"],

  ["7", "بهای تمام‌شده", G, "EXPENSE", "DEBIT", "NONE", null],
  ["71", "بهای تمام‌شده", L, "EXPENSE", "DEBIT", "NONE", null],
  ["7101", "بهای تمام‌شده‌ی کالای فروش‌رفته", S, "EXPENSE", "DEBIT", "NONE", "COGS"],
  ["7102", "کسری و اضافات انبار", S, "EXPENSE", "BOTH", "NONE", "INVENTORY_ADJUSTMENT"],
  ["7103", "هزینه‌ی کاهش ارزش موجودی", S, "EXPENSE", "BOTH", "NONE", "INVENTORY_WRITEDOWN"],

  ["8", "هزینه‌ها", G, "EXPENSE", "DEBIT", "NONE", null],
  ["81", "هزینه‌های فروش", L, "EXPENSE", "DEBIT", "NONE", null],
  ["8101", "کارمزد بازارگاه", S, "EXPENSE", "DEBIT", "NONE", "MARKETPLACE_FEE"],
  ["8102", "پورسانت فروش", S, "EXPENSE", "DEBIT", "PARTY", "COMMISSION_EXPENSE"],
  ["8103", "تبلیغات و بازاریابی", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8104", "ارسال و بسته‌بندی", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8105", "هدیه و جبران به مشتری", S, "EXPENSE", "DEBIT", "NONE", "CUSTOMER_REWARD"],
  ["8106", "کارمزد فروش اقساطی سازمانی", S, "EXPENSE", "DEBIT", "NONE", "ORG_INSTALLMENT_FEE"],
  ["82", "هزینه‌های اداری", L, "EXPENSE", "DEBIT", "NONE", null],
  ["8201", "اجاره", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8202", "حقوق و دستمزد", S, "EXPENSE", "DEBIT", "PARTY", null],
  ["8203", "آب، برق و گاز", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8204", "تلفن و اینترنت", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8205", "پیامک و سرویس‌های آنلاین", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8206", "ملزومات مصرفی", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8207", "هزینه‌های متفرقه", S, "EXPENSE", "DEBIT", "NONE", null],
  ["8208", "کسری و اضافه‌ی صندوق", S, "EXPENSE", "BOTH", "NONE", "CASH_OVER_SHORT"],
  ["8209", "هزینه‌ی استهلاک", S, "EXPENSE", "DEBIT", "NONE", "DEPRECIATION"],
  ["83", "هزینه‌های مالی", L, "EXPENSE", "DEBIT", "NONE", null],
  ["8301", "کارمزد بانکی", S, "EXPENSE", "DEBIT", "NONE", "BANK_FEE"],
  ["8302", "کارمزد خرید اقساطی", S, "EXPENSE", "DEBIT", "NONE", "INSTALLMENT_EXPENSE"],
  ["8303", "سود و جریمه‌ی تسهیلات", S, "EXPENSE", "DEBIT", "NONE", "LOAN_INTEREST"],
];

/**
 * ردیف‌های ۲.۱۶۸.۰ (بخش ۳۴.۵) — نصب‌های قدیمی‌تر با `ensureChartRows` می‌گیرند
 * (worker روزانه و اولین کار با دارایی‌ها).
 */
export const ASSET_CHART_CODES = ["1404", "2103", "2104", "2190", "22", "2201", "2202", "3103", "3104", "3202", "3203", "4", "41", "4101", "6206", "8209"];

/** کلیدهای سیستمی که کد به آن‌ها تکیه دارد — نبودشان یعنی سرفصل ناقص است */
export const REQUIRED_KEYS = DEFAULT_CHART.map((r) => r[6]).filter((k): k is string => !!k);

export const ACC_CLASS_LABELS: Record<AccClass, string> = {
  ASSET: "دارایی",
  LIABILITY: "بدهی",
  EQUITY: "حقوق صاحبان سرمایه",
  REVENUE: "درآمد",
  EXPENSE: "هزینه",
};

export const ACC_LEVEL_LABELS: Record<AccLevel, string> = {
  GROUP: "گروه",
  LEDGER: "کل",
  SUBLEDGER: "معین",
};

export const ACC_DETAIL_LABELS: Record<AccDetailKind, string> = {
  NONE: "بدون تفصیلی",
  PARTY: "شخص",
  TREASURY: "صندوق و بانک",
};
