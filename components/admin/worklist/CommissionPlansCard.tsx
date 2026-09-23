"use client";

/**
 * طرح‌های پورسانت در تنظیمات کارتابل: قاعده‌ها و وصل‌کردن طرح به کارکنان.
 *
 * فرم قاعده دو انتخابگر، تیک ریفری و یک عدد دارد: دسته (خالی = همه)، وضعیت
 * (خالی = هر کدام)، ریفری (فقط فروش معرفی‌شده)، درصد. کارت برای کسی که مجوز ندارد رندر نمی‌شود.
 */

import { useCallback, useEffect, useState } from "react";
import { CONDITION_LABELS } from "@/lib/worklist/commission-rules";
import HelpButton from "./HelpButton";

interface Rule {
  id: string;
  categoryId: string | null;
  condition: string | null;
  referral: boolean;
  percent: number;
  category: { title: string } | null;
}
interface Plan {
  id: string;
  title: string;
  isActive: boolean;
  rules: Rule[];
  _count: { users: number };
}
interface Category {
  id: string;
  title: string;
  parentId: string | null;
}

const inputCls =
  "px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400";

export default function CommissionPlansCard() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string; planId: string | null }[]>([]);
  const [manage, setManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/worklist/commission/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setPlans(d.plans);
        setCategories(d.categories);
        setStaff(d.staff);
        setManage(d.can.manage);
      })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function call(url: string, method: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) setError((await res.json()).error ?? "انجام نشد");
    load();
  }

  if (!plans) return null;

  // مسیر کامل دسته برای انتخابگر — «دستگاه‌ها › لیزری»
  const byId = new Map(categories.map((c) => [c.id, c]));
  const label = (c: Category) => {
    const parts = [c.title];
    let p = c.parentId ? byId.get(c.parentId) : undefined;
    for (let i = 0; p && i < 5; i++, p = p.parentId ? byId.get(p.parentId) : undefined) parts.unshift(p.title);
    return parts.join(" › ");
  };
  const sortedCats = [...categories].sort((a, b) => label(a).localeCompare(label(b), "fa"));

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 mb-5 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-black text-gray-900 dark:text-white">طرح‌های پورسانت</h2>
        <HelpButton topic="commissionPlans" size="sm" />
      </div>
      <p className="text-[11px] text-gray-500">
        قاعده‌ی بدون دسته، درصدِ همه‌ی کالاهاست. هر قاعده‌ی دقیق‌تر، فقط همان‌ها را عوض می‌کند.
        قاعده‌ی «ریفری» فقط فروش‌های معرفی‌شده را می‌گیرد و بر بقیه برنده است.
      </p>

      {plans.map((plan) => (
        <PlanBlock key={plan.id} plan={plan} categories={sortedCats} label={label} manage={manage} call={call} />
      ))}

      {manage && (
        <div className="flex gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="عنوان طرح تازه، مثلاً «فروش ارشد»" className={`${inputCls} flex-1`} />
          <button
            disabled={!newTitle.trim()}
            onClick={() => {
              void call("/api/admin/worklist/commission/plans", "POST", { title: newTitle, defaultPercent: 10 });
              setNewTitle("");
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-40"
          >
            ساخت طرح
          </button>
        </div>
      )}

      {manage && staff.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-white/5">
          <p className="text-xs font-bold text-gray-900 dark:text-white mb-2">طرح هر کارمند</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {staff.map((u) => (
              <label key={u.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300">
                {u.name}
                <select
                  value={u.planId ?? ""}
                  onChange={(e) => call("/api/admin/worklist/commission/assign", "POST", { userId: u.id, planId: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">بدون پورسانت</option>
                  {plans.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

function PlanBlock({
  plan,
  categories,
  label,
  manage,
  call,
}: {
  plan: Plan;
  categories: Category[];
  label: (c: Category) => string;
  manage: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("");
  const [referral, setReferral] = useState(false);
  const [percent, setPercent] = useState("");
  const catTitle = (id: string | null) => {
    const c = id ? categories.find((x) => x.id === id) : undefined;
    return c ? label(c) : "همه‌ی کالاها";
  };

  return (
    <div className={`rounded-xl border border-gray-100 dark:border-white/5 p-3 space-y-2 ${plan.isActive ? "" : "opacity-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-gray-900 dark:text-white">
          {plan.title}
          <span className="font-normal text-gray-400 mr-1.5">{plan._count.users.toLocaleString("fa-IR")} کارمند</span>
        </p>
        {manage && (
          <button
            onClick={() => call(`/api/admin/worklist/commission/plans/${plan.id}`, "PATCH", { isActive: !plan.isActive })}
            className="text-[11px] font-bold text-gray-500 hover:text-amber-600"
          >
            {plan.isActive ? "غیرفعال" : "فعال"}
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {plan.rules.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 py-1.5 text-xs">
            <span className="flex-1 text-gray-700 dark:text-gray-300">
              {r.referral && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 font-bold">ریفری</span>
              )}
              {catTitle(r.categoryId)}
              {r.condition && <span className="text-violet-600 mr-1.5">· {CONDITION_LABELS[r.condition]}</span>}
              {!r.categoryId && !r.condition && !r.referral && <span className="text-[10px] text-gray-400 mr-1.5">(پیش‌فرض)</span>}
            </span>
            {manage ? (
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                defaultValue={r.percent}
                onBlur={(e) => Number(e.target.value) !== r.percent && call(`/api/admin/worklist/commission/rules/${r.id}`, "PATCH", { percent: Number(e.target.value) })}
                className={`${inputCls} w-20`}
                dir="ltr"
              />
            ) : (
              <span className="font-bold">{r.percent}٪</span>
            )}
            {manage && (r.categoryId || r.condition || r.referral) && (
              <button onClick={() => call(`/api/admin/worklist/commission/rules/${r.id}`, "DELETE")} className="text-gray-400 hover:text-red-500" aria-label="حذف قاعده">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {manage && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputCls} max-w-[220px]`}>
            <option value="">همه‌ی دسته‌ها</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{label(c)}</option>
            ))}
          </select>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
            <option value="">هر وضعیتی</option>
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={referral} onChange={(e) => setReferral(e.target.checked)} className="w-3.5 h-3.5 accent-violet-500" />
            ریفری
          </label>
          <input type="number" min={0} max={100} step={0.5} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="درصد" className={`${inputCls} w-20`} dir="ltr" />
          <button
            disabled={percent === "" || (!categoryId && !condition && !referral)}
            onClick={() => {
              void call(`/api/admin/worklist/commission/plans/${plan.id}`, "PATCH", {
                addRule: { categoryId: categoryId || null, condition: condition || null, referral, percent: Number(percent) },
              });
              setPercent("");
              setReferral(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold disabled:opacity-40"
          >
            افزودن قاعده
          </button>
        </div>
      )}
    </div>
  );
}
