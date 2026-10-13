"use client";

/**
 * دکمه‌ی ✨ نوار بالای پنل — docs/plans/admin-assistant.md
 *
 * فقط وقتی دیده می‌شود که دستیار روشن است و سقف این کارمند صفر نیست.
 * هر جای پنل می‌تواند پنل را با پیام آماده باز کند (مثلاً «راهنمای این کار»):
 *   window.dispatchEvent(new CustomEvent("assistant:open", { detail: { message: "…" } }))
 */

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAdminMe } from "@/components/admin/useAdminMe";
import AssistantPanel from "./AssistantPanel";
import { useAssistantStatus } from "./useAssistant";

export const ASSISTANT_OPEN_EVENT = "assistant:open";

export function openAssistant(message?: string) {
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT, { detail: { message } }));
}

export default function AssistantButton({ className }: { className: string }) {
  const me = useAdminMe();
  const { status, setStatus } = useAssistantStatus();
  const [open, setOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const message = (e as CustomEvent<{ message?: string }>).detail?.message;
      setInitialMessage(message?.trim() ? message.trim() : null);
      setOpen(true);
    };
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
  }, []);

  const onAnswered = useCallback(
    (remaining: number) => setStatus((s) => (s ? { ...s, used: s.used + 1, remaining } : s)),
    [setStatus],
  );

  if (!status?.enabled) return null;

  return (
    <>
      <button
        onClick={() => {
          setInitialMessage(null);
          setOpen((v) => !v);
        }}
        aria-label="راهنمای هوشمند"
        title="راهنمای هوشمند"
        className={`${className} ${open ? "bg-[var(--adm-hover)] text-blue-600 dark:text-blue-400" : ""}`}
      >
        <Sparkles className="h-[18px] w-[18px]" aria-hidden />
      </button>
      {open && (
        <AssistantPanel
          permissions={me?.permissions ?? []}
          unrestricted={!!me?.isUnrestricted}
          status={status}
          onAnswered={onAnswered}
          initialMessage={initialMessage}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
