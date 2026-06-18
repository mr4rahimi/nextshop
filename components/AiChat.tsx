"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FlowNode } from "@/lib/chat-flow";

// ─── انواع ───────────────────────────────────────────────────────────────────
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

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ChatConfig | null>(null);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [buttons, setButtons] = useState<ButtonItem[]>([]);
  const [inputMode, setInputMode] = useState(false);
  const [activeContext, setActiveContext] = useState<ChatContext>(null);

  // پیام‌هایی که واقعاً به مدل می‌رود (در محدوده‌ی context فعلی)
  const [apiMessages, setApiMessages] = useState<Bubble[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── بارگذاری تنظیمات هنگام اولین باز شدن ──────────────────────────────────
  useEffect(() => {
    if (open && !config) {
      fetch("/api/store/chat-config")
        .then((r) => r.json())
        .then((cfg: ChatConfig) => {
          setConfig(cfg);
          if (cfg.isEnabled) initRoot(cfg);
        })
        .catch(() => setConfig({ isEnabled: true, welcomeMessage: "سلام!", flow: [] }));
    }
  }, [open, config]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (inputMode) setTimeout(() => inputRef.current?.focus(), 100);
  }, [bubbles, buttons, inputMode]);

  // ─── شروع از منوی اصلی ─────────────────────────────────────────────────────
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
    if (config) initRoot(config);
  }

  // ─── کلیک روی یک node ──────────────────────────────────────────────────────
  async function handleNode(node: FlowNode) {
    // حباب انتخاب کاربر
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

    // برگ → بر اساس action
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

  // ─── کلیک روی یک دسته‌بندی ─────────────────────────────────────────────────
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

  // ─── دکمه‌ی سایر ───────────────────────────────────────────────────────────
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

  // ─── دریافت دسته‌بندی‌ها ────────────────────────────────────────────────────
  async function fetchCategories(): Promise<CategoryItem[]> {
    try {
      const res = await fetch("/api/store/categories-list");
      if (!res.ok) return [];
      return (await res.json()) as CategoryItem[];
    } catch {
      return [];
    }
  }

  // ─── ارسال پیام متنی به مدل ─────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userBubble: Bubble = { role: "user", content: text };
    const nextApi = [...apiMessages, userBubble];

    setBubbles((b) => [...b, userBubble, { role: "assistant", content: "" }]);
    setApiMessages(nextApi);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextApi, context: activeContext }),
      });
      if (!res.ok) throw new Error("server");

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
  }, [input, loading, apiMessages, activeContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // اگه چت غیرفعاله، چیزی نشون نده
  if (config && !config.isEnabled) return null;

  return (
    <>
      {/* دکمه‌ی شناور */}
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

      {/* پاپ‌آپ */}
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

          {/* هدر */}
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

          {/* بدنه */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px",
            display: "flex", flexDirection: "column", gap: "10px",
            background: "#f9fafb",
          }}>
            {!config && (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px", marginTop: "40px" }}>
                در حال بارگذاری...
              </div>
            )}

            {bubbles.map((b, i) => (
              <div key={i} style={{
                alignSelf: b.role === "user" ? "flex-start" : "flex-end",
                maxWidth: "85%",
                background: b.role === "user"
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
                color: b.role === "user" ? "#fff" : "#1f2937",
                borderRadius: b.role === "user"
                  ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "10px 14px", fontSize: "13.5px", lineHeight: "1.8",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                boxShadow: b.role === "assistant" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}>
                {b.content || (
                  <span style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <span className="td" /><span className="td" /><span className="td" />
                  </span>
                )}
              </div>
            ))}

            {/* دکمه‌های مرحله‌ی فعلی */}
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

          {/* ورودی متنی — فقط در حالت inputMode */}
          {inputMode && (
            <div style={{
              padding: "12px", borderTop: "1px solid #f3f4f6",
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