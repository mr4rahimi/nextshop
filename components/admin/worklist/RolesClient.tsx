"use client";

/**
 * مدیریت نقش‌ها و دسترسی‌ها.
 *
 * الگو: **هیچ بخشی بر اساس نقش تصمیم نمی‌گیرد، همیشه مجوز بررسی می‌شود.**
 * نقش فقط یک بسته‌ی مجوز است. مدیر می‌تواند نقش بسازد و مجوزها را جابه‌جا
 * کند، ولی نمی‌تواند کلید مجوز تازه اختراع کند — کلیدها در کد تعریف‌اند.
 *
 * دو محافظ که سمت سرور هم اعمال می‌شوند:
 *  - نقش سیستمیِ «مدیر» نه مجوزش کم می‌شود نه غیرفعال، وگرنه با یک اشتباه
 *    هیچ‌کس به همین صفحه دسترسی ندارد.
 *  - نقشی که به کسی داده شده حذف نمی‌شود؛ آن افراد بی‌صدا به «دسترسی کامل»
 *    برمی‌گشتند که برعکسِ خواست مدیر است.
 */

import { useCallback, useEffect, useState } from "react";
import HelpButton from "./HelpButton";

interface PermissionDef {
  key: string;
  label: string;
  hint?: string;
}
interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionDef[];
}
interface Role {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  _count: { users: number };
}

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function RolesClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [newTitle, setNewTitle] = useState("");
  const [showNew, setShowNew] = useState(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/worklist/roles")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        return d;
      })
      .then((d) => {
        if (ignore) return;
        setRoles(d.roles ?? []);
        setGroups(d.permissionGroups ?? []);
        setError(null);
      })
      .catch((e) => {
        if (!ignore) setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود");
      });
    return () => { ignore = true; };
  }, [reloadKey]);

  function openRole(role: Role) {
    if (openId === role.id) {
      setOpenId(null);
      return;
    }
    setOpenId(role.id);
    setDraft(new Set(role.permissions));
    setMsg(null);
  }

  function toggle(key: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(g: PermissionGroup, on: boolean) {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const i of g.items) {
        if (on) next.add(i.key);
        else next.delete(i.key);
      }
      return next;
    });
  }

  async function savePermissions(role: Role) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/worklist/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: [...draft] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره ناموفق بود");
      setMsg(`دسترسی‌های «${role.title}» ذخیره شد.`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    if (!newTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), permissions: [] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ساخت ناموفق بود");
      setNewTitle("");
      setShowNew(false);
      setMsg("نقش ساخته شد. حالا دسترسی‌هایش را انتخاب کنید.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخت ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(role: Role) {
    if (!confirm(`نقش «${role.title}» حذف شود؟`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/worklist/roles/${role.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "حذف ناموفق بود");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition"
        >
          {showNew ? "بستن" : "نقش تازه"}
        </button>
        <span className="text-[11px] text-gray-500">
          ادمینی که نقش ندارد، دسترسی کامل دارد
        </span>
      </div>

      {showNew && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="مثلاً: انباردار"
            className="flex-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
          />
          <button
            onClick={createRole}
            disabled={busy || !newTitle.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
          >
            بساز
          </button>
        </div>
      )}

      {msg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        {roles.map((role) => {
          const isOpen = openId === role.id;
          return (
            <div
              key={role.id}
              className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden"
            >
              <button
                onClick={() => openRole(role)}
                className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {role.title}
                    </h3>
                    {role.isSystem && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        سیستمی
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {role.isSystem
                      ? "دسترسی کامل — قابل تغییر نیست"
                      : `${fa(role.permissions.length)} دسترسی`}
                    {role._count.users > 0 && ` · ${fa(role._count.users)} نفر`}
                  </p>
                </div>
                <span className="text-gray-400 text-xs shrink-0">
                  {isOpen ? "بستن" : "دسترسی‌ها"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-white/5 p-4 space-y-4">
                  {role.isSystem ? (
                    <p className="text-xs text-gray-500">
                      نقش مدیر همیشه همه‌ی دسترسی‌ها را دارد و تغییر نمی‌کند. این
                      عمدی است: بدون آن، یک اشتباه می‌تواند همه را از تنظیمات
                      نقش‌ها بیرون بگذارد.
                    </p>
                  ) : (
                    <>
                      {groups.map((g) => {
                        const all = g.items.every((i) => draft.has(i.key));
                        return (
                          <div key={g.key}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                {g.label}
                              </h4>
                              <button
                                onClick={() => toggleGroup(g, !all)}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400"
                              >
                                {all ? "برداشتن همه" : "انتخاب همه"}
                              </button>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-1.5">
                              {g.items.map((i) => (
                                <label
                                  key={i.key}
                                  className="flex items-start gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition"
                                >
                                  <input
                                    type="checkbox"
                                    checked={draft.has(i.key)}
                                    onChange={() => toggle(i.key)}
                                    className="mt-0.5 w-4 h-4 rounded accent-blue-500 shrink-0"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                                      {i.label}
                                    </span>
                                    {i.hint && (
                                      <span className="block text-[10px] text-gray-400 mt-0.5">
                                        {i.hint}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => savePermissions(role)}
                          disabled={busy}
                          className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
                        >
                          {busy ? "در حال ذخیره..." : "ذخیره‌ی دسترسی‌ها"}
                        </button>
                        <button
                          onClick={() => removeRole(role)}
                          disabled={busy}
                          className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-40 text-red-600 dark:text-red-400 text-sm font-bold transition"
                        >
                          حذف نقش
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <HelpButton topic="roles" />
      </div>
    </div>
  );
}
