"use client";

/**
 * جزئیات گره — بریف، دکمه‌های مرحله، اتصال محتوا و تاریخچه.
 *
 * ضربه روی گره در بوم، ردیف فهرست و کارت «گره‌های من» همه همین را باز
 * می‌کنند؛ `?node=<id>` هم (کلیک روی اعلان). برتر روی بوم مستقیم فرم ویرایش
 * را باز می‌کرد؛ اینجا اول جزئیات می‌آید چون کارمند و ناظر هم چارت را
 * می‌بینند و فرم ویرایش برایشان بی‌معنی است. مدیر از همین‌جا «ویرایش» می‌زند.
 */

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  ANCHOR_KIND_LABELS,
  CONTENT_KIND_LABELS,
  NODE_STATUS_LABELS,
  NODE_STATUS_TONES,
  relOf,
} from "@/lib/marketing/link-constants";
import { EVENT_LABELS } from "@/lib/marketing/types";
import { formatDateTime, dueLabel } from "@/lib/worklist/types";
import LinkNodeActions from "./LinkNodeActions";
import LinkNodeContent from "./LinkNodeContent";
import { NodeIcon } from "./LinkNodeRow";
import { Dialog, Skeleton, cn, fa, useFetch } from "./ui";
import type { LinkMeta, LinkNodeDto, NodeEventDto } from "./link-client-types";

export default function LinkNodeDetail({
  nodeId,
  meta,
  onClose,
  onChanged,
  onEdit,
  onDelete,
}: {
  nodeId: string | null;
  meta: LinkMeta | null;
  onClose: () => void;
  onChanged: () => void;
  onEdit?: (node: LinkNodeDto) => void;
  onDelete?: (node: LinkNodeDto) => void;
}) {
  const { data, loading, error, reload } = useFetch<{ node: LinkNodeDto; events: NodeEventDto[] }>(
    nodeId ? `/api/admin/worklist/links/nodes/${nodeId}` : null,
  );
  const node = data?.node && data.node.id === nodeId ? data.node : null;
  const canManage = !!meta?.can.manage;

  function changed() {
    reload();
    onChanged();
  }

  return (
    <Dialog open={!!nodeId} onClose={onClose} title={node ? `گره ${fa(node.code)}` : "گره"} wide>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {loading && !node && <Skeleton className="h-48" />}
      {node && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <NodeIcon node={node} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-[14px] font-black text-gray-900 dark:text-white">
                  {node.platform?.title ?? node.type.title}
                </h3>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", NODE_STATUS_TONES[node.status])}>
                  {NODE_STATUS_LABELS[node.status]}
                </span>
                <span className="rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                  {node.tier === null ? "معلق" : `لایه ${fa(node.tier)}`}
                </span>
                {node.isBlocked && (
                  <span className="rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    در انتظار پیش‌نیاز
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {node.type.title} · کمپین «{node.campaign.title}»
                {node.assigneeName && ` · مسئول: ${node.assigneeName}`}
                {node.dueAt && ` · مهلت: ${dueLabel(node.dueAt)}`}
              </p>
            </div>
            {canManage && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                title="ویرایش"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canManage && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node)}
                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {node.type.isRisky && (
            <p className="rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-[11.5px] leading-6 text-red-700 dark:text-red-300">
              این روشِ لینک‌سازی ریسک جریمه دارد. فقط ثبت شده تا اگر رتبه افت کرد، بدانیم از کجاست.
            </p>
          )}

          {(node.returnReason || node.failReason) && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3">
              <p className="text-[11px] font-black text-red-700 dark:text-red-400">
                {node.status === "FAILED" ? "دلیل «نشد»" : "دلیل برگشت"}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">
                {node.status === "FAILED" ? node.failReason : node.returnReason}
              </p>
            </div>
          )}

          {/* بریف — همان چیزی که مدیر نوشته و کارمند باید اجرا کند */}
          <dl className="space-y-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 p-3.5 text-[12px]">
            <Row label="متن لینک">
              {node.anchorText || "—"}
              {node.anchorKind && (
                <span className="mr-1.5 font-normal text-gray-500">({ANCHOR_KIND_LABELS[node.anchorKind]})</span>
              )}
            </Row>
            <Row label="نوع لینک">
              <span dir="ltr">rel=&quot;{relOf(node)}&quot;</span>
            </Row>
            {node.contentKind !== "NONE" && (
              <Row label="محتوا">
                {CONTENT_KIND_LABELS[node.contentKind]}
                {node.wordCount ? ` — حدود ${fa(node.wordCount)} کلمه` : ""}
              </Row>
            )}
            {node.profileTitle && <Row label="عنوان">{node.profileTitle}</Row>}
            {node.contentBrief && (
              <p className="pt-0.5 leading-6 text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{node.contentBrief}</p>
            )}
            {node.note && canManage && <Row label="یادداشت مدیر">{node.note}</Row>}
            {node.cost !== null && canManage && <Row label="هزینه">{fa(node.cost)} تومان</Row>}
            {node.publishedUrl && (
              <a
                href={node.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 pt-0.5 text-blue-600 dark:text-blue-400 hover:underline"
                dir="ltr"
              >
                <span className="truncate">{node.publishedUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </dl>

          <div className="space-y-2">
            <LinkNodeContent node={node} canManage={canManage} meta={meta} onChanged={changed} />
            <LinkNodeActions
              node={node}
              canManage={canManage}
              isMine={node.assigneeId === meta?.me.id}
              meta={meta}
              onChanged={changed}
            />
          </div>

          <section>
            <h4 className="text-[11px] font-black text-gray-500 mb-1.5">تاریخچه</h4>
            <ul className="space-y-1.5">
              {(data?.events ?? []).map((e) => (
                <li key={e.id} className="text-[11px] text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{EVENT_LABELS[e.action]}</span>
                  {" — "}
                  {e.actorName ?? "سیستم"} · {formatDateTime(e.createdAt)}
                  {e.note && <p className="mt-0.5 text-gray-500 whitespace-pre-wrap break-all">{e.note}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-gray-500">{label}:</dt>
      <dd className="font-bold text-gray-800 dark:text-gray-100">{children}</dd>
    </div>
  );
}
