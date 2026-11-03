"use client";

/**
 * طرح خطی لباس با فلش اندازه‌ها — docs/features/size-guide.md.
 * عمداً با کد کشیده می‌شود نه هوش مصنوعی: عدد و حرف همیشه دقیق و همه‌ی محصولات یکدست.
 * حرف هر فلش از `SIZE_GUIDE_KINDS` می‌آید؛ فقط ستون‌هایی که جدول دارد فلش می‌گیرند.
 */

import { useId } from "react";
import { kindColumn, type SizeGuideKind } from "@/lib/size-guide";
import { SIZE_SHAPES, labelPos } from "@/lib/size-guide-shapes";

export default function SizeGuideDiagram({ kind, keys, active, className = "" }: { kind: SizeGuideKind; keys: string[]; active?: string | null; className?: string }) {
  const uid = useId().replace(/:/g, "");
  if (kind === "custom") return null;
  const shape = SIZE_SHAPES[kind];
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="طرح لباس و محل اندازه‌گیری">
      <defs>
        <marker id={`a${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 Z" className="fill-rose-500 dark:fill-rose-400" />
        </marker>
        <marker id={`b${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 Z" className="fill-primary-600 dark:fill-primary-400" />
        </marker>
      </defs>
      <path d={shape.outline} className="fill-gray-50 stroke-gray-400 dark:fill-white/5 dark:stroke-white/30" strokeWidth="1.4" strokeLinejoin="round" />
      {shape.details.map((d) => (
        <path key={d} d={d} fill="none" className="stroke-gray-300 dark:stroke-white/20" strokeWidth="1" />
      ))}
      {shape.dots?.map(([x, y]) => <circle key={y} cx={x} cy={y} r="1.6" className="fill-gray-300 dark:fill-white/25" />)}
      {keys.map((key) => {
        const l = shape.lines[key];
        const letter = kindColumn(kind, key)?.letter;
        if (!l || !letter) return null;
        const on = active === key;
        const dim = !!active && !on;
        const [mx, my] = labelPos(key, l);
        const tone = on ? "stroke-primary-600 dark:stroke-primary-400" : "stroke-rose-500 dark:stroke-rose-400";
        return (
          <g key={key} opacity={dim ? 0.3 : 1}>
            {l.ticks &&
              (l.y1 === l.y2 ? (
                <path d={`M${l.x1},${l.y1 - 4} L${l.x1},${l.y1 + 18} M${l.x2},${l.y2 - 4} L${l.x2},${l.y2 + 18}`} className="stroke-gray-300 dark:stroke-white/20" strokeWidth="0.8" strokeDasharray="2 2" />
              ) : (
                <path d={`M${l.x1 - 14},${l.y1} L${l.x1 + 4},${l.y1} M${l.x2 - 14},${l.y2} L${l.x2 + 4},${l.y2}`} className="stroke-gray-300 dark:stroke-white/20" strokeWidth="0.8" strokeDasharray="2 2" />
              ))}
            <line {...l} className={tone} strokeWidth={on ? 2.2 : 1.6} markerStart={`url(#${on ? "b" : "a"}${uid})`} markerEnd={`url(#${on ? "b" : "a"}${uid})`} />
            <circle cx={mx} cy={my} r="7.5" className={on ? "fill-primary-600 dark:fill-primary-500" : "fill-rose-500 dark:fill-rose-400"} />
            <text x={mx} y={my + 3.4} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
              {letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
