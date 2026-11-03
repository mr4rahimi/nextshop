"use client";

import { useEffect, useState } from "react";
import { WORK_MODE_LABELS } from "@/lib/worklist/work-hours";
import { useAdminMe } from "@/components/admin/useAdminMe";

interface AdminUser {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  /** نقش کارتابل — `null` یعنی دسترسی کامل (رفتار پیش‌فرض) */
  staffRoleId: string | null;
  staffRole: { id: string; title: string } | null;
  /** حضوری / دورکار / ترکیبی */
  staffWorkMode: string;
}

interface StaffRoleOption {
  id: string;
  title: string;
}

function fa(n: number) { return n.toLocaleString("fa-IR"); }

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<StaffRoleOption[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ phone: "", firstName: "", lastName: "", password: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  // غیرفعال‌کردن و حذف فقط برای ادمین با دسترسی کامل — مرز واقعی در API است
  const me = useAdminMe();
  const canRemove = me?.isUnrestricted === true;

  async function fetchAdmins() {
    setLoading(true);
    const res = await fetch("/api/admin/users?role=ADMIN&page=1");
    const data = await res.json();
    setAdmins((data.users ?? []).filter((u: AdminUser) => u.role === "ADMIN"));
    setLoading(false);
  }

  useEffect(() => { fetchAdmins(); }, []);

  // فهرست نقش‌های کارتابل — اگر ماژول روشن نباشد یا دسترسی نباشد، خالی
  // می‌ماند و ستون نقش اصلاً نشان داده نمی‌شود.
  useEffect(() => {
    fetch("/api/admin/worklist/roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRoles(d.roles ?? []))
      .catch(() => {});
  }, []);

  /** تخصیص نقش کارتابل — خالی یعنی «بدون نقش» که دسترسی کامل می‌دهد */
  async function assignRole(adminId: string, staffRoleId: string) {
    setSavingRole(adminId);
    try {
      const res = await fetch(`/api/admin/users/${adminId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffRoleId: staffRoleId || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === adminId
            ? { ...a, staffRoleId: d.staffRoleId ?? null, staffRole: d.staffRole ?? null }
            : a,
        ),
      );
    } catch {
      alert("تغییر نقش ذخیره نشد");
    } finally {
      setSavingRole(null);
    }
  }

  async function assignWorkMode(adminId: string, staffWorkMode: string) {
    setSavingRole(adminId);
    try {
      const res = await fetch(`/api/admin/users/${adminId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffWorkMode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, staffWorkMode: d.staffWorkMode } : a)));
    } catch {
      alert("نوع کار ذخیره نشد");
    } finally {
      setSavingRole(null);
    }
  }

  function openAdd() {
    setEditingAdmin(null);
    setForm({ phone: "", firstName: "", lastName: "", password: "", confirmPassword: "" });
    setError("");
    setShowModal(true);
  }

  function openEdit(admin: AdminUser) {
    setEditingAdmin(admin);
    setForm({ phone: admin.phone, firstName: admin.firstName ?? "", lastName: admin.lastName ?? "", password: "", confirmPassword: "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password && form.password !== form.confirmPassword) {
      setError("رمز عبور و تکرار آن یکسان نیستند");
      return;
    }
    if (!editingAdmin && !form.password) {
      setError("رمز عبور برای ادمین جدید الزامی است");
      return;
    }
    if (form.password && form.password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد");
      return;
    }

    setSaving(true);

    try {
      if (editingAdmin) {
        const res = await fetch(`/api/admin/users/${editingAdmin.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName || null,
            lastName: form.lastName || null,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        if (!res.ok) throw new Error("خطا در ویرایش");
      } else {
        const res = await fetch("/api/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: form.phone,
            firstName: form.firstName || null,
            lastName: form.lastName || null,
            password: form.password,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "خطا در ساخت ادمین");
        }
      }

      setShowModal(false);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || "خطای سرور");
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (a: AdminUser) => [a.firstName, a.lastName].filter(Boolean).join(" ") || a.phone;

  async function handleToggleActive(admin: AdminUser) {
    setBusy(admin.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "انجام نشد");
      setNotice({ ok: true, text: `${nameOf(admin)} ${admin.isActive ? "غیرفعال شد و دیگر نمی‌تواند وارد پنل شود" : "دوباره فعال شد"}.` });
      fetchAdmins();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "انجام نشد" });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(admin: AdminUser) {
    setBusy(admin.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "حذف نشد");
      setNotice({
        ok: true,
        text: d.mode === "demoted"
          ? `${nameOf(admin)} از ادمین‌ها برداشته شد. چون سابقه (مثل سفارش) داشت، حسابش به کاربر عادی تبدیل شد و سوابقش ماند.`
          : `${nameOf(admin)} حذف شد.`,
      });
      setConfirmDelete(null);
      fetchAdmins();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "حذف نشد" });
      setConfirmDelete(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">

      {}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت ادمین‌ها</h1>
          <p className="text-sm text-gray-500 mt-1">{fa(admins.length)} ادمین</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-500/30">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          ادمین جدید
        </button>
      </div>

      {notice && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${notice.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-gray-400">هیچ ادمینی یافت نشد</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                <th className="text-right text-xs font-black text-gray-500 px-5 py-3">ادمین</th>
                <th className="text-right text-xs font-black text-gray-500 px-5 py-3">شماره موبایل</th>
                {roles.length > 0 && (
                  <th className="text-right text-xs font-black text-gray-500 px-5 py-3">نقش کارتابل</th>
                )}
                <th className="text-right text-xs font-black text-gray-500 px-5 py-3">نوع کار</th>
                <th className="text-right text-xs font-black text-gray-500 px-5 py-3">وضعیت</th>
                <th className="text-right text-xs font-black text-gray-500 px-5 py-3">تاریخ ثبت</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {admins.map(admin => {
                const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-black text-sm flex-shrink-0">
                          {(admin.firstName?.[0] || admin.phone[2]).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 dark:text-white">
                            {name}
                            {me?.userId === admin.id && <span className="mr-1.5 text-[10px] font-bold text-blue-500">(شما)</span>}
                          </p>
                          {admin.email && <p className="text-xs text-gray-400">{admin.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-600 dark:text-gray-400 dir-ltr">{admin.phone}</td>
                    {roles.length > 0 && (
                      <td className="px-5 py-4">
                        <select
                          value={admin.staffRoleId ?? ""}
                          disabled={savingRole === admin.id}
                          onChange={(e) => assignRole(admin.id, e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:border-blue-400 disabled:opacity-50"
                        >
                          <option value="">بدون نقش (دسترسی کامل)</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.title}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <select
                        value={admin.staffWorkMode ?? "ONSITE"}
                        disabled={savingRole === admin.id}
                        onChange={(e) => assignWorkMode(admin.id, e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:border-blue-400 disabled:opacity-50"
                      >
                        {Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                        admin.isActive
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                      }`}>
                        {admin.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {new Date(admin.createdAt).toLocaleDateString("fa-IR")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(admin)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-blue-500 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {canRemove && me?.userId !== admin.id && (
                          <>
                            <button onClick={() => handleToggleActive(admin)} disabled={busy === admin.id}
                              title={admin.isActive ? "غیرفعال کردن" : "فعال کردن"}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-amber-500 transition-all disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={admin.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                              </svg>
                            </button>
                            <button onClick={() => setConfirmDelete(admin)} disabled={busy === admin.id}
                              title="حذف ادمین"
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => busy || setConfirmDelete(null)}>
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">حذف {nameOf(confirmDelete)}؟</h2>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              دیگر نمی‌تواند وارد پنل شود. اگر این حساب سابقه داشته باشد (مثل سفارش)، حذف کامل نمی‌شود و فقط از
              ادمین‌ها برداشته و کاربر عادی می‌شود تا سوابق بماند. کارهای کارتابلش با نام او سر جایش می‌ماند.
            </p>
            <p className="mt-2 text-xs text-gray-400">اگر فقط می‌خواهید موقتاً وارد نشود، «غیرفعال کردن» بهتر است.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => handleDelete(confirmDelete)} disabled={busy === confirmDelete.id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black text-sm">
                {busy === confirmDelete.id ? "در حال حذف…" : "حذف شود"}
              </button>
              <button onClick={() => setConfirmDelete(null)} disabled={busy === confirmDelete.id}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-black text-sm">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-black text-gray-900 dark:text-white mb-5">
              {editingAdmin ? "ویرایش ادمین" : "ادمین جدید"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600 dark:text-red-400 font-bold">{error}</p>
                </div>
              )}

              {!editingAdmin && (
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">شماره موبایل *</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="09xxxxxxxxx" required dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">نام</label>
                  <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="نام"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">نام خانوادگی</label>
                  <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="نام خانوادگی"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">
                  {editingAdmin ? "رمز عبور جدید (خالی بگذارید اگر تغییر نمی‌دهید)" : "رمز عبور *"}
                </label>
                <input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-blue-500 transition-all" />
              </div>

              {form.password && (
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">تکرار رمز عبور</label>
                  <input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="••••••••" dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all">
                  {saving ? "در حال ذخیره..." : "ذخیره"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-black text-sm transition-all">
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
