"use client"; 

import { VERSIONS } from "@/lib/changelog-data";

const TAG_CONFIG = {
  major: { label: "Major", color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
  minor: { label: "Minor", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  patch: { label: "Patch", color: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

const CHANGE_CONFIG = {
  feature:     { label: "قابلیت جدید", color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/10",    icon: "✦" },
  improvement: { label: "بهبود",        color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/10", icon: "↑" },
  fix:         { label: "اصلاح",        color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/10",  icon: "✓" },
  security:    { label: "امنیت",        color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/10", icon: "🔒" },
};

export default function ChangelogPage() {
  const latest = VERSIONS[0];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8" dir="rtl">

      {}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">نسخه‌های برنامه</h1>
          <p className="text-sm text-gray-500 mt-1">تاریخچه تغییرات و بروزرسانی‌های سیستم</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl px-5 py-3 text-white shadow-lg shadow-blue-500/30">
          <p className="text-[10px] font-bold opacity-70 mb-0.5">نسخه فعلی</p>
          <p className="text-2xl font-black tracking-tight">{latest.version}</p>
          <p className="text-[10px] opacity-70 mt-0.5">{latest.date}</p>
        </div>
      </div>

      {}
      <div className="relative">
        <div className="absolute right-[22px] top-8 bottom-8 w-px bg-gray-200 dark:bg-white/[0.06]" />

        <div className="space-y-6">
          {VERSIONS.map((v, idx) => {
            const tag = TAG_CONFIG[v.tag as keyof typeof TAG_CONFIG];
            const isLatest = idx === 0;

            return (
              <div key={v.version} className="relative flex gap-6">
                <div className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-black text-xs shadow-lg ${
                  isLatest
                    ? "bg-blue-600 text-white shadow-blue-500/40"
                    : "bg-white dark:bg-[#0f1117] border-2 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
                }`}>
                  {isLatest ? "🔥" : "●"}
                </div>

                <div className={`flex-1 rounded-2xl border overflow-hidden ${
                  isLatest
                    ? "bg-white dark:bg-[#0f1117] border-blue-200 dark:border-blue-500/20 shadow-xl shadow-blue-500/5"
                    : "bg-white dark:bg-[#0f1117] border-gray-200 dark:border-white/[0.06]"
                }`}>
                  <div className={`p-5 border-b ${isLatest ? "border-blue-100 dark:border-blue-500/10" : "border-gray-100 dark:border-white/[0.04]"}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                          v{v.version}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-600 text-white shadow shadow-blue-500/30">
                            جدیدترین
                          </span>
                        )}
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${tag.color}`}>
                          {tag.label}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-bold">{v.date}</span>
                    </div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white mt-2">{v.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-6">{v.description}</p>
                  </div>

                  <div className="p-5">
                    <div className="space-y-2">
                      {v.changes.map((change, i) => {
                        const cfg = CHANGE_CONFIG[change.type as keyof typeof CHANGE_CONFIG];
                        return (
                          <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${cfg.bg}`}>
                            <span className={`text-[11px] font-black flex-shrink-0 mt-0.5 ${cfg.color}`}>
                              {cfg.icon}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 leading-6">
                              {change.text}
                            </span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 mt-1 ${cfg.color} opacity-60`}>
                              {cfg.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.04]">
                      {Object.entries(
                        v.changes.reduce((acc, c) => {
                          acc[c.type] = (acc[c.type] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([type, count]) => {
                        const cfg = CHANGE_CONFIG[type as keyof typeof CHANGE_CONFIG];
                        if (!cfg) return null;
                        return (
                          <div key={type} className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black ${cfg.color}`}>{cfg.icon}</span>
                            <span className="text-[11px] font-bold text-gray-500">{count} {cfg.label}</span>
                          </div>
                        );
                      })}
                      <span className="text-[11px] text-gray-400 mr-auto">{v.changes.length} تغییر کل</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
