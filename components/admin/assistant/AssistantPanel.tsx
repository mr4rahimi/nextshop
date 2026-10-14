"use client";

/**
 * پنل گفتگوی راهنمای هوشمند — docs/plans/admin-assistant.md
 *
 * z-[70]: بالای سایدبار (۵۰)، زیر پنل شناور منو (۸۰)، جستجوی سریع (۹۰) و پاپ‌آپ ارجاع فوری
 * کارتابل (۲۰۰) — ارجاع فوری هرگز پشت دستیار پنهان نشود.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUp, History, Loader2, MessageSquarePlus, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, X,
} from "lucide-react";
import AssistantMarkdown from "./AssistantMarkdown";
import {
  deleteConversation, listConversations, useAssistantChat,
  type AssistantChatMessage, type AssistantQuota,
} from "./useAssistant";

const STORED_CONVERSATION = "assistant-conversation";

/** پیشنهاد شروع بسته به مجوز — فقط متن آماده است، دسترسی را سرور می‌سنجد */
function suggestionsFor(permissions: string[], unrestricted: boolean): string[] {
  const has = (p: string) => unrestricted || permissions.includes(p);
  const list: string[] = [];
  // گزارش‌های مدیر (فاز ۳) اول — برای مدیر سؤال اصلی همین‌هاست
  if (has("PANEL_REPORTS") || has("PANEL_ORDERS")) list.push("فروش این ماه نسبت به دوره‌ی قبل چطور بوده؟");
  if (has("PANEL_ORDERS")) list.push("کدام سفارش‌ها معطل مانده‌اند؟");
  if (has("SEO_ANALYTICS_VIEW")) list.push("کدام منبع ورود این ماه بیشترین فروش را آورد؟");
  if (has("PANEL_CATALOG")) list.push("کدام محصولات قیمت، عکس یا متا ندارند؟");
  list.push("این صفحه چه کار می‌کند؟");
  if (has("SEO_TASK_WORK") || has("CONTENT_TASK_WORK") || has("LINK_WORK")) {
    list.push("کارهای سئو و محتوای من چیست و کدام عقب افتاده؟");
  }
  if (has("WORK_VIEW_OWN")) list.push("امروز در کارتابل چه کارهایی دارم؟");
  if (has("ORDER_CREATE")) list.push("آخرین سفارش‌های تلفنی من در چه وضعیتی‌اند؟");
  if (has("PANEL_CONTENT") || has("SEO_TASK_WORK")) list.push("وقتی نشانی یک محصول را عوض می‌کنم، آدرس قبلی چه می‌شود؟");
  if (has("PANEL_CATALOG")) list.push("چطور برای چند محصول یک‌جا متن بنویسم؟");
  return list.slice(0, 5);
}

const remember = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(STORED_CONVERSATION, id);
    else sessionStorage.removeItem(STORED_CONVERSATION);
  } catch {
    // حافظه‌ی مرورگر در دسترس نیست — بی‌اهمیت
  }
};

export default function AssistantPanel({
  permissions,
  unrestricted,
  status,
  onAnswered,
  initialMessage,
  onClose,
}: {
  permissions: string[];
  unrestricted: boolean;
  status: AssistantQuota | null;
  onAnswered: (remaining: number) => void;
  /** پیام آماده — مثلاً از دکمه‌ی «راهنمای این کار» */
  initialMessage?: string | null;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const chat = useAssistantChat(onAnswered);
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef<string | null>(null);

  // ادامه‌ی همان گفتگو بعد از رفرش صفحه — مگر پیام آماده‌ای آمده باشد
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORED_CONVERSATION);
    } catch {
      stored = null;
    }
    if (stored && !initialMessage) chat.open(stored).catch(() => remember(null));
    inputRef.current?.focus();
    // فقط بار اول
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialMessage || sentInitial.current === initialMessage) return;
    sentInitial.current = initialMessage;
    chat.reset();
    void chat.send(initialMessage, pathname ?? "/admin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  useEffect(() => {
    remember(chat.conversationId);
  }, [chat.conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat.messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const remaining = status?.remaining ?? null;
  const exhausted = remaining !== null && remaining <= 0;

  const submit = () => {
    if (!draft.trim() || chat.isStreaming || exhausted) return;
    void chat.send(draft, pathname ?? "/admin");
    setDraft("");
  };

  return (
    <div
      className="adm-pop-in fixed inset-x-0 top-0 z-[70] flex h-dvh flex-col bg-white text-gray-900 dark:bg-[#111620] dark:text-gray-100 md:inset-y-3 md:left-3 md:right-auto md:h-auto md:w-[26rem] md:rounded-[1.25rem] md:border md:border-[var(--adm-border)] md:shadow-[var(--adm-shadow-lg)]"
      dir="rtl"
      role="dialog"
      aria-label="راهنمای هوشمند"
    >
      <header className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-[var(--adm-border)] px-3">
        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-gray-900 dark:text-white">راهنمای هوشمند</div>
          {remaining !== null && (
            <div className="text-[11px] text-gray-500">
              {exhausted ? "سقف پرسش امروز پر شده" : `${remaining.toLocaleString("fa-IR")} پرسش دیگر امروز`}
            </div>
          )}
        </div>
        <IconAction label="گفتگوهای قبلی" onClick={() => setShowHistory((v) => !v)} active={showHistory}>
          <History className="h-[18px] w-[18px]" aria-hidden />
        </IconAction>
        <IconAction
          label="گفتگوی تازه"
          onClick={() => {
            chat.reset();
            setShowHistory(false);
            inputRef.current?.focus();
          }}
        >
          <MessageSquarePlus className="h-[18px] w-[18px]" aria-hidden />
        </IconAction>
        <IconAction label="بستن" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden />
        </IconAction>
      </header>

      {showHistory ? (
        <ConversationList
          activeId={chat.conversationId}
          onSelect={(id) => {
            chat.open(id).catch(() => undefined);
            setShowHistory(false);
          }}
          onDeleted={(id) => {
            if (id === chat.conversationId) chat.reset();
          }}
        />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {chat.messages.length === 0 ? (
            <EmptyState
              suggestions={suggestionsFor(permissions, unrestricted)}
              onPick={(t) => void chat.send(t, pathname ?? "/admin")}
              disabled={exhausted}
            />
          ) : (
            chat.messages.map((m) => <MessageBubble key={m.localId} message={m} onFeedback={chat.setFeedback} />)
          )}
        </div>
      )}

      <footer className="flex-shrink-0 border-t border-[var(--adm-border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--adm-border-strong)] bg-gray-50 p-1.5 focus-within:border-blue-500 dark:bg-white/[0.04]">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={exhausted ? "فردا دوباره می‌توانید بپرسید" : "سؤالتان را بنویسید…"}
            disabled={exhausted}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-[13.5px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-60 dark:text-white"
          />
          {chat.isStreaming ? (
            <button
              type="button"
              onClick={chat.stop}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"
              aria-label="توقف"
              title="توقف"
            >
              <Square className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || exhausted}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow shadow-blue-500/20 transition-opacity disabled:opacity-40"
              aria-label="ارسال"
              title="ارسال"
            >
              <ArrowUp className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-gray-400">
          فقط داده‌هایی را می‌بیند که خودتان دسترسی دارید · گفتگوها ذخیره می‌شوند و مدیر فقط تعدادشان را می‌بیند
        </p>
      </footer>
    </div>
  );
}

function IconAction({
  label, onClick, active = false, children,
}: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--adm-hover)] ${
        active ? "bg-[var(--adm-hover)] text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ suggestions, onPick, disabled }: { suggestions: string[]; onPick: (t: string) => void; disabled: boolean }) {
  return (
    <div className="flex h-full flex-col justify-end gap-4 pb-2">
      <div className="space-y-1.5 px-1">
        <div className="text-[15px] font-black text-gray-900 dark:text-white">چطور کمکتان کنم؟</div>
        <p className="text-[12.5px] leading-6 text-gray-500">
          درباره‌ی طرز کار پنل بپرسید، یا کارها و سفارش‌های خودتان را. اگر منظور کاری که به شما سپرده‌اند روشن نیست، کدش را بگویید تا قدم‌به‌قدم توضیح بدهم.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {suggestions.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onPick(t)}
            className="rounded-xl border border-[var(--adm-border)] px-3 py-2.5 text-right text-[13px] text-gray-700 transition-colors hover:bg-[var(--adm-hover)] disabled:opacity-50 dark:text-gray-200"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message, onFeedback,
}: { message: AssistantChatMessage; onFeedback: (id: string, f: 1 | -1 | null) => void }) {
  if (message.role === "USER") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-blue-600 px-3.5 py-2 text-[13.5px] leading-7 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const thinking = message.pending && !message.content;
  return (
    <div className="space-y-1.5">
      {thinking ? (
        <div className="flex items-center gap-2 px-1 py-2 text-[12.5px] text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {message.toolLabel ? `${message.toolLabel}…` : "در حال فکر کردن…"}
        </div>
      ) : message.content ? (
        <div className="rounded-2xl rounded-tl-md border border-[var(--adm-border)] bg-gray-50/60 px-3.5 py-2.5 text-gray-800 dark:bg-white/[0.03] dark:text-gray-100">
          <AssistantMarkdown text={message.content} />
          {message.pending && message.toolLabel && (
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {message.toolLabel}…
            </div>
          )}
        </div>
      ) : null}
      {message.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {message.error}
        </div>
      )}
      {message.id && !message.error && (
        <div className="flex gap-1 px-1">
          <FeedbackButton active={message.feedback === 1} label="مفید بود" onClick={() => onFeedback(message.id!, message.feedback === 1 ? null : 1)}>
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          </FeedbackButton>
          <FeedbackButton active={message.feedback === -1} label="مفید نبود" onClick={() => onFeedback(message.id!, message.feedback === -1 ? null : -1)}>
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
          </FeedbackButton>
        </div>
      )}
    </div>
  );
}

function FeedbackButton({
  active, label, onClick, children,
}: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--adm-hover)] ${
        active ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

function ConversationList({
  activeId, onSelect, onDeleted,
}: { activeId: string | null; onSelect: (id: string) => void; onDeleted: (id: string) => void }) {
  const [rows, setRows] = useState<{ id: string; title: string; updatedAt: string }[] | null>(null);
  const load = useCallback(() => {
    listConversations().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  if (rows === null) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="flex-1 py-10 text-center text-[12.5px] text-gray-500">هنوز گفتگویی ندارید</p>;
  }
  return (
    <ul className="min-h-0 flex-1 divide-y divide-[var(--adm-border)] overflow-y-auto">
      {rows.map((row) => (
        <li key={row.id} className={`flex items-center gap-1 pl-2 ${row.id === activeId ? "bg-[var(--adm-hover)]" : ""}`}>
          <button type="button" onClick={() => onSelect(row.id)} className="min-w-0 flex-1 px-3 py-3 text-right">
            <div className="truncate text-[13px] font-bold text-gray-800 dark:text-gray-100">{row.title}</div>
            <div className="text-[11px] text-gray-400">{new Date(row.updatedAt).toLocaleDateString("fa-IR")}</div>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await deleteConversation(row.id)) {
                onDeleted(row.id);
                load();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[var(--adm-hover)] hover:text-red-500"
            aria-label="حذف گفتگو"
            title="حذف گفتگو"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
