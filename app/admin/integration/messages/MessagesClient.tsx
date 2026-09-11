"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatRow {
  id:              string;
  platformCode:    string;
  platformName:    string;
  chatType:        string;
  contactName:     string | null;
  contactAvatar:   string | null;
  unseenCount:     number;
  lastMessageAt:   string | null;
  lastMessageText: string | null;
}

interface ChatFile { url: string; width?: number; height?: number; name?: string }

interface MessageRow {
  id:         string;
  direction:  "IN" | "OUT";
  senderName: string | null;
  text:       string | null;
  files:      ChatFile[];
  sentAt:     string;
  sendStatus: string;
  sendError:  string | null;
}

interface ThreadHead {
  id:            string;
  platformName:  string;
  chatType:      string;
  contactName:   string | null;
  contactAvatar: string | null;
  canReply:      boolean;
}

const TYPE_TABS = [
  { key: "private", label: "گفت‌وگوی مشتری" },
  { key: "channel", label: "کانال‌ها" },
  { key: "all",     label: "همه" },
] as const;

function clock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fa-IR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** تصویرهای پیام از آن‌هایی که فقط پیوست فایل‌اند جدا می‌شوند. */
function isImage(f: ChatFile): boolean {
  return Boolean(f.width && f.height) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(f.url);
}

export default function MessagesClient({ platforms }: { platforms: { code: string; name: string }[] }) {
  const [chats,    setChats]    = useState<ChatRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [head,     setHead]     = useState<ThreadHead | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [platform, setPlatform] = useState("");
  const [type,     setType]     = useState<string>("private");
  const [query,    setQuery]    = useState("");
  const [onlyUnseen, setOnlyUnseen] = useState(false);

  const [loadingChats,  setLoadingChats]  = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [syncing,  setSyncing]  = useState(false);
  const [draft,    setDraft]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const threadEnd = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const sp = new URLSearchParams({ type });
      if (platform) sp.set("platform", platform);
      if (query.trim()) sp.set("q", query.trim());
      if (onlyUnseen) sp.set("unseen", "1");

      const res  = await fetch(`/api/integration/messages?${sp}`);
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      setError("خواندن فهرست گفت‌وگوها ناموفق بود");
    } finally {
      setLoadingChats(false);
    }
  }, [platform, type, query, onlyUnseen]);

  const loadThread = useCallback(async (chatId: string) => {
    setLoadingThread(true);
    try {
      const res  = await fetch(`/api/integration/messages/${chatId}`);
      const data = await res.json();
      setHead(data.chat ?? null);
      setMessages(data.messages ?? []);
    } catch {
      setError("خواندن پیام‌های این گفت‌وگو ناموفق بود");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => { void loadChats(); }, [loadChats]);
  useEffect(() => { if (selected) void loadThread(selected); }, [selected, loadThread]);

  // رشته گفت‌وگو همیشه روی تازه‌ترین پیام باز می‌شود.
  useEffect(() => { threadEnd.current?.scrollIntoView({ block: "end" }); }, [messages]);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/integration/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(platform ? { platform } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "درخواست همگام‌سازی رد شد");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !selected) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/integration/messages/${selected}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "ارسال پیام ناموفق بود");
        return;
      }
      setDraft("");
      await loadThread(selected);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">پیام‌های بازارگاه</h1>
          <p className="text-sm text-gray-500 mt-1">گفت‌وگوهای مشتریان باسلام و پاسخ‌دادن از همین‌جا</p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {syncing ? "در حال صف‌کردن…" : "همگام‌سازی"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-2xl border border-red-200 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* فیلترها */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-gray-100 dark:bg-white/5 p-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                type === t.key
                  ? "bg-white dark:bg-[#0f1117] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {platforms.length > 1 && (
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-0"
          >
            <option value="">همه بازارگاه‌ها</option>
            {platforms.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی نام مخاطب"
          className="text-xs px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 border-0 flex-1 min-w-40"
        />

        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer">
          <input type="checkbox" checked={onlyUnseen} onChange={(e) => setOnlyUnseen(e.target.checked)} />
          فقط خوانده‌نشده
        </label>
      </div>

      <div className="grid md:grid-cols-[20rem_1fr] gap-4 items-start">
        {/* فهرست گفت‌وگوها */}
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
          {loadingChats ? (
            <p className="text-center text-gray-400 text-sm py-10">در حال بارگذاری…</p>
          ) : chats.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">گفت‌وگویی ثبت نشده</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04] max-h-[70vh] overflow-y-auto">
              {chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full text-right px-4 py-3 flex gap-3 items-center transition-colors ${
                    selected === c.id
                      ? "bg-blue-50 dark:bg-blue-900/15"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-black text-gray-400">
                    {c.contactAvatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.contactAvatar} alt="" className="w-full h-full object-cover" />
                      : (c.contactName?.[0] ?? "؟")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm text-gray-900 dark:text-white truncate">
                        {c.contactName ?? "بدون نام"}
                      </p>
                      {c.unseenCount > 0 && (
                        <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 flex-shrink-0">
                          {c.unseenCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.lastMessageText ?? "—"}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{clock(c.lastMessageAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* رشته پیام‌ها */}
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden flex flex-col min-h-[24rem]">
          {!selected ? (
            <p className="text-center text-gray-400 text-sm py-20">یک گفت‌وگو را انتخاب کنید</p>
          ) : loadingThread ? (
            <p className="text-center text-gray-400 text-sm py-20">در حال بارگذاری…</p>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.04] flex items-center gap-3">
                <p className="font-black text-sm text-gray-900 dark:text-white">
                  {head?.contactName ?? "بدون نام"}
                </p>
                <span className="text-[10px] text-gray-400">{head?.platformName}</span>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[55vh] px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-10">پیامی ذخیره نشده</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "OUT" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      m.direction === "OUT"
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100"
                        : "bg-gray-100 dark:bg-white/[0.06] text-gray-800 dark:text-gray-100"
                    }`}>
                      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}

                      {m.files?.filter(isImage).map((f, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={f.url} alt="" className="mt-2 rounded-xl max-h-60" />
                      ))}
                      {m.files?.filter((f) => !isImage(f)).map((f, i) => (
                        <a key={i} href={f.url} target="_blank" rel="noreferrer"
                          className="block mt-2 text-xs underline opacity-80">
                          {f.name ?? "فایل پیوست"}
                        </a>
                      ))}

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] opacity-50">{clock(m.sentAt)}</span>
                        {m.sendStatus === "PENDING" && <span className="text-[10px] opacity-60">در صف ارسال</span>}
                        {m.sendStatus === "FAILED"  && <span className="text-[10px] text-red-500">ارسال نشد</span>}
                      </div>
                      {m.sendError && <p className="text-[10px] text-red-500 mt-0.5">{m.sendError}</p>}
                    </div>
                  </div>
                ))}
                <div ref={threadEnd} />
              </div>

              {head?.canReply ? (
                <div className="border-t border-gray-100 dark:border-white/[0.04] p-3 flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder="پاسخ خود را بنویسید…"
                    className="flex-1 text-sm px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-100 border-0 resize-none"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="text-xs font-black px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                  >
                    {sending ? "…" : "ارسال"}
                  </button>
                </div>
              ) : (
                <div className="border-t border-gray-100 dark:border-white/[0.04] px-4 py-3 text-xs text-gray-400">
                  در این گفت‌وگو امکان پاسخ‌دادن نیست
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
