"use client";

/**
 * انواع لینک و پلتفرم‌ها — الگوبرداری از `link-types-view.tsx` برتر.
 *
 * «نوع» روش لینک‌سازی است و «پلتفرم» سایت مشخصی از همان نوع (بخش ۷.۲).
 * توضیح هر نوع **آموزش کارمند تازه** است: تیم سئو مدام عوض می‌شود و توضیح
 * شفاهی هر بار از نو گفته می‌شود. برای همین علامت سؤال کنار هر نوع، توضیح و
 * تله‌ی سئویی و نمونه‌ها را با هم نشان می‌دهد.
 *
 * ⚠️ آیکن پلتفرم اینجا گرفته نمی‌شود — سرور به اینترنت وصل نمی‌شود. فایل
 * آیکن در `public/link-platforms/` کامیت و با سید وصل می‌شود.
 */

import { useState } from "react";
import { ChevronDown, HelpCircle, Pencil, Plus, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { CONTENT_KINDS, CONTENT_KIND_LABELS, relOf, type LinkContentKind } from "@/lib/marketing/link-constants";
import { LINK_ICON_NAMES, linkTypeIcon } from "./link-icons";
import {
  ConfirmDialog,
  Dialog,
  Hint,
  Label,
  Skeleton,
  Switch,
  btn,
  card,
  cn,
  fa,
  inputCls,
  send,
  useFetch,
  useToast,
} from "./ui";
import type { LinkTypeDto, PlatformDto } from "./link-client-types";

const EMPTY_TYPE = {
  title: "",
  icon: "link",
  description: "",
  seoNote: "",
  sampleSites: "",
  defaultContentKind: "NONE" as LinkContentKind,
  defaultFollow: true,
  defaultUgc: false,
  defaultSponsored: false,
  isRisky: false,
  isActive: true,
};

const EMPTY_PLATFORM = { title: "", domain: "", accountNote: "", domainAuthority: "", isActive: true };

function PlatformIcon({ platform, fallback: Fallback }: { platform: PlatformDto; fallback: LucideIcon }) {
  const [failed, setFailed] = useState(false);
  if (!platform.iconPath || failed) return <Fallback className="h-4 w-4 shrink-0 text-gray-400" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={platform.iconPath}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
    />
  );
}

const typeRel = (t: Pick<LinkTypeDto, "defaultFollow" | "defaultUgc" | "defaultSponsored">) =>
  relOf({ relFollow: t.defaultFollow, relUgc: t.defaultUgc, relSponsored: t.defaultSponsored });

export default function LinkTypesView() {
  const toast = useToast();
  const query = useFetch<{ items: LinkTypeDto[] }>("/api/admin/worklist/links/types?all=1");
  const types = query.data?.items ?? [];

  const [expanded, setExpanded] = useState<string | null>(null);
  const [helpFor, setHelpFor] = useState<LinkTypeDto | null>(null);
  const [busy, setBusy] = useState(false);

  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<LinkTypeDto | null>(null);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [deletingType, setDeletingType] = useState<LinkTypeDto | null>(null);

  const [platformOpen, setPlatformOpen] = useState(false);
  const [platformTypeId, setPlatformTypeId] = useState("");
  const [editingPlatform, setEditingPlatform] = useState<PlatformDto | null>(null);
  const [platformForm, setPlatformForm] = useState(EMPTY_PLATFORM);
  const [deletingPlatform, setDeletingPlatform] = useState<PlatformDto | null>(null);

  function openTypeForm(type: LinkTypeDto | null) {
    setEditingType(type);
    setTypeForm(
      type
        ? {
            title: type.title,
            icon: type.icon ?? "link",
            description: type.description ?? "",
            seoNote: type.seoNote ?? "",
            sampleSites: type.sampleSites ?? "",
            defaultContentKind: type.defaultContentKind,
            defaultFollow: type.defaultFollow,
            defaultUgc: type.defaultUgc,
            defaultSponsored: type.defaultSponsored,
            isRisky: type.isRisky,
            isActive: type.isActive,
          }
        : EMPTY_TYPE,
    );
    setTypeOpen(true);
  }

  function openPlatformForm(typeId: string, platform: PlatformDto | null) {
    setPlatformTypeId(typeId);
    setEditingPlatform(platform);
    setPlatformForm(
      platform
        ? {
            title: platform.title,
            domain: platform.domain,
            accountNote: platform.accountNote ?? "",
            domainAuthority: platform.domainAuthority === null ? "" : String(platform.domainAuthority),
            isActive: platform.isActive,
          }
        : EMPTY_PLATFORM,
    );
    setPlatformOpen(true);
  }

  async function act(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      after?.();
      query.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-black text-gray-900 dark:text-white">انواع لینک‌سازی</h2>
          <p className="mt-1 text-[12px] leading-6 text-gray-500">
            «نوع» روش لینک‌سازی است و «پلتفرم» سایت مشخصی از همان نوع. هنگام ساخت گره در چارت
            لینک‌سازی از همین فهرست انتخاب می‌شوند. گزارش‌ها روی نوع جمع می‌شوند، نه پلتفرم.
          </p>
        </div>
        <button type="button" className={btn.primary} onClick={() => openTypeForm(null)}>
          <Plus className="h-4 w-4" />
          نوع تازه
        </button>
      </div>

      {query.loading && !query.data && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}
      {query.error && <p className="text-xs font-bold text-red-600">{query.error}</p>}

      <div className="space-y-2.5">
        {types.map((type) => {
          const Icon = linkTypeIcon(type.icon);
          const isOpen = expanded === type.id;
          return (
            <div
              key={type.id}
              className={cn(card, !type.isActive && "opacity-60", type.isRisky && "border-red-300 dark:border-red-500/40")}
            >
              <div className="flex items-center gap-3 p-4">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    type.isRisky ? "bg-red-50 dark:bg-red-500/10" : "bg-gray-100 dark:bg-white/5",
                  )}
                >
                  <Icon className={cn("h-5 w-5", type.isRisky ? "text-red-600" : "text-gray-500")} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[13.5px] font-black text-gray-900 dark:text-white">{type.title}</h3>
                    <button
                      type="button"
                      onClick={() => setHelpFor(type)}
                      className="rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      title="این نوع چیست؟"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    {type.isRisky && (
                      <span className="rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        پرریسک
                      </span>
                    )}
                    {!type.isActive && (
                      <span className="rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                        غیرفعال
                      </span>
                    )}
                    {!type.key && (
                      <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        دست‌ساز
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-gray-500">
                    <span dir="ltr">rel=&quot;{typeRel(type)}&quot;</span>
                    {" · "}
                    {CONTENT_KIND_LABELS[type.defaultContentKind]}
                    {type.nodeCount > 0 && ` · ${fa(type.nodeCount)} لینک`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : type.id)}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-gray-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"
                >
                  {fa(type.platforms.length)} پلتفرم
                  <ChevronDown className={cn("h-3.5 w-3.5 transition", isOpen && "rotate-180")} />
                </button>
                <button
                  type="button"
                  onClick={() => openTypeForm(type)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                  title="ویرایش"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingType(type)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-white/5 px-4 py-3">
                  <div className="space-y-2">
                    {type.platforms.map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2",
                          !p.isActive && "opacity-60",
                        )}
                      >
                        <PlatformIcon platform={p} fallback={Icon} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold text-gray-800 dark:text-gray-100">{p.title}</p>
                          <p className="truncate text-[10.5px] text-gray-400" dir="ltr">
                            {p.domain}
                          </p>
                        </div>
                        {p.domainAuthority !== null && (
                          <span className="shrink-0 rounded bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-500">
                            DA {fa(p.domainAuthority)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openPlatformForm(type.id, p)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-white dark:hover:bg-white/10"
                          title="ویرایش"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPlatform(p)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {type.platforms.length === 0 && (
                      <p className="py-2 text-center text-[11.5px] text-gray-400">
                        پلتفرمی ثبت نشده — گره می‌تواند فقط نوع داشته باشد
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className={cn(btn.outline, "mt-2.5 w-full")}
                    onClick={() => openPlatformForm(type.id, null)}
                  >
                    <Plus className="h-4 w-4" />
                    پلتفرم تازه
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* توضیح نوع — همان علامت سؤال */}
      <Dialog open={Boolean(helpFor)} onClose={() => setHelpFor(null)} title={helpFor?.title ?? ""}>
        <div className="space-y-3.5">
          {helpFor?.description && (
            <p className="text-[12.5px] leading-7 text-gray-700 dark:text-gray-200">{helpFor.description}</p>
          )}
          {helpFor?.seoNote && (
            <div className={cn("rounded-xl p-3", helpFor.isRisky ? "bg-red-50 dark:bg-red-500/10" : "bg-gray-50 dark:bg-white/5")}>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black text-gray-700 dark:text-gray-200">
                {helpFor.isRisky && <TriangleAlert className="h-3.5 w-3.5 text-red-600" />}
                نکته‌ی سئویی
              </p>
              <p className="text-[12px] leading-7 text-gray-700 dark:text-gray-200">{helpFor.seoNote}</p>
            </div>
          )}
          {helpFor?.sampleSites && (
            <div>
              <p className="mb-1 text-[11px] font-black text-gray-500">نمونه‌ها</p>
              <p className="text-[12px] leading-7 text-gray-700 dark:text-gray-200">{helpFor.sampleSites}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 dark:border-white/5 pt-3 text-[11px]">
            <span className="rounded-lg bg-gray-100 dark:bg-white/5 px-2 py-1 font-bold" dir="ltr">
              rel=&quot;{helpFor ? typeRel(helpFor) : ""}&quot;
            </span>
            <span className="rounded-lg bg-gray-100 dark:bg-white/5 px-2 py-1 font-bold">
              محتوا: {helpFor ? CONTENT_KIND_LABELS[helpFor.defaultContentKind] : ""}
            </span>
          </div>
          <p className="text-[11px] leading-6 text-gray-400">این‌ها پیش‌فرض‌اند و هنگام ساخت گره قابل تغییرند.</p>
        </div>
      </Dialog>

      {/* فرم نوع */}
      <Dialog open={typeOpen} onClose={() => setTypeOpen(false)} title={editingType ? "ویرایش نوع لینک" : "نوع لینک تازه"}>
        <div className="space-y-3.5">
          <div>
            <Label htmlFor="type-name">نام نوع</Label>
            <input
              id="type-name"
              className={inputCls}
              value={typeForm.title}
              onChange={(e) => setTypeForm({ ...typeForm, title: e.target.value })}
              placeholder="مثلاً: پروفایل لینک"
            />
          </div>
          <div>
            <Label htmlFor="type-icon">آیکن</Label>
            <div className="flex items-center gap-2">
              <select
                id="type-icon"
                className={inputCls}
                value={typeForm.icon}
                onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })}
              >
                {LINK_ICON_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {(() => {
                const Preview = linkTypeIcon(typeForm.icon);
                return <Preview className="h-6 w-6 shrink-0 text-gray-500" />;
              })()}
            </div>
          </div>
          <div>
            <Label htmlFor="type-description">توضیح</Label>
            <textarea
              id="type-description"
              rows={2}
              className={cn(inputCls, "resize-none")}
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
              placeholder="این نوع لینک چیست، یک تا دو جمله"
            />
          </div>
          <div>
            <Label htmlFor="type-seo">نکته‌ی سئویی</Label>
            <textarea
              id="type-seo"
              rows={2}
              className={cn(inputCls, "resize-none")}
              value={typeForm.seoNote}
              onChange={(e) => setTypeForm({ ...typeForm, seoNote: e.target.value })}
              placeholder="کِی به کار می‌آید و تله‌اش چیست"
            />
          </div>
          <div>
            <Label htmlFor="type-samples">نمونه‌ها</Label>
            <input
              id="type-samples"
              className={inputCls}
              value={typeForm.sampleSites}
              onChange={(e) => setTypeForm({ ...typeForm, sampleSites: e.target.value })}
              placeholder="با ویرگول جدا کنید"
            />
          </div>
          <div>
            <Label htmlFor="type-content">نوع محتوای پیش‌فرض</Label>
            <select
              id="type-content"
              className={inputCls}
              value={typeForm.defaultContentKind}
              onChange={(e) => setTypeForm({ ...typeForm, defaultContentKind: e.target.value as LinkContentKind })}
            >
              {CONTENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CONTENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 rounded-2xl border border-gray-200 dark:border-white/10 p-3">
            <p className="text-[11.5px] font-black text-gray-500">پیش‌فرض rel — هنگام ساخت گره قابل تغییر است</p>
            <Switch label="فالو" checked={typeForm.defaultFollow} onChange={(v) => setTypeForm({ ...typeForm, defaultFollow: v })} />
            <Switch
              label="ugc (محتوای کاربر)"
              checked={typeForm.defaultUgc}
              onChange={(v) => setTypeForm({ ...typeForm, defaultUgc: v })}
            />
            <Switch
              label="sponsored (تبلیغ)"
              checked={typeForm.defaultSponsored}
              onChange={(v) => setTypeForm({ ...typeForm, defaultSponsored: v })}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 px-3.5 py-3">
            <Switch label="پرریسک" checked={typeForm.isRisky} onChange={(v) => setTypeForm({ ...typeForm, isRisky: v })} />
            <Hint>روشی که ریسک جریمه دارد — با هشدار قرمز نشان داده می‌شود.</Hint>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 px-3.5 py-3">
            <Switch label="فعال" checked={typeForm.isActive} onChange={(v) => setTypeForm({ ...typeForm, isActive: v })} />
            <Hint>نوع غیرفعال در فهرست ساخت گره تازه نمی‌آید.</Hint>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className={cn(btn.primary, "flex-1")}
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    editingType
                      ? send(`/api/admin/worklist/links/types/${editingType.id}`, "PATCH", typeForm)
                      : send("/api/admin/worklist/links/types", "POST", typeForm),
                  editingType ? "نوع لینک به‌روزرسانی شد" : "نوع لینک اضافه شد",
                  () => setTypeOpen(false),
                )
              }
            >
              ذخیره
            </button>
            <button type="button" className={btn.outline} onClick={() => setTypeOpen(false)}>
              انصراف
            </button>
          </div>
        </div>
      </Dialog>

      {/* فرم پلتفرم */}
      <Dialog open={platformOpen} onClose={() => setPlatformOpen(false)} title={editingPlatform ? "ویرایش پلتفرم" : "پلتفرم تازه"}>
        <div className="space-y-3.5">
          {!editingPlatform && (
            <div>
              <Label htmlFor="platform-type">نوع لینک</Label>
              <select
                id="platform-type"
                className={inputCls}
                value={platformTypeId}
                onChange={(e) => setPlatformTypeId(e.target.value)}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="platform-name">نام پلتفرم</Label>
            <input
              id="platform-name"
              className={inputCls}
              value={platformForm.title}
              onChange={(e) => setPlatformForm({ ...platformForm, title: e.target.value })}
              placeholder="مثلاً: آپارات"
            />
          </div>
          <div>
            <Label htmlFor="platform-domain">دامنه</Label>
            <input
              id="platform-domain"
              dir="ltr"
              className={inputCls}
              value={platformForm.domain}
              onChange={(e) => setPlatformForm({ ...platformForm, domain: e.target.value })}
              placeholder="aparat.com"
            />
            <Hint>
              بدون https://. آیکن سایت را سرور از اینترنت نمی‌گیرد؛ فایلش را توسعه‌دهنده در پوشه‌ی آیکن
              پلتفرم‌ها می‌گذارد.
            </Hint>
          </div>
          <div>
            <Label htmlFor="platform-account">حساب کاربری ما و یادداشت (اختیاری)</Label>
            <textarea
              id="platform-account"
              rows={2}
              className={cn(inputCls, "resize-none")}
              value={platformForm.accountNote}
              onChange={(e) => setPlatformForm({ ...platformForm, accountNote: e.target.value })}
              placeholder="نام کاربری، محدودیت‌ها، قوانین انتشار — رمز اینجا ثبت نمی‌شود"
            />
          </div>
          <div>
            <Label htmlFor="platform-da">قدرت دامنه (اختیاری)</Label>
            <input
              id="platform-da"
              dir="ltr"
              inputMode="numeric"
              className={inputCls}
              value={platformForm.domainAuthority}
              onChange={(e) => setPlatformForm({ ...platformForm, domainAuthority: e.target.value.replace(/[^\d]/g, "") })}
              placeholder="۰ تا ۱۰۰"
            />
            <Hint>فعلاً دستی؛ در فاز آنالیز خودکار می‌شود.</Hint>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 px-3.5 py-3">
            <Switch label="فعال" checked={platformForm.isActive} onChange={(v) => setPlatformForm({ ...platformForm, isActive: v })} />
            <Hint>پلتفرم غیرفعال در فهرست ساخت گره تازه نمی‌آید.</Hint>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className={cn(btn.primary, "flex-1")}
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    editingPlatform
                      ? send(`/api/admin/worklist/links/platforms/${editingPlatform.id}`, "PATCH", {
                          ...platformForm,
                          domainAuthority: platformForm.domainAuthority === "" ? null : Number(platformForm.domainAuthority),
                        })
                      : send("/api/admin/worklist/links/platforms", "POST", {
                          ...platformForm,
                          typeId: platformTypeId,
                          domainAuthority: platformForm.domainAuthority === "" ? null : Number(platformForm.domainAuthority),
                        }),
                  editingPlatform ? "پلتفرم به‌روزرسانی شد" : "پلتفرم اضافه شد",
                  () => setPlatformOpen(false),
                )
              }
            >
              ذخیره
            </button>
            <button type="button" className={btn.outline} onClick={() => setPlatformOpen(false)}>
              انصراف
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingType)}
        title="حذف نوع لینک"
        message={`«${deletingType?.title ?? ""}» حذف شود؟ نوع سیدشده یا نوعی که لینک یا پلتفرم دارد حذف نمی‌شود و فقط غیرفعال می‌شود.`}
        confirmLabel="حذف"
        pending={busy}
        onConfirm={() =>
          deletingType &&
          act(
            async () => {
              const r = await send<{ result: string }>(`/api/admin/worklist/links/types/${deletingType.id}`, "DELETE");
              if (r.result === "deactivated") toast("این نوع استفاده شده؛ غیرفعال شد");
            },
            "انجام شد",
            () => setDeletingType(null),
          )
        }
        onClose={() => setDeletingType(null)}
      />
      <ConfirmDialog
        open={Boolean(deletingPlatform)}
        title="حذف پلتفرم"
        message={`«${deletingPlatform?.title ?? ""}» حذف شود؟ پلتفرمی که گره دارد فقط غیرفعال می‌شود.`}
        confirmLabel="حذف"
        pending={busy}
        onConfirm={() =>
          deletingPlatform &&
          act(
            async () => {
              const r = await send<{ result: string }>(
                `/api/admin/worklist/links/platforms/${deletingPlatform.id}`,
                "DELETE",
              );
              if (r.result === "deactivated") toast("این پلتفرم گره دارد؛ غیرفعال شد");
            },
            "انجام شد",
            () => setDeletingPlatform(null),
          )
        }
        onClose={() => setDeletingPlatform(null)}
      />
    </div>
  );
}
