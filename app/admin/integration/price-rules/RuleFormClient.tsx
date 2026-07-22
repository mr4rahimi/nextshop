"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// لیست پیش‌فرض — در زمان اجرا با پلتفرم‌های دیتابیس جایگزین می‌شود
const DEFAULT_PLATFORMS = [
  { code: "shop",    label: "فروشگاه" },
  { code: "hesaban", label: "وب‌حسابان" },
  { code: "basalam", label: "باسلام" },
];

interface Tier {
  minStock: string;
  maxStock: string;
  marginPercent: string;
}

interface Props {
  mode: "create" | "edit";
  initial?: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    priority: number;
    targetPlatforms: string[];
    feePercent: number;
    shippingType: "FIXED" | "PERCENT";
    shippingValue: number;
    packagingType: "FIXED" | "PERCENT";
    packagingValue: number;
    miscType: "FIXED" | "PERCENT";
    miscValue: number;
    marginPercent: number;
    roundTo: number | null;
    tiers: { minStock: number | null; maxStock: number | null; marginPercent: number }[];
  };
}

function CostInput({
  label, type, value, onTypeChange, onValueChange,
}: {
  label: string;
  type: "FIXED" | "PERCENT";
  value: string;
  onTypeChange: (t: "FIXED" | "PERCENT") => void;
  onValueChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
          dir="ltr"
        />
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value as "FIXED" | "PERCENT")}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-700 dark:text-gray-300"
        >
          <option value="FIXED">تومان ثابت</option>
          <option value="PERCENT">درصد</option>
        </select>
      </div>
    </div>
  );
}

export default function RuleFormClient({ mode, initial }: Props) {
  const router = useRouter();
  const [name, setName]               = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority]       = useState(String(initial?.priority ?? 100));
  const [isActive, setIsActive]       = useState(initial?.isActive ?? true);
  const [platforms, setPlatforms]     = useState<string[]>(initial?.targetPlatforms ?? []);
  const [availablePlatforms, setAvailablePlatforms] = useState(DEFAULT_PLATFORMS);

  // پلتفرم‌های فعال از دیتابیس — پلتفرم جدید (تپسی‌شاپ و…) خودکار اینجا ظاهر می‌شود
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/integration/platforms");
        if (!res.ok) return;
        const data = await res.json() as { platforms?: { code: string; name: string }[] };
        if (data.platforms?.length) {
          setAvailablePlatforms([
            { code: "shop", label: "فروشگاه" },
            ...data.platforms.map((p) => ({ code: p.code, label: p.name })),
          ]);
        }
      } catch { /* لیست پیش‌فرض باقی می‌ماند */ }
    })();
  }, []);

  const [feePercent, setFeePercent]       = useState(String(initial?.feePercent ?? 0));
  const [shippingType, setShippingType]   = useState<"FIXED" | "PERCENT">(initial?.shippingType ?? "FIXED");
  const [shippingValue, setShippingValue] = useState(String(initial?.shippingValue ?? 0));
  const [packagingType, setPackagingType] = useState<"FIXED" | "PERCENT">(initial?.packagingType ?? "FIXED");
  const [packagingValue, setPackagingValue] = useState(String(initial?.packagingValue ?? 0));
  const [miscType, setMiscType]           = useState<"FIXED" | "PERCENT">(initial?.miscType ?? "FIXED");
  const [miscValue, setMiscValue]         = useState(String(initial?.miscValue ?? 0));
  const [marginPercent, setMarginPercent] = useState(String(initial?.marginPercent ?? 0));
  const [roundTo, setRoundTo]             = useState(String(initial?.roundTo ?? 1000));

  const [tiers, setTiers] = useState<Tier[]>(
    (initial?.tiers ?? []).map((t) => ({
      minStock: t.minStock?.toString() ?? "",
      maxStock: t.maxStock?.toString() ?? "",
      marginPercent: String(t.marginPercent),
    })),
  );

  const [purchasePrice, setPurchasePrice] = useState("100000");
  const [stock, setStock] = useState("10");
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function togglePlatform(code: string) {
    setPlatforms((prev) => (prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]));
  }

  function addTier() {
    setTiers((prev) => [...prev, { minStock: "", maxStock: "", marginPercent: "0" }]);
  }
  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateTier(i: number, field: keyof Tier, value: string) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function computePreview() {
    const base = Number(purchasePrice) || 0;
    const st = Number(stock) || 0;

    let margin = Number(marginPercent) || 0;
    for (const t of tiers) {
      const min = t.minStock ? Number(t.minStock) : null;
      const max = t.maxStock ? Number(t.maxStock) : null;
      const minOk = min == null || st >= min;
      const maxOk = max == null || st < max;
      if (minOk && maxOk) { margin = Number(t.marginPercent) || 0; break; }
    }

    const cost = (type: string, value: string) => (type === "PERCENT" ? (Number(value) / 100) * base : Number(value) || 0);

    const fee = (Number(feePercent) / 100) * base;
    const shipping = cost(shippingType, shippingValue);
    const packaging = cost(packagingType, packagingValue);
    const misc = cost(miscType, miscValue);

    const subtotal = base + fee + shipping + packaging + misc;
    let final = subtotal * (1 + margin / 100);
    const rt = Number(roundTo);
    if (rt > 0) final = Math.ceil(final / rt) * rt;

    setPreview(Math.round(final));
  }

  async function handleSave() {
    if (!name.trim()) { alert("نام قانون الزامی است"); return; }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        priority: Number(priority) || 100,
        isActive,
        targetPlatforms: platforms,
        feePercent: Number(feePercent) || 0,
        shippingType, shippingValue: Number(shippingValue) || 0,
        packagingType, packagingValue: Number(packagingValue) || 0,
        miscType, miscValue: Number(miscValue) || 0,
        marginPercent: Number(marginPercent) || 0,
        roundTo: Number(roundTo) || null,
        tiers: tiers.map((t) => ({
          minStock: t.minStock ? Number(t.minStock) : null,
          maxStock: t.maxStock ? Number(t.maxStock) : null,
          marginPercent: Number(t.marginPercent) || 0,
        })),
      };

      const url = mode === "create" ? "/api/integration/price-rules" : `/api/integration/price-rules/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

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
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">اطلاعات قانون</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">نام قانون <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">اولویت (عدد کمتر = اجرا اول)</label>
            <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" dir="ltr" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">توضیح (اختیاری)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">قانون فعال باشد</span>
        </label>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-3">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">پلتفرم هدف</h2>
        <p className="text-xs text-gray-400 -mt-1">اگر هیچی انتخاب نشود، برای همه اعمال می‌شود (شامل فروشگاه)</p>
        <div className="flex gap-3 flex-wrap">
          {availablePlatforms.map((p) => (
            <label key={p.code} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={platforms.includes(p.code)} onChange={() => togglePlatform(p.code)} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-bold">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">هزینه‌ها و کارمزد</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">درصد کارمزد پلتفرم</label>
            <input type="number" value={feePercent} onChange={(e) => setFeePercent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">درصد سود پیش‌فرض</label>
            <input type="number" value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" dir="ltr" />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <CostInput label="هزینه ارسال" type={shippingType} value={shippingValue} onTypeChange={setShippingType} onValueChange={setShippingValue} />
          <CostInput label="هزینه بسته‌بندی" type={packagingType} value={packagingValue} onTypeChange={setPackagingType} onValueChange={setPackagingValue} />
          <CostInput label="سایر هزینه‌ها" type={miscType} value={miscValue} onTypeChange={setMiscType} onValueChange={setMiscValue} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">گرد کردن نهایی (تومان) — اختیاری</label>
          <input type="number" value={roundTo} onChange={(e) => setRoundTo(e.target.value)}
            className="w-40 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" dir="ltr" />
        </div>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-sm text-gray-900 dark:text-white">قوانین پلکانی سود بر اساس موجودی</h2>
            <p className="text-xs text-gray-400 mt-0.5">اولین ردیفی که موجودی داخلش بیفتد، جای «درصد سود پیش‌فرض» می‌نشیند</p>
          </div>
          <button onClick={addTier} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors">
            + ردیف جدید
          </button>
        </div>
        {tiers.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">قانون پلکانی‌ای تعریف نشده — درصد سود پیش‌فرض همیشه استفاده می‌شود</p>
        ) : (
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="number" placeholder="حداقل موجودی" value={t.minStock} onChange={(e) => updateTier(i, "minStock", e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white" dir="ltr" />
                <span className="text-gray-400 text-xs">تا</span>
                <input type="number" placeholder="حداکثر موجودی (خالی=نامحدود)" value={t.maxStock} onChange={(e) => updateTier(i, "maxStock", e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white" dir="ltr" />
                <span className="text-gray-400 text-xs">→ سود</span>
                <input type="number" placeholder="درصد سود" value={t.marginPercent} onChange={(e) => updateTier(i, "marginPercent", e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white" dir="ltr" />
                <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-500 text-xs px-2">حذف</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">پیش‌نمایش</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">قیمت خرید (تومان)</label>
            <input type="number" value={purchasePrice} onChange={(e) => { setPurchasePrice(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">موجودی نگاشت</label>
            <input type="number" value={stock} onChange={(e) => { setStock(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white" dir="ltr" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={computePreview} className="px-4 py-2 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
            محاسبه
          </button>
          {preview !== null && (
            <span className="text-lg font-black text-green-600 dark:text-green-400">{preview.toLocaleString("fa-IR")} تومان</span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40">
          {saving ? "در حال ذخیره..." : mode === "create" ? "ایجاد قانون" : "ذخیره تغییرات"}
        </button>
        <button onClick={() => router.back()} className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          انصراف
        </button>
      </div>
    </div>
  );
}