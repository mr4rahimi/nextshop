"use client";

/**
 * فرم گره — همان بریفی که مدیر برای کارمند می‌نویسد. الگوبرداری از
 * `link-node-form-dialog.tsx` برتر.
 *
 * همه‌ی فیلدها جز نوع اختیاری‌اند. **مقصد از یال می‌آید نه از فیلد متنی**
 * (تله‌ی ۱): اینجا تیک می‌خورد و همان چیزی است که روی بوم فلش می‌شود.
 *
 * **هشدار توزیع انکر همین‌جا می‌آید، نه در گزارش آخر ماه** — و عدد «بعد از
 * افزودن» را می‌گوید، هم برای کل کمپین و هم برای صفحه‌ی هدفِ همین گره.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ANCHOR_KINDS,
  ANCHOR_KIND_EXAMPLES,
  ANCHOR_KIND_LABELS,
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  anchorRanges,
  type LinkAnchorKind,
  type LinkContentKind,
} from "@/lib/marketing/link-constants";
import { projectedAnchorWarnings } from "@/lib/marketing/anchor-profile";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { isoToTehranLocal } from "@/lib/club/jalali";
import { Dialog, Hint, Label, Section, Switch, btn, cn, fa, inputCls, send, useToast } from "./ui";
import type {
  CampaignDetail,
  CampaignStatsDto,
  LinkMeta,
  LinkNodeDto,
} from "./link-client-types";

type Destination = { toNodeId: string | null; toTargetId: string | null };

const EMPTY = {
  typeId: "",
  platformId: "",
  anchorText: "",
  anchorKind: "" as LinkAnchorKind | "",
  relFollow: true,
  relUgc: false,
  relSponsored: false,
  contentKind: "NONE" as LinkContentKind,
  wordCount: "",
  contentBrief: "",
  profileTitle: "",
  assigneeId: "",
  dueAt: "",
  cost: "",
  note: "",
};

export default function LinkNodeFormDialog({
  open,
  onClose,
  onSaved,
  campaign,
  nodes,
  meta,
  stats,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  campaign: CampaignDetail;
  nodes: LinkNodeDto[];
  meta: LinkMeta;
  stats: CampaignStatsDto | null;
  editing: LinkNodeDto | null;
}) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  /** کاربر خودش rel یا نوع محتوا را دست زده؟ اگر نه، پیش‌فرض نوع دنبال شود */
  const [touchedDefaults, setTouchedDefaults] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        typeId: editing.type.id,
        platformId: editing.platform?.id ?? "",
        anchorText: editing.anchorText ?? "",
        anchorKind: editing.anchorKind ?? "",
        relFollow: editing.relFollow,
        relUgc: editing.relUgc,
        relSponsored: editing.relSponsored,
        contentKind: editing.contentKind,
        wordCount: editing.wordCount === null ? "" : String(editing.wordCount),
        contentBrief: editing.contentBrief ?? "",
        profileTitle: editing.profileTitle ?? "",
        assigneeId: editing.assigneeId ?? "",
        dueAt: editing.dueAt ? isoToTehranLocal(editing.dueAt).slice(0, 10) : "",
        cost: editing.cost === null ? "" : String(editing.cost),
        note: editing.note ?? "",
      });
      setDestinations(editing.destinations);
      setTouchedDefaults(true);
    } else {
      setForm(EMPTY);
      // گره‌ی تازه پیش‌فرض به اولین صفحه‌ی هدف وصل می‌شود — رایج‌ترین حالت؛
      // مقصدِ خالی یعنی گره معلق ساخته شود
      setDestinations(campaign.targets[0] ? [{ toNodeId: null, toTargetId: campaign.targets[0].id }] : []);
      setTouchedDefaults(false);
    }
  }, [open, editing, campaign.targets]);

  const selectedType = meta.types.find((t) => t.id === form.typeId);

  /** انتخاب نوع، پیش‌فرض‌های rel و محتوا را می‌آورد — مگر کاربر خودش دست زده باشد */
  function pickType(typeId: string) {
    const type = meta.types.find((t) => t.id === typeId);
    setForm((cur) => ({
      ...cur,
      typeId,
      platformId: "",
      ...(type && !touchedDefaults
        ? {
            relFollow: type.defaultFollow,
            relUgc: type.defaultUgc,
            relSponsored: type.defaultSponsored,
            contentKind: type.defaultContentKind,
          }
        : {}),
    }));
  }

  const anchorWarnings = useMemo(() => {
    if (!form.anchorKind || !stats) return [];
    return projectedAnchorWarnings({
      current: stats.nodes,
      editingId: editing?.id ?? null,
      anchorKind: form.anchorKind,
      targetIds: destinations.map((d) => d.toTargetId).filter((x): x is string => !!x),
      targetLabels: new Map(campaign.targets.map((t) => [t.id, t.label || t.url])),
      profile: campaign.anchorProfile,
    });
  }, [form.anchorKind, stats, editing, destinations, campaign]);

  const exactRange = anchorRanges(campaign.anchorProfile).EXACT;

  function toggleDestination(d: Destination) {
    const key = d.toNodeId ?? d.toTargetId;
    setDestinations((cur) =>
      cur.some((x) => (x.toNodeId ?? x.toTargetId) === key)
        ? cur.filter((x) => (x.toNodeId ?? x.toTargetId) !== key)
        : [...cur, d],
    );
  }
  const isChosen = (key: string) => destinations.some((x) => (x.toNodeId ?? x.toTargetId) === key);

  async function submit() {
    setSaving(true);
    try {
      const body = {
        ...(editing ? {} : { campaignId: campaign.id }),
        typeId: form.typeId,
        platformId: form.platformId || null,
        anchorText: form.anchorText,
        anchorKind: form.anchorKind || null,
        relFollow: form.relFollow,
        relUgc: form.relUgc,
        relSponsored: form.relSponsored,
        contentKind: form.contentKind,
        wordCount: form.wordCount === "" ? null : Number(form.wordCount),
        contentBrief: form.contentBrief,
        profileTitle: form.profileTitle,
        dueAt: form.dueAt || null,
        cost: form.cost === "" ? null : Number(form.cost),
        note: form.note,
        destinations,
        // مسئولِ گرهِ در جریان از دکمه‌ی «ارجاع» عوض می‌شود تا اعلان بخورد
        ...(!editing || editing.status === "PLANNED" ? { assigneeId: form.assigneeId || null } : {}),
      };
      if (editing) await send(`/api/admin/worklist/links/nodes/${editing.id}`, "PATCH", body);
      else await send("/api/admin/worklist/links/nodes", "POST", body);
      toast(editing ? "گره به‌روزرسانی شد" : "گره اضافه شد");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ثبت انجام نشد", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? `ویرایش گره ${fa(editing.code)}` : "گره تازه"} wide>
      <div className="space-y-3.5">
        <div>
          <Label htmlFor="node-type">نوع لینک</Label>
          <select id="node-type" className={inputCls} value={form.typeId} onChange={(e) => pickType(e.target.value)}>
            <option value="">انتخاب کنید…</option>
            {meta.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.isRisky ? " ⚠" : ""}
              </option>
            ))}
          </select>
          {selectedType?.seoNote && (
            <Hint tone={selectedType.isRisky ? "error" : undefined}>{selectedType.seoNote}</Hint>
          )}
        </div>

        {selectedType && selectedType.platforms.length > 0 && (
          <div>
            <Label htmlFor="node-platform">پلتفرم (اختیاری)</Label>
            <select
              id="node-platform"
              className={inputCls}
              value={form.platformId}
              onChange={(e) => setForm({ ...form, platformId: e.target.value })}
            >
              <option value="">هنوز انتخاب نشده</option>
              {selectedType.platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.domain})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* مقصد — همان یالی که روی بوم فلش می‌شود */}
        <Section title="این گره به کجا لینک می‌دهد؟">
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {campaign.targets.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/5 px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  checked={isChosen(t.id)}
                  onChange={() => toggleDestination({ toNodeId: null, toTargetId: t.id })}
                  className="h-4 w-4 shrink-0 accent-blue-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-gray-800 dark:text-gray-100">
                    {t.label || "صفحه‌ی هدف"}
                  </span>
                  <span className="block truncate text-[10.5px] text-gray-400" dir="ltr">
                    {t.url}
                  </span>
                </span>
              </label>
            ))}
            {nodes
              .filter((n) => n.id !== editing?.id)
              .map((n) => (
                <label key={n.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5">
                  <input
                    type="checkbox"
                    checked={isChosen(n.id)}
                    onChange={() => toggleDestination({ toNodeId: n.id, toTargetId: null })}
                    className="h-4 w-4 shrink-0 accent-blue-500"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-gray-700 dark:text-gray-200">
                    گره {fa(n.code)} — {n.type.title}
                    {n.platform ? ` (${n.platform.title})` : ""}
                  </span>
                </label>
              ))}
          </div>
          <p className="text-[10.5px] leading-5 text-gray-400">
            بدون مقصد، گره «معلق» می‌ماند و لایه نمی‌گیرد. لینک به گره‌ی دیگر یعنی لایه‌ی بعدی. یک
            رپورتاژ خوب می‌تواند به دو صفحه لینک بدهد — هر دو را تیک بزنید.
          </p>
        </Section>

        <Section title="سئو">
          <div>
            <Label htmlFor="node-anchor">متن انکر</Label>
            <input
              id="node-anchor"
              className={inputCls}
              value={form.anchorText}
              onChange={(e) => setForm({ ...form, anchorText: e.target.value })}
              placeholder="متنی که روی لینک می‌نشیند"
            />
          </div>
          <div>
            <Label htmlFor="node-anchor-kind">نوع انکر</Label>
            <select
              id="node-anchor-kind"
              className={inputCls}
              value={form.anchorKind}
              onChange={(e) => setForm({ ...form, anchorKind: e.target.value as LinkAnchorKind | "" })}
            >
              <option value="">مشخص نشده</option>
              {ANCHOR_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ANCHOR_KIND_LABELS[k]} — {ANCHOR_KIND_EXAMPLES[k]}
                </option>
              ))}
            </select>
            <Hint>
              برای گزارش توزیع انکر لازم است — تطابق دقیق در فروشگاه اینترنتی باید حدود{" "}
              {exactRange ? `${fa(exactRange[0])} تا ${fa(exactRange[1])}` : "۵ تا ۱۰"} درصد بماند.
            </Hint>
            {/* هشدار همین‌جا، نه در گزارش آخر ماه: وقتی صد لینک ساخته شد، دانستنش دیر است */}
            {anchorWarnings.map((w) => (
              <Hint key={w} tone="error">
                {w}
              </Hint>
            ))}
          </div>
          <Switch
            label="فالو"
            checked={form.relFollow}
            onChange={(v) => {
              setTouchedDefaults(true);
              setForm({ ...form, relFollow: v });
            }}
          />
          <Switch
            label="ugc"
            checked={form.relUgc}
            onChange={(v) => {
              setTouchedDefaults(true);
              setForm({ ...form, relUgc: v });
            }}
          />
          <Switch
            label="sponsored"
            checked={form.relSponsored}
            onChange={(v) => {
              setTouchedDefaults(true);
              setForm({ ...form, relSponsored: v });
            }}
          />
        </Section>

        <Section title="محتوا">
          <div>
            <Label htmlFor="node-content-kind">نوع محتوا</Label>
            <select
              id="node-content-kind"
              className={inputCls}
              value={form.contentKind}
              onChange={(e) => {
                setTouchedDefaults(true);
                setForm({ ...form, contentKind: e.target.value as LinkContentKind });
              }}
            >
              {CONTENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CONTENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          {form.contentKind === "TEXT" && (
            <div>
              <Label htmlFor="node-words">تعداد کلمات پیشنهادی</Label>
              <input
                id="node-words"
                dir="ltr"
                inputMode="numeric"
                className={inputCls}
                value={form.wordCount}
                onChange={(e) => setForm({ ...form, wordCount: e.target.value })}
                placeholder="مثلاً ۵۰۰"
              />
            </div>
          )}
          <div>
            <Label htmlFor="node-title">عنوان مطلب یا پروفایل</Label>
            <input
              id="node-title"
              className={inputCls}
              value={form.profileTitle}
              onChange={(e) => setForm({ ...form, profileTitle: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="node-brief">توضیح کوتاه برای کارمند</Label>
            <textarea
              id="node-brief"
              rows={2}
              className={cn(inputCls, "resize-none")}
              value={form.contentBrief}
              onChange={(e) => setForm({ ...form, contentBrief: e.target.value })}
            />
          </div>
        </Section>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="node-assignee">مسئول (اختیاری)</Label>
            <select
              id="node-assignee"
              className={inputCls}
              value={form.assigneeId}
              disabled={!!editing && editing.status !== "PLANNED"}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            >
              <option value="">هنوز واگذار نشده</option>
              {meta.linkStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMe ? " (خودم)" : ""}
                </option>
              ))}
            </select>
            {editing && editing.status !== "PLANNED" ? (
              <Hint>گره در جریان است؛ مسئول را از دکمه‌ی «ارجاع» عوض کنید.</Hint>
            ) : meta.linkStaff.length === 0 ? (
              <Hint tone="warn">هنوز کسی مجوز «ساخت لینک و ثبت آدرس منتشرشده» را ندارد.</Hint>
            ) : null}
          </div>
          <div>
            <Label>مهلت (اختیاری)</Label>
            <JalaliDatePicker value={form.dueAt} onChange={(v) => setForm({ ...form, dueAt: v })} placeholder="بدون مهلت" />
          </div>
          <div>
            <Label htmlFor="node-cost">هزینه به تومان (اختیاری)</Label>
            <input
              id="node-cost"
              dir="ltr"
              inputMode="numeric"
              className={inputCls}
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value.replace(/[^\d]/g, "") })}
            />
            <Hint>هزینه‌ای که موقعش ثبت نشود، بعداً بازسازی نمی‌شود.</Hint>
          </div>
          <div>
            <Label htmlFor="node-note">یادداشت مدیر</Label>
            <input
              id="node-note"
              className={inputCls}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className={cn(btn.primary, "flex-1")}
            onClick={submit}
            disabled={saving || !form.typeId}
          >
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
          <button type="button" className={btn.outline} onClick={onClose}>
            انصراف
          </button>
        </div>
      </div>
    </Dialog>
  );
}
