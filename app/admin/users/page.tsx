"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fa-IR"); }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 20;

  const fetchUsers = useCallback(async (search: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (search) params.set("q", search);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(q, page); }, [q, page, fetchUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(searchInput);
    setPage(1);
  }

  async function toggleActive(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...user, isActive: !user.isActive }),
    });
    fetchUsers(q, page);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`کاربر "${name}" حذف شود؟`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers(q, page);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت کاربران</h1>
          <p className="text-sm text-gray-500 mt-1">{toFa(total)} کاربر ثبت‌نام کرده</p>
        </div>
        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="جستجو با نام یا موبایل..."
              className="w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pr-10 pl-4 text-sm outline-none focus:border-blue-500 dark:text-white"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
            جستجو
          </button>
          {q && (
            <button type="button" onClick={() => { setQ(""); setSearchInput(""); setPage(1); }}
              className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              ✕
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 dark:bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-bold">کاربری یافت نشد</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">کاربر</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">موبایل</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">سفارشات</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">تاریخ ثبت</th>
                    <th className="px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">وضعیت</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users.map(user => {
                    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500/20 to-blue-500/5 flex items-center justify-center flex-shrink-0 overflow-hidden border border-blue-500/10">
                              {user.avatarUrl
                                ? <img src={user.avatarUrl} alt={name} className="w-full h-full object-cover" />
                                : <span className="text-sm font-black text-blue-600">{(user.firstName ?? user.phone).charAt(0)}</span>
                              }
                            </div>
                            <div>
                              <p className="text-sm font-black text-gray-900 dark:text-white">{name}</p>
                              {user.email && <p className="text-[11px] text-gray-400">{user.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400 tabular-nums" dir="ltr">{user.phone}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-xs font-black">
                            {toFa(user._count.orders)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">{formatDate(user.createdAt)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <button onClick={() => toggleActive(user)}
                            className={`relative w-11 h-6 rounded-full transition-all ${user.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${user.isActive ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/admin/users/${user.id}`}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                            <button onClick={() => handleDelete(user.id, name)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {users.map(user => {
                const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <div key={user.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500/20 to-blue-500/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {user.avatarUrl
                            ? <img src={user.avatarUrl} alt={name} className="w-full h-full object-cover" />
                            : <span className="text-sm font-black text-blue-600">{(user.firstName ?? user.phone).charAt(0)}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900 dark:text-white truncate">{name}</p>
                          <p className="text-[11px] text-gray-400" dir="ltr">{user.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => toggleActive(user)}
                          className={`relative w-10 h-5 rounded-full transition-all ${user.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${user.isActive ? "right-0.5" : "left-0.5"}`} />
                        </button>
                        <Link href={`/admin/users/${user.id}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 mr-13">
                      <span className="text-[10px] text-gray-400">{toFa(user._count.orders)} سفارش</span>
                      <span className="text-[10px] text-gray-400">{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500">{toFa((page-1)*PAGE_SIZE+1)}–{toFa(Math.min(page*PAGE_SIZE,total))} از {toFa(total)}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2">{toFa(page)} / {toFa(totalPages)}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
