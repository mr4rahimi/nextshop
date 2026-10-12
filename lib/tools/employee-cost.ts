/**
 * هزینه‌ی واقعی کارمند برای کارفرما — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۲۰
 *
 * ⚠️ نرخ‌ها در کد ثابت نیستند — هر سال عوض می‌شوند. پیش‌فرض‌ها فقط نقطه‌ی شروع‌اند و کاربر با
 * حسابدارش چک می‌کند (مثل نرخ مالیات در ماشین‌حساب قیمت).
 *
 *   مشمول بیمه         = حقوق پایه + مزایای مشمول
 *   بیمه‌ی سهم کارفرما = مشمول × نرخ (پیش‌فرض ۲۳٪: ۲۰ کارفرما + ۳ بیکاری)
 *   عیدی و پاداش       = حقوق پایه × ماه‌های عیدی ÷ ۱۲      (ماهانه‌شده)
 *   سنوات              = حقوق پایه × ماه سنوات در سال ÷ ۱۲  (ماهانه‌شده)
 *   هزینه‌ی ماهانه     = حقوق + همه‌ی مزایا + بیمه + عیدی + سنوات + هزینه‌های جانبی
 */

export interface EmployeeInput {
  baseSalary: number;
  /** مزایای مشمول بیمه (حق مسکن، بن، …) */
  insurableBenefits: number;
  /** مزایای غیرمشمول (مثلاً حق اولاد) */
  otherBenefits: number;
  /** نرخ بیمه‌ی سهم کارفرما (درصد) */
  insurancePct: number;
  /** عیدی و پاداش سالانه به ماه حقوق پایه */
  bonusMonths: number;
  /** سنوات سالانه به ماه حقوق پایه */
  severanceMonths: number;
  /** هزینه‌های جانبی ماهانه: ناهار، ایاب‌وذهاب، تجهیزات، نرم‌افزار */
  extraMonthly: number;
  /** سود هر فروش — اختیاری، برای «چند فروش بیشتر لازم است» */
  profitPerSale: number;
}

export interface EmployeeResult {
  insurable: number;
  insurance: number;
  bonusMonthly: number;
  severanceMonthly: number;
  monthly: number;
  yearly: number;
  /** هزینه‌ی کل ÷ (حقوق پایه + همه‌ی مزایا) */
  overRatio: number | null;
  /** فروش ماهانه‌ی لازم برای پوشاندن هزینه */
  salesNeeded: number | null;
  parts: { key: string; label: string; value: number }[];
}

export const DEFAULT_EMPLOYEE: EmployeeInput = {
  baseSalary: 0,
  insurableBenefits: 0,
  otherBenefits: 0,
  insurancePct: 23,
  bonusMonths: 2,
  severanceMonths: 1,
  extraMonthly: 0,
  profitPerSale: 0,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calcEmployee(input: EmployeeInput): EmployeeResult {
  const base = pos(input.baseSalary);
  const insurable = base + pos(input.insurableBenefits);
  const insurance = (insurable * Math.min(100, pos(input.insurancePct))) / 100;
  const bonusMonthly = (base * pos(input.bonusMonths)) / 12;
  const severanceMonthly = (base * pos(input.severanceMonths)) / 12;
  const pay = insurable + pos(input.otherBenefits);
  const parts = [
    { key: "pay", label: "حقوق و مزایا", value: pay },
    { key: "insurance", label: "بیمه‌ی کارفرما", value: insurance },
    { key: "bonus", label: "عیدی و پاداش", value: bonusMonthly },
    { key: "severance", label: "سنوات", value: severanceMonthly },
    { key: "extra", label: "هزینه‌های جانبی", value: pos(input.extraMonthly) },
  ];
  const monthly = parts.reduce((s, p) => s + p.value, 0);
  const pps = pos(input.profitPerSale);
  return {
    insurable,
    insurance,
    bonusMonthly,
    severanceMonthly,
    monthly,
    yearly: monthly * 12,
    overRatio: pay > 0 ? monthly / pay : null,
    salesNeeded: pps > 0 && monthly > 0 ? Math.ceil(monthly / pps - 1e-9) : null,
    parts,
  };
}
