"use client";

/**
 * اتصال گره به کار محتوا — الگوبرداری از `link-node-content.tsx` برتر.
 *
 * ویرایشگر دوم ساخته نمی‌شود: گره به یک کار محتوای **بیرونی** وصل می‌شود و
 * متن در همان گردش کار محتوا نوشته می‌شود (بخش ۷.۶). تا متن ارسال نشده،
 * گره «در انتظار محتوا» است.
 */

import { useState } from "react";
import Link from "next/link";
import { FileText, Unlink } from "lucide-react";
import { CONTENT_STATUS_LABELS } from "@/lib/marketing/types";
import { Dialog, Hint, Label, btn, cn, fa, inputCls, send, useToast } from "./ui";
import type { LinkMeta, LinkNodeDto } from "./link-client-types";

export default function LinkNodeContent({
  node,
  canManage,
  meta,
  onChanged,
}: {
  node: LinkNodeDto;
  canManage: boolean;
  meta: LinkMeta | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", writerId: "", publisherId: "" });

  // فقط گره‌ای که واقعاً محتوا می‌خواهد این بخش را می‌بیند
  if (node.contentKind === "NONE" && !node.content) return null;

  async function call(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      await send(`/api/admin/worklist/links/nodes/${node.id}/content`, "POST", body);
      toast(ok);
      setIsOpen(false);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  if (node.content) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2",
          node.content.isReady ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-amber-50 dark:bg-amber-500/10",
        )}
      >
        <FileText className="h-4 w-4 shrink-0 text-gray-500" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/worklist/content?task=${node.content.taskId}`}
            className="block truncate text-[11.5px] font-bold text-gray-800 dark:text-gray-100 hover:underline"
          >
            کار محتوا {fa(node.content.code)} — {node.content.title}
          </Link>
          <p className="text-[10.5px] text-gray-500">
            {node.content.isReady
              ? CONTENT_STATUS_LABELS[node.content.status]
              : `در انتظار محتوا · ${CONTENT_STATUS_LABELS[node.content.status]}`}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => call({ mode: "detach" }, "اتصال برداشته شد — متن نوشته‌شده پاک نمی‌شود")}
            disabled={busy}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-white dark:hover:bg-white/10"
            title="برداشتن اتصال"
          >
            <Unlink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!canManage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setForm({ title: "", writerId: "", publisherId: node.assigneeId ?? "" });
          setIsOpen(true);
        }}
        className={cn(btn.small, "border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5")}
      >
        <FileText className="h-3.5 w-3.5" />
        ساخت کار محتوا
      </button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="کار محتوا برای این گره">
        <div className="space-y-3.5">
          <p className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-[11.5px] leading-6 text-gray-600 dark:text-gray-300">
            عنوان، کلمه‌ی کلیدی (از صفحه‌ی هدفِ همین گره) و بریف از روی گره پر می‌شوند. مقصد کار
            «سایت بیرونی» است و در مجله منتشر نمی‌شود. تا متن ارسال نشود، گره «در انتظار محتوا»
            می‌ماند.
          </p>
          <div>
            <Label htmlFor="content-title">عنوان (اختیاری)</Label>
            <input
              id="content-title"
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={node.profileTitle || "از روی گره پر می‌شود"}
            />
          </div>
          <div>
            <Label htmlFor="content-writer">محتوانویس</Label>
            <select
              id="content-writer"
              className={inputCls}
              value={form.writerId}
              onChange={(e) => setForm({ ...form, writerId: e.target.value })}
            >
              <option value="">انتخاب کنید…</option>
              {(meta?.contentStaff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="content-publisher">محتواگذار</Label>
            <select
              id="content-publisher"
              className={inputCls}
              value={form.publisherId}
              onChange={(e) => setForm({ ...form, publisherId: e.target.value })}
            >
              <option value="">همان محتوانویس</option>
              {(meta?.contentStaff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Hint>معمولاً همان کسی که گره به او ارجاع شده — او با سایت میزبان هماهنگ می‌کند.</Hint>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className={cn(btn.primary, "flex-1")}
              onClick={() =>
                call(
                  {
                    mode: "create",
                    title: form.title || undefined,
                    writerId: form.writerId,
                    publisherId: form.publisherId || null,
                  },
                  "کار محتوا ساخته و به گره وصل شد",
                )
              }
              disabled={busy || !form.writerId}
            >
              {busy ? "در حال ساخت..." : "ساخت"}
            </button>
            <button type="button" className={btn.outline} onClick={() => setIsOpen(false)}>
              انصراف
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
