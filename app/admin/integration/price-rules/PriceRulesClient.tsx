"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  targetPlatforms: string[];
  tiersCount: number;
  marginPercent: number;
}

interface Props {
  initialRules: Rule[];
  platformLabels: Record<string, string>;
}

export default function PriceRulesClient({ initialRules, platformLabels }: Props) {
  const [rules, setRules] = useState<Rule[]>(initialRules ?? []);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle(rule: Rule) {
    setToggling(rule.id);
    try {
      const res = await fetch(`/api/integration/price-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("این قانون حذف شود؟")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/integration/price-rules/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  if (rules.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
        <div className="text-4xl mb-4 opacity-20">⚖</div>
        <p className="text-gray-400 text-sm font-bold">هنوز قانونی تعریف نشده</p>
        <p className="text-gray-400 text-xs mt-2">قانون جدید بسازید</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`bg-white dark:bg-[#0f1117] rounded-2xl border p-4 transition-colors ${
            rule.isActive
              ? "border-gray-200 dark:border-white/[0.06]"
              : "border-gray-100 dark:border-white/[0.03] opacity-60"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-gray-500 dark:text-gray-400">{rule.priority}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-sm text-gray-900 dark:text-white">{rule.name}</p>
                {rule.targetPlatforms.length > 0 ? (
                  <div className="flex gap-1">
                    {rule.targetPlatforms.map((p) => (
                      <span key={p} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                        {platformLabels[p] ?? p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500">
                    همه پلتفرم‌ها
                  </span>
                )}
                {rule.tiersCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    {rule.tiersCount} قانون پلکانی
                  </span>
                )}
              </div>
              {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
              <p className="text-xs text-gray-400 mt-0.5">سود پیش‌فرض: {rule.marginPercent}٪</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleToggle(rule)}
                disabled={toggling === rule.id}
                className={`text-[10px] font-black px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 ${
                  rule.isActive
                    ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30"
                    : "bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                {toggling === rule.id ? "..." : rule.isActive ? "فعال" : "غیرفعال"}
              </button>

              <button
                onClick={() => router.push(`/admin/integration/price-rules/${rule.id}`)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
              >
                ویرایش
              </button>

              <button
                onClick={() => handleDelete(rule.id)}
                disabled={deleting === rule.id}
                className="text-xs text-red-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-40"
              >
                {deleting === rule.id ? "..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}