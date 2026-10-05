"use client";

/**
 * کیوآر کد — ساخت، پیش‌نمایش زنده، دانلود SVG/PNG و QRهای ذخیره‌شده.
 *
 * - QR ثابت بدون ذخیره هم ساخته و دانلود می‌شود (ابزار سریع).
 * - QR پویا تا ذخیره نشود لینک کوتاه ندارد، پس پیش‌نمایشش کم‌رنگ و دانلودش
 *   بسته است — تصویری که پیش از ذخیره چاپ شود به هیچ‌جا اشاره نمی‌کند.
 * - کاربر بدون `TOOLS_MANAGE` فقط QR ثابت می‌سازد.
 *
 * مستندات: docs/features/tools.md بخش ۲
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Download, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { normalizeTarget } from "@/lib/tools/common";
import {
  DEFAULT_QR_STYLE, QR_TYPES, QR_TYPE_MAP, qrContrastWarning, qrStaticPayload, validateQrContent,
  type QrContent, type QrStyle, type QrType,
} from "@/lib/tools/qr-content";
import type { QrDto } from "@/lib/tools/qr-codes";
import { Badge, Card, Empty, ErrorText, Field, PageHeader, SectionTitle, Segmented, api, btn, inputCls } from "../accounting/ui";
import { useToolsAccess } from "./ToolsShell";
import { buildQrPng, buildQrSvg, downloadBlob, logoToDataUrl } from "@/components/tools/qr-render";

interface Draft {
  id: string | null;
  title: string;
  type: QrType;
  content: QrContent;
  isDynamic: boolean;
  style: QrStyle;
  /** فقط برای QR ذخیره‌شده‌ی پویا */
  shortUrl: string | null;
}

const emptyDraft = (url = ""): Draft => ({
  id: null,
  title: "",
  type: "url",
  content: { url },
  isDynamic: true,
  style: { ...DEFAULT_QR_STYLE },
  shortUrl: null,
});

const fa = (n: number) => n.toLocaleString("fa-IR");

function fileName(title: string) {
  return (title.trim() || "qr").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 60);
}

export default function QrClient() {
  const params = useSearchParams();
  const { ready, canManage } = useToolsAccess();
  const [d, setD] = useState<Draft>(() => emptyDraft(params.get("url") ?? ""));
  const [list, setList] = useState<QrDto[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<{ items: QrDto[] }>("/api/admin/tools/qr").then((r) => setList(r.items)).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  // بدون مجوز ساختن، فقط ثابت
  useEffect(() => {
    if (ready && !canManage && d.isDynamic) setD((x) => ({ ...x, isDynamic: false }));
  }, [ready, canManage, d.isDynamic]);

  const meta = QR_TYPE_MAP[d.type];
  const dynamic = d.isDynamic && meta.dynamic;
  const contentError = validateQrContent(d.type, d.content);

  const payload = useMemo(() => {
    if (dynamic) return d.shortUrl ?? `${typeof window !== "undefined" ? window.location.origin : ""}/s/xxxxx`;
    if (d.type === "url") {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return normalizeTarget(d.content.url ?? "", origin) ?? "";
    }
    return qrStaticPayload(d.type, d.content);
  }, [dynamic, d.shortUrl, d.type, d.content]);

  const svg = useMemo(() => {
    try {
      return buildQrSvg(payload || " ", d.style);
    } catch {
      return null; // متن بیش از ظرفیت QR
    }
  }, [payload, d.style]);

  const pendingDynamic = dynamic && !d.shortUrl;
  const canDownload = !!svg && !contentError && !pendingDynamic;
  const contrast = qrContrastWarning(d.style.fg, d.style.bg);

  function setType(type: QrType) {
    setD((x) => ({ ...x, type, content: {}, isDynamic: canManage && QR_TYPE_MAP[type].dynamic && x.isDynamic }));
  }
  const setField = (k: string, v: string) => setD((x) => ({ ...x, content: { ...x.content, [k]: v } }));
  const setStyle = (p: Partial<QrStyle>) => setD((x) => ({ ...x, style: { ...x.style, ...p } }));

  async function pickLogo(f: File | undefined) {
    if (!f) return;
    try {
      setStyle({ logo: await logoToDataUrl(f) });
    } catch {
      setMsg({ ok: false, text: "این تصویر خوانده نشد" });
    }
  }

  async function save() {
    if (contentError) return setMsg({ ok: false, text: contentError });
    setSaving(true);
    setMsg(null);
    try {
      const body = { title: d.title, content: d.content, style: d.style };
      const saved = d.id
        ? await api<QrDto>(`/api/admin/tools/qr/${d.id}`, { method: "PATCH", json: body })
        : await api<QrDto>("/api/admin/tools/qr", { method: "POST", json: { ...body, contentType: d.type, isDynamic: dynamic } });
      edit(saved);
      setMsg({ ok: true, text: d.id ? "✓ ذخیره شد" : saved.isDynamic ? "✓ ساخته شد — حالا می‌توانید دانلود کنید" : "✓ ذخیره شد" });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setSaving(false);
    }
  }

  function edit(q: QrDto) {
    setD({ id: q.id, title: q.title, type: q.contentType, content: q.content, isDynamic: q.isDynamic, style: q.style, shortUrl: q.shortUrl });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(q: QrDto) {
    const warn = q.isDynamic ? "\nلینک کوتاهش هم خاموش می‌شود و QRهای چاپ‌شده دیگر کار نمی‌کنند." : "";
    if (!confirm(`«${q.title}» حذف شود؟${warn}`)) return;
    await api(`/api/admin/tools/qr/${q.id}`, { method: "DELETE" }).catch(() => {});
    if (d.id === q.id) setD(emptyDraft());
    load();
  }

  async function downloadSvg(p = payload, style = d.style, title = d.title) {
    downloadBlob(new Blob([buildQrSvg(p, style)], { type: "image/svg+xml" }), `${fileName(title)}.svg`);
  }
  async function downloadPng(width: number, p = payload, style = d.style, title = d.title) {
    try {
      downloadBlob(await buildQrPng(p, style, width), `${fileName(title)}-${width}.png`);
    } catch {
      setMsg({ ok: false, text: "PNG ساخته نشد" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="کیوآر کد"
        help="toolsQr"
        desc="برای هر آدرس یا متنی. اگر قرار است چاپ شود، پویا بسازید تا بعداً مقصد عوض شود و اسکن‌ها شمرده شوند."
        actions={
          d.id ? (
            <button className={btn.soft} onClick={() => setD(emptyDraft())}>
              <Plus className="h-4 w-4" aria-hidden />
              QR تازه
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-4 p-4 sm:p-5">
          {d.id && (
            <p className="rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600">
              در حال ویرایش «{d.title}» — نوع و ثابت/پویا بودن پس از ساخت عوض نمی‌شود.
            </p>
          )}

          <Field label="نوع محتوا">
            <div className="flex flex-wrap gap-1.5">
              {QR_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  disabled={!!d.id}
                  onClick={() => setType(t.type)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                    d.type === t.type ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          {meta.dynamic && (
            <Field
              label="حالت"
              hint={
                dynamic
                  ? "داخل QR یک لینک کوتاه روی دامنه‌ی فروشگاه می‌نشیند؛ مقصد را هر وقت خواستید عوض کنید و اسکن‌ها شمرده می‌شوند."
                  : "خود محتوا داخل QR است؛ بعد از چاپ قابل تغییر نیست و آماری ندارد."
              }
            >
              {d.id ? (
                <Badge tone={d.isDynamic ? "blue" : "gray"}>{d.isDynamic ? "پویا" : "ثابت"}</Badge>
              ) : (
                <Segmented
                  value={dynamic ? "dynamic" : "static"}
                  onChange={(v) => setD((x) => ({ ...x, isDynamic: v === "dynamic" }))}
                  options={canManage ? [{ value: "dynamic", label: "پویا (برای چاپ)" }, { value: "static", label: "ثابت" }] : [{ value: "static", label: "ثابت" }]}
                />
              )}
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {meta.fields.map((f) => (
              <Field key={f.key} label={f.label} className={f.multiline || meta.fields.length === 1 ? "sm:col-span-2" : ""}>
                {f.multiline ? (
                  <textarea className={`${inputCls} min-h-[80px]`} value={d.content[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
                ) : (
                  <input
                    className={inputCls}
                    dir={f.dir}
                    placeholder={f.placeholder}
                    value={d.content[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>

          <SectionTitle title="ظاهر" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رنگ نقطه‌ها">
              <ColorInput value={d.style.fg} onChange={(fg) => setStyle({ fg })} />
            </Field>
            <Field label="رنگ زمینه">
              <ColorInput value={d.style.bg} onChange={(bg) => setStyle({ bg })} />
            </Field>
            <Field label="متن زیر QR (اختیاری)" hint="مثل «برای دیدن محصول اسکن کنید»" className="sm:col-span-2">
              <input className={inputCls} maxLength={80} value={d.style.caption} onChange={(e) => setStyle({ caption: e.target.value })} />
            </Field>
            <Field label="لوگوی وسط (اختیاری)" hint="با لوگو تصحیح خطا خودکار بالاترین سطح می‌شود تا اسکن خراب نشود." className="sm:col-span-2">
              <div className="flex items-center gap-2">
                {d.style.logo && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL
                  <img src={d.style.logo} alt="" className="h-10 w-10 rounded-lg border border-[var(--adm-border)] object-contain" />
                )}
                <button type="button" className={btn.small} onClick={() => logoInput.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                  {d.style.logo ? "عوض کردن" : "انتخاب لوگو"}
                </button>
                {d.style.logo && (
                  <button type="button" className={btn.small} onClick={() => setStyle({ logo: null })}>
                    <X className="h-3.5 w-3.5" aria-hidden />
                    حذف
                  </button>
                )}
                <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
              </div>
            </Field>
          </div>
          {contrast && <p className="text-xs font-bold text-amber-600">⚠ {contrast}</p>}

          {canManage && (
            <div className="space-y-3 border-t border-[var(--adm-border)] pt-4">
              <Field label="عنوان (برای فهرست)">
                <input className={inputCls} value={d.title} maxLength={120} onChange={(e) => setD((x) => ({ ...x, title: e.target.value }))} placeholder="مثلاً استند پیشخوان" />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <button className={btn.primary} disabled={saving || !!contentError} onClick={save}>
                  {saving ? "در حال ذخیره…" : d.id ? "ذخیره‌ی تغییرات" : dynamic ? "ساختن QR پویا" : "ذخیره"}
                </button>
                {msg && <span className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
              </div>
            </div>
          )}
          {!canManage && msg && <ErrorText>{msg.text}</ErrorText>}
        </Card>

        {/* پیش‌نمایش */}
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4">
            <div
              className={`mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-xl transition ${pendingDynamic || contentError ? "opacity-30" : ""}`}
              style={{ aspectRatio: d.style.caption ? "1 / 1.14" : "1 / 1" }}
              dangerouslySetInnerHTML={{ __html: svg ?? "" }}
            />
            {!svg && <p className="mt-2 text-center text-xs font-bold text-red-600">متن بیش از ظرفیت QR است</p>}
            {pendingDynamic && <p className="mt-2 text-center text-xs text-gray-500">پیش‌نمایش — برای دانلود اول «ساختن QR پویا» را بزنید</p>}
            {d.shortUrl && (
              <button
                className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-bold text-blue-600"
                onClick={() => navigator.clipboard?.writeText(d.shortUrl!)}
                dir="ltr"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {d.shortUrl.replace(/^https?:\/\//, "")}
              </button>
            )}
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-xs font-bold text-gray-500">دانلود</p>
            <button className={`${btn.dark} w-full`} disabled={!canDownload} onClick={() => downloadSvg()}>
              <Download className="h-4 w-4" aria-hidden />
              SVG برای چاپخانه
            </button>
            <div className="grid grid-cols-3 gap-2">
              {[512, 1024, 2048].map((w) => (
                <button key={w} className={btn.small} disabled={!canDownload} onClick={() => downloadPng(w)}>
                  PNG {fa(w)}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <section>
        <SectionTitle title="QRهای ذخیره‌شده" />
        <Card>
          {list === null ? (
            <p className="p-4 text-xs text-gray-400">در حال بارگذاری…</p>
          ) : list.length === 0 ? (
            <Empty title="هنوز QRی ذخیره نشده" desc="QR پویا برای بنر، استند و کارت ویزیت بسازید تا اسکن‌ها اینجا شمرده شوند." />
          ) : (
            <ul className="divide-y divide-[var(--adm-border)]">
              {list.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                  <div
                    className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--adm-border)]"
                    dangerouslySetInnerHTML={{ __html: safeSvg(q) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{q.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={q.isDynamic ? "blue" : "gray"}>{q.isDynamic ? "پویا" : "ثابت"}</Badge>
                      <Badge>{QR_TYPE_MAP[q.contentType]?.label ?? q.contentType}</Badge>
                      {q.isDynamic && (
                        <span className="text-[11px] text-gray-500">
                          {fa(q.clickCount ?? 0)} اسکن{q.botCount ? ` · ${fa(q.botCount)} پیش‌نمایش ربات` : ""}
                        </span>
                      )}
                    </div>
                    {q.target && (
                      <p className="mt-1 truncate text-[11px] text-gray-400" dir="ltr">
                        → {q.target}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button className={btn.small} onClick={() => downloadSvg(q.payload, q.style, q.title)} title="دانلود SVG">
                      SVG
                    </button>
                    <button className={btn.small} onClick={() => downloadPng(1024, q.payload, q.style, q.title)} title="دانلود PNG">
                      PNG
                    </button>
                    {canManage && (
                      <>
                        <button className={btn.small} onClick={() => edit(q)} aria-label="ویرایش">
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button className={btn.small} onClick={() => remove(q)} aria-label="حذف">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function safeSvg(q: QrDto): string {
  try {
    return buildQrSvg(q.payload, { ...q.style, caption: "" });
  } catch {
    return "";
  }
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--adm-border)] bg-transparent" />
      <input
        className={inputCls}
        dir="ltr"
        value={value}
        maxLength={7}
        onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)}
      />
    </div>
  );
}
