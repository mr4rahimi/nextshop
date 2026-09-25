"use client";

/**
 * دکمه‌های مرحله‌ی گره — الگوبرداری از `link-node-actions.tsx` برتر.
 *
 * چه دکمه‌ای دیده شود از **وضعیت و نقش** می‌آید. سرور همین را دوباره بررسی
 * می‌کند؛ نبودن دکمه هیچ‌وقت تنها نگهبان نیست.
 */

import { useState } from "react";
import { Dialog, Hint, Label, btn, cn, inputCls, send, useToast } from "./ui";
import type { LinkMeta, LinkNodeDto } from "./link-client-types";

type Prompt = {
  action: "submit" | "fail" | "return" | "lost" | "assign";
  title: string;
  needs: "note" | "url" | "assignee";
};

export default function LinkNodeActions({
  node,
  canManage,
  isMine,
  meta,
  onChanged,
}: {
  node: LinkNodeDto;
  canManage: boolean;
  isMine: boolean;
  meta: LinkMeta | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await send(`/api/admin/worklist/links/nodes/${node.id}/transition`, "POST", { action, ...extra });
      toast("انجام شد");
      setPrompt(null);
      setNote("");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "انجام نشد", "error");
    } finally {
      setBusy(false);
    }
  }

  function open(next: Prompt) {
    setNote("");
    setUrl(node.publishedUrl ?? "");
    setAssigneeId(node.assigneeId ?? "");
    setPrompt(next);
  }

  const buttons: { label: string; onClick: () => void; outline?: boolean }[] = [];
  // مثل برتر: دکمه‌های اجرا فقط برای خودِ مسئول گره؛ مدیر ارجاع و تأیید دارد
  const acting = isMine;
  const waitingContent = !!node.content && !node.content.isReady;

  if (acting && node.status === "ASSIGNED") {
    buttons.push({
      label: node.isBlocked ? "در انتظار پیش‌نیاز" : waitingContent ? "در انتظار محتوا" : "شروع",
      onClick: () =>
        node.isBlocked
          ? toast("اول لینکی که این گره به آن اشاره می‌کند باید فعال شود", "error")
          : waitingContent
            ? toast("متن این گره هنوز در کار محتوا نوشته و ارسال نشده", "error")
            : run("start"),
    });
  }
  if (acting && node.status === "IN_PROGRESS") {
    buttons.push({
      label: "ثبت لینک",
      onClick: () => open({ action: "submit", title: "ثبت لینک ساخته‌شده", needs: "url" }),
    });
  }
  if (acting && ["ASSIGNED", "IN_PROGRESS"].includes(node.status)) {
    buttons.push({
      label: "نشد",
      outline: true,
      onClick: () => open({ action: "fail", title: "این گره نشد", needs: "note" }),
    });
  }
  if (canManage && node.status === "SUBMITTED") {
    buttons.push({ label: "تأیید", onClick: () => run("approve") });
    buttons.push({
      label: "برگشت",
      outline: true,
      onClick: () => open({ action: "return", title: "برگشت با دلیل", needs: "note" }),
    });
  }
  if (canManage && node.status === "LIVE") {
    buttons.push({
      label: "لینک دیگر نیست",
      outline: true,
      onClick: () => open({ action: "lost", title: "لینک از دست رفت", needs: "note" }),
    });
  }
  if (canManage && ["FAILED", "LOST"].includes(node.status)) {
    buttons.push({ label: "بازگشایی", outline: true, onClick: () => run("reopen") });
  }
  if (canManage && ["PLANNED", "ASSIGNED", "IN_PROGRESS"].includes(node.status)) {
    buttons.push({
      label: node.assigneeId ? "ارجاع به دیگری" : "ارجاع",
      outline: true,
      onClick: () => open({ action: "assign", title: "ارجاع گره", needs: "assignee" }),
    });
  }

  if (buttons.length === 0) return null;

  const blocked =
    busy ||
    (prompt?.needs === "url" && url.trim().length < 8) ||
    (prompt?.needs === "assignee" && !assigneeId) ||
    (prompt?.needs === "note" && prompt.action !== "lost" && note.trim().length < 3);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            disabled={busy}
            className={cn(
              btn.small,
              b.outline
                ? "border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                : "bg-blue-500 hover:bg-blue-600 text-white",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <Dialog open={Boolean(prompt)} onClose={() => setPrompt(null)} title={prompt?.title ?? ""}>
        <div className="space-y-3.5">
          {prompt?.needs === "url" && (
            <div>
              <Label htmlFor="submit-url">آدرس صفحه‌ای که لینک در آن گذاشته شد</Label>
              <input
                id="submit-url"
                dir="ltr"
                className={inputCls}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
              {/* تله‌ی ۱: جابه‌جایی این دو، کل گزارش را بی‌معنی می‌کند */}
              <Hint>آدرس خودِ صفحه‌ی میزبان، نه آدرسی که لینک به آن اشاره می‌کند.</Hint>
            </div>
          )}
          {prompt?.needs === "note" && (
            <div>
              <Label htmlFor="action-note">دلیل {prompt.action === "lost" ? "(اختیاری)" : ""}</Label>
              <textarea
                id="action-note"
                rows={3}
                className={cn(inputCls, "resize-none")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="چه اتفاقی افتاد؟"
              />
            </div>
          )}
          {prompt?.needs === "assignee" && (
            <div>
              <Label htmlFor="action-assignee">مسئول</Label>
              <select
                id="action-assignee"
                className={inputCls}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">انتخاب کنید…</option>
                {(meta?.linkStaff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isMe ? " (خودم)" : ""}
                  </option>
                ))}
              </select>
              <Hint>به مسئول تازه اعلان می‌رود. گره‌ی برنامه‌ریزی‌شده با ارجاع «واگذارشده» می‌شود.</Hint>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btn.primary, "flex-1")}
              disabled={blocked}
              onClick={() =>
                prompt &&
                run(prompt.action, {
                  ...(prompt.needs === "url" ? { publishedUrl: url.trim() } : {}),
                  ...(prompt.needs === "note" && note.trim() ? { note: note.trim() } : {}),
                  ...(prompt.needs === "assignee" ? { assigneeId } : {}),
                })
              }
            >
              {busy ? "در حال ثبت..." : "ثبت"}
            </button>
            <button type="button" className={btn.outline} onClick={() => setPrompt(null)}>
              انصراف
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
