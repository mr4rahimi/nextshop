"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("خطا در ارتباط با سرور");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + text,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "متأسفم، مشکلی پیش آمد. لطفاً دوباره امتحان کنید.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  const unreadCount = messages.filter((m) => m.role === "assistant").length;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="دستیار خرید"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px", // RTL: left side
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {/* Notification dot */}
        {!open && unreadCount === 0 && (
          <span
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              width: "10px",
              height: "10px",
              background: "#22c55e",
              borderRadius: "50%",
              border: "2px solid white",
            }}
          />
        )}
      </button>

      {/* Chat Popup */}
      {open && (
        <div
          dir="rtl"
          style={{
            position: "fixed",
            bottom: "92px",
            right: "24px",
            zIndex: 9998,
            width: "360px",
            maxWidth: "calc(100vw - 48px)",
            height: "480px",
            maxHeight: "calc(100vh - 120px)",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "Tahoma, IRANSans, sans-serif",
            animation: "chatSlideUp 0.25s ease",
          }}
        >
          <style>{`
            @keyframes chatSlideUp {
              from { opacity: 0; transform: translateY(16px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .chat-msg-user {
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              color: #fff;
              border-radius: 16px 16px 4px 16px;
              align-self: flex-start;
              max-width: 80%;
              padding: 10px 14px;
              font-size: 14px;
              line-height: 1.7;
              word-break: break-word;
            }
            .chat-msg-assistant {
              background: #f3f4f6;
              color: #1f2937;
              border-radius: 16px 16px 16px 4px;
              align-self: flex-end;
              max-width: 85%;
              padding: 10px 14px;
              font-size: 14px;
              line-height: 1.7;
              word-break: break-word;
            }
            .chat-input:focus { outline: none; }
            .chat-send-btn:hover:not(:disabled) { background: #5558e8 !important; }
            .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .typing-dot {
              display: inline-block;
              width: 6px; height: 6px;
              background: #9ca3af;
              border-radius: 50%;
              animation: typingBounce 1.2s infinite ease-in-out;
            }
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typingBounce {
              0%, 80%, 100% { transform: translateY(0); }
              40% { transform: translateY(-6px); }
            }
          `}</style>

          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>
                دستیار خرید
              </div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "7px",
                    height: "7px",
                    background: "#4ade80",
                    borderRadius: "50%",
                    marginLeft: "5px",
                    verticalAlign: "middle",
                  }}
                />
                آنلاین
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.8)",
                padding: "4px",
                display: "flex",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "13px",
                  marginTop: "32px",
                  lineHeight: "2",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛍️</div>
                سلام! من دستیار خرید این فروشگاه هستم.
                <br />
                درباره هر محصولی سوال داری بپرس!
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={msg.role === "user" ? "chat-msg-user" : "chat-msg-assistant"}
              >
                {msg.content || (
                  // Typing indicator
                  <span style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid #f3f4f6",
              display: "flex",
              gap: "8px",
              alignItems: "flex-end",
              background: "#fff",
            }}
          >
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="پیام بنویسید..."
              rows={1}
              style={{
                flex: 1,
                border: "1.5px solid #e5e7eb",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "none",
                lineHeight: "1.5",
                direction: "rtl",
                maxHeight: "100px",
                overflowY: "auto",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="chat-send-btn"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#6366f1",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}