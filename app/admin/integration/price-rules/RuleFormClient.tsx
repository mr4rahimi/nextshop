"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { evaluateFormula, RULE_TEMPLATES } from "@/lib/integration/core/price-rule-engine";
import type { FormulaNode } from "@/lib/integration/core/price-rule-engine";
import type { PriceRuleContext } from "@/lib/integration/types";

const PLATFORMS = [
  { code: "hesaban", label: "وب‌حسابان" },
  { code: "basalam", label: "باسلام" },
];

const DEFAULT_FORMULA = JSON.stringify({ type: "var", name: "shop_price" }, null, 2);

interface Props {
  mode: "create" | "edit";
  initial?: {
    id:               string;
    name:             string;
    description:      string | null;
    isActive:         boolean;
    priority:         number;
    targetPlatforms:  string[];
    formula:          unknown;
  };
}

export default function RuleFormClient({ mode, initial }: Props) {
  const router  = useRouter();
  const [name,        setName]        = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority,    setPriority]    = useState(String(initial?.priority ?? 100));
  const [isActive,    setIsActive]    = useState(initial?.isActive ?? true);
  const [platforms,   setPlatforms]   = useState<string[]>(initial?.targetPlatforms ?? []);
  const [formulaStr,  setFormulaStr]  = useState(
    initial?.formula ? JSON.stringify(initial.formula, null, 2) : DEFAULT_FORMULA,
  );
  const [formulaError, setFormulaError] = useState<string | null>(null);

  // preview context
  const [shopPrice,    setShopPrice]    = useState("100000");
  const [purchPrice,   setPurchPrice]   = useState("75000");
  const [stock,        setStock]        = useState("10");
  const [previewResult, setPreviewResult] = useState<number | null>(null);
  const [previewError,  setPreviewError]  = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  function validateFormula(str: string): FormulaNode | null {
    try {
      const parsed = JSON.parse(str);
      setFormulaError(null);
      return parsed as FormulaNode;
    } catch (e) {
      setFormulaError(`JSON نامعتبر: ${(e as Error).message}`);
      return null;
    }
  }

  const handleFormulaChange = useCallback((v: string) => {
    setFormulaStr(v);
    validateFormula(v);
    setPreviewResult(null);
  }, []);

  function applyTemplate(templateKey: string) {
    const t = RULE_TEMPLATES.find(x => x.key === templateKey);
    if (!t) return;
    const str = JSON.stringify(t.formula, null, 2);
    setFormulaStr(str);
    setFormulaError(null);
    setPreviewResult(null);
    if (!name) setName(t.label);
    if (!description) setDescription(t.description);
  }

  function handlePreview() {
    setPreviewError(null);
    const node = validateFormula(formulaStr);
    if (!node) return;

    const ctx: PriceRuleContext = {
      shop_price:          Number(shopPrice) || 0,
      last_purchase_price: Number(purchPrice) || 0,
      avg_purchase_price:  Number(purchPrice) || 0,
      current_stock:       Number(stock) || 0,
      shipping_cost:       0,
      packaging_cost:      0,
    };

    try {
      const result = evaluateFormula(node, ctx);
      setPreviewResult(Math.max(1, Math.round(result)));
    } catch (e) {
      setPreviewError(`خطا در اجرای فرمول: ${(e as Error).message}`);
    }
  }

  function togglePlatform(code: string) {
    setPlatforms(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code],
    );
  }

  async function handleSave() {
    const node = validateFormula(formulaStr);
    if (!node) return;
    if (!name.trim()) {
      alert("نام قانون الزامی است");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name:            name.trim(),
        description:     description.trim() || null,
        priority:        Number(priority) || 100,
        isActive,
        targetPlatforms: platforms,
        formula:         node,
      };

      const url    = mode === "create" ? "/api/integration/price-rules" : `/api/integration/price-rules/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (res.ok) {
        router.push("/admin/integration/price-rules");
        router.refresh();
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error ?? "خطا در ذخیره");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* اطلاعات پایه */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">اطلاعات قانون</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              نام قانون <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: قیمت باسلام — قیمت خرید + ۳۰٪"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">اولویت (عدد کمتر = اجرا اول)</label>
            <input
              type="number"
              value={priority}
              onChange={e => setPriority(e.target.value)}
              min={1} max={999}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">توضیح (اختیاری)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="توضیح مختصر قانون..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* وضعیت */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">قانون فعال باشد</span>
        </label>
      </div>

      {/* محدوده پلتفرم */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-3">
        <div>
          <h2 className="font-black text-sm text-gray-900 dark:text-white">پلتفرم هدف</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            اگر هیچی انتخاب نشود، قانون برای همه مارکت‌پلیس‌ها اعمال می‌شود
          </p>
        </div>
        <div className="flex gap-3">
          {PLATFORMS.map(p => (
            <label key={p.code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={platforms.includes(p.code)}
                onChange={() => togglePlatform(p.code)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-bold">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* فرمول */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-black text-sm text-gray-900 dark:text-white">فرمول قیمت</h2>
            <p className="text-xs text-gray-400 mt-0.5">JSON — یا از template‌های آماده استفاده کنید</p>
          </div>
        </div>

        {/* template‌ها */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">Template‌های آماده</p>
          <div className="flex flex-wrap gap-2">
            {RULE_TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => applyTemplate(t.key)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* editor */}
        <div>
          <textarea
            value={formulaStr}
            onChange={e => handleFormulaChange(e.target.value)}
            rows={14}
            spellCheck={false}
            className={`w-full px-4 py-3 rounded-xl border font-mono text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-white/[0.03] placeholder-gray-400 focus:outline-none transition-colors resize-y ${
              formulaError
                ? "border-red-400 dark:border-red-600"
                : "border-gray-200 dark:border-white/[0.08] focus:border-blue-500"
            }`}
            dir="ltr"
          />
          {formulaError && (
            <p className="text-xs text-red-500 mt-1">{formulaError}</p>
          )}
        </div>

        {/* راهنمای متغیرها */}
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3 space-y-1.5">
            <p className="font-bold text-gray-700 dark:text-gray-300">متغیرها (var)</p>
            <div className="space-y-1 text-gray-500 font-mono">
              <p>"shop_price" — قیمت فروشگاه</p>
              <p>"last_purchase_price" — قیمت خرید (از حسابان)</p>
              <p>"avg_purchase_price" — میانگین قیمت خرید</p>
              <p>"current_stock" — موجودی فعلی</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3 space-y-1.5">
            <p className="font-bold text-gray-700 dark:text-gray-300">عملیات</p>
            <div className="space-y-1 text-gray-500 font-mono">
              <p>add / subtract / multiply / divide</p>
              <p>max / min</p>
              <p>percent_of (percent, of)</p>
              <p>round_up (to, arg)</p>
              <p>if (condition, then, else)</p>
            </div>
          </div>
        </div>
      </div>

      {/* پیش‌نمایش */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">پیش‌نمایش فرمول</h2>
        <p className="text-xs text-gray-400 -mt-2">مقادیر نمونه وارد کنید تا نتیجه فرمول را ببینید</p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">قیمت فروشگاه (ریال)</label>
            <input
              type="number"
              value={shopPrice}
              onChange={e => { setShopPrice(e.target.value); setPreviewResult(null); }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">قیمت خرید (ریال)</label>
            <input
              type="number"
              value={purchPrice}
              onChange={e => { setPurchPrice(e.target.value); setPreviewResult(null); }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">موجودی (عدد)</label>
            <input
              type="number"
              value={stock}
              onChange={e => { setStock(e.target.value); setPreviewResult(null); }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePreview}
            disabled={!!formulaError}
            className="px-4 py-2 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            محاسبه
          </button>

          {previewResult !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">نتیجه:</span>
              <span className="text-lg font-black text-green-600 dark:text-green-400">
                {previewResult.toLocaleString("fa-IR")} ریال
              </span>
            </div>
          )}

          {previewError && (
            <p className="text-sm text-red-500">{previewError}</p>
          )}
        </div>
      </div>

      {/* ذخیره */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !!formulaError || !name.trim()}
          className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "در حال ذخیره..." : mode === "create" ? "ایجاد قانون" : "ذخیره تغییرات"}
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}
