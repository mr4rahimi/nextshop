"use client";

/**
 * پیوست مدارک یک سند — زیر فاکتور، دریافت و پرداخت، سند، حواله، چک، شخص و … (webhesab-parity.md بخش ۱۶).
 *
 * انتخاب فایل، کشیدن و رها کردن، یا چسباندن عکس (Ctrl+V از اسکنر/اسکرین‌شات). فایل خصوصی است و فقط از
 * `/api/admin/accounting/attachments/<id>` با مجوز باز می‌شود.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { api, Card, inputCls, SectionTitle } from "./ui";

export type AttachDocType =
  | "AccInvoice"
  | "AccMoneyDoc"
  | "AccVoucher"
  | "AccStockAdjust"
  | "AccTransfer"
  | "AccStockCount"
  | "AccPurchaseOrder"
  | "AccCheque"
  | "AccParty";

interface Row {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  image: boolean;
  url: string;
  uploadedByName: string;
  createdAt: string;
}

const MAX_SIZE = 10 * 1024 * 1024;

export const fileSize =(n: number) => (n < 1024 * 1024 ? `${faNum(Math.max(1, Math.round(n / 1024)))} کیلوبایت` : `${faNum(Math.round((n / 1024 / 1024) * 10) / 10)} مگابایت`);

export function fileIcon(name: string, mime: string): string {
  if (mime === "application/pdf") return "📕";
  if (mime.startsWith("image/")) return "🖼";
  if (/\.(xlsx?|csv)$/i.test(name)) return "📊";
  if (/\.docx?$/i.test(name)) return "📝";
  if (/\.(zip|rar)$/i.test(name)) return "🗜";
  return "📄";
}

export default function Attachments({ docType, docId, title = "پیوست‌ها", className = "" }: { docType: AttachDocType; docId: string; title?: string; className?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [accept, setAccept] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<{ rows: Row[]; can: { edit: boolean }; accept: string }>(`/api/admin/accounting/attachments?docType=${docType}&docId=${docId}`)
      .then((d) => {
        setRows(d.rows);
        setCanEdit(d.can.edit);
        setAccept(d.accept);
      })
      // بی مجوز دیدن، بخش پنهان می‌ماند — صفحه‌ی سند خودش پیام دسترسی دارد
      .catch(() => setHidden(true));
  }, [docType, docId]);
  useEffect(load, [load]);

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError(null);
    // یکی‌یکی: سقف بدنه‌ی nginx (۵۰ مگابایت) با ده فایل ۱۰ مگابایتی پر می‌شد و پاسخ ۴۱۳ پیام خوانا نداشت
    const errors: string[] = [];
    try {
      for (const f of files.slice(0, 10)) {
        if (f.size > MAX_SIZE) {
          errors.push(`«${f.name}» بیش از ۱۰ مگابایت است`);
          continue;
        }
        const fd = new FormData();
        fd.set("docType", docType);
        fd.set("docId", docId);
        if (note.trim()) fd.set("title", note.trim());
        fd.append("file", f);
        await api("/api/admin/accounting/attachments", { method: "POST", body: fd }).catch((e: Error) => errors.push(`«${f.name}»: ${e.message}`));
      }
      if (!errors.length) setNote("");
      if (files.length > 10) errors.push("هر بار حداکثر ۱۰ فایل؛ بقیه را دوباره بفرستید.");
      if (errors.length) setError(errors.join(" — "));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      load();
    }
  }

  async function rename(r: Row) {
    const t = prompt("شرح پیوست", r.title ?? "");
    if (t === null) return;
    try {
      await api(r.url, { method: "PATCH", json: { title: t } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(r: Row) {
    if (!confirm(`پیوست «${r.title || r.fileName}» حذف شود؟`)) return;
    try {
      await api(r.url, { method: "DELETE" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (hidden) return null;
  return (
    <Card className={`p-4 ${className}`}>
      <SectionTitle
        title={`📎 ${title}${rows?.length ? ` (${faNum(rows.length)})` : ""}`}
        help="accountingAttachments"
        actions={
          canEdit && (
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="acc-btn-soft rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/5 dark:text-gray-200">
              {busy ? "در حال بارگذاری…" : "+ افزودن فایل"}
            </button>
          )
        }
      />
      {canEdit && (
        <>
          <input ref={input} type="file" multiple accept={accept} className="hidden" onChange={(e) => upload([...(e.target.files ?? [])])} />
          <div
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              upload([...e.dataTransfer.files]);
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                upload(files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `paste-${Date.now()}-${i}.png`, { type: f.type }))));
              }
            }}
            className={`mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-2 text-[11px] text-gray-500 outline-none focus:border-blue-400 ${drag ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-gray-300 dark:border-white/15"}`}
          >
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="شرح (اختیاری): رسید واریز، قرارداد، …" className={`${inputCls} max-w-xs !py-1.5 text-xs`} />
            <span>فایل را اینجا بکشید، یا کلیک کنید و عکس را بچسبانید (Ctrl+V). عکس، PDF، Word، Excel — هر فایل تا ۱۰ مگابایت.</span>
          </div>
        </>
      )}
      {error && <p className="mb-2 text-xs font-bold text-red-600">{error}</p>}
      {rows === null ? (
        <p className="text-xs text-gray-400">…</p>
      ) : !rows.length ? (
        <p className="text-xs text-gray-400">پیوستی ندارد.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-gray-200 p-2 dark:border-white/10">
              <a href={r.url} target="_blank" rel="noopener" className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-2xl dark:bg-white/5" title="باز کردن">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.url} alt={r.title ?? r.fileName} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  fileIcon(r.fileName, r.mimeType)
                )}
              </a>
              <div className="min-w-0 flex-1">
                <a href={r.url} target="_blank" rel="noopener" className="block truncate text-xs font-bold text-gray-900 hover:text-blue-600 dark:text-white">
                  {r.title || r.fileName}
                </a>
                <p className="truncate text-[10px] text-gray-400" dir="auto">
                  {r.title ? `${r.fileName} · ` : ""}
                  {fileSize(r.size)} · {formatJalali(new Date(r.createdAt))} · {r.uploadedByName}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1 text-[11px]">
                <a href={`${r.url}?download=1`} className="rounded-md px-1.5 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" title="دانلود">
                  ⬇
                </a>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => rename(r)} className="rounded-md px-1.5 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" title="ویرایش شرح">
                      ✏️
                    </button>
                    <button type="button" onClick={() => remove(r)} className="rounded-md px-1.5 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="حذف">
                      🗑
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
