"use client";

/**
 * گفتگوی راهنمای هوشمند — docs/plans/admin-assistant.md
 *
 * جریان SSE با fetch خوانده می‌شود (EventSource فقط GET دارد).
 *
 * ⚠️ راه جایگزین CDN: اگر جریان بی رویداد پایانی تمام شد یا وسطش قطع شد، پاسخ روی سرور
 * همچنان ساخته و ذخیره می‌شود؛ پس گفتگو را هر ۲ ثانیه از `conversations/:id` می‌خوانیم تا
 * پاسخ برسد. بدون این، CDN‌ای که جریان را می‌بُرد پاسخ را برای کاربر گم می‌کرد.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AssistantQuota {
  enabled: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export interface AssistantChatMessage {
  /** شناسه‌ی سرور — برای بازخورد؛ پیام در حال نوشتن ندارد */
  id: string | null;
  localId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  error: string | null;
  feedback: number | null;
  pending?: boolean;
  /** ابزاری که الان اجرا می‌شود — «خواندن کارهای کارتابل شما…» */
  toolLabel?: string | null;
}

type ServerMessage = { id: string; role: "USER" | "ASSISTANT"; content: string; error: string | null; feedback: number | null };

type AssistantEvent =
  | { type: "meta"; conversationId: string; remaining: number }
  | { type: "tool"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; remaining: number }
  | { type: "error"; message: string };

let counter = 0;
const nextLocalId = () => `local-${Date.now()}-${counter++}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useAssistantStatus() {
  const [status, setStatus] = useState<AssistantQuota | null>(null);
  const refresh = useCallback(() => {
    fetch("/api/admin/assistant/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d?.ok ? { enabled: d.enabled, limit: d.limit, used: d.used, remaining: d.remaining } : null))
      .catch(() => setStatus(null));
  }, []);
  useEffect(refresh, [refresh]);
  return { status, setStatus, refresh };
}

async function loadConversation(id: string): Promise<{ id: string; messages: ServerMessage[] } | null> {
  const r = await fetch(`/api/admin/assistant/conversations/${id}`);
  const d = await r.json().catch(() => null);
  return d?.ok ? d : null;
}

export function useAssistantChat(onAnswered: (remaining: number) => void) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = (patch: (m: AssistantChatMessage) => AssistantChatMessage) =>
    setMessages((current) => {
      const copy = [...current];
      const last = copy[copy.length - 1];
      if (last?.role === "ASSISTANT") copy[copy.length - 1] = patch(last);
      return copy;
    });

  /** پاسخ ذخیره‌شده‌ی بعد از `afterCount` پیام — تا ۱۵۰ ثانیه */
  const pollAnswer = async (convId: string, afterCount: number, signal: AbortSignal) => {
    for (let i = 0; i < 75 && !signal.aborted; i++) {
      await wait(2000);
      const view = await loadConversation(convId).catch(() => null);
      const answer = view?.messages.slice(afterCount).find((m) => m.role === "ASSISTANT");
      if (answer) return answer;
    }
    return null;
  };

  const send = useCallback(
    async (text: string, pagePath: string) => {
      const message = text.trim();
      if (!message || isStreaming) return;

      setIsStreaming(true);
      setMessages((current) => [
        ...current,
        { id: null, localId: nextLocalId(), role: "USER", content: message, error: null, feedback: null },
        { id: null, localId: nextLocalId(), role: "ASSISTANT", content: "", error: null, feedback: null, pending: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      let convId = conversationId;
      let finished = false;
      // تعداد پیام‌های ذخیره‌شده‌ی پیش از این نوبت + پیام کاربر — مبنای خواندن پاسخ در حالت جایگزین
      const before = convId ? ((await loadConversation(convId).catch(() => null))?.messages.length ?? 0) + 1 : 1;

      try {
        const response = await fetch("/api/admin/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, conversationId: convId ?? undefined, pagePath }),
          signal: controller.signal,
        });

        // خطای پیش از جریان با ۲۰۰ و ok:false (CDN بدنه‌ی ۴xx را عوض می‌کند)
        if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
          const json = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? "ارسال پیام ناموفق بود");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const line = block.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let event: AssistantEvent;
            try {
              event = JSON.parse(line.slice(5).trim()) as AssistantEvent;
            } catch {
              continue;
            }
            if (event.type === "meta") {
              convId = event.conversationId;
              setConversationId(event.conversationId);
            } else if (event.type === "tool") {
              patchLast((m) => ({ ...m, toolLabel: event.label }));
            } else if (event.type === "delta") {
              patchLast((m) => ({ ...m, content: m.content + event.text, toolLabel: null }));
            } else if (event.type === "done") {
              finished = true;
              patchLast((m) => ({ ...m, id: event.messageId, pending: false, toolLabel: null }));
              onAnswered(event.remaining);
            } else if (event.type === "error") {
              finished = true;
              patchLast((m) => ({ ...m, error: event.message, pending: false, toolLabel: null }));
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          finished = true;
          patchLast((m) => ({ ...m, pending: false, toolLabel: null }));
        } else if (!convId) {
          finished = true;
          patchLast((m) => ({
            ...m, pending: false, toolLabel: null,
            error: error instanceof Error ? error.message : "ارسال پیام ناموفق بود",
          }));
        }
      }

      // جریان بی رویداد پایانی تمام شد یا قطع شد — پاسخ را از گفتگوی ذخیره‌شده بخوان
      if (!finished && convId) {
        patchLast((m) => ({ ...m, toolLabel: "در انتظار پاسخ" }));
        const answer = await pollAnswer(convId, before, controller.signal);
        patchLast((m) =>
          answer
            ? { ...m, id: answer.error ? null : answer.id, content: answer.content, error: answer.error, pending: false, toolLabel: null }
            : { ...m, pending: false, toolLabel: null, error: "پاسخ نرسید؛ کمی بعد از «گفتگوهای قبلی» دوباره باز کنید" },
        );
      }

      // پاسخی که بی‌رویداد پایانی ماند در حالت «در حال نوشتن» گیر نکند
      patchLast((m) => (m.pending ? { ...m, pending: false, toolLabel: null } : m));
      abortRef.current = null;
      setIsStreaming(false);
    },
    [conversationId, isStreaming, onAnswered],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
  }, []);

  const open = useCallback(async (id: string) => {
    abortRef.current?.abort();
    const view = await loadConversation(id);
    if (!view) throw new Error("گفتگو پیدا نشد");
    setConversationId(view.id);
    setMessages(view.messages.map((m) => ({ ...m, localId: m.id })));
  }, []);

  const setFeedback = useCallback(async (messageId: string, feedback: 1 | -1 | null) => {
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
    await fetch(`/api/admin/assistant/messages/${messageId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    }).catch(() => undefined);
  }, []);

  return { conversationId, messages, isStreaming, send, stop, reset, open, setFeedback };
}

export async function listConversations(): Promise<{ id: string; title: string; updatedAt: string }[]> {
  const r = await fetch("/api/admin/assistant/conversations");
  const d = await r.json().catch(() => null);
  return d?.ok ? d.items : [];
}

export async function deleteConversation(id: string): Promise<boolean> {
  const r = await fetch(`/api/admin/assistant/conversations/${id}`, { method: "DELETE" });
  const d = await r.json().catch(() => null);
  return !!d?.ok;
}
