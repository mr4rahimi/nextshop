"use client";

/**
 * کارهای سئو — فهرست، فرم ثبت، و کشوی جزئیات با گردش کار.
 *
 * سه تصمیم رابط کاربری:
 *
 * **۱. دکمه‌های مرحله روی خودِ جزئیات‌اند، نه در یک منوی کشویی.** کارمند باید
 * بدون فکر کردن بداند قدم بعدی چیست؛ یک دکمه‌ی اصلی که وضعیت فعلی تعیینش
 * می‌کند.
 *
 * **۲. «ثبت گزارش» از «واگذارشده» هم دیده می‌شود.** کار ده‌ثانیه‌ای نباید
 * اول «شروع» بخورد (بخش ۵.۲ مستندات).
 *
 * **۳. کشو با `?task=<id>` باز می‌شود** تا کلیک روی اعلان مستقیم همان کار را
 * باز کند.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import SeoRecurringPanel from "./SeoRecurringPanel";
import {
  SEO_STATUS_LABELS,
  SEO_STATUS_COLORS,
  REVIEW_LABELS,
  REVIEW_COLORS,
  EVENT_LABELS,
  parsePageUrls,
  isSeoOverdue,
  type SeoTaskStatus,
  type SeoReviewOutcome,
  type MarketingEventAction,
} from "@/lib/marketing/types";
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDateTime,
  dueLabel,
  type StaffPriority,
} from "@/lib/worklist/types";

// ─────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  key: string | null;
  title: string;
  description: string | null;
}

interface Staff {
  id: string;
  name: string;
  isMe: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  sortOrder: number;
  doneAt: string | null;
  doneById: string | null;
  doneByName: string | null;
}

interface TaskFile {
  id: string;
  url: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  uploadedByName: string;
  createdAt: string;
}

interface TaskEvent {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: MarketingEventAction;
  fromStatus: SeoTaskStatus | null;
  toStatus: SeoTaskStatus | null;
  note: string | null;
  createdAt: string;
}

interface SeoTask {
  id: string;
  code: number;
  categoryId: string;
  title: string;
  description: string | null;
  pageUrls: string | null;
  assigneeId: string | null;
  assigneeName: string;
  createdById: string | null;
  createdByName: string;
  status: SeoTaskStatus;
  priority: StaffPriority;
  dueAt: string | null;
  report: string | null;
  returnReason: string | null;
  cancelReason: string | null;
  startedAt: string | null;
  reportedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  reviewAt: string | null;
  reviewOutcome: SeoReviewOutcome | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  category: { id: string; key: string | null; title: string };
  _count: { checklist: number; files: number; events: number };
  checklist?: ChecklistItem[];
  files?: TaskFile[];
  events?: TaskEvent[];
}

interface Caps {
  viewAll: boolean;
  work: boolean;
  manage: boolean;
}

const TABS = [
  { key: "open", label: "در جریان" },
  { key: "mine", label: "کارهای من", badge: "mine" },
  { key: "approval", label: "منتظر تأیید", badge: "approval" },
  { key: "review", label: "بررسی نتیجه", badge: "review" },
  { key: "done", label: "تکمیل‌شده" },
  { key: "canceled", label: "لغوشده" },
  { key: "all", label: "همه" },
  { key: "recurring", label: "دوره‌ای" },
] as const;

/** تبی که فهرست کار نیست و خوراکش را خودش می‌گیرد */
const RECURRING_TAB = "recurring";

const inputCls =
  "w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400";

const EMPTY_FORM = {
  categoryId: "",
  title: "",
  description: "",
  pageUrls: "",
  assigneeId: "",
  priority: "NORMAL" as StaffPriority,
  dueAt: "",
  reviewAt: "",
  checklist: "",
};

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

/** «۲۴۰ کیلوبایت» — بایت خام روی کارت پیوست خوانده نمی‌شود */
function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${fa(Math.round(bytes / 1024))} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", "٫")} مگابایت`;
}

export default function SeoTasksClient() {
  const router = useRouter();
  const params = useSearchParams();
  const openTaskId = params.get("task");

  const [tab, setTab] = useState<string>("open");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [items, setItems] = useState<SeoTask[]>([]);
  const [counts, setCounts] = useState({ approval: 0, review: 0, mine: 0 });
  const [caps, setCaps] = useState<Caps>({ viewAll: false, work: false, manage: false });
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<SeoTask | null>(null);

  // ── بارگذاری ────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/admin/worklist/seo/meta")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setCategories(d.categories);
        setStaff(d.staff);
        setMe(d.me);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"));
  }, []);

  const load = useCallback(() => {
    // تب دوره‌ای فهرست کار نیست؛ خودش خوراکش را می‌گیرد
    if (tab === RECURRING_TAB) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const p = new URLSearchParams({ tab });
    if (q.trim()) p.set("q", q.trim());
    if (categoryId) p.set("categoryId", categoryId);
    fetch(`/api/admin/worklist/seo?${p}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setItems(d.items);
        setCounts(d.counts);
        setCaps(d.can);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => setLoading(false));
  }, [tab, q, categoryId]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/admin/worklist/seo/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "کار باز نشد");
      setDetail(d.task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "کار باز نشد");
    }
  }, []);

  // کلیک روی اعلان: `?task=<id>` کشو را باز می‌کند
  const openedFromUrl = useRef<string | null>(null);
  useEffect(() => {
    if (openTaskId && openedFromUrl.current !== openTaskId) {
      openedFromUrl.current = openTaskId;
      openDetail(openTaskId);
    }
  }, [openTaskId, openDetail]);

  function closeDetail() {
    setDetail(null);
    if (openTaskId) router.replace("/admin/worklist/seo");
  }

  /** بعد از هر تغییر: هم کشو تازه شود هم فهرست، وگرنه وضعیت دو جا فرق می‌کند */
  async function refresh(id: string) {
    await openDetail(id);
    load();
  }

  // ── ثبت کار ─────────────────────────────────────────────────────

  async function submit() {
    if (!form.title.trim()) return setError("عنوان کار لازم است");
    if (!form.categoryId) return setError("دسته‌ی کار را انتخاب کنید");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assigneeId: form.assigneeId || null,
          dueAt: form.dueAt || null,
          reviewAt: form.reviewAt || null,
          checklist: form.checklist
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ثبت نشد");
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* تب‌ها */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const badge =
            "badge" in t ? counts[t.badge as keyof typeof counts] : 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                tab === t.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {t.label}
              {badge > 0 && (
                <span
                  className={`mr-1.5 px-1.5 py-0.5 rounded-lg text-[10px] ${
                    tab === t.key ? "bg-white/20" : "bg-amber-500 text-white"
                  }`}
                >
                  {fa(badge)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* فیلتر و دکمه‌ی ثبت — تب دوره‌ای نوار خودش را دارد */}
      <div
        className={`flex-wrap items-center gap-2 ${tab === RECURRING_TAB ? "hidden" : "flex"}`}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در عنوان، شرح، آدرس صفحه و گزارش..."
          className={`${inputCls} max-w-sm`}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${inputCls} max-w-[13rem]`}
        >
          <option value="">همه‌ی دسته‌ها</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {caps.work && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold"
          >
            {showForm ? "بستن فرم" : "ثبت کار سئو"}
          </button>
        )}
      </div>

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

      {/* فرم ثبت */}
      {showForm && caps.work && tab !== RECURRING_TAB && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 space-y-3">
          <h2 className="text-xs font-black text-gray-900 dark:text-white">کار سئوی تازه</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input
              className={inputCls}
              placeholder="عنوان کار *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              className={inputCls}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">دسته *</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              disabled={!caps.manage}
              title={caps.manage ? undefined : "واگذاری به دیگران با مدیر سئو است"}
            >
              <option value="">مسئول: خودم</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMe ? " (خودم)" : ""}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as StaffPriority })
              }
            >
              {(Object.keys(PRIORITY_LABELS) as StaffPriority[]).map((p) => (
                <option key={p} value={p}>
                  اولویت: {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">مهلت (اختیاری)</label>
              <JalaliDatePicker
                value={form.dueAt}
                onChange={(v) => setForm({ ...form, dueAt: v })}
                mode="datetime"
                placeholder="بدون مهلت"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">
                تاریخ بررسی نتیجه (اختیاری)
              </label>
              <JalaliDatePicker
                value={form.reviewAt}
                onChange={(v) => setForm({ ...form, reviewAt: v })}
                placeholder="بدون بررسی"
              />
            </div>
          </div>

          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="شرح کار — چه چیزی و چرا"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <textarea
              className={`${inputCls} resize-none`}
              dir="ltr"
              rows={2}
              placeholder="آدرس صفحه‌های مربوط — هر خط یک آدرس"
              value={form.pageUrls}
              onChange={(e) => setForm({ ...form, pageUrls: e.target.value })}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              آدرس صفحه‌ها همان چیزی است که بعداً افت یا رشد رتبه را به این کار وصل می‌کند.
            </p>
          </div>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="چک‌لیست — هر خط یک بند (اختیاری)"
            value={form.checklist}
            onChange={(e) => setForm({ ...form, checklist: e.target.value })}
          />

          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
          >
            {saving ? "در حال ثبت..." : "ثبت کار"}
          </button>
        </div>
      )}

      {tab === RECURRING_TAB ? (
        <SeoRecurringPanel
          categories={categories}
          staff={staff}
          canManage={caps.manage}
        />
      ) : (
        /* فهرست */
        <div className="space-y-2">
          {loading ? (
            <p className="p-8 text-center text-xs text-gray-500">در حال بارگذاری...</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-xs text-gray-500">کاری در این تب نیست</p>
          ) : (
            items.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={() => openDetail(t.id)} />
            ))
          )}
        </div>
      )}

      {detail && (
        <DetailDrawer
          task={detail}
          caps={caps}
          me={me}
          staff={staff}
          onClose={closeDetail}
          onChanged={() => refresh(detail.id)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// کارت فهرست
// ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onOpen }: { task: SeoTask; onOpen: () => void }) {
  const pages = parsePageUrls(task.pageUrls);
  const overdue = isSeoOverdue(task);

  return (
    <button
      onClick={onOpen}
      className="w-full text-right rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3.5 hover:border-blue-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-gray-400">
              کار سئو {fa(task.code)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${SEO_STATUS_COLORS[task.status]}`}
            >
              {SEO_STATUS_LABELS[task.status]}
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
              {task.category.title}
            </span>
            {task.priority !== "NORMAL" && (
              <span className={`text-[10px] font-bold ${PRIORITY_COLORS[task.priority]}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {task.reviewOutcome && (
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${REVIEW_COLORS[task.reviewOutcome]}`}
              >
                {REVIEW_LABELS[task.reviewOutcome]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white truncate">
            {task.title}
          </p>
          <div className="mt-1 flex items-center gap-2.5 flex-wrap text-[11px] text-gray-500">
            <span>مسئول: {task.assigneeName}</span>
            {pages.length > 0 && <span>{fa(pages.length)} صفحه</span>}
            {task._count.checklist > 0 && <span>{fa(task._count.checklist)} بند</span>}
            {task._count.files > 0 && <span>{fa(task._count.files)} پیوست</span>}
          </div>
        </div>
        {task.dueAt && (
          <span
            className={`shrink-0 text-[11px] font-bold ${
              overdue ? "text-red-600 dark:text-red-400" : "text-gray-500"
            }`}
          >
            {dueLabel(task.dueAt)}
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// کشوی جزئیات
// ─────────────────────────────────────────────────────────────────

function DetailDrawer({
  task,
  caps,
  me,
  staff,
  onClose,
  onChanged,
}: {
  task: SeoTask;
  caps: Caps;
  me: { id: string; name: string } | null;
  staff: Staff[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [newItem, setNewItem] = useState("");
  const [uploading, setUploading] = useState(false);

  const isMine = !!me && (task.assigneeId === me.id || task.createdById === me.id);
  const canAct = caps.manage || isMine;
  const closed = task.status === "DONE" || task.status === "CANCELED";
  const pages = parsePageUrls(task.pageUrls);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/worklist/seo/${task.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || null, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "انجام نشد");
      setNote("");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    const title = newItem.trim();
    if (!title) return;
    setNewItem("");
    await fetch(`/api/admin/worklist/seo/${task.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    onChanged();
  }

  async function toggleItem(itemId: string) {
    await fetch(`/api/admin/worklist/seo/${task.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    onChanged();
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/admin/worklist/seo/${task.id}/checklist?itemId=${itemId}`, {
      method: "DELETE",
    });
    onChanged();
  }

  /**
   * آپلود دو قدم است: اول فایل به `/api/admin/upload` می‌رود (همان‌جا نوع و
   * حجم چک می‌شود)، بعد آدرسش به کار می‌چسبد. مسیر آپلود دوم ساخته نمی‌شود.
   */
  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", file.type.startsWith("image/") ? "image" : "download");
      const up = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const upd = await up.json();
      if (!up.ok) throw new Error(upd.error ?? "آپلود نشد");

      const res = await fetch(`/api/admin/worklist/seo/${task.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: upd.url,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ثبت پیوست نشد");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "آپلود نشد");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(fileId: string) {
    await fetch(`/api/admin/worklist/seo/${task.id}/files?fileId=${fileId}`, {
      method: "DELETE",
    });
    onChanged();
  }

  const doneItems = (task.checklist ?? []).filter((i) => i.doneAt).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-start" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl p-5 space-y-5">
        {/* سربرگ */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black text-gray-400">کار سئو {fa(task.code)}</span>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${SEO_STATUS_COLORS[task.status]}`}
              >
                {SEO_STATUS_LABELS[task.status]}
              </span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                {task.category.title}
              </span>
            </div>
            <h2 className="mt-1 text-base font-black text-gray-900 dark:text-white">
              {task.title}
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              مسئول: {task.assigneeName} · ثبت: {task.createdByName} ·{" "}
              {formatDateTime(task.createdAt)}
              {task.dueAt && ` · مهلت: ${dueLabel(task.dueAt)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300"
          >
            بستن
          </button>
        </div>

        {err && <p className="text-xs font-bold text-red-600 dark:text-red-400">{err}</p>}

        {task.returnReason && task.status !== "DONE" && (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3">
            <p className="text-[11px] font-black text-red-700 dark:text-red-400">دلیل برگشت</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">
              {task.returnReason}
            </p>
          </div>
        )}

        {task.description && (
          <section>
            <h3 className="text-[11px] font-black text-gray-500 mb-1.5">شرح کار</h3>
            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {task.description}
            </p>
          </section>
        )}

        {pages.length > 0 && (
          <section>
            <h3 className="text-[11px] font-black text-gray-500 mb-1.5">
              صفحه‌های مربوط ({fa(pages.length)})
            </h3>
            <ul className="space-y-1">
              {pages.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="block text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* چک‌لیست */}
        <section>
          <h3 className="text-[11px] font-black text-gray-500 mb-1.5">
            چک‌لیست
            {(task.checklist?.length ?? 0) > 0 &&
              ` — ${fa(doneItems)} از ${fa(task.checklist!.length)}`}
          </h3>
          <div className="space-y-1">
            {(task.checklist ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={!!item.doneAt}
                  disabled={closed && !caps.manage}
                  onChange={() => toggleItem(item.id)}
                  className="accent-blue-500 shrink-0"
                />
                <span
                  className={`text-xs flex-1 ${
                    item.doneAt
                      ? "line-through text-gray-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {item.title}
                  {item.doneByName && (
                    <span className="text-[10px] text-gray-400 mr-2">
                      ({item.doneByName})
                    </span>
                  )}
                </span>
                {canAct && !closed && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 px-1.5"
                  >
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
          {canAct && !closed && (
            <div className="flex gap-2 mt-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                placeholder="بند تازه..."
                className={`${inputCls} text-xs`}
              />
              <button
                onClick={addItem}
                className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300"
              >
                افزودن
              </button>
            </div>
          )}
          {(task.checklist?.length ?? 0) > 0 && doneItems < task.checklist!.length && (
            <p className="text-[11px] text-gray-400 mt-1.5">
              بند ناتمام جلوی ثبت گزارش را نمی‌گیرد؛ فقط موقع تأیید به مدیر نشان داده می‌شود.
            </p>
          )}
        </section>

        {/* پیوست */}
        <section>
          <h3 className="text-[11px] font-black text-gray-500 mb-1.5">پیوست</h3>
          <div className="space-y-1">
            {(task.files ?? []).map((f) => (
              <div key={f.id} className="flex items-center gap-2 group">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                >
                  {f.fileName}
                </a>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {formatSize(f.size)} · {f.uploadedByName}
                </span>
                {canAct && (
                  <button
                    onClick={() => removeFile(f.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 px-1.5"
                  >
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
          {canAct && (
            <label className="inline-block mt-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
              {uploading ? "در حال آپلود..." : "افزودن فایل"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </section>

        {/* گزارش انجام */}
        {task.report && (
          <section>
            <h3 className="text-[11px] font-black text-gray-500 mb-1.5">گزارش انجام</h3>
            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              {task.report}
            </p>
          </section>
        )}

        {/* بررسی نتیجه */}
        {task.status === "DONE" && (
          <section>
            <h3 className="text-[11px] font-black text-gray-500 mb-1.5">بررسی نتیجه</h3>
            {task.reviewOutcome ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${REVIEW_COLORS[task.reviewOutcome]}`}
                >
                  {REVIEW_LABELS[task.reviewOutcome]}
                </span>
                {task.reviewNote && (
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {task.reviewNote}
                  </span>
                )}
              </div>
            ) : caps.manage || task.createdById === me?.id ? (
              <>
                <p className="text-[11px] text-gray-400 mb-2">
                  {task.reviewAt
                    ? `تاریخ بررسی: ${formatDateTime(task.reviewAt)}`
                    : "تاریخ بررسی ثبت نشده"}{" "}
                  — ثبت نتیجه وضعیت کار را عوض نمی‌کند.
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.keys(REVIEW_LABELS) as SeoReviewOutcome[]).map((o) => (
                    <button
                      key={o}
                      disabled={busy}
                      onClick={() => act("review", { outcome: o })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold ${REVIEW_COLORS[o]} disabled:opacity-40`}
                    >
                      {REVIEW_LABELS[o]}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        )}

        {/* دکمه‌های مرحله */}
        {canAct && (
          <section className="rounded-2xl bg-gray-50 dark:bg-white/5 p-3 space-y-2">
            <textarea
              className={`${inputCls} resize-none bg-white dark:bg-gray-900`}
              rows={3}
              placeholder={
                task.status === "AWAITING_APPROVAL"
                  ? "دلیل برگشت (اگر برمی‌گردانید) یا یادداشت تأیید"
                  : "گزارش انجام — چه کاری کردید و نتیجه‌اش چه شد"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-1.5 flex-wrap">
              {task.status === "ASSIGNED" && (
                <ActionBtn label="شروع کار" tone="blue" busy={busy} onClick={() => act("start")} />
              )}
              {(task.status === "ASSIGNED" || task.status === "IN_PROGRESS") && (
                <ActionBtn
                  label="ثبت گزارش انجام"
                  tone="emerald"
                  busy={busy}
                  onClick={() => act("report")}
                />
              )}
              {task.status === "AWAITING_APPROVAL" && caps.manage && (
                <>
                  <ActionBtn label="تأیید" tone="emerald" busy={busy} onClick={() => act("approve")} />
                  <ActionBtn
                    label="برگشت با دلیل"
                    tone="amber"
                    busy={busy}
                    onClick={() => act("return")}
                  />
                </>
              )}
              {!closed && caps.manage && (
                <ActionBtn label="لغو" tone="gray" busy={busy} onClick={() => act("cancel")} />
              )}
              {closed && caps.manage && (
                <ActionBtn label="بازگشایی" tone="gray" busy={busy} onClick={() => act("reopen")} />
              )}
            </div>
            {task.status === "ASSIGNED" && (
              <p className="text-[11px] text-gray-400">
                کار کوتاه را می‌شود بدون «شروع» مستقیم گزارش داد.
              </p>
            )}
          </section>
        )}

        {/* تاریخچه */}
        <section>
          <h3 className="text-[11px] font-black text-gray-500 mb-1.5">تاریخچه</h3>
          <ul className="space-y-1.5">
            {(task.events ?? []).map((e) => (
              <li key={e.id} className="text-[11px] text-gray-600 dark:text-gray-400">
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {EVENT_LABELS[e.action]}
                </span>
                {" — "}
                {e.actorName ?? "سیستم"} · {formatDateTime(e.createdAt)}
                {e.note && (
                  <p className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap">{e.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* واگذاری دوباره */}
        {caps.manage && !closed && (
          <section>
            <h3 className="text-[11px] font-black text-gray-500 mb-1.5">تغییر مسئول</h3>
            <select
              className={inputCls}
              value={task.assigneeId ?? ""}
              onChange={async (e) => {
                setBusy(true);
                await fetch(`/api/admin/worklist/seo/${task.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ assigneeId: e.target.value }),
                });
                setBusy(false);
                onChanged();
              }}
              disabled={busy}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMe ? " (خودم)" : ""}
                </option>
              ))}
            </select>
          </section>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-blue-500 hover:bg-blue-600 text-white",
  emerald: "bg-emerald-500 hover:bg-emerald-600 text-white",
  amber: "bg-amber-500 hover:bg-amber-600 text-white",
  gray: "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10",
};

function ActionBtn({
  label,
  tone,
  busy,
  onClick,
}: {
  label: string;
  tone: keyof typeof TONES;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 ${TONES[tone]}`}
    >
      {label}
    </button>
  );
}
