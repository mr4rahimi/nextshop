"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FlowNode } from "@/lib/chat-flow";

// ── Markdown inline parser ─────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));

    if (m[1] !== undefined) {
      result.push(
        <strong key={m.index} style={{ fontWeight: 800, color: "inherit" }}>
          {m[1]}
        </strong>
      );
    } else {
      const label = m[2];
      const href = m[3];
      if (href.startsWith("/products/")) {
        result.push(
          <a key={m.index} href={href} style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", padding: "6px 16px", borderRadius: "22px",
            fontSize: "12px", fontWeight: 700, textDecoration: "none",
            margin: "4px 0", verticalAlign: "middle",
            boxShadow: "0 2px 10px rgba(99,102,241,0.35)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {label}
          </a>
        );
      } else {
        result.push(
          <a key={m.index} href={href} target="_blank" rel="noopener noreferrer"
            style={{ color: "#6366f1", textDecoration: "underline", fontWeight: 600 }}>
            {label}
          </a>
        );
      }
    }
    last = re.lastIndex;
  }

  if (last < text.length) result.push(text.slice(last));
  return result.length ? result : [text];
}

function MarkdownBubble({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let k = 0;

  function flushList() {
    if (!listBuffer.length) return;
    nodes.push(
      <ul key={k++} style={{
        margin: "6px 0", paddingRight: "20px", paddingLeft: 0,
        listStyleType: "disc", display: "flex", flexDirection: "column", gap: "3px",
      }}>
        {listBuffer.map((item, j) => (
          <li key={j} style={{ lineHeight: "1.75" }}>{parseInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  for (const line of lines) {
    const listMatch = line.match(/^[\*\-]\s+(.+)/);
    if (listMatch) { listBuffer.push(listMatch[1]); continue; }
    flushList();
    if (line.trim() === "") {
      if (nodes.length > 0) nodes.push(<div key={k++} style={{ height: "7px" }} />);
    } else {
      nodes.push(
        <div key={k++} style={{ lineHeight: "1.85" }}>{parseInline(line)}</div>
      );
    }
  }
  flushList();
  return <>{nodes}</>;
}

type Bubble = { role: "user" | "assistant"; content: string };

type ChatContext =
  | { kind: "category"; slug: string }
  | { kind: "topic"; topic: string }
  | { kind: "free" }
  | null;

type CategoryItem = { title: string; slug: string; children?: CategoryItem[] };

type ButtonItem =
  | { type: "node"; node: FlowNode }
  | { type: "category"; cat: CategoryItem }
  | { type: "other" }
  | { type: "home" };

interface ChatConfig {
  isEnabled: boolean;
  welcomeMessage: string;
  flow: FlowNode[];
}

// ── Per-site localStorage helpers ──────────────────────────────────────────

function getSiteKey(base: string): string {
  const host = typeof window !== "undefined" ? window.location.host : "unknown";
  return `${base}_${host}`;
}

function readLocalState(): { bubbles: Bubble[]; apiMessages: Bubble[]; conversationId: string | null } | null {
  try {
    const saved = localStorage.getItem(getSiteKey("chat_state"));
    if (!saved) return null;
    const s = JSON.parse(saved);
    if (!s.bubbles?.length) return null;
    return {
      bubbles: s.bubbles,
      apiMessages: s.apiMessages ?? [],
      conversationId: s.conversationId ?? null,
    };
  } catch {
    return null;
  }
}

function writeLocalState(bubbles: Bubble[], apiMessages: Bubble[], conversationId: string | null) {
  try {
    localStorage.setItem(getSiteKey("chat_state"), JSON.stringify({ bubbles, apiMessages, conversationId }));
  } catch {}
}

function clearLocalState() {
  try { localStorage.removeItem(getSiteKey("chat_state")); } catch {}
}

function getSessionId(): string {
  try {
    const key = getSiteKey("chat_session_id");
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ChatConfig | null>(null);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [buttons, setButtons] = useState<ButtonItem[]>([]);
  const [inputMode, setInputMode] = useState(false);
  const [activeContext, setActiveContext] = useState<ChatContext>(null);
  const [apiMessages, setApiMessages] = useState<Bubble[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // "idle" = not determined yet, "guest" = no auth, "member" = logged in
  const [sessionMode, setSessionMode] = useState<"idle" | "guest" | "member">("idle");

  // callback request panel
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackDone, setCallbackDone] = useState(false);
  const [callbackLoading, setCallbackLoading] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const initDoneRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── On first open: two-stage init ────────────────────────────────────────
  // Stage 1: fetch config → show buttons immediately (never blocked by auth)
  // Stage 2: fetch my-chat → if logged in with history, overlay server history
  useEffect(() => {
    if (!open || initDoneRef.current) return;
    initDoneRef.current = true;

    const siteId = typeof window !== "undefined" ? window.location.host : "";

    fetch("/api/store/chat-config")
      .then((r) => r.json())
      .then((cfg: ChatConfig) => {
        setConfig(cfg);
        if (!cfg.isEnabled) return;

        // Always initialize from localStorage first (guest mode default)
        setSessionMode("guest");
        const local = readLocalState();
        if (local) {
          setBubbles(local.bubbles);
          setApiMessages(local.apiMessages);
          conversationIdRef.current = local.conversationId;
          setButtons(flowToButtons(cfg.flow, false));
          setInputMode(false);
          setActiveContext(null);
        } else {
          initRoot(cfg);
        }

        // Stage 2: auth check — non-blocking, failure is safe to ignore
        fetch(`/api/store/my-chat?siteId=${encodeURIComponent(siteId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((myChat: { isLoggedIn: boolean; phone?: string | null; conversationId?: string | null; messages?: { role: string; content: string }[] } | null) => {
            if (!myChat?.isLoggedIn) return; // confirmed guest
            setSessionMode("member");
            if (myChat.phone) setUserPhone(myChat.phone);
            const msgs = myChat.messages ?? [];
            if (myChat.conversationId && msgs.length > 0) {
              const serverBubbles = msgs.map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }));
              setBubbles(serverBubbles);
              setApiMessages(serverBubbles);
              conversationIdRef.current = myChat.conversationId;
              setActiveContext({ kind: "free" });
              setButtons([{ type: "home" }]);
              setInputMode(true);
            }
            // logged in but no history → flow buttons already showing from stage 1
          })
          .catch(() => {}); // my-chat failure never breaks the chat
      })
      .catch(() => {
        setConfig({ isEnabled: true, welcomeMessage: "سلام!", flow: [] });
        setSessionMode("guest");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Persist guest state to site-namespaced localStorage ──────────────────
  useEffect(() => {
    if (sessionMode !== "guest") return;
    if (bubbles.length === 0) return;
    writeLocalState(bubbles, apiMessages, conversationIdRef.current);
  }, [bubbles, apiMessages, sessionMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (inputMode) setTimeout(() => inputRef.current?.focus(), 100);
  }, [bubbles, buttons, inputMode]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function initRoot(cfg: ChatConfig) {
    setBubbles([{ role: "assistant", content: cfg.welcomeMessage }]);
    setButtons(flowToButtons(cfg.flow, false));
    setInputMode(false);
    setActiveContext(null);
    setApiMessages([]);
  }

  function flowToButtons(nodes: FlowNode[], showOther: boolean): ButtonItem[] {
    const items: ButtonItem[] = nodes.map((node) => ({ type: "node", node }));
    if (showOther) items.push({ type: "other" });
    return items;
  }

  function goHome() {
    conversationIdRef.current = null;
    if (sessionMode === "guest") clearLocalState();
    if (config) initRoot(config);
    setCallbackOpen(false);
    setCallbackDone(false);
    setCallbackPhone("");
  }

  async function submitCallback() {
    const phone = (sessionMode === "member" && userPhone ? userPhone : callbackPhone).trim();
    if (!phone) return;
    setCallbackLoading(true);
    try {
      const siteId = typeof window !== "undefined" ? window.location.host : "";
      const res = await fetch("/api/store/callback-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, conversationId: conversationIdRef.current, siteId }),
      });
      if (res.ok) setCallbackDone(true);
    } catch { /* ignore */ }
    setCallbackLoading(false);
  }

  // ── Node / category / other handlers ─────────────────────────────────────

  async function handleNode(node: FlowNode) {
    setBubbles((b) => [...b, { role: "user", content: node.label }]);

    const isMenu = node.children.length > 0;

    if (isMenu) {
      if (node.message?.trim()) {
        setBubbles((b) => [...b, { role: "assistant", content: node.message! }]);
      }
      setButtons(flowToButtons(node.children, !!node.showOther));
      setInputMode(false);
      return;
    }

    const action = node.action ?? { type: "free_text" as const };

    if (node.message?.trim()) {
      setBubbles((b) => [...b, { role: "assistant", content: node.message! }]);
    }

    switch (action.type) {
      case "reply": {
        setBubbles((b) => [
          ...b,
          { role: "assistant", content: action.replyText || "—" },
        ]);
        setButtons([{ type: "home" }]);
        setInputMode(false);
        break;
      }

      case "categories": {
        const cats = await fetchCategories();
        setButtons([
          ...cats.map((cat) => ({ type: "category" as const, cat })),
          { type: "home" },
        ]);
        if (!node.message?.trim()) {
          setBubbles((b) => [
            ...b,
            { role: "assistant", content: "یکی از دسته‌بندی‌های زیر را انتخاب کنید:" },
          ]);
        }
        setInputMode(false);
        break;
      }

      case "connect_context": {
        if (!node.message?.trim()) {
          setBubbles((b) => [
            ...b,
            { role: "assistant", content: "سوال خود را در این زمینه بنویسید:" },
          ]);
        }
        setActiveContext({ kind: "topic", topic: action.contextTopic ?? "" });
        setApiMessages([]);
        setButtons([{ type: "home" }]);
        setInputMode(true);
        break;
      }

      case "free_text":
      default: {
        if (!node.message?.trim()) {
          setBubbles((b) => [
            ...b,
            { role: "assistant", content: "سوال خود را بنویسید:" },
          ]);
        }
        setActiveContext({ kind: "free" });
        setApiMessages([]);
        setButtons([{ type: "home" }]);
        setInputMode(true);
        break;
      }
    }
  }

  function handleCategory(cat: CategoryItem) {
    setBubbles((b) => [
      ...b,
      { role: "user", content: cat.title },
      { role: "assistant", content: `درباره‌ی محصولات «${cat.title}» چه چیزی می‌خواهید بدانید؟` },
    ]);
    setActiveContext({ kind: "category", slug: cat.slug });
    setApiMessages([]);
    setButtons([{ type: "home" }]);
    setInputMode(true);
  }

  function handleOther() {
    setBubbles((b) => [
      ...b,
      { role: "user", content: "سایر" },
      { role: "assistant", content: "سوال خود را بنویسید:" },
    ]);
    setActiveContext({ kind: "free" });
    setApiMessages([]);
    setButtons([{ type: "home" }]);
    setInputMode(true);
  }

  async function fetchCategories(): Promise<CategoryItem[]> {
    try {
      const res = await fetch("/api/store/categories-list");
      if (!res.ok) return [];
      return (await res.json()) as CategoryItem[];
    } catch {
      return [];
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userBubble: Bubble = { role: "user", content: text };
    const nextApi = [...apiMessages, userBubble];

    setBubbles((b) => [...b, userBubble, { role: "assistant", content: "" }]);
    setApiMessages(nextApi);
    setInput("");
    setLoading(true);

    const siteId = typeof window !== "undefined" ? window.location.host : "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextApi,
          context: activeContext,
          sessionId: sessionMode === "guest" ? getSessionId() : null,
          conversationId: conversationIdRef.current,
          siteId,
        }),
      });
      if (!res.ok) throw new Error("server");

      const convId = res.headers.get("X-Conversation-Id");
      if (convId) conversationIdRef.current = convId;

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { text: chunk, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (chunk) {
              assistantText += chunk;
              setBubbles((b) => {
                const u = [...b];
                u[u.length - 1] = { role: "assistant", content: assistantText };
                return u;
              });
            }
          } catch {
            /* skip */
          }
        }
      }

      setApiMessages((m) => [...m, { role: "assistant", content: assistantText }]);
    } catch {
      setBubbles((b) => {
        const u = [...b];
        u[u.length - 1] = {
          role: "assistant",
          content: "متأسفم، مشکلی پیش آمد. دوباره امتحان کنید.",
        };
        return u;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, apiMessages, activeContext, sessionMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (config && !config.isEnabled) return null;

  return (
    <>
      {}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="دستیار خرید"
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          width: "56px", height: "56px", borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {}
      {open && (
        <div dir="rtl" style={{
          position: "fixed", bottom: "92px", right: "24px", zIndex: 9998,
          width: "370px", maxWidth: "calc(100vw - 48px)",
          height: "520px", maxHeight: "calc(100vh - 120px)",
          background: "#fff", borderRadius: "16px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "Tahoma, IRANSans, sans-serif",
        }}>
          <style>{`
            @keyframes tb { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
            .td{display:inline-block;width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:tb 1.2s infinite}
            .td:nth-child(2){animation-delay:.2s}.td:nth-child(3){animation-delay:.4s}
          `}</style>

          {}
          <div style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px",
          }}>
            <div style={{
              width: "36px", height: "36px", background: "rgba(255,255,255,0.2)",
              borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>دستیار خرید</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>
                <span style={{
                  display: "inline-block", width: "7px", height: "7px",
                  background: "#4ade80", borderRadius: "50%", marginLeft: "5px",
                  verticalAlign: "middle",
                }} />
                آنلاین
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.85)", padding: "4px", display: "flex",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px 14px",
            display: "flex", flexDirection: "column", gap: "12px",
            background: "linear-gradient(180deg,#f5f3ff 0%,#f9fafb 60%)",
          }}>
            {!config && (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px", marginTop: "40px" }}>
                در حال بارگذاری...
              </div>
            )}

            {bubbles.map((b, i) => {
              const isUser = b.role === "user";
              return (
                <div key={i} style={{
                  alignSelf: isUser ? "flex-start" : "flex-end",
                  maxWidth: "90%",
                  display: "flex",
                  flexDirection: isUser ? "row" : "row-reverse",
                  alignItems: "flex-end",
                  gap: "7px",
                }}>
                  {!isUser && (
                    <div style={{
                      width: "28px", height: "28px", flexShrink: 0,
                      background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(99,102,241,0.3)",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="white" strokeWidth="2">
                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2zM9 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                      </svg>
                    </div>
                  )}
                  <div style={{
                    background: isUser
                      ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
                    color: isUser ? "#fff" : "#1f2937",
                    borderRadius: isUser
                      ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                    padding: isUser ? "10px 15px" : "12px 16px",
                    fontSize: "13.5px",
                    wordBreak: "break-word",
                    boxShadow: isUser
                      ? "0 3px 10px rgba(99,102,241,0.25)"
                      : "0 2px 10px rgba(0,0,0,0.08)",
                    ...(isUser ? { whiteSpace: "pre-wrap" as const, lineHeight: "1.75" } : {}),
                  }}>
                    {b.content
                      ? (isUser
                          ? b.content
                          : <MarkdownBubble text={b.content} />)
                      : (
                        <span style={{ display: "flex", gap: "4px", alignItems: "center", padding: "2px 0" }}>
                          <span className="td" /><span className="td" /><span className="td" />
                        </span>
                      )
                    }
                  </div>
                </div>
              );
            })}

            {}
            {buttons.length > 0 && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {buttons.map((item, i) => {
                  const label =
                    item.type === "node" ? (item.node.label || "بدون عنوان") :
                    item.type === "category" ? item.cat.title :
                    item.type === "other" ? "سایر (سوال دیگری دارم)" :
                    "↩ بازگشت به منوی اصلی";

                  const onClick = () => {
                    if (item.type === "node") handleNode(item.node);
                    else if (item.type === "category") handleCategory(item.cat);
                    else if (item.type === "other") handleOther();
                    else goHome();
                  };

                  const isHome = item.type === "home";
                  return (
                    <button key={i} onClick={onClick} style={{
                      textAlign: "right", padding: "11px 14px", borderRadius: "12px",
                      background: isHome ? "transparent" : "#fff",
                      border: isHome ? "none" : "1.5px solid #e5e7eb",
                      color: isHome ? "#6366f1" : "#374151",
                      fontSize: "13px", fontWeight: 700, cursor: "pointer",
                      transition: "all 0.15s", fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      if (!isHome) {
                        e.currentTarget.style.borderColor = "#6366f1";
                        e.currentTarget.style.background = "#eef2ff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isHome) {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.background = "#fff";
                      }
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Callback request section ──────────────────────────────────── */}
          {config && config.isEnabled && sessionMode !== "idle" && (
            <div style={{
              borderTop: "1px solid #f3f4f6", background: "#fff",
              padding: callbackOpen && !callbackDone ? "12px 14px" : "8px 14px",
              transition: "padding 0.2s",
            }}>
              {callbackDone ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  background: "#f0fdf4", borderRadius: "10px", padding: "10px 12px",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "#15803d", fontWeight: 700 }}>
                    درخواست ثبت شد. به زودی با شما تماس می‌گیریم.
                  </span>
                </div>
              ) : !callbackOpen ? (
                <button
                  onClick={() => setCallbackOpen(true)}
                  style={{
                    width: "100%", textAlign: "right", background: "none", border: "1.5px dashed #d1d5db",
                    borderRadius: "10px", padding: "8px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", fontFamily: "inherit",
                    color: "#6b7280", fontSize: "12px", fontWeight: 700,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; e.currentTarget.style.background = "#eef2ff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "none"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 3.18 2 2 0 012.1 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.55-.55a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  درخواست تماس کارشناس
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 3.18 2 2 0 012.1 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.55-.55a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#374151" }}>
                      {sessionMode === "member" && userPhone
                        ? "شماره تماس شما:"
                        : "شماره تماس خود را وارد کنید:"}
                    </span>
                  </div>

                  {sessionMode === "member" && userPhone ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <div style={{
                        flex: 1, background: "#f3f4f6", borderRadius: "8px",
                        padding: "9px 12px", fontSize: "13px", direction: "ltr",
                        color: "#374151", fontWeight: 700,
                      }}>
                        {userPhone}
                      </div>
                      <button
                        onClick={submitCallback} disabled={callbackLoading}
                        style={{
                          padding: "9px 16px", borderRadius: "8px", border: "none",
                          background: callbackLoading ? "#c7d2fe" : "#6366f1", color: "#fff",
                          fontSize: "12px", fontWeight: 800, cursor: callbackLoading ? "default" : "pointer",
                          fontFamily: "inherit", flexShrink: 0,
                        }}
                      >
                        {callbackLoading ? "..." : "ثبت درخواست"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="tel" value={callbackPhone}
                        onChange={(e) => setCallbackPhone(e.target.value)}
                        placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
                        onKeyDown={(e) => e.key === "Enter" && submitCallback()}
                        style={{
                          flex: 1, border: "1.5px solid #e5e7eb", borderRadius: "8px",
                          padding: "9px 12px", fontSize: "13px", fontFamily: "inherit",
                          direction: "ltr", outline: "none",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }}
                        onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
                      />
                      <button
                        onClick={submitCallback}
                        disabled={callbackLoading || !callbackPhone.trim()}
                        style={{
                          padding: "9px 14px", borderRadius: "8px", border: "none",
                          background: callbackLoading || !callbackPhone.trim() ? "#c7d2fe" : "#6366f1",
                          color: "#fff", fontSize: "12px", fontWeight: 800,
                          cursor: callbackLoading || !callbackPhone.trim() ? "default" : "pointer",
                          fontFamily: "inherit", flexShrink: 0,
                        }}
                      >
                        {callbackLoading ? "..." : "ثبت"}
                      </button>
                    </div>
                  )}

                  {!(sessionMode === "member" && userPhone) && (
                    <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>
                      در سریع‌ترین زمان کارشناسان ما با شما تماس می‌گیرند
                    </p>
                  )}

                  <button
                    onClick={() => setCallbackOpen(false)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "11px", color: "#9ca3af", textAlign: "right",
                      padding: 0, fontFamily: "inherit",
                    }}
                  >
                    انصراف
                  </button>
                </div>
              )}
            </div>
          )}

          {}
          {inputMode && (
            <div style={{
              padding: "12px", borderTop: callbackOpen || callbackDone ? "none" : "1px solid #f3f4f6",
              display: "flex", gap: "8px", alignItems: "flex-end", background: "#fff",
            }}>
              <textarea
                ref={inputRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="پیام بنویسید..."
                rows={1} disabled={loading}
                style={{
                  flex: 1, border: "1.5px solid #e5e7eb", borderRadius: "10px",
                  padding: "10px 12px", fontSize: "13px", fontFamily: "inherit",
                  resize: "none", lineHeight: "1.5", direction: "rtl",
                  maxHeight: "100px", overflowY: "auto",
                }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: !input.trim() || loading ? "#c7d2fe" : "#6366f1",
                border: "none", cursor: !input.trim() || loading ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
