"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

function fa(n: number) { return n.toLocaleString("fa-IR"); }

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ phone: "", firstName: "", lastName: "", password: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchAdmins() {
    setLoading(true);
    const res = await fetch("/api/admin/users?role=ADMIN&page=1");
    const data = await res.json();
    setAdmins((data.users ?? []).filter((u: AdminUser) => u.role === "ADMIN"));
    setLoading(false);
  }

  useEffect(() => { fetchAdmins(); }, []);

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
            isActive: true,
            role: "ADMIN",
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

  async function handleToggleActive(admin: AdminUser) {
    await fetch(`/api/admin/users/${admin.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...admin, isActive: !admin.isActive, role: "ADMIN" }),
    });
    fetchAdmins();
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
                          <p className="text-sm font-black text-gray-900 dark:text-white">{name}</p>
                          {admin.email && <p className="text-xs text-gray-400">{admin.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-600 dark:text-gray-400 dir-ltr">{admin.phone}</td>
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
                        <button onClick={() => handleToggleActive(admin)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-amber-500 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={admin.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-blue-500 transition-all" />
              </div>

              {form.password && (
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">تکرار رمز عبور</label>
                  <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
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
