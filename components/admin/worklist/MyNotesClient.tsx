"use client";

/**
 * دفترچه‌ی شخصی کارمند — الگوی Google Keep.
 *
 * سنجاق، رنگ و بایگانی خوش‌بینانه روی صفحه اعمال می‌شوند و اگر سرور رد کرد
 * فهرست دوباره بارگذاری می‌شود. متن فقط با بستن کادر نوشتن یا پنجره‌ی
 * ویرایش ذخیره می‌شود، نه با هر کلید — تا برای هر حرف یک درخواست نرود.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "@/lib/worklist/types";
import { NOTE_COLORS, type NoteColor } from "@/lib/worklist/note-colors";

interface Note {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

type Patch = Partial<Pick<Note, "title" | "body" | "color" | "pinned" | "archived">>;

/** کلاس‌ها باید متن کامل باشند تا Tailwind حذفشان نکند */
const COLOR_STYLE: Record<NoteColor, { card: string; dot: string; label: string }> = {
  default: { card: "bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10", dot: "bg-white dark:bg-gray-800", label: "بی‌رنگ" },
  red: { card: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/20", dot: "bg-red-300", label: "قرمز" },
  orange: { card: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-500/20", dot: "bg-orange-300", label: "نارنجی" },
  yellow: { card: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-500/20", dot: "bg-yellow-300", label: "زرد" },
  green: { card: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-500/20", dot: "bg-green-300", label: "سبز" },
  teal: { card: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-500/20", dot: "bg-teal-300", label: "فیروزه‌ای" },
  blue: { card: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-500/20", dot: "bg-blue-300", label: "آبی" },
  purple: { card: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-500/20", dot: "bg-purple-300", label: "بنفش" },
  pink: { card: "bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-500/20", dot: "bg-pink-300", label: "صورتی" },
  gray: { card: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-white/10", dot: "bg-gray-300", label: "خاکستری" },
};

const ICON = {
  pin: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
  palette: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  archive: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  unarchive: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-7 8v-5m0 0l-2 2m2-2l2 2",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
};

function Svg({ d, filled = false, className = "w-4 h-4" }: { d: string; filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

function ToolButton({
  label,
  onClick,
  children,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-black/5 dark:hover:bg-white/10 ${
        active ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

function ColorPicker({ value, onPick }: { value: NoteColor; onPick: (c: NoteColor) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ToolButton label="رنگ" onClick={() => setOpen((o) => !o)}>
        <Svg d={ICON.palette} />
      </ToolButton>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-10 right-0 z-20 grid grid-cols-5 gap-1.5 p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-xl w-max"
        >
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={COLOR_STYLE[c].label}
              aria-label={COLOR_STYLE[c].label}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className={`w-7 h-7 rounded-full border ${COLOR_STYLE[c].dot} ${
                value === c ? "ring-2 ring-blue-500 border-transparent" : "border-gray-300 dark:border-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** textarea که با متن بلند می‌شود، مثل Keep */
function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

// ─────────────────────────────────────────────────────────────────

export default function MyNotesClient() {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/worklist/my-notes?archived=${tab === "archived" ? 1 : 0}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        setNotes(d.notes ?? []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (id: string, data: Patch) => {
      // خوش‌بینانه: یادداشتی که به تب دیگر رفته از فهرست فعلی بیرون می‌رود
      setNotes((prev) =>
        prev
          .map((n) => (n.id === id ? { ...n, ...data, pinned: data.archived ? false : data.pinned ?? n.pinned } : n))
          .filter((n) => n.archived === (tab === "archived")),
      );
      try {
        const res = await fetch(`/api/admin/worklist/my-notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "ذخیره ناموفق بود");
        if (d.note.archived === (tab === "archived")) {
          setNotes((prev) => prev.map((n) => (n.id === id ? d.note : n)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
        load();
      }
    },
    [tab, load],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("این یادداشت برای همیشه حذف شود؟")) return;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setEditing((cur) => (cur?.id === id ? null : cur));
      const res = await fetch(`/api/admin/worklist/my-notes/${id}`, { method: "DELETE" }).catch(() => null);
      if (!res?.ok) {
        setError("حذف یادداشت ناموفق بود");
        load();
      }
    },
    [load],
  );

  const create = useCallback(async (data: Patch) => {
    const res = await fetch("/api/admin/worklist/my-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "ثبت یادداشت ناموفق بود");
    setNotes((prev) => [d.note, ...prev]);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [notes, query]);

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
            <Svg d={ICON.search} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در یادداشت‌ها..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex rounded-xl bg-gray-100 dark:bg-white/5 p-1 text-xs font-bold">
          {(["active", "archived"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg transition ${
                tab === t
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t === "active" ? "یادداشت‌ها" : "بایگانی"}
            </button>
          ))}
        </div>
      </div>

      {tab === "active" && <Composer onCreate={create} />}

      {error && <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>}

      {loading ? (
        <p className="text-xs text-gray-500 text-center py-10">در حال بارگذاری...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-16">
          {query
            ? "یادداشتی با این عبارت پیدا نشد"
            : tab === "archived"
              ? "بایگانی خالی است"
              : "یادداشت‌هایی که اضافه می‌کنید اینجا نمایش داده می‌شوند"}
        </p>
      ) : (
        <>
          {pinned.length > 0 && (
            <NoteSection title="سنجاق‌شده" notes={pinned} onOpen={setEditing} onPatch={patch} onDelete={remove} />
          )}
          <NoteSection
            title={pinned.length > 0 ? "سایر" : null}
            notes={others}
            onOpen={setEditing}
            onPatch={patch}
            onDelete={remove}
          />
        </>
      )}

      {editing && (
        <EditorModal
          note={editing}
          onClose={(changes) => {
            setEditing(null);
            if (changes) patch(editing.id, changes);
          }}
          onDelete={() => remove(editing.id)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function Composer({ onCreate }: { onCreate: (data: Patch) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(async () => {
    if (saving) return;
    if (!title.trim() && !body.trim()) {
      setOpen(false);
      setColor("default");
      setPinned(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ title, body, color, pinned });
      setTitle("");
      setBody("");
      setColor("default");
      setPinned(false);
      setOpen(false);
    } catch (e) {
      // متن نوشته‌شده پاک نمی‌شود تا کاربر دوباره تلاش کند
      setError(e instanceof Error ? e.message : "ثبت یادداشت ناموفق بود");
    } finally {
      setSaving(false);
    }
  }, [saving, title, body, color, pinned, onCreate]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  return (
    <div ref={ref} className="max-w-xl mx-auto">
      <div className={`rounded-2xl border shadow-sm transition ${COLOR_STYLE[color].card}`}>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full text-right px-4 py-3.5 text-sm text-gray-500"
          >
            یادداشت بنویسید...
          </button>
        ) : (
          <div
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            <div className="flex items-start gap-2 px-4 pt-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان"
                maxLength={200}
                className="flex-1 bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
              />
              <ToolButton label={pinned ? "برداشتن سنجاق" : "سنجاق"} onClick={() => setPinned((p) => !p)} active={pinned}>
                <Svg d={ICON.pin} filled={pinned} />
              </ToolButton>
            </div>
            <AutoTextarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="یادداشت بنویسید..."
              className="w-full px-4 py-2 bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none resize-none placeholder:text-gray-400 max-h-[50vh]"
            />
            {error && <p className="px-4 text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center justify-between px-2 pb-2">
              <ColorPicker value={color} onPick={setColor} />
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
              >
                {saving ? "در حال ثبت..." : "بستن"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteSection({
  title,
  notes,
  onOpen,
  onPatch,
  onDelete,
}: {
  title: string | null;
  notes: Note[];
  onOpen: (n: Note) => void;
  onPatch: (id: string, data: Patch) => void;
  onDelete: (id: string) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <section>
      {title && <h2 className="text-[11px] font-bold text-gray-500 mb-2 px-1">{title}</h2>}
      <div className="columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-3">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} onOpen={() => onOpen(n)} onPatch={(d) => onPatch(n.id, d)} onDelete={() => onDelete(n.id)} />
        ))}
      </div>
    </section>
  );
}

function NoteCard({
  note,
  onOpen,
  onPatch,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onPatch: (data: Patch) => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={`group relative break-inside-avoid mb-3 rounded-2xl border cursor-pointer transition hover:shadow-md ${COLOR_STYLE[note.color].card}`}
    >
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-start gap-2">
          {note.title ? (
            <h3 className="flex-1 text-sm font-bold text-gray-900 dark:text-white break-words">{note.title}</h3>
          ) : (
            <span className="flex-1" />
          )}
          {!note.archived && (
            <span className={`-mt-1 -ml-2 transition ${note.pinned ? "" : "opacity-0 group-hover:opacity-100"}`}>
              <ToolButton label={note.pinned ? "برداشتن سنجاق" : "سنجاق"} onClick={() => onPatch({ pinned: !note.pinned })} active={note.pinned}>
                <Svg d={ICON.pin} filled={note.pinned} />
              </ToolButton>
            </span>
          )}
        </div>
        {note.body && (
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words line-clamp-[12]">
            {note.body}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 px-2 pb-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
        <ColorPicker value={note.color} onPick={(color) => onPatch({ color })} />
        <ToolButton
          label={note.archived ? "خروج از بایگانی" : "بایگانی"}
          onClick={() => onPatch({ archived: !note.archived })}
        >
          <Svg d={note.archived ? ICON.unarchive : ICON.archive} />
        </ToolButton>
        <ToolButton label="حذف" onClick={onDelete}>
          <Svg d={ICON.trash} />
        </ToolButton>
        <span className="mr-auto text-[10px] text-gray-400 px-2">{formatDateTime(note.updatedAt)}</span>
      </div>
    </div>
  );
}

function EditorModal({
  note,
  onClose,
  onDelete,
}: {
  note: Note;
  /** `null` یعنی چیزی تغییر نکرده و درخواستی لازم نیست */
  onClose: (changes: Patch | null) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const archived = note.archived;

  const finish = useCallback(
    (extra: Patch = {}) => {
      const next = { title, body, color, pinned, archived, ...extra };
      const changes: Patch = {};
      (Object.keys(next) as (keyof Patch)[]).forEach((k) => {
        if (next[k] !== note[k]) (changes as Record<string, unknown>)[k] = next[k];
      });
      onClose(Object.keys(changes).length > 0 ? changes : null);
    },
    [title, body, color, pinned, archived, note, onClose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
    >
      <div className={`w-full sm:max-w-xl max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl ${COLOR_STYLE[color].card}`}>
        <div className="flex items-start gap-2 px-5 pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان"
            maxLength={200}
            className="flex-1 bg-transparent text-base font-bold text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
          />
          {!archived && (
            <ToolButton label={pinned ? "برداشتن سنجاق" : "سنجاق"} onClick={() => setPinned((p) => !p)} active={pinned}>
              <Svg d={ICON.pin} filled={pinned} />
            </ToolButton>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2">
          <AutoTextarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="یادداشت بنویسید..."
            className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none resize-none placeholder:text-gray-400 min-h-[120px]"
          />
        </div>
        <div className="px-5 pb-1 text-[10px] text-gray-400 text-left">
          ویرایش: {formatDateTime(note.updatedAt)}
        </div>
        <div className="flex items-center gap-0.5 px-3 pb-3">
          <ColorPicker value={color} onPick={setColor} />
          <ToolButton
            label={archived ? "خروج از بایگانی" : "بایگانی"}
            onClick={() => finish({ archived: !archived })}
          >
            <Svg d={archived ? ICON.unarchive : ICON.archive} />
          </ToolButton>
          <ToolButton label="حذف" onClick={onDelete}>
            <Svg d={ICON.trash} />
          </ToolButton>
          <button
            type="button"
            onClick={() => finish()}
            className="mr-auto px-4 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
