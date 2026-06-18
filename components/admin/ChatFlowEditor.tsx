"use client";

import { useState } from "react";
import {
  FlowNode,
  FlowActionType,
  ACTION_TYPES,
  CONTEXT_TOPICS,
  createNode,
  updateNodeById,
  removeNodeById,
  addChildToNode,
  moveNodeInSiblings,
  getNodeIssues,
} from "@/lib/chat-flow";

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all";

const DEPTH_BORDERS = [
  "border-blue-300 dark:border-blue-500/40",
  "border-emerald-300 dark:border-emerald-500/40",
  "border-amber-300 dark:border-amber-500/40",
  "border-pink-300 dark:border-pink-500/40",
  "border-violet-300 dark:border-violet-500/40",
];

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function NodeEditor({
  node,
  depth,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
}: {
  node: FlowNode;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (updater: (n: FlowNode) => FlowNode) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);
  const isMenu = node.children.length > 0;
  const issues = getNodeIssues(node);
  const borderColor = DEPTH_BORDERS[depth % DEPTH_BORDERS.length];

  const updateChildren = (next: FlowNode[]) =>
    onChange((n) => ({ ...n, children: next }));

  function addChild() {
    onChange((n) => ({ ...n, children: [...n.children, createNode()] }));
    setOpen(true);
  }

  return (
    <div className={`rounded-2xl border-2 ${borderColor} bg-white dark:bg-[#0f1117]`}>
      {}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-gray-400 hover:text-gray-600 transition-all shrink-0"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <input
          value={node.label}
          onChange={(e) => onChange((n) => ({ ...n, label: e.target.value }))}
          className={`${inputClass} flex-1 font-black`}
          placeholder="متن دکمه (مثلاً: مشاوره خرید محصول)"
        />

        {}
        <span
          className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black ${
            isMenu
              ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {isMenu ? "منو" : "مقصد"}
        </span>

        {}
        <div className="flex flex-col shrink-0">
          <button
            onClick={() => onMove(-1)} disabled={isFirst}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            onClick={() => onMove(1)} disabled={isLast}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {}
        <button
          onClick={onRemove}
          className="text-red-300 hover:text-red-600 transition-all shrink-0"
          title="حذف"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {}
      {issues.length > 0 && (
        <div className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
          ⚠ {issues.join(" • ")}
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {}
          <div className="space-y-1">
            <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400">
              پیام هنگام کلیک (اختیاری)
            </label>
            <textarea
              value={node.message ?? ""}
              onChange={(e) => onChange((n) => ({ ...n, message: e.target.value }))}
              rows={2}
              className={inputClass}
              placeholder="مثلاً: لطفاً یکی از موارد زیر را انتخاب کنید"
            />
          </div>

          {}
          {!isMenu && (
            <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]">
              <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400">
                وقتی کاربر این دکمه را زد:
              </label>
              <select
                value={node.action?.type ?? "free_text"}
                onChange={(e) =>
                  onChange((n) => ({
                    ...n,
                    action: { ...n.action, type: e.target.value as FlowActionType },
                  }))
                }
                className={inputClass}
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400">
                {ACTION_TYPES.find((a) => a.value === (node.action?.type ?? "free_text"))?.desc}
              </p>

              {}
              {node.action?.type === "connect_context" && (
                <select
                  value={node.action.contextTopic ?? ""}
                  onChange={(e) =>
                    onChange((n) => ({
                      ...n,
                      action: { ...n.action!, contextTopic: e.target.value },
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">— موضوع را انتخاب کنید —</option>
                  {CONTEXT_TOPICS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}

              {node.action?.type === "reply" && (
                <textarea
                  value={node.action.replyText ?? ""}
                  onChange={(e) =>
                    onChange((n) => ({
                      ...n,
                      action: { ...n.action!, replyText: e.target.value },
                    }))
                  }
                  rows={3}
                  className={inputClass}
                  placeholder="متن پاسخ ثابت که به کاربر نشان داده می‌شود..."
                />
              )}
            </div>
          )}

          {}
          {isMenu && (
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => onChange((n) => ({ ...n, showOther: !n.showOther }))}
                className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${
                  node.showOther ? "bg-blue-600" : "bg-gray-300 dark:bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    node.showOther ? "right-0.5" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">
                نمایش دکمه‌ی «سایر» در این مرحله (سوال آزاد)
              </span>
            </label>
          )}

          {}
          {node.children.length > 0 && (
            <div className="space-y-2 pr-3 border-r-2 border-dashed border-gray-200 dark:border-white/10">
              {node.children.map((child, i) => (
                <NodeEditor
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  isFirst={i === 0}
                  isLast={i === node.children.length - 1}
                  onChange={(updater) =>
                    updateChildren(updateNodeById(node.children, child.id, updater))
                  }
                  onRemove={() => updateChildren(removeNodeById(node.children, child.id))}
                  onMove={(dir) => updateChildren(moveNodeInSiblings(node.children, child.id, dir))}
                />
              ))}
            </div>
          )}

          {}
          <button
            onClick={addChild}
            className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-400 hover:text-blue-500 hover:border-blue-300 text-xs font-black transition-all"
          >
            + افزودن زیردکمه{isMenu ? "" : " (تبدیل به منو)"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function FlowPreview({ flow, welcome }: { flow: FlowNode[]; welcome: string }) {
  const [stack, setStack] = useState<FlowNode[]>([]);
  const current = stack.length ? stack[stack.length - 1].children : flow;
  const currentParent = stack[stack.length - 1];

  function reset() {
    setStack([]);
  }

  return (
    <div className="rounded-2xl bg-gray-100 dark:bg-black/30 p-4 min-h-[360px] flex flex-col">
      {}
      <div className="bg-white dark:bg-white/10 rounded-2xl rounded-tr-sm px-3 py-2 text-xs text-gray-700 dark:text-gray-200 max-w-[85%] mb-3 leading-6">
        {currentParent?.message?.trim()
          ? currentParent.message
          : currentParent
          ? "یکی از موارد زیر را انتخاب کنید:"
          : welcome || "سلام! چطور می‌تونم کمکت کنم؟"}
      </div>

      {}
      <div className="space-y-2 mt-auto">
        {current.map((node) => {
          const isLeaf = node.children.length === 0;
          return (
            <button
              key={node.id}
              onClick={() => {
                if (!isLeaf) setStack((s) => [...s, node]);
              }}
              className="w-full text-right px-3 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-black text-gray-700 dark:text-gray-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all flex items-center justify-between"
            >
              <span>{node.label || "بدون عنوان"}</span>
              {isLeaf ? (
                <span className="text-[9px] font-bold text-gray-400">
                  {node.action?.type === "categories" && "← دسته‌بندی‌ها"}
                  {node.action?.type === "connect_context" &&
                    `← ${CONTEXT_TOPICS.find((t) => t.value === node.action?.contextTopic)?.label ?? "موضوع"}`}
                  {node.action?.type === "reply" && "← پاسخ ثابت"}
                  {node.action?.type === "free_text" && "← سوال آزاد"}
                </span>
              ) : (
                <span className="text-[9px] font-bold text-gray-400">←</span>
              )}
            </button>
          );
        })}

        {}
        {currentParent?.showOther && (
          <button className="w-full text-right px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/15 text-xs font-black text-gray-500 flex items-center justify-between">
            <span>سایر (سوال خود را بنویسید)</span>
            <span className="text-[9px] font-bold text-gray-400">← سوال آزاد</span>
          </button>
        )}

        {current.length === 0 && !currentParent?.showOther && (
          <p className="text-[11px] text-gray-400 text-center py-6">
            دکمه‌ای در این سطح تعریف نشده
          </p>
        )}

        {}
        {stack.length > 0 && (
          <button
            onClick={() => setStack((s) => s.slice(0, -1))}
            className="w-full px-3 py-2 rounded-xl text-[11px] font-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
          >
            ↩ بازگشت
          </button>
        )}
      </div>

      {stack.length > 0 && (
        <button
          onClick={reset}
          className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 transition-all"
        >
          بازنشانی پیش‌نمایش
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatFlowEditor({
  value,
  welcomeMessage,
  onChange,
}: {
  value: FlowNode[];
  welcomeMessage: string;
  onChange: (next: FlowNode[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {}
      <div className="xl:col-span-2 space-y-3">
        {value.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            هنوز دکمه‌ای تعریف نشده. اولین دکمه‌ی منوی اصلی را اضافه کنید.
          </p>
        ) : (
          value.map((node, i) => (
            <NodeEditor
              key={node.id}
              node={node}
              depth={0}
              isFirst={i === 0}
              isLast={i === value.length - 1}
              onChange={(updater) => onChange(updateNodeById(value, node.id, updater))}
              onRemove={() => onChange(removeNodeById(value, node.id))}
              onMove={(dir) => onChange(moveNodeInSiblings(value, node.id, dir))}
            />
          ))
        )}

        <button
          onClick={() => onChange([...value, createNode()])}
          className="w-full py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-black hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
        >
          + افزودن دکمه‌ی منوی اصلی
        </button>
      </div>

      {}
      <div className="xl:col-span-1">
        <div className="sticky top-8">
          <p className="text-xs font-black text-gray-400 mb-2">پیش‌نمایش زنده</p>
          <FlowPreview flow={value} welcome={welcomeMessage} />
        </div>
      </div>
    </div>
  );
}
