"use client";

/**
 * دکمه‌ی «✨ راهنمای این کار» — docs/plans/admin-assistant.md فاز ۲ (مربی کار)
 *
 * کارمند لازم نیست بداند چه بپرسد: پنل دستیار با پیام آماده باز می‌شود. فقط وقتی دیده می‌شود که
 * دستیار برای همین کارمند روشن است (وضعیت یک بار در هر بارگذاری صفحه خوانده می‌شود).
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { openAssistant } from "./AssistantButton";

let statusCache: Promise<boolean> | null = null;
function assistantEnabled(): Promise<boolean> {
  statusCache ??= fetch("/api/admin/assistant/status")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => !!d?.ok && !!d.enabled)
    .catch(() => false);
  return statusCache;
}

export default function AskAssistantButton({ message, label = "راهنمای این کار" }: { message: string; label?: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    assistantEnabled().then((v) => alive && setEnabled(v));
    return () => {
      alive = false;
    };
  }, []);
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => openAssistant(message)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
      title="دستیار این کار را برایتان قدم‌به‌قدم توضیح می‌دهد"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
