"use client";

/**
 * کارهای محتوا — فهرست، فرم ساخت، و کشوی جزئیات با ویرایشگر و گردش کار.
 *
 * قرینه‌ی `SeoTasksClient` است تا کارمند برای دو بخش دو الگوی ذهنی نسازد:
 * همان تب‌ها، همان کارت، همان کشو با `?task=<id>` برای کلیک روی اعلان.
 *
 * سه تفاوت که از خودِ کار محتوا می‌آید:
 *
 * **۱. ویرایشگر تا «شروع نوشتن» باز نمی‌شود** (بخش ۶.۱ مستندات). وگرنه
 * مرحله‌ی «واگذارشده» بی‌معنی است: نه زمان شروع ثبت می‌شود و نه مدیر می‌فهمد
 * کار دست گرفته شده.
 *
 * **۲. کشو پهن‌تر است** — متن بلند در ستون ۶۷۲ پیکسلی نوشته نمی‌شود.
 *
 * **۳. قبل از هر انتقال، متن ذخیره می‌شود** (`flushRef`)؛ بعد از «ارسال»
 * متن دیگر دست نویسنده نیست و سرور ذخیره‌ی دیرکرده را رد می‌کند.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۶
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import ContentEditorPanel from "./ContentEditorPanel";
import {
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
  CONTENT_EVENT_LABELS,
  DESTINATION_LABELS,
  isContentOverdue,
  type ContentTaskStatus,
  type ContentDestination,
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

interface Staff {
  id: string;
  name: string;
  isMe: boolean;
}

interface BlogCategory {
  id: string;
  title: string;
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
  actorName: string | null;
  action: MarketingEventAction;
  note: string | null;
  createdAt: string;
}

interface BlogPostMeta {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  coverImage: string | null;
  categoryId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
}

interface ContentTask {
  id: string;
  code: number;
  title: string;
  primaryKeyword: string | null;
  relatedKeywords: string | null;
  brief: string | null;
  destination: ContentDestination;
  writerId: string | null;
  writerName: string;
  publisherId: string | null;
  publisherName: string | null;
  createdById: string | null;
  createdByName: string;
  status: ContentTaskStatus;
  priority: StaffPriority;
  dueAt: string | null;
  wordCount: number | null;
  blogPostId: string | null;
  publishedUrl: string | null;
  returnReason: string | null;
  cancelReason: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  linkNode: { id: string; code: number; campaignId: string } | null;
  _count: { files: number };
  // فقط جزئیات
  text?: string;
  blogPost?: BlogPostMeta | null;
  files?: TaskFile[];
  events?: TaskEvent[];
}

interface Caps {
  work: boolean;
  manage: boolean;
  viewAll: boolean;
}

const TABS = [
  { key: "open", label: "در جریان" },
  { key: "mine", label: "کارهای من", badge: "mine" },
  { key: "publish", label: "منتظر انتشار", badge: "publish" },
  { key: "approval", label: "منتظر تأیید", badge: "approval" },
  { key: "done", label: "تکمیل‌شده" },
  { key: "canceled", label: "لغوشده" },
  { key: "all", label: "همه" },
] as const;

const inputCls =
  "w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400";

const EMPTY_FORM = {
  title: "",
  primaryKeyword: "",
  relatedKeywords: "",
  brief: "",
  destination: "BLOG" as ContentDestination,
  writerId: "",
  publisherId: "",
  priority: "NORMAL" as StaffPriority,
  dueAt: "",
};

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${fa(Math.round(bytes / 1024))} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", "٫")} مگابایت`;
}

export default function ContentTasksClient() {
  const router = useRouter();
  const params = useSearchParams();
  const openTaskId = params.get("task");

  const [tab, setTab] = useState<string>("open");
  const [q, setQ] = useState("");
  const [destination, setDestination] = useState("");
  const [items, setItems] = useState<ContentTask[]>([]);
  const [counts, setCounts] = useState({ mine: 0, publish: 0, approval: 0 });
  const [caps, setCaps] = useState<Caps>({ work: false, manage: false, viewAll: false });
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ContentTask | null>(null);

  useEffect(() => {
    fetch("/api/admin/worklist/content/meta")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setStaff(d.staff);
        setCategories(d.categories);
        setCaps(d.can);
        setMe(d.me);
        // کارمند فقط کارهای خودش را دارد؛ تب پیش‌فرضش همان است
        if (!d.can.manage && !d.can.viewAll) setTab("mine");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ tab });
    if (q.trim()) p.set("q", q.trim());
    if (destination) p.set("destination", destination);
    fetch(`/api/admin/worklist/content?${p}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setItems(d.items);
        setCounts(d.counts);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => setLoading(false));
  }, [tab, q, destination]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/admin/worklist/content/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "کار باز نشد");
      setDetail(d.task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "کار باز نشد");
    }
  }, []);

  const openedFromUrl = useRef<string | null>(null);
  useEffect(() => {
    if (openTaskId && openedFromUrl.current !== openTaskId) {
      openedFromUrl.current = openTaskId;
      openDetail(openTaskId);
    }
  }, [openTaskId, openDetail]);

  function closeDetail() {
    setDetail(null);
    if (openTaskId) router.replace("/admin/worklist/content");
  }

  async function refresh(id: string) {
    await openDetail(id);
    load();
  }

  async function submit() {
    if (!form.title.trim()) return setError("عنوان کار لازم است");
    if (!form.writerId) return setError("محتوانویس را انتخاب کنید");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          publisherId: form.publisherId || null,
          dueAt: form.dueAt || null,
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
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const badge = "badge" in t ? counts[t.badge as keyof typeof counts] : 0;
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

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در عنوان، کلمه‌ی کلیدی و بریف..."
          className={`${inputCls} max-w-sm`}
        />
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className={`${inputCls} max-w-[15rem]`}
        >
          <option value="">همه‌ی مقصدها</option>
          <option value="BLOG">{DESTINATION_LABELS.BLOG}</option>
          <option value="EXTERNAL">سایت بیرونی</option>
        </select>
        {caps.manage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold"
          >
            {showForm ? "بستن فرم" : "کار محتوای تازه"}
          </button>
        )}
      </div>

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

      {showForm && caps.manage && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 space-y-3">
          <h2 className="text-xs font-black text-gray-900 dark:text-white">کار محتوای تازه</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <input
              className={inputCls}
              placeholder="عنوان *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="کلمه‌ی کلیدی اصلی"
              value={form.primaryKeyword}
              onChange={(e) => setForm({ ...form, primaryKeyword: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="کلمات مرتبط — با ویرگول"
              value={form.relatedKeywords}
              onChange={(e) => setForm({ ...form, relatedKeywords: e.target.value })}
            />
            <select
              className={inputCls}
              value={form.writerId}
              onChange={(e) => setForm({ ...form, writerId: e.target.value })}
            >
              <option value="">محتوانویس *</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMe ? " (خودم)" : ""}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={form.publisherId}
              onChange={(e) => setForm({ ...form, publisherId: e.target.value })}
            >
              <option value="">محتواگذار: همان محتوانویس</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMe ? " (خودم)" : ""}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={form.destination}
              onChange={(e) =>
                setForm({ ...form, destination: e.target.value as ContentDestination })
              }
            >
              <option value="BLOG">مقصد: {DESTINATION_LABELS.BLOG}</option>
              <option value="EXTERNAL">مقصد: {DESTINATION_LABELS.EXTERNAL}</option>
            </select>
            <select
              className={inputCls}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as StaffPriority })}
            >
              {(Object.keys(PRIORITY_LABELS) as StaffPriority[]).map((p) => (
                <option key={p} value={p}>
                  اولویت: {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2 lg:col-span-2">
              <JalaliDatePicker
                value={form.dueAt}
                onChange={(v) => setForm({ ...form, dueAt: v })}
                mode="datetime"
                placeholder="مهلت (اختیاری)"
              />
            </div>
          </div>
          {staff.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              هنوز کسی مجوز «نوشتن، ارسال و انتشار محتوا» را ندارد — اول در «نقش‌ها و دسترسی‌ها»
              به نقش محتوانویس بدهید.
            </p>
          )}
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="بریف — مخاطب، زاویه، سرتیترهای پیشنهادی، منابع"
            value={form.brief}
            onChange={(e) => setForm({ ...form, brief: e.target.value })}
          />
          <p className="text-[11px] text-gray-400">
            مقصد «مجله» یعنی با تکمیل انتشار، مقاله در همین فروشگاه منتشر می‌شود. «سایت بیرونی» برای
            مهمان‌نویسی و رپورتاژ است: متن تحویل داده می‌شود و آدرس انتشار دستی ثبت می‌شود.
          </p>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
          >
            {saving ? "در حال ثبت..." : "ثبت کار"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="p-8 text-center text-xs text-gray-500">در حال بارگذاری...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-xs text-gray-500">کاری در این تب نیست</p>
        ) : (
          items.map((t) => <TaskRow key={t.id} task={t} onOpen={() => openDetail(t.id)} />)
        )}
      </div>

      {detail && (
        <DetailDrawer
          key={detail.id}
          task={detail}
          caps={caps}
          me={me}
          staff={staff}
          categories={categories}
          onClose={closeDetail}
          onChanged={() => refresh(detail.id)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onOpen }: { task: ContentTask; onOpen: () => void }) {
  const overdue = isContentOverdue(task);
  return (
    <button
      onClick={onOpen}
      className="w-full text-right rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3.5 hover:border-blue-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-gray-400">محتوا {fa(task.code)}</span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${CONTENT_STATUS_COLORS[task.status]}`}
            >
              {CONTENT_STATUS_LABELS[task.status]}
            </span>
            {task.destination === "EXTERNAL" && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                بیرونی
              </span>
            )}
            {task.linkNode && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                گره {fa(task.linkNode.code)}
              </span>
            )}
            {task.priority !== "NORMAL" && (
              <span className={`text-[10px] font-bold ${PRIORITY_COLORS[task.priority]}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white truncate">
            {task.title}
          </p>
          <div className="mt-1 flex items-center gap-2.5 flex-wrap text-[11px] text-gray-500">
            {task.primaryKeyword && <span>«{task.primaryKeyword}»</span>}
            <span>
              {task.writerName}
              {task.publisherName && task.publisherName !== task.writerName
                ? ` ← ${task.publisherName}`
                : ""}
            </span>
            {!!task.wordCount && <span>{fa(task.wordCount)} کلمه</span>}
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

function DetailDrawer({
  task,
  caps,
  me,
  staff,
  categories,
  onClose,
  onChanged,
}: {
  task: ContentTask;
  caps: Caps;
  me: { id: string; name: string } | null;
  staff: Staff[];
  categories: BlogCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [externalUrl, setExternalUrl] = useState(task.publishedUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [wordCount, setWordCount] = useState(task.wordCount ?? 0);
  const flushRef = useRef<(() => Promise<void>) | null>(null);

  const myId = me?.id;
  const isManager = caps.manage;
  const isWriter = task.writerId === myId;
  const publisherId = task.publisherId ?? task.writerId;
  const isPublisher = publisherId === myId;
  const closed = task.status === "DONE" || task.status === "CANCELED";

  // چه کسی الان می‌تواند متن را بنویسد — همان قاعده‌ی `canEditBody` سرور
  const canEditText =
    !closed &&
    (isManager ||
      (task.status === "WRITING" && isWriter) ||
      (task.status === "PUBLISHING" && isPublisher));

  const editorVisible = task.status !== "ASSIGNED" || !!task.text;

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      // متنِ ذخیره‌نشده قبل از انتقال — بعد از آن سرور ذخیره را رد می‌کند
      await flushRef.current?.();
      const res = await fetch(`/api/admin/worklist/content/${task.id}/transition`, {
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

      const res = await fetch(`/api/admin/worklist/content/${task.id}/files`, {
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
    await fetch(`/api/admin/worklist/content/${task.id}/files?fileId=${fileId}`, {
      method: "DELETE",
    });
    onChanged();
  }

  async function reassign(field: "writerId" | "publisherId", value: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/worklist/content/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  const needsNote =
    task.status === "AWAITING_PUBLISH" ||
    task.status === "PUBLISHING" ||
    task.status === "AWAITING_APPROVAL";

  return (
    <div className="fixed inset-0 z-50 flex justify-start" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-full overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl p-5 space-y-5">
        {/* سربرگ */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black text-gray-400">
                کار محتوا {fa(task.code)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${CONTENT_STATUS_COLORS[task.status]}`}
              >
                {CONTENT_STATUS_LABELS[task.status]}
              </span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                {DESTINATION_LABELS[task.destination]}
              </span>
              {task.linkNode && (
                <Link
                  href={`/admin/worklist/links/${task.linkNode.campaignId}?node=${task.linkNode.id}`}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  برای گره {fa(task.linkNode.code)} لینک‌سازی
                </Link>
              )}
            </div>
            <h2 className="mt-1 text-base font-black text-gray-900 dark:text-white">{task.title}</h2>
            <p className="text-[11px] text-gray-500 mt-1">
              محتوانویس: {task.writerName}
              {" · "}محتواگذار: {task.publisherName ?? task.writerName}
              {" · "}ثبت: {task.createdByName} · {formatDateTime(task.createdAt)}
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

        {task.returnReason && !closed && (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3">
            <p className="text-[11px] font-black text-red-700 dark:text-red-400">دلیل برگشت</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">
              {task.returnReason}
            </p>
          </div>
        )}

        {/* بریف */}
        {(task.primaryKeyword || task.relatedKeywords || task.brief) && (
          <section className="rounded-2xl bg-gray-50 dark:bg-white/5 p-3.5 space-y-1.5">
            {task.primaryKeyword && (
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <span className="text-gray-500">کلمه‌ی کلیدی اصلی: </span>
                <b>{task.primaryKeyword}</b>
              </p>
            )}
            {task.relatedKeywords && (
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <span className="text-gray-500">کلمات مرتبط: </span>
                {task.relatedKeywords}
              </p>
            )}
            {task.brief && (
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-6">
                {task.brief}
              </p>
            )}
          </section>
        )}

        {/* متن */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[11px] font-black text-gray-500">
              متن {wordCount > 0 && `— ${fa(wordCount)} کلمه`}
            </h3>
            {task.blogPost && (
              <span className="text-[10px] text-gray-400">
                روی مقاله‌ی مجله نوشته می‌شود
              </span>
            )}
          </div>
          {editorVisible ? (
            <ContentEditorPanel
              // فقط بعد از انتقال وضعیت از نو ساخته می‌شود — refetch پس‌زمینه
              // متن در حال نوشتن را با نسخه‌ی کهنه‌ی سرور عوض نمی‌کند
              key={`${task.id}:${task.status}`}
              taskId={task.id}
              initial={task.text ?? ""}
              editable={canEditText}
              onSaved={setWordCount}
              flushRef={flushRef}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-6 text-center text-xs text-gray-500">
              ویرایشگر با «شروع نوشتن» باز می‌شود.
            </p>
          )}
        </section>

        {/* مشخصات مقاله — فقط مقصد مجله و بعد از ساخت مقاله */}
        {task.destination === "BLOG" && task.blogPost && (
          <PostMetaSection
            taskId={task.id}
            post={task.blogPost}
            categories={categories}
            editable={isManager || (isPublisher && task.status === "PUBLISHING")}
            onSaved={onChanged}
          />
        )}

        {task.publishedUrl && (
          <section>
            <h3 className="text-[11px] font-black text-gray-500 mb-1.5">آدرس انتشار</h3>
            <a
              href={task.publishedUrl}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="block text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
            >
              {task.publishedUrl}
            </a>
          </section>
        )}

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
                {f.mimeType?.startsWith("image/") && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(f.url)}
                    className="text-[10px] text-gray-500 hover:text-blue-600 px-1.5"
                    title="برای درج در متن: دکمه‌ی تصویر ویرایشگر و چسباندن همین آدرس"
                  >
                    کپی آدرس
                  </button>
                )}
                <span className="text-[10px] text-gray-400 shrink-0">
                  {formatSize(f.size)} · {f.uploadedByName}
                </span>
                {!closed && (
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
          {!closed && (
            <>
              <label className="inline-block mt-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                {uploading ? "در حال آپلود..." : "افزودن فایل یا عکس"}
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
              <p className="text-[11px] text-gray-400 mt-1.5">
                متن آماده را می‌شود به‌جای تایپ، به‌صورت فایل Word یا PDF پیوست کرد. عکس داخل
                متن: آپلود کنید، «کپی آدرس» بزنید و در دکمه‌ی تصویر ویرایشگر بچسبانید.
              </p>
            </>
          )}
        </section>

        {/* دکمه‌های مرحله */}
        {!closed && (isManager || isWriter || isPublisher) && (
          <section className="rounded-2xl bg-gray-50 dark:bg-white/5 p-3 space-y-2">
            {(needsNote || isManager) && (
              <textarea
                className={`${inputCls} resize-none bg-white dark:bg-gray-900`}
                rows={2}
                placeholder="دلیل برگشت یا لغو (برای برگشت اجباری است)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
            {task.destination === "EXTERNAL" && task.status === "PUBLISHING" && (
              <div>
                <input
                  className={`${inputCls} bg-white dark:bg-gray-900`}
                  dir="ltr"
                  placeholder="https://… آدرس صفحه‌ای که متن در آن منتشر شد"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {task.status === "ASSIGNED" && (isWriter || isManager) && (
                <ActionBtn label="شروع نوشتن" tone="blue" busy={busy} onClick={() => act("start")} />
              )}
              {task.status === "WRITING" && (isWriter || isManager) && (
                <ActionBtn
                  label="ارسال به محتواگذار"
                  tone="emerald"
                  busy={busy}
                  onClick={() => act("submit")}
                />
              )}
              {task.status === "AWAITING_PUBLISH" && (isPublisher || isManager) && (
                <ActionBtn
                  label={task.destination === "BLOG" ? "شروع انتشار در مجله" : "شروع انتشار"}
                  tone="blue"
                  busy={busy}
                  onClick={() => act("take")}
                />
              )}
              {task.status === "PUBLISHING" && (isPublisher || isManager) && (
                <ActionBtn
                  label={task.destination === "BLOG" ? "انتشار در مجله و تکمیل" : "ثبت آدرس و تکمیل"}
                  tone="emerald"
                  busy={busy}
                  onClick={() =>
                    act("complete", task.destination === "EXTERNAL" ? { publishedUrl: externalUrl } : {})
                  }
                />
              )}
              {task.status === "AWAITING_APPROVAL" && isManager && (
                <ActionBtn label="تأیید" tone="emerald" busy={busy} onClick={() => act("approve")} />
              )}
              {(task.status === "AWAITING_PUBLISH" || task.status === "PUBLISHING") &&
                (isPublisher || isManager) && (
                  <ActionBtn
                    label="برگشت به محتوانویس"
                    tone="amber"
                    busy={busy}
                    onClick={() => act("return")}
                  />
                )}
              {task.status === "AWAITING_APPROVAL" && isManager && (
                <>
                  <ActionBtn
                    label="برگشت به محتواگذار"
                    tone="amber"
                    busy={busy}
                    onClick={() => act("return")}
                  />
                  <ActionBtn
                    label="برگشت مستقیم به محتوانویس"
                    tone="amber"
                    busy={busy}
                    onClick={() => act("return", { toWriter: true })}
                  />
                </>
              )}
              {isManager && (
                <ActionBtn label="لغو" tone="gray" busy={busy} onClick={() => act("cancel")} />
              )}
            </div>
            {task.status === "PUBLISHING" && task.destination === "BLOG" && (
              <p className="text-[11px] text-gray-400">
                قبل از انتشار، عنوان، نامک، خلاصه و کاور مقاله را در «مشخصات مقاله» بالا کامل کنید.
              </p>
            )}
            {task.status === "AWAITING_APPROVAL" && task.destination === "BLOG" && (
              <p className="text-[11px] text-gray-400">
                مقاله منتشر شده است. برگشت آن را از مجله پایین نمی‌آورد؛ محتواگذار همان را اصلاح
                می‌کند.
              </p>
            )}
          </section>
        )}

        {closed && isManager && (
          <section className="flex gap-1.5">
            <ActionBtn label="بازگشایی" tone="gray" busy={busy} onClick={() => act("reopen")} />
          </section>
        )}

        {/* تاریخچه */}
        <section>
          <h3 className="text-[11px] font-black text-gray-500 mb-1.5">تاریخچه</h3>
          <ul className="space-y-1.5">
            {(task.events ?? []).map((e) => (
              <li key={e.id} className="text-[11px] text-gray-600 dark:text-gray-400">
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {CONTENT_EVENT_LABELS[e.action]}
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
        {isManager && !closed && (
          <section className="grid sm:grid-cols-2 gap-2">
            <div>
              <h3 className="text-[11px] font-black text-gray-500 mb-1.5">محتوانویس</h3>
              <select
                className={inputCls}
                value={task.writerId ?? ""}
                disabled={busy}
                onChange={(e) => e.target.value && reassign("writerId", e.target.value)}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isMe ? " (خودم)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h3 className="text-[11px] font-black text-gray-500 mb-1.5">محتواگذار</h3>
              <select
                className={inputCls}
                value={task.publisherId ?? ""}
                disabled={busy}
                onChange={(e) => reassign("publisherId", e.target.value)}
              >
                <option value="">همان محتوانویس</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isMe ? " (خودم)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// مشخصات مقاله‌ی مجله
// ─────────────────────────────────────────────────────────────────

function PostMetaSection({
  taskId,
  post,
  categories,
  editable,
  onSaved,
}: {
  taskId: string;
  post: BlogPostMeta;
  categories: BlogCategory[];
  editable: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    coverImage: post.coverImage ?? "",
    categoryId: post.categoryId ?? "",
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/worklist/content/${taskId}/post`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");
      setMsg({ ok: true, text: "ذخیره شد" });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      const up = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await up.json();
      if (!up.ok) throw new Error(d.error ?? "آپلود نشد");
      setForm((f) => ({ ...f, coverImage: d.url }));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "آپلود نشد" });
    } finally {
      setBusy(false);
    }
  }

  const published = post.status === "PUBLISHED";

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/10 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black text-gray-500">مشخصات مقاله</h3>
        <span
          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
            published
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-gray-100 dark:bg-white/5 text-gray-500"
          }`}
        >
          {published ? "منتشر شده" : "پیش‌نویس"}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          className={inputCls}
          disabled={!editable}
          placeholder="عنوان مقاله"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          className={inputCls}
          disabled={!editable}
          dir="ltr"
          placeholder="نامک (slug)"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <select
          className={inputCls}
          disabled={!editable}
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        >
          <option value="">بدون دسته</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <div className="flex gap-2 items-center">
          <input
            className={inputCls}
            disabled={!editable}
            dir="ltr"
            placeholder="آدرس کاور"
            value={form.coverImage}
            onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
          />
          {editable && (
            <label className="shrink-0 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
              آپلود
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <input
          className={`${inputCls} sm:col-span-2`}
          disabled={!editable}
          placeholder="عنوان سئو (اختیاری — خالی = عنوان مقاله)"
          value={form.seoTitle}
          onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
        />
        <textarea
          className={`${inputCls} sm:col-span-2 resize-none`}
          disabled={!editable}
          rows={2}
          placeholder="خلاصه‌ی مقاله"
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
        />
        <textarea
          className={`${inputCls} sm:col-span-2 resize-none`}
          disabled={!editable}
          rows={2}
          placeholder="توضیحات متا (۱۵۰ تا ۱۶۰ نویسه)"
          value={form.seoDescription}
          onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
        />
      </div>
      {form.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={form.coverImage} alt="" className="h-24 rounded-xl object-cover" />
      )}
      {editable && (
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
          >
            ذخیره‌ی مشخصات
          </button>
          {msg && (
            <span
              className={`text-[11px] font-bold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}
            >
              {msg.text}
            </span>
          )}
        </div>
      )}
      {post.publishedAt && (
        <p className="text-[11px] text-gray-400">
          منتشر شده: {formatDateTime(post.publishedAt)} ·{" "}
          <a href={`/mag/${post.slug}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            دیدن در مجله
          </a>
        </p>
      )}
      {!editable && (
        <p className="text-[11px] text-gray-400">
          مشخصات مقاله در مرحله‌ی «در حال انتشار» دست محتواگذار است.
        </p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────

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
