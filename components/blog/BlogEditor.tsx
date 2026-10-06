"use client";

/**
 * ادیتور متن غنی مقاله، صفحه‌ی ثابت و محتوای بازاریابی (Tiptap 3).
 *
 * خروجی HTML ساده است و صفحه‌ی سایت آن را با `.rich-content` رندر می‌کند —
 * هر گره‌ی تازه‌ای که اینجا اضافه شود باید در `app/styles/rich-content.css`
 * هم استایل بگیرد. گره‌های اختصاصی در `editor/extensions.ts` هستند.
 */

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Table, TableRow } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript as SubIcon,
  Superscript as SupIcon, Code, Baseline, Highlighter, AlignRight, AlignCenter, AlignLeft, AlignJustify,
  List, ListOrdered, ListChecks, Quote, SquareCode, Minus, MessageSquareWarning, Link2, Unlink,
  ImagePlus, Youtube as YoutubeIcon, Table as TableIcon, RemoveFormatting, FileCode2, Maximize2,
  Minimize2, ChevronDown, Trash2, TableCellsMerge, TableCellsSplit, PaintBucket, ExternalLink,
  Upload, X, Search,
} from "lucide-react";
import {
  Callout, CALLOUTS, VideoEmbed, RichImage, RichTableCell, RichTableHeader, toEmbedUrl,
  type CalloutType,
} from "@/components/blog/editor/extensions";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const TEXT_COLORS = [
  "#111827", "#4b5563", "#9ca3af", "#dc2626", "#ea580c", "#d97706", "#16a34a", "#059669",
  "#0891b2", "#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777", "#78350f", "#ffffff",
];
const HIGHLIGHTS = ["#fef08a", "#fde68a", "#fed7aa", "#fecaca", "#fbcfe8", "#e9d5ff", "#c7d2fe", "#bfdbfe", "#a5f3fc", "#bbf7d0", "#d9f99d", "#e5e7eb"];
const CELL_COLORS = ["#eff6ff", "#ecfdf5", "#fefce8", "#fff7ed", "#fef2f2", "#f5f3ff", "#f3f4f6", "#dbeafe", "#d1fae5", "#fef3c7"];

// ───────────────────────────── اجزای کوچک ─────────────────────────────

function Btn({ onClick, active, disabled, title, children, wide }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={onClick} title={title} aria-label={title} disabled={disabled}
      className={`${wide ? "px-2 gap-1" : "w-8"} h-8 flex items-center justify-center rounded-lg text-[13px] font-bold transition-all shrink-0 disabled:opacity-30 disabled:pointer-events-none
        ${active ? "bg-primary-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700"}`}>
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />;
}

/** پنل بازشونده زیر دکمه؛ با کلیک بیرون یا Esc بسته می‌شود */
function Pop({ open, onClose, children, className = "" }: {
  open: boolean; onClose: () => void; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref}
      className={`absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl shadow-black/10 p-3 ${className}`}>
      {children}
    </div>
  );
}

function Swatches({ colors, onPick, onClear, clearLabel }: {
  colors: string[]; onPick: (c: string) => void; onClear: () => void; clearLabel: string;
}) {
  return (
    <div className="w-56 space-y-3">
      <div className="grid grid-cols-8 gap-1.5">
        {colors.map(c => (
          <button key={c} type="button" onMouseDown={e => e.preventDefault()} onClick={() => onPick(c)} title={c}
            className="w-5 h-5 rounded-md border border-black/10 hover:scale-125 transition-transform" style={{ background: c }} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer flex-1">
          <input type="color" className="w-7 h-7 rounded cursor-pointer bg-transparent" onChange={e => onPick(e.target.value)} />
          رنگ دلخواه
        </label>
        <button type="button" onClick={onClear} className="text-xs font-bold text-red-500 hover:underline">{clearLabel}</button>
      </div>
    </div>
  );
}

const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15";
const primaryBtn = "px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-black hover:bg-primary-700 disabled:opacity-50 transition-all";

// ───────────────────────────── آپلود ─────────────────────────────

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "آپلود تصویر ممکن نشد");
  return data.url;
}

/** نام فایل → پیشنهاد alt («best-printer_2025.jpg» → «best printer 2025») */
function altFromFileName(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\d{10,}/g, "").trim();
}

// ───────────────────────────── ادیتور ─────────────────────────────

type PopName = "block" | "color" | "highlight" | "callout" | "link" | "image" | "video" | "table" | "cellColor" | null;

export default function BlogEditor({ value, onChange, placeholder = "محتوای مطلب را بنویسید... (برای سرتیتر از منوی «پاراگراف» استفاده کنید)" }: Props) {
  const [pop, setPop] = useState<PopName>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const close = useCallback(() => setPop(null), []);
  const toggle = (p: PopName) => setPop(cur => (cur === p ? null : p));
  const lastEmitted = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // پیش‌فرض Tiptap همه‌ی لینک‌ها را nofollow و تب جدید می‌کند — لینک
        // داخلی nofollow برای سئو ضرر است؛ هر لینک خودش تعیین می‌کند.
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { target: null, rel: null, class: null } },
      }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["right", "center", "left", "justify"] }),
      RichImage.configure({ HTMLAttributes: { loading: "lazy" } }),
      // فقط برای خواندن محتوای قدیمی؛ ویدیوی تازه با VideoEmbed درج می‌شود
      Youtube.configure({ width: 640, height: 360 }),
      VideoEmbed,
      Callout,
      // تغییر عرض ستون با کشیدن در prosemirror-tables برای RTL درست کار نمی‌کند
      Table.configure({ resizable: false }),
      TableRow,
      RichTableHeader,
      RichTableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rich-content rich-editor min-h-[460px] px-6 py-5 outline-none",
        dir: "rtl",
      },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter(f => f.type.startsWith("image/"));
        if (!files.length) return false;
        insertFiles(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter(f => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertFiles(files, pos);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  async function insertFiles(files: File[], pos?: number) {
    setUploading(true); setError("");
    try {
      for (const f of files) {
        const src = await uploadImage(f);
        const node = { type: "image", attrs: { src, alt: altFromFileName(f.name) } };
        const ed = editorRef.current;
        if (!ed) break;
        if (pos != null) ed.chain().focus().insertContentAt(pos, node).run();
        else ed.chain().focus().insertContent(node).run();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  // محتوای بیرونی (بارگذاری مقاله برای ویرایش) — نه بازتاب تایپ خود ادیتور
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !pop) setFullscreen(false); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); };
  }, [fullscreen, pop]);

  if (!editor) {
    return <div className="h-[540px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 animate-pulse" />;
  }

  const e = editor;
  const chain = () => e.chain().focus();
  const inTable = e.isActive("table");
  const onImage = e.isActive("image");
  const blockLabel = e.isActive("heading", { level: 2 }) ? "سرتیتر ۲" : e.isActive("heading", { level: 3 }) ? "سرتیتر ۳"
    : e.isActive("heading", { level: 4 }) ? "سرتیتر ۴" : e.isActive("codeBlock") ? "کد" : "پاراگراف";
  const words = e.storage.characterCount?.words?.() ?? 0;
  const chars = e.storage.characterCount?.characters?.() ?? 0;

  function applySource() {
    if (source == null) return;
    e.commands.setContent(source, { emitUpdate: true });
    setSource(null);
  }

  return (
    <div className={`be-root border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col
      ${fullscreen ? "fixed inset-0 z-[100] rounded-none" : "rounded-2xl relative"}`}>

      {/* ── نوار ابزار ─────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-0.5 p-2 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 ${fullscreen ? "" : "rounded-t-2xl"}`}>
        <Btn onClick={() => chain().undo().run()} disabled={!e.can().undo()} title="برگشت (Ctrl+Z)"><Undo2 size={16} /></Btn>
        <Btn onClick={() => chain().redo().run()} disabled={!e.can().redo()} title="انجام دوباره (Ctrl+Shift+Z)"><Redo2 size={16} /></Btn>
        <Sep />

        {/* نوع بلوک */}
        <div className="relative">
          <Btn wide onClick={() => toggle("block")} active={pop === "block"} title="نوع بلوک">
            <span className="min-w-[4.5rem] text-right">{blockLabel}</span><ChevronDown size={14} />
          </Btn>
          <Pop open={pop === "block"} onClose={close} className="w-52 !p-1.5">
            {[
              { l: "پاراگراف", c: "text-sm", run: () => chain().setParagraph().run(), a: e.isActive("paragraph") },
              { l: "سرتیتر ۲ (H2)", c: "text-lg font-black", run: () => chain().toggleHeading({ level: 2 }).run(), a: e.isActive("heading", { level: 2 }) },
              { l: "سرتیتر ۳ (H3)", c: "text-base font-black", run: () => chain().toggleHeading({ level: 3 }).run(), a: e.isActive("heading", { level: 3 }) },
              { l: "سرتیتر ۴ (H4)", c: "text-sm font-black", run: () => chain().toggleHeading({ level: 4 }).run(), a: e.isActive("heading", { level: 4 }) },
              { l: "بلوک کد", c: "text-sm font-mono", run: () => chain().toggleCodeBlock().run(), a: e.isActive("codeBlock") },
            ].map(o => (
              <button key={o.l} type="button" onMouseDown={ev => ev.preventDefault()} onClick={() => { o.run(); close(); }}
                className={`w-full text-right px-3 py-2 rounded-xl ${o.c} ${o.a ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                {o.l}
              </button>
            ))}
            <p className="text-[10px] text-gray-400 px-3 pt-1 pb-0.5 leading-5">عنوان مقاله خودش H1 است؛ بخش‌ها را با H2 شروع کنید.</p>
          </Pop>
        </div>
        <Sep />

        <Btn onClick={() => chain().toggleBold().run()} active={e.isActive("bold")} title="پررنگ (Ctrl+B)"><Bold size={16} /></Btn>
        <Btn onClick={() => chain().toggleItalic().run()} active={e.isActive("italic")} title="کج (Ctrl+I)"><Italic size={16} /></Btn>
        <Btn onClick={() => chain().toggleUnderline().run()} active={e.isActive("underline")} title="زیرخط (Ctrl+U)"><UnderlineIcon size={16} /></Btn>
        <Btn onClick={() => chain().toggleStrike().run()} active={e.isActive("strike")} title="خط‌خورده"><Strikethrough size={16} /></Btn>
        <Btn onClick={() => chain().toggleSuperscript().run()} active={e.isActive("superscript")} title="بالانویس (x²)"><SupIcon size={16} /></Btn>
        <Btn onClick={() => chain().toggleSubscript().run()} active={e.isActive("subscript")} title="زیرنویس (H₂O)"><SubIcon size={16} /></Btn>
        <Btn onClick={() => chain().toggleCode().run()} active={e.isActive("code")} title="کد درون‌خطی"><Code size={16} /></Btn>

        <div className="relative">
          <Btn onClick={() => toggle("color")} active={pop === "color"} title="رنگ متن">
            <span className="flex flex-col items-center leading-none">
              <Baseline size={16} />
              <span className="w-4 h-1 rounded-full -mt-0.5" style={{ background: e.getAttributes("textStyle").color || "currentColor" }} />
            </span>
          </Btn>
          <Pop open={pop === "color"} onClose={close}>
            <Swatches colors={TEXT_COLORS} clearLabel="رنگ پیش‌فرض"
              onPick={c => chain().setColor(c).run()} onClear={() => { chain().unsetColor().run(); close(); }} />
          </Pop>
        </div>
        <div className="relative">
          <Btn onClick={() => toggle("highlight")} active={pop === "highlight" || e.isActive("highlight")} title="رنگ پس‌زمینه‌ی متن (هایلایت)"><Highlighter size={16} /></Btn>
          <Pop open={pop === "highlight"} onClose={close}>
            <Swatches colors={HIGHLIGHTS} clearLabel="بدون هایلایت"
              onPick={c => chain().setHighlight({ color: c }).run()} onClear={() => { chain().unsetHighlight().run(); close(); }} />
          </Pop>
        </div>
        <Sep />

        <Btn onClick={() => chain().setTextAlign("right").run()} active={e.isActive({ textAlign: "right" })} title="راست‌چین"><AlignRight size={16} /></Btn>
        <Btn onClick={() => chain().setTextAlign("center").run()} active={e.isActive({ textAlign: "center" })} title="وسط‌چین"><AlignCenter size={16} /></Btn>
        <Btn onClick={() => chain().setTextAlign("left").run()} active={e.isActive({ textAlign: "left" })} title="چپ‌چین"><AlignLeft size={16} /></Btn>
        <Btn onClick={() => chain().setTextAlign("justify").run()} active={e.isActive({ textAlign: "justify" })} title="تراز دوطرفه"><AlignJustify size={16} /></Btn>
        <Sep />

        <Btn onClick={() => chain().toggleBulletList().run()} active={e.isActive("bulletList")} title="فهرست نقطه‌ای"><List size={16} /></Btn>
        <Btn onClick={() => chain().toggleOrderedList().run()} active={e.isActive("orderedList")} title="فهرست شماره‌دار"><ListOrdered size={16} /></Btn>
        <Btn onClick={() => chain().toggleTaskList().run()} active={e.isActive("taskList")} title="چک‌لیست"><ListChecks size={16} /></Btn>
        <Btn onClick={() => chain().toggleBlockquote().run()} active={e.isActive("blockquote")} title="نقل‌قول"><Quote size={16} /></Btn>
        <Btn onClick={() => chain().toggleCodeBlock().run()} active={e.isActive("codeBlock")} title="بلوک کد"><SquareCode size={16} /></Btn>
        <Btn onClick={() => chain().setHorizontalRule().run()} title="خط جداکننده"><Minus size={16} /></Btn>

        <div className="relative">
          <Btn onClick={() => toggle("callout")} active={pop === "callout" || e.isActive("callout")} title="کادر نکته / هشدار"><MessageSquareWarning size={16} /></Btn>
          <Pop open={pop === "callout"} onClose={close} className="w-48 !p-1.5">
            {CALLOUTS.map(c => (
              <button key={c.type} type="button" onMouseDown={ev => ev.preventDefault()}
                onClick={() => { chain().toggleCallout(c.type as CalloutType).run(); close(); }}
                className={`w-full flex items-center gap-2 text-right px-3 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200
                  ${e.isActive("callout", { type: c.type }) ? "bg-primary-50 dark:bg-primary-900/30" : ""}`}>
                <span>{c.emoji}</span>{c.label}
                {e.isActive("callout", { type: c.type }) && <span className="mr-auto text-[10px] text-gray-400">برداشتن</span>}
              </button>
            ))}
          </Pop>
        </div>
        <Sep />

        <LinkTool editor={e} open={pop === "link"} onToggle={() => toggle("link")} onClose={close} />
        <ImageTool open={pop === "image"} onToggle={() => toggle("image")} onClose={close} uploading={uploading}
          onInsert={(src, alt) => { chain().setImage({ src, alt }).run(); close(); }}
          onFiles={files => { close(); insertFiles(files); }} />
        <div className="relative">
          <Btn onClick={() => toggle("video")} active={pop === "video"} title="ویدیو یوتیوب / آپارات"><YoutubeIcon size={16} /></Btn>
          <Pop open={pop === "video"} onClose={close} className="w-80">
            <VideoForm onInsert={src => { chain().setVideoEmbed(src).run(); close(); }} />
          </Pop>
        </div>
        <TableTool editor={e} open={pop === "table"} onToggle={() => toggle("table")} onClose={close} />
        <Sep />

        <Btn onClick={() => chain().unsetAllMarks().clearNodes().run()} title="پاک کردن قالب‌بندی"><RemoveFormatting size={16} /></Btn>

        <div className="flex-1" />
        <Btn onClick={() => setSource(source == null ? formatHtml(e.getHTML()) : null)} active={source != null} title="ویرایش کد HTML"><FileCode2 size={16} /></Btn>
        <Btn onClick={() => setFullscreen(f => !f)} active={fullscreen} title={fullscreen ? "خروج از تمام‌صفحه (Esc)" : "تمام‌صفحه"}>
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Btn>
      </div>

      {/* ── نوارهای وابسته به انتخاب ───────────────────────── */}
      {inTable && source == null && <TableBar editor={e} cellColorOpen={pop === "cellColor"} onToggleCellColor={() => toggle("cellColor")} onClose={close} />}
      {onImage && source == null && <ImageBar editor={e} />}
      {e.isActive("link") && !onImage && source == null && <LinkBar editor={e} onEdit={() => setPop("link")} />}

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
          {error}
          <button type="button" onClick={() => setError("")} className="mr-auto"><X size={14} /></button>
        </div>
      )}
      {uploading && (
        <div className="px-4 py-2 text-xs font-bold text-primary-700 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-300 border-b border-primary-100 dark:border-primary-900/40 animate-pulse">
          در حال آپلود تصویر...
        </div>
      )}

      {/* ── متن ─────────────────────────────────────────────── */}
      <div className={`flex-1 ${fullscreen ? "overflow-y-auto" : ""}`}>
        {source != null ? (
          <div className="p-4 space-y-3">
            <textarea dir="ltr" spellCheck={false} value={source} onChange={ev => setSource(ev.target.value)}
              className="w-full min-h-[460px] font-mono text-xs leading-6 p-4 rounded-xl bg-gray-950 text-emerald-200 outline-none border border-gray-800" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={applySource} className={primaryBtn}>اعمال HTML</button>
              <button type="button" onClick={() => setSource(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">انصراف</button>
              <span className="text-[11px] text-gray-400 mr-auto">تگ‌هایی که ادیتور نمی‌شناسد هنگام اعمال حذف می‌شوند.</span>
            </div>
          </div>
        ) : (
          <div className={fullscreen ? "max-w-4xl mx-auto" : ""}>
            <EditorContent editor={e} />
          </div>
        )}
      </div>

      {/* ── پانویس آمار ─────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 ${fullscreen ? "" : "rounded-b-2xl"}`}>
        <span><b className="text-gray-600 dark:text-gray-300">{words.toLocaleString("fa-IR")}</b> کلمه</span>
        <span><b className="text-gray-600 dark:text-gray-300">{chars.toLocaleString("fa-IR")}</b> کاراکتر</span>
        <span>حدود <b className="text-gray-600 dark:text-gray-300">{Math.max(1, Math.round(words / 200)).toLocaleString("fa-IR")}</b> دقیقه مطالعه</span>
        <span className="mr-auto hidden sm:inline">تصویر را می‌توانید مستقیم بکشید و رها کنید یا Paste کنید</span>
      </div>
    </div>
  );
}

/** HTML یک‌خطی Tiptap را برای ویرایش دستی خوانا می‌کند */
function formatHtml(html: string) {
  return html
    .replace(/(<\/(p|h[1-6]|ul|ol|li|blockquote|table|tr|thead|tbody|pre|div)>)/g, "$1\n")
    .replace(/(<(ul|ol|table|tbody|thead|tr|blockquote)[^>]*>)/g, "$1\n")
    .replace(/(<hr[^>]*>|<img[^>]*>)/g, "$1\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// ───────────────────────────── لینک ─────────────────────────────

interface SearchHit { id: string; title: string; slug?: string; mainImage?: string | null }

function LinkTool({ editor, open, onToggle, onClose }: { editor: Editor; open: boolean; onToggle: () => void; onClose: () => void }) {
  const [href, setHref] = useState("");
  const [text, setText] = useState("");
  const [blank, setBlank] = useState(false);
  const [nofollow, setNofollow] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!open) return;
    const a = editor.getAttributes("link");
    const { from, to } = editor.state.selection;
    setHref(a.href ?? "");
    setBlank(a.target === "_blank");
    setNofollow(/nofollow/.test(a.rel ?? ""));
    setText(from === to ? "" : editor.state.doc.textBetween(from, to, " "));
    setQ(""); setHits([]);
  }, [open, editor]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/store/search?q=${encodeURIComponent(q)}&limit=6`).then(r => r.json())
        .then(d => setHits((d.products ?? []).filter((p: SearchHit) => p.slug))).catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function apply() {
    const url = href.trim();
    if (!url) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); onClose(); return; }
    const external = /^https?:\/\//i.test(url) && !url.includes(window.location.host);
    const rel = [blank || external ? "noopener" : "", nofollow ? "nofollow" : ""].filter(Boolean).join(" ") || null;
    const attrs = { href: url, target: blank ? "_blank" : null, rel };
    const { from, to } = editor.state.selection;
    if (from === to && !editor.isActive("link")) {
      const label = text.trim() || url;
      editor.chain().focus().insertContent({ type: "text", text: label, marks: [{ type: "link", attrs }] }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    }
    onClose();
  }

  const empty = editor.state.selection.empty && !editor.isActive("link");

  return (
    <div className="relative">
      <Btn onClick={onToggle} active={open || editor.isActive("link")} title="لینک (Ctrl+K)"><Link2 size={16} /></Btn>
      <Pop open={open} onClose={onClose} className="w-[22rem] space-y-3">
        <input autoFocus className={inp} dir="ltr" placeholder="https://... یا /products/..." value={href}
          onChange={ev => setHref(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") { ev.preventDefault(); apply(); } }} />
        {empty && (
          <input className={inp} placeholder="متن لینک" value={text} onChange={ev => setText(ev.target.value)} />
        )}
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${inp} pr-8`} placeholder="لینک داخلی: جستجوی محصول..." value={q} onChange={ev => setQ(ev.target.value)} />
        </div>
        {hits.length > 0 && (
          <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {hits.map(h => (
              <button key={h.id} type="button" onClick={() => { setHref(`/products/${h.slug}`); if (empty && !text) setText(h.title); setHits([]); setQ(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-right text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                {h.mainImage ? <img src={h.mainImage} alt="" className="w-7 h-7 rounded object-contain bg-white" /> : <span className="w-7 h-7 rounded bg-gray-100" />}
                <span className="line-clamp-1">{h.title}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-300">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={blank} onChange={ev => setBlank(ev.target.checked)} className="accent-primary-600" />باز شدن در تب جدید</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={nofollow} onChange={ev => setNofollow(ev.target.checked)} className="accent-primary-600" />nofollow <span className="text-gray-400">(لینک تبلیغاتی یا منبع نامطمئن)</span></label>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={apply} className={primaryBtn}>ثبت لینک</button>
          {editor.isActive("link") && (
            <button type="button" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); onClose(); }}
              className="px-3 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">حذف لینک</button>
          )}
        </div>
      </Pop>
    </div>
  );
}

function LinkBar({ editor, onEdit }: { editor: Editor; onEdit: () => void }) {
  const a = editor.getAttributes("link");
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-sky-50/70 dark:bg-sky-900/10 border-b border-gray-200 dark:border-gray-700 text-xs">
      <Link2 size={14} className="text-sky-600" />
      <a href={a.href} target="_blank" rel="noreferrer" dir="ltr" className="font-mono text-sky-700 dark:text-sky-300 hover:underline truncate max-w-[50%]">{a.href}</a>
      {a.target === "_blank" && <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 text-gray-500">تب جدید</span>}
      {/nofollow/.test(a.rel ?? "") && <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 text-gray-500">nofollow</span>}
      <div className="flex-1" />
      <Btn wide onClick={onEdit} title="ویرایش لینک"><span>ویرایش</span></Btn>
      <Btn onClick={() => window.open(a.href, "_blank")} title="باز کردن"><ExternalLink size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} title="حذف لینک"><Unlink size={14} /></Btn>
    </div>
  );
}

// ───────────────────────────── تصویر ─────────────────────────────

function ImageTool({ open, onToggle, onClose, onInsert, onFiles, uploading }: {
  open: boolean; onToggle: () => void; onClose: () => void; uploading: boolean;
  onInsert: (src: string, alt: string) => void; onFiles: (files: File[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setUrl(""); setAlt(""); } }, [open]);

  return (
    <div className="relative">
      <Btn onClick={onToggle} active={open} title="تصویر"><ImagePlus size={16} /></Btn>
      <Pop open={open} onClose={onClose} className="w-80 space-y-3">
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center gap-1.5 py-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Upload size={20} />
          <span className="text-sm font-bold">{uploading ? "در حال آپلود..." : "آپلود از کامپیوتر"}</span>
          <span className="text-[10px] text-gray-400">JPG، PNG، WebP — چند فایل با هم هم می‌شود</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={ev => { const f = [...(ev.target.files ?? [])]; ev.target.value = ""; if (f.length) onFiles(f); }} />
        <div className="flex items-center gap-2 text-[10px] text-gray-400"><span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />یا آدرس تصویر<span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" /></div>
        <input className={inp} dir="ltr" placeholder="https://..." value={url} onChange={ev => setUrl(ev.target.value)} />
        <input className={inp} placeholder="متن جایگزین (alt) — برای سئو لازم است" value={alt} onChange={ev => setAlt(ev.target.value)}
          onKeyDown={ev => { if (ev.key === "Enter" && url) { ev.preventDefault(); onInsert(url.trim(), alt.trim()); } }} />
        <button type="button" disabled={!url.trim()} onClick={() => onInsert(url.trim(), alt.trim())} className={`${primaryBtn} w-full`}>درج تصویر</button>
      </Pop>
    </div>
  );
}

function ImageBar({ editor }: { editor: Editor }) {
  const a = editor.getAttributes("image");
  const [alt, setAlt] = useState(a.alt ?? "");
  const [title, setTitle] = useState(a.title ?? "");
  useEffect(() => { setAlt(a.alt ?? ""); setTitle(a.title ?? ""); }, [a.src, a.alt, a.title]);
  // بدون focus: وگرنه رفتن از فیلد alt به title، فوکوس را به ادیتور برمی‌گرداند
  const set = (attrs: Record<string, any>) => editor.chain().updateAttributes("image", attrs).run();

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-amber-50/60 dark:bg-amber-900/10 border-b border-gray-200 dark:border-gray-700 text-xs">
      <span className="font-black text-amber-700 dark:text-amber-400">تصویر</span>
      <div className="flex items-center gap-1 flex-1 min-w-[14rem]">
        <input className={`${inp} !py-1.5 ${!alt.trim() ? "!border-red-300" : ""}`} placeholder="alt — توضیح تصویر برای گوگل و نابینایان"
          value={alt} onChange={ev => setAlt(ev.target.value)} onBlur={() => set({ alt: alt.trim() || null })}
          onKeyDown={ev => { if (ev.key === "Enter") { ev.preventDefault(); set({ alt: alt.trim() || null }); } }} />
        <input className={`${inp} !py-1.5 max-w-[10rem]`} placeholder="title (اختیاری)"
          value={title} onChange={ev => setTitle(ev.target.value)} onBlur={() => set({ title: title.trim() || null })} />
      </div>
      <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-lg p-0.5">
        {["25%", "50%", "75%", "100%"].map(w => (
          <Btn key={w} wide onClick={() => set({ width: w === "100%" ? null : w })} active={(a.width ?? "100%") === w} title={`عرض ${w}`}>
            <span className="text-[11px]">{w.replace("%", "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d])}٪</span>
          </Btn>
        ))}
      </div>
      <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-lg p-0.5">
        <Btn onClick={() => set({ align: "right" })} active={a.align === "right"} title="راست"><AlignRight size={14} /></Btn>
        <Btn onClick={() => set({ align: null })} active={!a.align || a.align === "center"} title="وسط"><AlignCenter size={14} /></Btn>
        <Btn onClick={() => set({ align: "left" })} active={a.align === "left"} title="چپ"><AlignLeft size={14} /></Btn>
      </div>
      <Btn onClick={() => editor.chain().focus().deleteSelection().run()} title="حذف تصویر"><Trash2 size={14} className="text-red-500" /></Btn>
    </div>
  );
}

// ───────────────────────────── ویدیو ─────────────────────────────

function VideoForm({ onInsert }: { onInsert: (src: string) => void }) {
  const [url, setUrl] = useState("");
  const embed = url ? toEmbedUrl(url) : null;
  return (
    <div className="space-y-3">
      <input autoFocus className={inp} dir="ltr" placeholder="لینک ویدیو یوتیوب یا آپارات" value={url} onChange={ev => setUrl(ev.target.value)}
        onKeyDown={ev => { if (ev.key === "Enter" && embed) { ev.preventDefault(); onInsert(embed); } }} />
      {url && !embed && <p className="text-[11px] text-red-500">لینک شناخته نشد — نمونه: youtube.com/watch?v=... یا aparat.com/v/...</p>}
      <button type="button" disabled={!embed} onClick={() => embed && onInsert(embed)} className={`${primaryBtn} w-full`}>درج ویدیو</button>
    </div>
  );
}

// ───────────────────────────── جدول ─────────────────────────────

const TEMPLATES: { label: string; html: string }[] = [
  {
    label: "مقایسه‌ی دو محصول",
    html: "<table><tbody><tr><th><p>ویژگی</p></th><th><p>محصول الف</p></th><th><p>محصول ب</p></th></tr>" +
      ["قیمت", "کیفیت ساخت", "گارانتی", "مناسب برای"].map(r => `<tr><td><p>${r}</p></td><td><p></p></td><td><p></p></td></tr>`).join("") +
      "</tbody></table><p></p>",
  },
  {
    label: "مشخصات فنی",
    html: "<table><tbody><tr><th><p>مشخصه</p></th><th><p>مقدار</p></th></tr>" +
      ["ابعاد", "وزن", "رنگ", "کشور سازنده", "گارانتی"].map(r => `<tr><td><p>${r}</p></td><td><p></p></td></tr>`).join("") +
      "</tbody></table><p></p>",
  },
  {
    label: "مزایا و معایب",
    html: "<table><tbody><tr><th><p>✅ مزایا</p></th><th><p>❌ معایب</p></th></tr>" +
      "<tr><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td></tr>" +
      "</tbody></table><p></p>",
  },
];

function TableTool({ editor, open, onToggle, onClose }: { editor: Editor; open: boolean; onToggle: () => void; onClose: () => void }) {
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const [header, setHeader] = useState(true);
  const ROWS = 8, COLS = 8;
  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <div className="relative">
      <Btn onClick={onToggle} active={open || editor.isActive("table")} title="جدول"><TableIcon size={16} /></Btn>
      <Pop open={open} onClose={onClose} className="w-64 space-y-3">
        <p className="text-xs font-black text-gray-700 dark:text-gray-200">
          درج جدول {hover[0] ? <span className="text-primary-600">{fa(hover[0])} ردیف × {fa(hover[1])} ستون</span> : ""}
        </p>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} onMouseLeave={() => setHover([0, 0])}>
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
            const r = Math.floor(i / COLS) + 1, c = (i % COLS) + 1;
            const on = r <= hover[0] && c <= hover[1];
            return (
              <button key={i} type="button" onMouseEnter={() => setHover([r, c])} onMouseDown={ev => ev.preventDefault()}
                onClick={() => { editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: header }).run(); onClose(); }}
                className={`aspect-square rounded-[4px] border transition-colors ${on ? "bg-primary-500 border-primary-600" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`} />
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={header} onChange={ev => setHeader(ev.target.checked)} className="accent-primary-600" />
          ردیف اول عنوان باشد <span className="text-gray-400">(پیشنهاد سئو)</span>
        </label>
        <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
          <p className="text-[10px] font-black text-gray-400">جدول آماده</p>
          {TEMPLATES.map(t => (
            <button key={t.label} type="button" onMouseDown={ev => ev.preventDefault()}
              onClick={() => { editor.chain().focus().insertContent(t.html).run(); onClose(); }}
              className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
              {t.label}
            </button>
          ))}
        </div>
      </Pop>
    </div>
  );
}

function TableBar({ editor, cellColorOpen, onToggleCellColor, onClose }: {
  editor: Editor; cellColorOpen: boolean; onToggleCellColor: () => void; onClose: () => void;
}) {
  const c = () => editor.chain().focus();
  const setBg = (bg: string | null) => {
    c().setCellAttribute("background", bg).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 bg-primary-50/60 dark:bg-primary-900/10 border-b border-gray-200 dark:border-gray-700 text-xs">
      <span className="font-black text-primary-700 dark:text-primary-300 ml-2 flex items-center gap-1"><TableIcon size={14} />جدول</span>
      <Btn wide onClick={() => c().addRowBefore().run()} title="افزودن ردیف بالا"><span>+ ردیف بالا</span></Btn>
      <Btn wide onClick={() => c().addRowAfter().run()} title="افزودن ردیف پایین"><span>+ ردیف پایین</span></Btn>
      <Btn wide onClick={() => c().addColumnBefore().run()} title="افزودن ستون سمت راست"><span>+ ستون راست</span></Btn>
      <Btn wide onClick={() => c().addColumnAfter().run()} title="افزودن ستون سمت چپ"><span>+ ستون چپ</span></Btn>
      <Sep />
      <Btn wide onClick={() => c().deleteRow().run()} title="حذف ردیف"><span className="text-red-500">− ردیف</span></Btn>
      <Btn wide onClick={() => c().deleteColumn().run()} title="حذف ستون"><span className="text-red-500">− ستون</span></Btn>
      <Sep />
      <Btn onClick={() => c().mergeCells().run()} disabled={!editor.can().mergeCells()} title="ادغام خانه‌های انتخاب‌شده"><TableCellsMerge size={15} /></Btn>
      <Btn onClick={() => c().splitCell().run()} disabled={!editor.can().splitCell()} title="جدا کردن خانه"><TableCellsSplit size={15} /></Btn>
      <Btn wide onClick={() => c().toggleHeaderRow().run()} title="ردیف اول عنوان باشد/نباشد"><span>ردیف عنوان</span></Btn>
      <Btn wide onClick={() => c().toggleHeaderColumn().run()} title="ستون اول عنوان باشد/نباشد"><span>ستون عنوان</span></Btn>
      <div className="relative">
        <Btn onClick={onToggleCellColor} active={cellColorOpen} title="رنگ خانه"><PaintBucket size={15} /></Btn>
        <Pop open={cellColorOpen} onClose={onClose}>
          <Swatches colors={CELL_COLORS} clearLabel="بی‌رنگ" onPick={color => setBg(color)} onClear={() => { setBg(null); onClose(); }} />
        </Pop>
      </div>
      <div className="flex-1" />
      <Btn wide onClick={() => c().deleteTable().run()} title="حذف کل جدول"><Trash2 size={14} className="text-red-500" /><span className="text-red-500">حذف جدول</span></Btn>
    </div>
  );
}

