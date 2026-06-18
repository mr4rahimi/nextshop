"use client";

import { useEffect, useState, useCallback } from "react";

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);

  // linear sRGB → OKLab
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bv * bv);
  let H = Math.atan2(bv, a) * 180 / Math.PI;
  if (H < 0) H += 360;

  return [L, C, H];
}

function hexToOklchString(hex: string): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    const [L, C, H] = rgbToOklch(r, g, b);
    return `oklch(${(L * 100).toFixed(3)}% ${C.toFixed(5)} ${H.toFixed(2)})`;
  } catch {
    return hex;
  }
}

function generateColorScale(baseHex: string, steps: number[]): Record<string, string> {
  try {
    const [r, g, b] = hexToRgb(baseHex);
    const [, C, H] = rgbToOklch(r, g, b);
    const result: Record<string, string> = {};
    steps.forEach(step => {
      const L = 0.97 - (step / 1000) * 0.87;
      const chroma = step === 50 || step === 100 ? C * 0.25 :
                     step === 200 ? C * 0.5 :
                     step === 300 ? C * 0.7 :
                     step === 400 ? C * 0.85 :
                     step === 500 ? C :
                     step === 600 ? C * 0.87 :
                     step === 700 ? C * 0.68 :
                     step === 800 ? C * 0.47 :
                     step === 900 ? C * 0.22 : C * 0.1;
      result[`step-${step}`] = `oklch(${(L * 100).toFixed(3)}% ${chroma.toFixed(5)} ${H.toFixed(2)})`;
    });
    return result;
  } catch {
    return {};
  }
}

function oklchToHex(oklchStr: string): string {
  try {
    const match = oklchStr.match(/oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/);
    if (!match) return "#3b82f6";
    const L = parseFloat(match[1]) / 100;
    const C = parseFloat(match[2]);
    const H = parseFloat(match[3]) * Math.PI / 180;

    const a = C * Math.cos(H);
    const bv = C * Math.sin(H);

    // OKLab → linear sRGB
    const l_ = L + 0.3963377774 * a + 0.2158037573 * bv;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * bv;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * bv;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const toSrgb = (c: number) => {
      c = Math.max(0, Math.min(1, c));
      return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };

    r = toSrgb(r); g = toSrgb(g); b = toSrgb(b);
    const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return "#3b82f6";
  }
}

const COLOR_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_SECONDARY = "#ef4444";
const DEFAULT_CUSTOM_LIGHT = "#f2f5fc";
const DEFAULT_CUSTOM_DARK = "#161b22";

interface ThemeConfig {
  primaryBase: string;
  secondaryBase: string;
  customLight: string;
  customDark: string;
}

function buildCssVarsFromTheme(theme: ThemeConfig): Record<string, string> {
  const vars: Record<string, string> = {};
  const primaryScale = generateColorScale(theme.primaryBase, COLOR_STEPS);
  const secondaryScale = generateColorScale(theme.secondaryBase, COLOR_STEPS);

  vars["--color-primary"] = primaryScale["step-500"] ?? hexToOklchString(theme.primaryBase);
  COLOR_STEPS.forEach(step => {
    vars[`--color-primary-${step}`] = primaryScale[`step-${step}`] ?? "";
  });

  vars["--color-secondary"] = secondaryScale["step-500"] ?? hexToOklchString(theme.secondaryBase);
  COLOR_STEPS.forEach(step => {
    vars[`--color-secondary-${step}`] = secondaryScale[`step-${step}`] ?? "";
  });

  vars["--color-custom-light"] = theme.customLight;
  vars["--color-custom-dark"] = theme.customDark;

  return vars;
}

function ThemePreview({ theme }: { theme: ThemeConfig }) {
  const scale = generateColorScale(theme.primaryBase, COLOR_STEPS);
  const secScale = generateColorScale(theme.secondaryBase, COLOR_STEPS);

  return (
    <div className="space-y-4">
      {}
      <div className="flex flex-wrap gap-3">
        <div className="px-5 py-2.5 rounded-xl text-white text-sm font-black"
          style={{ backgroundColor: scale["step-500"] }}>
          دکمه اصلی
        </div>
        <div className="px-5 py-2.5 rounded-xl text-white text-sm font-black"
          style={{ backgroundColor: secScale["step-500"] }}>
          دکمه ثانویه
        </div>
        <div className="px-5 py-2.5 rounded-xl text-sm font-black border"
          style={{ color: scale["step-600"], borderColor: scale["step-300"], backgroundColor: scale["step-50"] }}>
          دکمه outline
        </div>
      </div>

      {}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2">رنگ‌های primary</p>
        <div className="flex rounded-xl overflow-hidden">
          {COLOR_STEPS.map(step => (
            <div key={step} className="flex-1 h-10 flex items-end justify-center pb-1"
              style={{ backgroundColor: scale[`step-${step}`] }}>
              <span className="text-[8px] font-bold opacity-60" style={{ color: step < 500 ? "#000" : "#fff" }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div>
        <p className="text-xs font-black text-gray-400 mb-2">رنگ‌های secondary</p>
        <div className="flex rounded-xl overflow-hidden">
          {COLOR_STEPS.map(step => (
            <div key={step} className="flex-1 h-10 flex items-end justify-center pb-1"
              style={{ backgroundColor: secScale[`step-${step}`] }}>
              <span className="text-[8px] font-bold opacity-60" style={{ color: step < 500 ? "#000" : "#fff" }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="flex gap-3">
        <div className="flex-1 h-12 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center text-xs font-black text-gray-700"
          style={{ backgroundColor: theme.customLight }}>
          custom-light
        </div>
        <div className="flex-1 h-12 rounded-xl flex items-center justify-center text-xs font-black text-white"
          style={{ backgroundColor: theme.customDark }}>
          custom-dark
        </div>
      </div>

      {}
      <div className="p-4 rounded-2xl border"
        style={{ backgroundColor: theme.customLight, borderColor: scale["step-100"] }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black" style={{ color: scale["step-700"] }}>محصول نمونه</p>
            <p className="text-xs mt-0.5" style={{ color: scale["step-400"] }}>دسته‌بندی محصول</p>
          </div>
          <div className="text-lg font-black" style={{ color: scale["step-600"] }}>۱۲۵,۰۰۰ ت</div>
        </div>
        <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: scale["step-100"] }}>
          <div className="h-full rounded-full w-3/5" style={{ backgroundColor: scale["step-500"] }} />
        </div>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const [theme, setTheme] = useState<ThemeConfig>({
    primaryBase: DEFAULT_PRIMARY,
    secondaryBase: DEFAULT_SECONDARY,
    customLight: DEFAULT_CUSTOM_LIGHT,
    customDark: DEFAULT_CUSTOM_DARK,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/theme")
      .then(r => r.json())
      .then(data => {
        if (data["--color-primary-500"]) {
          setTheme({
            primaryBase: oklchToHex(data["--color-primary-500"]),
            secondaryBase: oklchToHex(data["--color-secondary-500"]),
            customLight: data["--color-custom-light"] ?? DEFAULT_CUSTOM_LIGHT,
            customDark: data["--color-custom-dark"] ?? DEFAULT_CUSTOM_DARK,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const cssVars = buildCssVarsFromTheme(theme);
    await fetch("/api/admin/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cssVars),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleReset() {
    setResetting(true);
    const defaultTheme: ThemeConfig = {
      primaryBase: DEFAULT_PRIMARY,
      secondaryBase: DEFAULT_SECONDARY,
      customLight: DEFAULT_CUSTOM_LIGHT,
      customDark: DEFAULT_CUSTOM_DARK,
    };
    setTheme(defaultTheme);
    await fetch("/api/admin/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setResetting(false);
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 bg-white dark:bg-[#0f1117] rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  const PRESETS = [
    { name: "آبی (پیش‌فرض)", primary: "#3b82f6", secondary: "#ef4444" },
    { name: "بنفش",          primary: "#8b5cf6", secondary: "#f59e0b" },
    { name: "سبز",           primary: "#10b981", secondary: "#3b82f6" },
    { name: "نارنجی",        primary: "#f97316", secondary: "#8b5cf6" },
    { name: "صورتی",         primary: "#ec4899", secondary: "#06b6d4" },
    { name: "فیروزه‌ای",     primary: "#06b6d4", secondary: "#f97316" },
    { name: "قرمز",          primary: "#ef4444", secondary: "#3b82f6" },
    { name: "طلایی",         primary: "#eab308", secondary: "#6366f1" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">تنظیمات ظاهری</h1>
          <p className="text-xs text-gray-500 mt-0.5">رنگ‌بندی سایت را برای همه کاربران سفارشی کنید</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} disabled={resetting}
            className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-black hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
            {resetting ? "در حال بازنشانی..." : "بازنشانی"}
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-500/20"
            } disabled:opacity-50`}>
            {saving ? "در حال ذخیره..." : saved ? "✓ ذخیره شد" : "اعمال تغییرات"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {}
        <div className="space-y-4">
          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">پالت‌های آماده</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map(preset => (
                <button key={preset.name}
                  onClick={() => setTheme(prev => ({ ...prev, primaryBase: preset.primary, secondaryBase: preset.secondary }))}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    theme.primaryBase === preset.primary && theme.secondaryBase === preset.secondary
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                      : "border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20"
                  }`}>
                  <div className="flex justify-center gap-1 mb-2">
                    <div className="w-5 h-5 rounded-full shadow" style={{ backgroundColor: preset.primary }} />
                    <div className="w-5 h-5 rounded-full shadow" style={{ backgroundColor: preset.secondary }} />
                  </div>
                  <p className="text-[10px] font-black text-gray-600 dark:text-gray-400">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">رنگ اصلی (Primary)</h2>
            <p className="text-xs text-gray-400 mb-4">رنگ دکمه‌ها، لینک‌ها، و عناصر اصلی سایت</p>

            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <input type="color" value={theme.primaryBase}
                  onChange={e => setTheme(prev => ({ ...prev, primaryBase: e.target.value }))}
                  className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-lg" />
              </div>
              <div className="flex-1">
                <input type="text" value={theme.primaryBase}
                  onChange={e => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                      setTheme(prev => ({ ...prev, primaryBase: e.target.value }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  dir="ltr" placeholder="#3b82f6" />
                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                  oklch: {hexToOklchString(theme.primaryBase)}
                </p>
              </div>
            </div>

            {}
            <div className="flex rounded-xl overflow-hidden">
              {COLOR_STEPS.map(step => {
                const scale = generateColorScale(theme.primaryBase, COLOR_STEPS);
                return (
                  <div key={step} className="flex-1 h-8" style={{ backgroundColor: scale[`step-${step}`] }}
                    title={`primary-${step}`} />
                );
              })}
            </div>
            <div className="flex mt-1">
              {COLOR_STEPS.map(step => (
                <div key={step} className="flex-1 text-center">
                  <span className="text-[8px] text-gray-400">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">رنگ ثانویه (Secondary)</h2>
            <p className="text-xs text-gray-400 mb-4">رنگ تخفیف‌ها، برچسب‌های ویژه و تأکیدهای ثانویه</p>

            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <input type="color" value={theme.secondaryBase}
                  onChange={e => setTheme(prev => ({ ...prev, secondaryBase: e.target.value }))}
                  className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-lg" />
              </div>
              <div className="flex-1">
                <input type="text" value={theme.secondaryBase}
                  onChange={e => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                      setTheme(prev => ({ ...prev, secondaryBase: e.target.value }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  dir="ltr" placeholder="#ef4444" />
                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                  oklch: {hexToOklchString(theme.secondaryBase)}
                </p>
              </div>
            </div>

            <div className="flex rounded-xl overflow-hidden">
              {COLOR_STEPS.map(step => {
                const scale = generateColorScale(theme.secondaryBase, COLOR_STEPS);
                return (
                  <div key={step} className="flex-1 h-8" style={{ backgroundColor: scale[`step-${step}`] }}
                    title={`secondary-${step}`} />
                );
              })}
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">رنگ‌های پس‌زمینه</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">
                  پس‌زمینه روشن (custom-light)
                </label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.customLight}
                    onChange={e => setTheme(prev => ({ ...prev, customLight: e.target.value }))}
                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white shadow" />
                  <input type="text" value={theme.customLight} dir="ltr"
                    onChange={e => setTheme(prev => ({ ...prev, customLight: e.target.value }))}
                    className="flex-1 px-2 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-mono text-gray-900 dark:text-white focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">
                  پس‌زمینه تاریک (custom-dark)
                </label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.customDark}
                    onChange={e => setTheme(prev => ({ ...prev, customDark: e.target.value }))}
                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white shadow" />
                  <input type="text" value={theme.customDark} dir="ltr"
                    onChange={e => setTheme(prev => ({ ...prev, customDark: e.target.value }))}
                    className="flex-1 px-2 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-mono text-gray-900 dark:text-white focus:outline-none transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 sticky top-8">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">پیش‌نمایش زنده</h2>
            <ThemePreview theme={theme} />

            {}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              <p className="text-xs font-black text-gray-400 mb-2">CSS Variables تولیدشده</p>
              <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 max-h-48 overflow-y-auto">
                <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-400 leading-5">
                  {Object.entries(buildCssVarsFromTheme(theme))
                    .map(([k, v]) => `${k}: ${v};`)
                    .join("\n")}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
