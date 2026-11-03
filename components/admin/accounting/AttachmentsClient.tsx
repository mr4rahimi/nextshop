"use client";

/** همه‌ی پیوست‌های حسابداری — جستجو در شرح و نام فایل، با لینک به سند (webhesab-parity.md بخش ۱۶) */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, type Range } from "./Statement";
import { fileIcon, fileSize } from "./Attachments";
import { api, Card, Chips, Empty, ErrorText, inputCls, PageHeader } from "./ui";

interface Row {
  id: string;
  docType: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  image: boolean;
  url: string;
  uploadedByName: string;
  createdAt: string;
  doc: { label: string; href: string | null; partyName: string | null };
}
interface Data {
  rows: Row[];
  total: number;
  totalSize: number;
  counts: { byType: Record<string, number>; uploaders: { name: string; count: number }[] };
  types: { value: string; label: string }[];
}

export default function AttachmentsClient() {
  const [range, setRange] = useState<Range>(() => rangeFor("all"));
  const [docType, setDocType] = useState("");
  const [uploader, setUploader] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState<{ qs: string | null; data: Data | null; error: string | null }>({ qs: null, data: null, error: null });

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams(Object.entries({ from: range.from, to: range.to, docType, uploader, q: term }).filter((e): e is [string, string] => !!e[1])).toString();
  useEffect(() => {
    let alive = true;
    api<Data>(`/api/admin/accounting/attachments?${qs}`)
      .then((d) => alive && setState({ qs, data: d, error: null }))
      .catch((e: Error) => alive && setState((x) => ({ ...x, qs, error: e.message })));
    return () => {
      alive = false;
    };
  }, [qs]);
  const data = state.data;
  const all = data ? Object.values(data.counts.byType).reduce((s, n) => s + n, 0) : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="پیوست مدارک"
        help="accountingAttachments"
        desc="همه‌ی فایل‌هایی که به فاکتور، دریافت و پرداخت، سند، حواله، چک و اشخاص پیوست شده‌اند. برای افزودن پیوست، خود سند را باز کنید."
      />
      <div className="space-y-2">
        <RangeBar value={range} onChange={setRange} />
        {data && (
          <Chips
            value={docType}
            onChange={setDocType}
            options={[{ value: "", label: "همه", count: all }, ...data.types.filter((t) => data.counts.byType[t.value] || docType === t.value).map((t) => ({ ...t, count: data.counts.byType[t.value] ?? 0 }))]}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شرح یا نام فایل" className={`${inputCls} max-w-xs`} />
          <select value={uploader} onChange={(e) => setUploader(e.target.value)} className={`${inputCls} max-w-[14rem]`}>
            <option value="">همه‌ی کاربران</option>
            {data?.counts.uploaders.map((u) => (
              <option key={u.name} value={u.name}>
                {u.name} ({faNum(u.count)})
              </option>
            ))}
          </select>
        </div>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {data && (
        <p className="text-xs text-gray-500">
          {faNum(data.total)} پیوست · {fileSize(data.totalSize)}
          {data.total > data.rows.length && ` — ${faNum(data.rows.length)} تای آخر نشان داده شد؛ بازه یا جستجو را تنگ‌تر کنید`}
        </p>
      )}
      <Card className={`overflow-hidden transition-opacity ${state.qs !== qs ? "opacity-60" : ""}`}>
        {data && !data.rows.length ? (
          <Empty title="پیوستی پیدا نشد" desc="پیوست را از صفحه‌ی خود سند اضافه کنید (بخش «📎 پیوست‌ها»)." />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {data?.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <a href={r.url} target="_blank" rel="noopener" className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-xl dark:bg-white/5">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.url} alt={r.title ?? r.fileName} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    fileIcon(r.fileName, r.mimeType)
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={r.url} target="_blank" rel="noopener" className="block truncate text-sm font-bold text-gray-900 hover:text-blue-600 dark:text-white">
                    {r.title || r.fileName}
                  </a>
                  <p className="truncate text-[11px] text-gray-400" dir="auto">
                    {r.title ? `${r.fileName} · ` : ""}
                    {fileSize(r.size)} · {formatJalali(new Date(r.createdAt))} · {r.uploadedByName}
                  </p>
                </div>
                <div className="flex-shrink-0 text-left">
                  {r.doc.href ? (
                    <Link href={r.doc.href} className="block text-xs font-bold text-blue-600 hover:underline">
                      {r.doc.label}
                    </Link>
                  ) : (
                    <span className="block text-xs text-gray-400">{r.doc.label}</span>
                  )}
                  {r.doc.partyName && r.docType !== "AccParty" && <span className="block text-[11px] text-gray-500">{r.doc.partyName}</span>}
                </div>
                <a href={`${r.url}?download=1`} className="flex-shrink-0 rounded-md px-1.5 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" title="دانلود">
                  ⬇
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
