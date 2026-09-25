"use client";

/**
 * جزئیات کمپین — صفحه‌های هدف، اعداد، و چارت/فهرست گره‌ها. الگوبرداری از
 * `link-campaign-detail-view.tsx` برتر.
 *
 * بوم و فهرست **دو نمای یک داده‌اند**؛ بوم منطق تازه‌ای نمی‌آورد. بعد از هر
 * تغییر هر سه خوراک (گره‌ها، آمار، بوم) با هم تازه می‌شوند، وگرنه رنگ بوم و
 * عدد پیشرفت با فهرست اختلاف پیدا می‌کند.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Send,
  Target,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  ANCHOR_PROFILE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONES,
  type LinkCampaignStatus,
} from "@/lib/marketing/link-constants";
import LinkChartCanvas from "./LinkChartCanvas";
import LinkCampaignStats from "./LinkCampaignStats";
import LinkNodeFormDialog from "./LinkNodeFormDialog";
import LinkNodeDetail from "./LinkNodeDetail";
import LinkNodeRow from "./LinkNodeRow";
import {
  ConfirmDialog,
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
import type {
  CampaignDetail,
  CampaignStatsDto,
  CanvasData,
  LinkMeta,
  LinkNodeDto,
  TargetDto,
} from "./link-client-types";

export default function LinkCampaignDetail({ campaignId }: { campaignId: string }) {
  return (
    <ToastProvider>
      <Inner campaignId={campaignId} />
    </ToastProvider>
  );
}

function Inner({ campaignId }: { campaignId: string }) {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const meta = useFetch<LinkMeta>("/api/admin/worklist/links/meta");
  const campaign = useFetch<{ campaign: CampaignDetail }>(`/api/admin/worklist/links/campaigns/${campaignId}`);
  const nodes = useFetch<{ items: LinkNodeDto[] }>(`/api/admin/worklist/links/nodes?campaignId=${campaignId}`);
  const stats = useFetch<CampaignStatsDto>(`/api/admin/worklist/links/campaigns/${campaignId}/stats`);
  const canvas = useFetch<CanvasData>(`/api/admin/worklist/links/campaigns/${campaignId}/canvas`);

  const [view, setView] = useState<"chart" | "list">("chart");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LinkNodeDto | null>(null);
  const [deletingNode, setDeletingNode] = useState<LinkNodeDto | null>(null);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetDto | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<TargetDto | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = campaign.data?.campaign;
  const items = nodes.data?.items ?? [];
  const canManage = !!meta.data?.can.manage;

  /** یک تغییر، هر سه خوراک — رنگ بوم و عدد پیشرفت نباید از فهرست عقب بمانند */
  const refreshAll = useCallback(() => {
    campaign.reload();
    nodes.reload();
    stats.reload();
    canvas.reload();
  }, [campaign, nodes, stats, canvas]);

  // `?node=<id>` (کلیک روی اعلان) از خودِ آدرس خوانده می‌شود، نه با state در
  // effect؛ بستنش آدرس را پاک می‌کند
  const nodeParam = params.get("node");
  const [dismissedParam, setDismissedParam] = useState<string | null>(null);
  const shownNodeId = openNodeId ?? (nodeParam && nodeParam !== dismissedParam ? nodeParam : null);

  function closeNode() {
    setOpenNodeId(null);
    setDismissedParam(nodeParam);
    if (nodeParam) router.replace(`/admin/worklist/links/${campaignId}`);
  }

  function openForm(node: LinkNodeDto | null) {
    setEditing(node);
    setFormOpen(true);
  }

  async function runPlan() {
    setBusy(true);
    try {
      const r = await send<{ assigned: number; skippedWithoutAssignee: number }>(
        `/api/admin/worklist/links/campaigns/${campaignId}/plan`,
        "POST",
      );
      toast(
        r.assigned === 0
          ? "گره برنامه‌ریزی‌شده‌ای برای واگذاری نبود"
          : `${fa(r.assigned)} گره واگذار شد` +
              (r.skippedWithoutAssignee > 0 ? ` — ${fa(r.skippedWithoutAssignee)} گره مسئول ندارد` : ""),
      );
      refreshAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeNode() {
    if (!deletingNode) return;
    setBusy(true);
    try {
      await send(`/api/admin/worklist/links/nodes/${deletingNode.id}`, "DELETE");
      toast("گره حذف شد");
      setDeletingNode(null);
      setOpenNodeId(null);
      refreshAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "حذف انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeTarget() {
    if (!deletingTarget) return;
    setBusy(true);
    try {
      await send(`/api/admin/worklist/links/targets/${deletingTarget.id}`, "DELETE");
      toast("صفحه‌ی هدف حذف شد");
      setDeletingTarget(null);
      refreshAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "حذف انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeCampaign() {
    setBusy(true);
    try {
      await send(`/api/admin/worklist/links/campaigns/${campaignId}`, "DELETE");
      router.push("/admin/worklist/links");
    } catch (e) {
      toast(e instanceof Error ? e.message : "حذف انجام نشد", "error");
      setDeletingCampaign(false);
    } finally {
      setBusy(false);
    }
  }

  if (campaign.error) {
    return <p className="text-sm font-bold text-red-600">{campaign.error}</p>;
  }
  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const w = data.warnings;
  const hasWarning = w.orphans > 0 || w.tooDeep > 0 || w.noDestination > 0;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/worklist/links"
            className="mb-1 flex items-center gap-1 text-[11.5px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            کمپین‌ها
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-black text-gray-900 dark:text-white">{data.title}</h1>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", CAMPAIGN_STATUS_TONES[data.status])}>
              {CAMPAIGN_STATUS_LABELS[data.status]}
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                title="تنظیمات کمپین"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-gray-500">
            {data.weeklyQuota ? `سقف ${fa(data.weeklyQuota)} لینک در هفته · ` : ""}
            بازه‌ی انکر: {ANCHOR_PROFILE_LABELS[data.anchorProfile] ?? data.anchorProfile}
            {data.note && ` · ${data.note}`}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button type="button" className={btn.outline} onClick={runPlan} disabled={busy}>
              <Send className="h-4 w-4" />
              ساخت برنامه
            </button>
            <button type="button" className={btn.primary} onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" />
              گره تازه
            </button>
          </div>
        )}
      </div>

      {hasWarning && (
        <div className="space-y-1 rounded-2xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-500/5 p-3.5">
          <p className="flex items-center gap-1.5 text-[12px] font-black text-amber-600 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4" />
            نکته‌های ساختاری
          </p>
          {w.orphans > 0 && (
            <p className="text-[11.5px] leading-6 text-gray-700 dark:text-gray-200">
              {fa(w.orphans)} گره معلق است — به هیچ صفحه‌ی هدفی مسیر ندارد
            </p>
          )}
          {w.noDestination > 0 && (
            <p className="text-[11.5px] leading-6 text-gray-700 dark:text-gray-200">
              {fa(w.noDestination)} گره هنوز مقصدی ندارد
            </p>
          )}
          {w.tooDeep > 0 && (
            <p className="text-[11.5px] leading-6 text-gray-700 dark:text-gray-200">
              {fa(w.tooDeep)} گره از لایه‌ی {fa(w.maxTier)} عمیق‌تر است — عمق بیشتر عملاً اعتباری منتقل نمی‌کند
            </p>
          )}
        </div>
      )}

      {/* صفحه‌های هدف */}
      <div className={cn(card, "p-4")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-black text-gray-900 dark:text-white">صفحه‌های هدف</h2>
          {canManage && (
            <button
              type="button"
              className={btn.outline}
              onClick={() => {
                setEditingTarget(null);
                setTargetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              صفحه‌ی تازه
            </button>
          )}
        </div>
        <div className="space-y-2">
          {data.targets.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2.5 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2",
                !t.isActive && "opacity-60",
              )}
            >
              <Target className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-gray-800 dark:text-gray-100">
                  {t.label || "بدون برچسب"}
                  {t.primaryKeyword && <span className="mr-2 font-normal text-gray-500">· {t.primaryKeyword}</span>}
                  {!t.isActive && <span className="mr-2 text-[10px] text-gray-400">(غیرفعال)</span>}
                </p>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-[10.5px] text-gray-400 hover:underline"
                  dir="ltr"
                >
                  <span className="truncate">{t.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTarget(t);
                    setTargetOpen(true);
                  }}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-white dark:hover:bg-white/10"
                  title="ویرایش"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canManage && data.targets.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDeletingTarget(t)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  title="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* اعداد کنار چارت‌اند نه در صفحه‌ی دیگر */}
      <LinkCampaignStats stats={stats.data} />

      {/* گره‌ها — بوم و فهرست دو نمای یک داده‌اند */}
      <div className="flex gap-2">
        {(
          [
            { key: "chart", label: "چارت", icon: LayoutGrid },
            { key: "list", label: "فهرست", icon: List },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold",
                view === item.key
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {view === "chart" &&
        (canvas.data ? (
          <LinkChartCanvas
            campaignId={campaignId}
            data={canvas.data}
            canManage={canManage}
            onSelectNode={setOpenNodeId}
          />
        ) : (
          <Skeleton className="h-[520px]" />
        ))}

      {view === "list" && (
        <div className={card}>
          <div className="flex items-center justify-between p-4 pb-3">
            <h2 className="text-[13px] font-black text-gray-900 dark:text-white">
              گره‌ها {items.length > 0 && `(${fa(items.length)})`}
            </h2>
          </div>
          {nodes.loading && !nodes.data && (
            <div className="space-y-2 p-4 pt-0">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}
          {nodes.data && items.length === 0 && (
            <p className="px-4 pb-6 pt-2 text-center text-[12px] text-gray-500">هنوز گره‌ای تعریف نشده</p>
          )}
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {items.map((n) => (
              <LinkNodeRow
                key={n.id}
                node={n}
                meta={meta.data}
                variant="campaign"
                onOpen={() => setOpenNodeId(n.id)}
                onEdit={() => openForm(n)}
                onDelete={() => setDeletingNode(n)}
                onChanged={refreshAll}
              />
            ))}
          </div>
        </div>
      )}

      {meta.data && (
        <LinkNodeFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={refreshAll}
          campaign={data}
          nodes={items}
          meta={meta.data}
          stats={stats.data}
          editing={editing}
        />
      )}

      <LinkNodeDetail
        nodeId={shownNodeId}
        meta={meta.data}
        onClose={closeNode}
        onChanged={refreshAll}
        onEdit={(n) => {
          setOpenNodeId(null);
          openForm(n);
        }}
        onDelete={(n) => setDeletingNode(n)}
      />

      <TargetDialog
        open={targetOpen}
        campaignId={campaignId}
        editing={editingTarget}
        onClose={() => setTargetOpen(false)}
        onSaved={refreshAll}
      />

      <CampaignSettingsDialog
        open={settingsOpen}
        campaign={data}
        onClose={() => setSettingsOpen(false)}
        onSaved={refreshAll}
        onDelete={() => {
          setSettingsOpen(false);
          setDeletingCampaign(true);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTarget)}
        title="حذف صفحه‌ی هدف"
        message="این صفحه از کمپین حذف شود؟ اگر گره‌ای به آن لینک می‌دهد حذف نمی‌شود — غیرفعالش کنید."
        confirmLabel="حذف"
        pending={busy}
        onConfirm={removeTarget}
        onClose={() => setDeletingTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(deletingNode)}
        title="حذف گره"
        message={`گره ${deletingNode ? fa(deletingNode.code) : ""} حذف شود؟ تاریخچه‌اش می‌ماند.`}
        confirmLabel="حذف"
        pending={busy}
        onConfirm={removeNode}
        onClose={() => setDeletingNode(null)}
      />
      <ConfirmDialog
        open={deletingCampaign}
        title="حذف کمپین"
        message="کمپینی که گره‌ی در جریان یا فعال دارد حذف نمی‌شود — «متوقف» یا «تمام‌شده» کنید."
        confirmLabel="حذف"
        pending={busy}
        onConfirm={removeCampaign}
        onClose={() => setDeletingCampaign(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function TargetDialog({
  open,
  campaignId,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  campaignId: string;
  editing: TargetDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ url: "", label: "", primaryKeyword: "", isActive: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            url: editing.url,
            label: editing.label ?? "",
            primaryKeyword: editing.primaryKeyword ?? "",
            isActive: editing.isActive,
          }
        : { url: "", label: "", primaryKeyword: "", isActive: true },
    );
  }, [open, editing]);

  async function submit() {
    setBusy(true);
    try {
      if (editing) await send(`/api/admin/worklist/links/targets/${editing.id}`, "PATCH", form);
      else await send(`/api/admin/worklist/links/campaigns/${campaignId}/targets`, "POST", form);
      toast(editing ? "صفحه‌ی هدف به‌روزرسانی شد" : "صفحه‌ی هدف اضافه شد");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ثبت انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "ویرایش صفحه‌ی هدف" : "صفحه‌ی هدف تازه"}>
      <div className="space-y-3.5">
        <div>
          <Label htmlFor="t-url">آدرس صفحه</Label>
          <input
            id="t-url"
            dir="ltr"
            className={inputCls}
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://example.com/category/printer"
          />
          <Hint>دسته، محصول، مقاله یا خانه — لینک به صفحه‌ی داخلی، نه فقط صفحه‌ی اصلی.</Hint>
        </div>
        <div>
          <Label htmlFor="t-label">برچسب کوتاه</Label>
          <input
            id="t-label"
            className={inputCls}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="مثلاً: پرینتر لیزری"
          />
        </div>
        <div>
          <Label htmlFor="t-kw">کلمه‌ی کلیدی اصلی</Label>
          <input
            id="t-kw"
            className={inputCls}
            value={form.primaryKeyword}
            onChange={(e) => setForm({ ...form, primaryKeyword: e.target.value })}
          />
          <Hint>توزیع انکر برای هر صفحه جدا حساب می‌شود.</Hint>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-[12px] font-bold text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            فعال
          </label>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" className={cn(btn.primary, "flex-1")} onClick={submit} disabled={busy}>
            {editing ? "ذخیره" : "افزودن"}
          </button>
          <button type="button" className={btn.outline} onClick={onClose}>
            انصراف
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function CampaignSettingsDialog({
  open,
  campaign,
  onClose,
  onSaved,
  onDelete,
}: {
  open: boolean;
  campaign: CampaignDetail;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    note: "",
    status: "ACTIVE" as LinkCampaignStatus,
    weeklyQuota: "",
    anchorProfile: "ECOMMERCE",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: campaign.title,
      note: campaign.note ?? "",
      status: campaign.status,
      weeklyQuota: campaign.weeklyQuota ? String(campaign.weeklyQuota) : "",
      anchorProfile: campaign.anchorProfile,
    });
  }, [open, campaign]);

  async function submit() {
    setBusy(true);
    try {
      await send(`/api/admin/worklist/links/campaigns/${campaign.id}`, "PATCH", {
        ...form,
        weeklyQuota: form.weeklyQuota === "" ? null : Number(form.weeklyQuota),
      });
      toast("کمپین به‌روزرسانی شد");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ذخیره نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="تنظیمات کمپین">
      <div className="space-y-3.5">
        <div>
          <Label htmlFor="c-title">نام کمپین</Label>
          <input id="c-title" className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-status">وضعیت</Label>
            <select
              id="c-status"
              className={inputCls}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as LinkCampaignStatus })}
            >
              {(Object.keys(CAMPAIGN_STATUS_LABELS) as LinkCampaignStatus[]).map((s) => (
                <option key={s} value={s}>
                  {CAMPAIGN_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="c-quota">سقف لینک در هفته</Label>
            <input
              id="c-quota"
              dir="ltr"
              inputMode="numeric"
              className={inputCls}
              value={form.weeklyQuota}
              onChange={(e) => setForm({ ...form, weeklyQuota: e.target.value.replace(/[^\d]/g, "") })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="c-profile">بازه‌ی مرجع توزیع انکر</Label>
          <select
            id="c-profile"
            className={inputCls}
            value={form.anchorProfile}
            onChange={(e) => setForm({ ...form, anchorProfile: e.target.value })}
          >
            {Object.entries(ANCHOR_PROFILE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="c-note">یادداشت</Label>
          <textarea
            id="c-note"
            rows={2}
            className={cn(inputCls, "resize-none")}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" className={cn(btn.primary, "flex-1")} onClick={submit} disabled={busy}>
            ذخیره
          </button>
          <button type="button" className={btn.outline} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            حذف کمپین
          </button>
        </div>
      </div>
    </Dialog>
  );
}
