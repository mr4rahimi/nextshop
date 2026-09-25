"use client";

/**
 * لینک‌سازی — سه تب: کمپین‌ها، گره‌های من، انواع و پلتفرم‌ها.
 *
 * الگوبرداری از `link-campaigns-view.tsx` و `my-link-nodes-view.tsx` و
 * `link-types-view.tsx` برتر، با رنگ و گوشه‌ی پنل فروشگاه.
 *
 * هر کس فقط تب‌هایی را می‌بیند که به کارش می‌آید:
 *   - «کمپین‌ها» — مدیر لینک‌سازی و ناظر (`MARKETING_VIEW_ALL`)
 *   - «گره‌های من» — هر کس که گره‌ای به او ارجاع می‌شود؛ کارمند چارت را
 *     نمی‌بیند، برای او فهرست است (سرور هم همین را تضمین می‌کند)
 *   - «انواع و پلتفرم‌ها» — `MARKETING_SETTINGS_MANAGE`
 *
 * `?node=<id>` (کلیک روی اعلان) جزئیات همان گره را باز می‌کند.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, Plus, Target } from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONES } from "@/lib/marketing/link-constants";
import LinkNodeDetail from "./LinkNodeDetail";
import LinkNodeRow from "./LinkNodeRow";
import LinkTypesView from "./LinkTypesView";
import {
  Dialog,
  Hint,
  Label,
  Skeleton,
  ToastProvider,
  btn,
  card,
  cn,
  fa,
  inputCls,
  send,
  useFetch,
  useToast,
} from "./ui";
import type { CampaignListItem, LinkMeta, LinkNodeDto } from "./link-client-types";

export default function LinksClient() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

type Tab = "campaigns" | "mine" | "types";

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const meta = useFetch<LinkMeta>("/api/admin/worklist/links/meta");
  const can = meta.data?.can;

  const tabs = useMemo(() => {
    if (!can) return [] as { key: Tab; label: string }[];
    const list: { key: Tab; label: string }[] = [];
    if (can.manage || can.viewAll) list.push({ key: "campaigns", label: "کمپین‌ها" });
    if (can.work || can.manage) list.push({ key: "mine", label: "گره‌های من" });
    if (can.settings) list.push({ key: "types", label: "انواع و پلتفرم‌ها" });
    return list;
  }, [can]);

  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab && tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? null);

  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [mineVersion, setMineVersion] = useState(0);
  // `?node=<id>` (کلیک روی اعلان) از خودِ آدرس خوانده می‌شود، نه با state در
  // effect؛ بستنش آدرس را پاک می‌کند
  const nodeParam = params.get("node");
  const [dismissedParam, setDismissedParam] = useState<string | null>(null);
  const shownNodeId = openNodeId ?? (nodeParam && nodeParam !== dismissedParam ? nodeParam : null);

  function closeNode() {
    setOpenNodeId(null);
    setDismissedParam(nodeParam);
    if (nodeParam) router.replace("/admin/worklist/links");
  }

  if (meta.error) return <p className="text-sm font-bold text-red-600">{meta.error}</p>;
  if (!meta.data) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                current === t.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {current === "campaigns" && <CampaignsView canManage={meta.data.can.manage} />}
      {current === "mine" && (
        <MyNodesView meta={meta.data} version={mineVersion} onOpen={setOpenNodeId} onChanged={() => setMineVersion((v) => v + 1)} />
      )}
      {current === "types" && <LinkTypesView />}
      {!current && <p className="text-xs text-gray-500">به بخش لینک‌سازی دسترسی ندارید.</p>}

      <LinkNodeDetail
        nodeId={shownNodeId}
        meta={meta.data}
        onClose={closeNode}
        onChanged={() => setMineVersion((v) => v + 1)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// کمپین‌ها
// ─────────────────────────────────────────────────────────────────

const EMPTY_CAMPAIGN = {
  title: "",
  note: "",
  weeklyQuota: "",
  targetUrl: "",
  targetLabel: "",
  targetKeyword: "",
};

/**
 * فهرست کمپین‌ها. کمپین **همیشه با یک صفحه‌ی هدف** ساخته می‌شود: کمپین بدون
 * صفحه‌ی هدف ریشه ندارد و کل چارت معلق می‌ماند.
 */
function CampaignsView({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [showDone, setShowDone] = useState(false);
  const query = useFetch<{ items: CampaignListItem[] }>(
    `/api/admin/worklist/links/campaigns${showDone ? "?all=1" : ""}`,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CAMPAIGN);
  const [saving, setSaving] = useState(false);
  const campaigns = query.data?.items ?? [];

  async function submit() {
    setSaving(true);
    try {
      const r = await send<{ campaign: { id: string } }>("/api/admin/worklist/links/campaigns", "POST", {
        title: form.title,
        note: form.note,
        weeklyQuota: form.weeklyQuota === "" ? null : Number(form.weeklyQuota),
        firstTarget: { url: form.targetUrl, label: form.targetLabel, primaryKeyword: form.targetKeyword },
      });
      toast("کمپین ساخته شد");
      setIsOpen(false);
      setForm(EMPTY_CAMPAIGN);
      router.push(`/admin/worklist/links/${r.campaign.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "ثبت انجام نشد", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[12px] leading-6 text-gray-500 max-w-2xl">
          هر کمپین یک یا چند صفحه‌ی هدف از همین فروشگاه دارد (دسته، محصول، مقاله) و گره‌های لینک‌سازی
          زیر همان کمپین روی یک چارت کشیده می‌شوند.
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-500">
            <input type="checkbox" className="accent-blue-500" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            تمام‌شده‌ها هم
          </label>
          {canManage && (
            <button type="button" className={btn.primary} onClick={() => setIsOpen(true)}>
              <Plus className="h-4 w-4" />
              کمپین تازه
            </button>
          )}
        </div>
      </div>

      {query.loading && !query.data && (
        <div className="space-y-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {query.error && <p className="text-xs font-bold text-red-600">{query.error}</p>}

      {query.data && campaigns.length === 0 && (
        <div className={cn(card, "flex flex-col items-center gap-2 py-16")}>
          <Link2 className="h-9 w-9 text-gray-300" />
          <p className="text-sm font-bold text-gray-500">هنوز کمپینی ساخته نشده</p>
        </div>
      )}

      <div className="space-y-2.5">
        {campaigns.map((c) => {
          const progress = c.nodeCount === 0 ? 0 : Math.round((c.liveCount / c.nodeCount) * 100);
          return (
            <Link
              key={c.id}
              href={`/admin/worklist/links/${c.id}`}
              className={cn(card, "block p-4 hover:border-blue-400 transition-colors", c.status === "DONE" && "opacity-60")}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
                  <Link2 className="h-5 w-5 text-gray-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[13.5px] font-black text-gray-900 dark:text-white">{c.title}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", CAMPAIGN_STATUS_TONES[c.status])}>
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.targets.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className="flex max-w-[220px] items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10.5px] font-bold text-gray-500"
                      >
                        <Target className="h-3 w-3 shrink-0" />
                        <span className="truncate" dir={t.label ? undefined : "ltr"}>
                          {t.label || t.url}
                        </span>
                      </span>
                    ))}
                    {c.targets.length > 3 && (
                      <span className="rounded-lg bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10.5px] font-bold text-gray-500">
                        +{fa(c.targets.length - 3)}
                      </span>
                    )}
                  </div>
                  {c.nodeCount > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 max-w-xs overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10.5px] font-bold tabular-nums text-gray-400">
                        {fa(c.liveCount)} از {fa(c.nodeCount)} فعال
                      </span>
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-xl bg-gray-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold tabular-nums text-gray-500">
                  {fa(c.nodeCount)} گره
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="کمپین تازه">
        <div className="space-y-3.5">
          <div>
            <Label htmlFor="campaign-name">نام کمپین</Label>
            <input
              id="campaign-name"
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً: پرینتر لیزری — پاییز"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-gray-200 dark:border-white/10 p-3">
            <p className="text-[11.5px] font-black text-gray-500">
              اولین صفحه‌ی هدف — صفحه‌های بعدی را از داخل کمپین اضافه کنید
            </p>
            <div>
              <Label htmlFor="target-url">آدرس صفحه</Label>
              <input
                id="target-url"
                dir="ltr"
                className={inputCls}
                value={form.targetUrl}
                onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                placeholder="https://example.com/category/laser-printer"
              />
            </div>
            <div>
              <Label htmlFor="target-label">برچسب کوتاه (اختیاری)</Label>
              <input
                id="target-label"
                className={inputCls}
                value={form.targetLabel}
                onChange={(e) => setForm({ ...form, targetLabel: e.target.value })}
                placeholder="مثلاً: پرینتر لیزری"
              />
            </div>
            <div>
              <Label htmlFor="target-keyword">کلمه‌ی کلیدی اصلی (اختیاری)</Label>
              <input
                id="target-keyword"
                className={inputCls}
                value={form.targetKeyword}
                onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })}
                placeholder="مثلاً: خرید پرینتر لیزری"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="campaign-quota">سقف لینک در هفته (اختیاری)</Label>
            <input
              id="campaign-quota"
              dir="ltr"
              inputMode="numeric"
              className={inputCls}
              value={form.weeklyQuota}
              onChange={(e) => setForm({ ...form, weeklyQuota: e.target.value.replace(/[^\d]/g, "") })}
              placeholder="مثلاً ۵"
            />
            <Hint>پروفایل لینک طبیعی تدریجی رشد می‌کند؛ جهش ناگهانی به چشم می‌آید.</Hint>
          </div>
          <div>
            <Label htmlFor="campaign-note">یادداشت (اختیاری)</Label>
            <textarea
              id="campaign-note"
              rows={2}
              className={cn(inputCls, "resize-none")}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" className={cn(btn.primary, "flex-1")} onClick={submit} disabled={saving}>
              {saving ? "در حال ساخت..." : "ساخت کمپین"}
            </button>
            <button type="button" className={btn.outline} onClick={() => setIsOpen(false)}>
              انصراف
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// گره‌های من
// ─────────────────────────────────────────────────────────────────

const OPEN_STATUSES = "ASSIGNED,IN_PROGRESS,SUBMITTED";

/**
 * «کارهای من» برای لینک‌سازی. کارمند چارت را نمی‌بیند؛ برای او این فهرست
 * است. گره‌ی «برنامه‌ریزی‌شده» اینجا نمی‌آید — تا «ساخت برنامه» زده نشده،
 * کار کسی نیست.
 */
function MyNodesView({
  meta,
  version,
  onOpen,
  onChanged,
}: {
  meta: LinkMeta;
  version: number;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const query = useFetch<{ items: LinkNodeDto[] }>(
    `/api/admin/worklist/links/nodes?mine=1${showClosed ? "" : `&status=${OPEN_STATUSES}`}`,
    [version],
  );
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-500">
        <input type="checkbox" className="accent-blue-500" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
        فعال‌شده‌ها و بسته‌شده‌ها هم
      </label>

      {query.loading && !query.data && (
        <div className="space-y-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {query.error && <p className="text-xs font-bold text-red-600">{query.error}</p>}

      {query.data && items.length === 0 && (
        <div className={cn(card, "flex flex-col items-center gap-2 py-14")}>
          <Link2 className="h-9 w-9 text-gray-300" />
          <p className="text-sm font-bold text-gray-500">گره لینک‌سازی بازی به شما ارجاع نشده</p>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((n) => (
          <div key={n.id} className={card}>
            <LinkNodeRow node={n} meta={meta} variant="mine" onOpen={() => onOpen(n.id)} onChanged={onChanged} />
          </div>
        ))}
      </div>
    </div>
  );
}
