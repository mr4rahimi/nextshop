"use client";

/**
 * ردیف گره در نمای «فهرست» کمپین و کارت «گره‌های من» — الگوبرداری از
 * جدول گره‌ها در `link-campaign-detail-view.tsx` و `my-link-nodes-view.tsx`
 * برتر.
 */

import { useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  ANCHOR_KIND_LABELS,
  CONTENT_KIND_LABELS,
  NODE_STATUS_LABELS,
  NODE_STATUS_TONES,
  relOf,
} from "@/lib/marketing/link-constants";
import { dueLabel } from "@/lib/worklist/types";
import { LinkTypeIcon } from "./link-icons";
import LinkNodeActions from "./LinkNodeActions";
import LinkNodeContent from "./LinkNodeContent";
import { cn, fa } from "./ui";
import type { LinkMeta, LinkNodeDto } from "./link-client-types";

/**
 * آیکن گره: فاوآیکن پلتفرم اگر فایلش هست، وگرنه آیکن نوع. `onError` همان
 * برگشت را برای فایلِ پاک‌شده هم تضمین می‌کند — سرور برای آیکن به اینترنت
 * وصل نمی‌شود (بخش ۷.۲).
 */
export function NodeIcon({ node, size = "md" }: { node: Pick<LinkNodeDto, "type" | "platform">; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const img = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        box,
        node.type.isRisky ? "bg-red-50 dark:bg-red-500/10" : "bg-gray-100 dark:bg-white/5",
      )}
    >
      {node.platform?.iconPath && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={node.platform.iconPath}
          alt=""
          onError={() => setFailed(true)}
          className={cn(img, "rounded-sm object-contain")}
        />
      ) : (
        <LinkTypeIcon icon={node.type.icon} className={cn(img, node.type.isRisky ? "text-red-600" : "text-gray-500")} />
      )}
    </span>
  );
}

export default function LinkNodeRow({
  node,
  meta,
  variant,
  onOpen,
  onEdit,
  onDelete,
  onChanged,
}: {
  node: LinkNodeDto;
  meta: LinkMeta | null;
  /** «campaign» جدول مدیر؛ «mine» کارت کارمند با بریف کامل */
  variant: "campaign" | "mine";
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onChanged: () => void;
}) {
  const canManage = !!meta?.can.manage && variant === "campaign";
  const isMine = node.assigneeId === meta?.me.id;

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="shrink-0">
          <NodeIcon node={node} size={variant === "mine" ? "lg" : "md"} />
        </button>

        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="flex flex-wrap items-center gap-1.5 text-right">
            <span className="text-[11px] font-bold tabular-nums text-gray-400">{fa(node.code)}</span>
            <h3 className="truncate text-[13px] font-black text-gray-900 dark:text-white hover:underline">
              {node.platform?.title ?? node.type.title}
            </h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", NODE_STATUS_TONES[node.status])}>
              {NODE_STATUS_LABELS[node.status]}
            </span>
            {node.tier === null ? (
              <span className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                معلق
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                لایه {fa(node.tier)}
              </span>
            )}
            {node.isBlocked && (
              <span className="rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                در انتظار پیش‌نیاز
              </span>
            )}
            {node.dueAt && !["LIVE", "FAILED", "LOST"].includes(node.status) && (
              <span className="text-[10.5px] font-bold text-gray-400">{dueLabel(node.dueAt)}</span>
            )}
          </button>

          {variant === "campaign" ? (
            <>
              <p className="mt-1 truncate text-[11.5px] text-gray-500">
                {node.anchorText || "بدون انکر"}
                {node.anchorKind && ` · ${ANCHOR_KIND_LABELS[node.anchorKind]}`}
                <span dir="ltr"> · rel=&quot;{relOf(node)}&quot;</span>
              </p>
              {node.assigneeName && <p className="mt-0.5 text-[11px] text-gray-500">مسئول: {node.assigneeName}</p>}
            </>
          ) : (
            // بریف — همان چیزی که مدیر نوشته و کارمند باید اجرا کند
            <dl className="mt-2 space-y-1 text-[11.5px]">
              <p className="text-gray-400">کمپین «{node.campaign.title}»</p>
              {node.anchorText && (
                <div className="flex gap-1.5">
                  <dt className="shrink-0 text-gray-500">متن لینک:</dt>
                  <dd className="font-bold text-gray-800 dark:text-gray-100">
                    {node.anchorText}
                    {node.anchorKind && (
                      <span className="mr-1.5 font-normal text-gray-500">({ANCHOR_KIND_LABELS[node.anchorKind]})</span>
                    )}
                  </dd>
                </div>
              )}
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-gray-500">نوع لینک:</dt>
                <dd dir="ltr" className="font-bold text-gray-800 dark:text-gray-100">
                  rel=&quot;{relOf(node)}&quot;
                </dd>
              </div>
              {node.contentKind !== "NONE" && (
                <div className="flex gap-1.5">
                  <dt className="shrink-0 text-gray-500">محتوا:</dt>
                  <dd className="font-bold text-gray-800 dark:text-gray-100">
                    {CONTENT_KIND_LABELS[node.contentKind]}
                    {node.wordCount ? ` — حدود ${fa(node.wordCount)} کلمه` : ""}
                  </dd>
                </div>
              )}
              {node.profileTitle && (
                <div className="flex gap-1.5">
                  <dt className="shrink-0 text-gray-500">عنوان:</dt>
                  <dd className="font-bold text-gray-800 dark:text-gray-100">{node.profileTitle}</dd>
                </div>
              )}
              {node.contentBrief && <p className="pt-0.5 leading-6 text-gray-500">{node.contentBrief}</p>}
              {node.returnReason && node.status === "IN_PROGRESS" && (
                <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-2 py-1 text-red-600 dark:text-red-400">
                  برگشت: {node.returnReason}
                </p>
              )}
              {node.publishedUrl && (
                <a
                  href={node.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 pt-0.5 text-gray-500 hover:underline"
                  dir="ltr"
                >
                  <span className="truncate">{node.publishedUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </dl>
          )}
        </div>

        {canManage && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
            title="ویرایش"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {canManage && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            title="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn("mt-2.5 space-y-2", variant === "campaign" && "pr-12")}>
        <LinkNodeContent node={node} canManage={canManage} meta={meta} onChanged={onChanged} />
        <LinkNodeActions node={node} canManage={canManage} isMine={isMine} meta={meta} onChanged={onChanged} />
      </div>
    </div>
  );
}
