"use client";

/**
 * بوم چارت لینک‌سازی — الگوبرداری از `link-chart-canvas.tsx` برتر.
 *
 * SVG دستی است، نه کتابخانه‌ی دیاگرام (بخش ۷.۳): گراف لایه‌ای است و جای هر
 * گره از لایه‌اش درمی‌آید؛ خروجی SVG تمیز هم می‌ماند تا بشود عکسش را فرستاد.
 *
 * **هیچ منطق تازه‌ای اینجا نیست** — همان داده‌ی جدول با نمای دیگر. چیدمان
 * خودکار از `lib/marketing/link-graph.ts` می‌آید (همان تابع خالصی که آزمون
 * دارد) و تنها نوشتنیِ بوم مختصات است.
 *
 * چهار تله که اینجا بسته شده‌اند:
 * - **متن داخل SVG صریحاً `direction="rtl"` و از لبه‌ی راست لنگر می‌گیرد.**
 *   جهت صفحه به SVG ارث می‌رسد و `text-anchor: start` در راست‌به‌چپ یعنی «به
 *   چپِ x بنویس»؛ بدون این، برچسب‌ها بیرون مستطیل می‌افتادند.
 * - **خودِ بوم آینه نمی‌شود** — وگرنه معنی فلش‌ها عوض می‌شود.
 * - **درگ در `ref` می‌ماند نه state** — هر حرکت ماوس یک رندر اضافه می‌ساخت.
 * - **(۰،۰) دو معنی دارد** (تله‌ی ۶): گره‌ای که بعد از ذخیره‌ی چیدمان ساخته
 *   شده جای خودکارش را می‌گیرد تا زیر صفحه‌ی هدف پنهان نشود.
 *
 * روی موبایل فقط خواندنی است: زوم، پن و ضربه روی گره.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Expand, Globe, LayoutGrid, Scan, Shrink, ZoomIn, ZoomOut } from "lucide-react";
import { LAYOUT, autoLayout } from "@/lib/marketing/link-graph";
import { NODE_STATUS_LABELS, NODE_STATUS_SVG, type LinkNodeStatus } from "@/lib/marketing/link-constants";
import { LinkTypeIcon } from "./link-icons";
import { btn, cn, fa, send, useToast } from "./ui";
import type { CanvasData, CanvasNode, CanvasTarget } from "./link-client-types";

const NODE_W = LAYOUT.nodeWidth;
const NODE_H = LAYOUT.nodeHeight;
const TARGET_W = LAYOUT.targetWidth;
const TARGET_H = LAYOUT.targetHeight;
/** حاشیه‌ی دور محتوا وقتی بوم «اندازه‌ی صفحه» می‌شود */
const FRAME_PAD = 56;
/** جای سرستون‌ها («لایه ۱»، «صفحه‌های هدف») بالای گره‌ها */
const HEADER_SPACE = 44;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;

const toneOf = (status: LinkNodeStatus | string) =>
  NODE_STATUS_SVG[status as LinkNodeStatus] ?? NODE_STATUS_SVG.PLANNED;
/** یک مارکر فلش برای هر رنگ — `context-stroke` هنوز در همه‌ی مرورگرها نیست */
const MARKERS = [
  { key: "planned", color: NODE_STATUS_SVG.PLANNED.stroke },
  { key: "progress", color: NODE_STATUS_SVG.ASSIGNED.stroke },
  { key: "pending", color: NODE_STATUS_SVG.SUBMITTED.stroke },
  { key: "live", color: NODE_STATUS_SVG.LIVE.stroke },
  { key: "failed", color: NODE_STATUS_SVG.FAILED.stroke },
];

/** راهنما — «در حال انجام» با «واگذارشده» یک رنگ است */
const LEGEND: { label: string; statuses: LinkNodeStatus[]; tone: LinkNodeStatus }[] = [
  { label: NODE_STATUS_LABELS.PLANNED, statuses: ["PLANNED"], tone: "PLANNED" },
  { label: "دست کارمند", statuses: ["ASSIGNED", "IN_PROGRESS"], tone: "ASSIGNED" },
  { label: NODE_STATUS_LABELS.SUBMITTED, statuses: ["SUBMITTED"], tone: "SUBMITTED" },
  { label: NODE_STATUS_LABELS.LIVE, statuses: ["LIVE"], tone: "LIVE" },
  { label: "شکست / ازدست‌رفته", statuses: ["FAILED", "LOST"], tone: "FAILED" },
];

type Placement = { id: string; kind: "node" | "target"; posX: number; posY: number };
type Point = { x: number; y: number };
type Frame = { minX: number; minY: number; width: number; height: number };

const mean = (values: number[], fallback: number) =>
  values.length === 0 ? fallback : values.reduce((s, v) => s + v, 0) / values.length;

function layoutOf(data: CanvasData): Placement[] {
  return autoLayout({ nodes: data.nodes, targets: data.targets, edges: data.edges });
}

/** قاب دور همه‌ی گره‌ها — مبنای «اندازه‌ی صفحه» و viewBox */
function frameOf(positions: Map<string, Point>, data: CanvasData): Frame {
  const targetIds = new Set(data.targets.map((t) => t.id));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [id, p] of positions) {
    const w = targetIds.has(id) ? TARGET_W : NODE_W;
    const h = targetIds.has(id) ? TARGET_H : NODE_H;
    minX = Math.min(minX, p.x - w / 2);
    maxX = Math.max(maxX, p.x + w / 2);
    minY = Math.min(minY, p.y - h / 2);
    maxY = Math.max(maxY, p.y + h / 2);
  }
  if (!Number.isFinite(minX)) return { minX: -400, minY: -200, width: 800, height: 400 };
  return {
    minX: minX - FRAME_PAD,
    minY: minY - FRAME_PAD - HEADER_SPACE,
    width: maxX - minX + FRAME_PAD * 2,
    height: maxY - minY + FRAME_PAD * 2 + HEADER_SPACE,
  };
}

/** منحنی بزیه‌ی افقی بین دو مستطیل — از لبه به لبه، نه از مرکز */
function edgePath(from: Point, fromW: number, to: Point, toW: number) {
  const rightward = to.x > from.x;
  const startX = from.x + (rightward ? fromW / 2 : -fromW / 2);
  const endX = to.x + (rightward ? -toW / 2 - 4 : toW / 2 + 4);
  const bend = Math.max(40, Math.abs(endX - startX) * 0.5);
  const c1 = startX + (rightward ? bend : -bend);
  const c2 = endX + (rightward ? -bend : bend);
  return `M ${startX} ${from.y} C ${c1} ${from.y}, ${c2} ${to.y}, ${endX} ${to.y}`;
}

/** برش متن بر حسب تعداد نویسه — SVG خودش متن را نمی‌شکند */
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function pathOf(url: string) {
  try {
    return decodeURI(new URL(url).pathname);
  } catch {
    return url;
  }
}

export default function LinkChartCanvas({
  campaignId,
  data,
  canManage,
  onSelectNode,
}: {
  campaignId: string;
  data: CanvasData;
  canManage: boolean;
  onSelectNode: (nodeId: string) => void;
}) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Map<string, Point>>(new Map());
  const [frame, setFrame] = useState<Frame | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [width, setWidth] = useState(1000);
  const [fullscreen, setFullscreen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const drag = useRef<{
    id: string;
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number; unit: number } | null>(
    null,
  );

  /**
   * زوم اولیه: روی دسکتاپ کل چارت، روی موبایل اندازه‌ای که متن گره خوانا
   * باشد — کل چارت در عرض ۳۶۰ پیکسل ریز و بی‌فایده است.
   */
  const openAt = useCallback((next: Frame) => {
    const available = wrapRef.current?.clientWidth ?? 1000;
    setZoom(available < 640 ? Math.min(MAX_ZOOM, Math.max(1, (0.6 * next.width) / available)) : 1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const auto = new Map(layoutOf(data).map((p) => [p.id, { x: p.posX, y: p.posY }]));

    if (data.isPristine) {
      const initial = frameOf(auto, data);
      setPositions(auto);
      setFrame(initial);
      openAt(initial);
      setIsDirty(data.nodes.length > 0);
      return;
    }

    // چیدمان ذخیره‌شده مبناست، ولی گره‌ای که بعد از آن ساخته شده (۰،۰)
    // دارد و روی صفحه‌ی هدف می‌افتد — جای خودکارش را می‌گیرد
    const next = new Map<string, Point>();
    let placedFresh = false;
    for (const node of data.nodes) {
      if (node.posX === 0 && node.posY === 0 && auto.has(node.id)) {
        next.set(node.id, auto.get(node.id)!);
        placedFresh = true;
      } else {
        next.set(node.id, { x: node.posX, y: node.posY });
      }
    }
    // صفحه‌ی هدفی که بعد از ذخیره اضافه شده هم (۰،۰) است؛ ولی اولین صفحه
    // ممکن است واقعاً همان‌جا باشد، پس فقط صفحه‌های **دوم به بعد** روی (۰،۰)
    // جای خودکار می‌گیرند
    let originTaken = false;
    for (const t of data.targets) {
      const atOrigin = t.posX === 0 && t.posY === 0;
      if (atOrigin && originTaken && auto.has(t.id)) {
        next.set(t.id, auto.get(t.id)!);
        placedFresh = true;
      } else {
        next.set(t.id, { x: t.posX, y: t.posY });
        if (atOrigin) originTaken = true;
      }
    }

    const initial = frameOf(next, data);
    setPositions(next);
    setFrame(initial);
    openAt(initial);
    setIsDirty(placedFresh);
  }, [data, openAt]);

  // عرض واقعی ظرف، تا ارتفاع بوم با نسبت محتوا جور شود
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // زوم با چرخ فقط همراه Ctrl — وگرنه اسکرول صفحه در بوم گیر می‌کند
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  /** ویرایش چارت کار مدیر پشت دسکتاپ است؛ درگ دقیق روی صفحه‌ی کوچک فقط خرابش می‌کند */
  const editable = canManage && width >= 640;

  const svgHeight = useMemo(() => {
    if (!frame) return 520;
    return Math.round(Math.min(760, Math.max(460, (width * frame.height) / frame.width)));
  }, [frame, width]);

  const viewBox = useMemo(() => {
    if (!frame) return "0 0 1000 500";
    const w = frame.width / zoom;
    const h = frame.height / zoom;
    const cx = frame.minX + frame.width / 2 - pan.x;
    const cy = frame.minY + frame.height / 2 - pan.y;
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  }, [frame, zoom, pan]);

  /** مختصات صفحه به مختصات بوم — با ماتریس خود SVG، پس زوم و meet هر دو درست‌اند */
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /** همسایه‌های گره‌ی زیر ماوس — بقیه کم‌رنگ می‌شوند */
  const related = useMemo(() => {
    if (!hovered) return null;
    const ids = new Set([hovered]);
    const edges = new Set<string>();
    for (const e of data.edges) {
      const to = e.toNodeId ?? e.toTargetId;
      if (e.fromNodeId === hovered || to === hovered) {
        ids.add(e.fromNodeId);
        if (to) ids.add(to);
        edges.add(e.id);
      }
    }
    return { ids, edges };
  }, [hovered, data]);

  /** سرستون‌ها از جای واقعی گره‌ها — بعد از جابه‌جایی دستی هم درست می‌مانند */
  const columnHeaders = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const node of data.nodes) {
      const p = positions.get(node.id);
      if (!p || node.tier === null) continue;
      const key = `${Math.sign(p.x) || 1}:${node.tier}`;
      const list = groups.get(key);
      if (list) list.push(p.x);
      else groups.set(key, [p.x]);
    }
    const headers = [...groups.entries()].map(([key, xs]) => ({
      key,
      x: mean(xs, 0),
      label: `لایه ${fa(Number(key.split(":")[1]))}`,
      count: xs.length,
    }));
    const targetXs = data.targets.map((t) => positions.get(t.id)?.x ?? 0);
    if (targetXs.length > 0) {
      headers.push({ key: "targets", x: mean(targetXs, 0), label: "صفحه‌های هدف", count: targetXs.length });
    }
    return headers;
  }, [data, positions]);

  const incomingCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data.edges) {
      const to = e.toNodeId ?? e.toTargetId;
      if (to) counts.set(to, (counts.get(to) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const onItemPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const p = toCanvas(e.clientX, e.clientY);
    const cur = positions.get(id) ?? { x: 0, y: 0 };
    drag.current = { id, dx: p.x - cur.x, dy: p.y - cur.y, startX: e.clientX, startY: e.clientY, moved: false };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const state = drag.current;
      if (!state.moved && Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 5) return;
      state.moved = true;
      if (!editable) return;
      const p = toCanvas(e.clientX, e.clientY);
      setPositions((cur) => {
        const next = new Map(cur);
        next.set(state.id, { x: Math.round(p.x - state.dx), y: Math.round(p.y - state.dy) });
        return next;
      });
      setIsDirty(true);
      return;
    }
    if (panStart.current) {
      const s = panStart.current;
      setPan({ x: s.panX + (e.clientX - s.x) * s.unit, y: s.panY + (e.clientY - s.y) * s.unit });
    }
  };

  const endPointer = () => {
    const state = drag.current;
    // ضربه بدون جابه‌جایی = باز کردن گره؛ روی موبایل دابل‌کلیک نیست
    if (state && !state.moved && data.nodes.some((n) => n.id === state.id)) onSelectNode(state.id);
    drag.current = null;
    panStart.current = null;
    setIsPanning(false);
  };

  const startPan = (e: React.PointerEvent) => {
    const matrix = svgRef.current?.getScreenCTM();
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, unit: matrix ? 1 / matrix.a : 1 };
    setIsPanning(true);
  };

  const fitView = () => {
    setFrame(frameOf(positions, data));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const applyAutoLayout = () => {
    const next = new Map(layoutOf(data).map((p) => [p.id, { x: p.posX, y: p.posY }]));
    setPositions(next);
    setFrame(frameOf(next, data));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDirty(true);
  };

  const save = async () => {
    const placements: Placement[] = [
      ...data.nodes.map((n) => ({
        id: n.id,
        kind: "node" as const,
        posX: positions.get(n.id)?.x ?? 0,
        posY: positions.get(n.id)?.y ?? 0,
      })),
      ...data.targets.map((t) => ({
        id: t.id,
        kind: "target" as const,
        posX: positions.get(t.id)?.x ?? 0,
        posY: positions.get(t.id)?.y ?? 0,
      })),
    ];
    setSaving(true);
    try {
      await send(`/api/admin/worklist/links/campaigns/${campaignId}/layout`, "PUT", { placements });
      setIsDirty(false);
      toast("چیدمان ذخیره شد");
    } catch (e) {
      toast(e instanceof Error ? e.message : "ذخیره نشد", "error");
    } finally {
      setSaving(false);
    }
  };

  if (data.nodes.length === 0 && data.targets.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900">
        <p className="text-[13px] text-gray-500">هنوز چیزی برای نمایش نیست</p>
      </div>
    );
  }

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const targetIds = new Set(data.targets.map((t) => t.id));
  const statusCount = (statuses: LinkNodeStatus[]) => data.nodes.filter((n) => statuses.includes(n.status)).length;
  const tool =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-white/5";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900",
        fullscreen && "fixed inset-2 z-50 shadow-2xl md:inset-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-white/10 p-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))} className={tool} title="بزرگ‌نمایی">
            <ZoomIn className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))} className={tool} title="کوچک‌نمایی">
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="w-12 text-center text-[12px] font-bold tabular-nums text-gray-500">
            {fa(Math.round(zoom * 100))}٪
          </span>
          <button type="button" onClick={fitView} className={tool} title="اندازه‌ی صفحه">
            <Scan className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className={tool}
            title={fullscreen ? "خروج از تمام‌صفحه (Esc)" : "تمام‌صفحه"}
          >
            {fullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
          </button>
        </div>

        {editable && (
          <>
            <span className="mx-1 h-6 w-px bg-gray-200 dark:bg-white/10" />
            <button
              type="button"
              onClick={applyAutoLayout}
              className="flex h-9 items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-3 text-[12.5px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
              چیدمان خودکار
            </button>
            {isDirty && (
              <button type="button" onClick={save} disabled={saving} className={cn(btn.primary, "h-9")}>
                {saving ? "در حال ذخیره..." : "ذخیره‌ی چیدمان"}
              </button>
            )}
          </>
        )}

        <span className="mr-auto hidden text-[11.5px] text-gray-400 sm:inline">
          {editable
            ? "کشیدن گره = جابه‌جایی · ضربه = جزئیات · Ctrl+چرخ = زوم"
            : "ضربه روی گره = جزئیات · Ctrl+چرخ = زوم"}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={fullscreen ? undefined : { height: svgHeight }}
        className={cn(
          "block w-full touch-none select-none bg-gray-50/60 dark:bg-black/20",
          fullscreen && "min-h-0 flex-1",
          isPanning ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerLeave={endPointer}
      >
        <defs>
          <pattern id="link-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.3" className="fill-gray-300/60 dark:fill-white/10" />
          </pattern>
          {MARKERS.map((m) => (
            <marker
              key={m.key}
              id={`link-arrow-${m.key}`}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 11 6 L 1 11 z" fill={m.color} />
            </marker>
          ))}
          <filter id="link-shadow" x="-10%" y="-20%" width="120%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {frame && (
          <rect
            x={frame.minX - frame.width * 4}
            y={frame.minY - frame.height * 4}
            width={frame.width * 9}
            height={frame.height * 9}
            fill="url(#link-grid)"
          />
        )}

        {frame &&
          columnHeaders.map((h) => (
            <g key={h.key}>
              {h.key === "targets" && (
                <rect
                  x={h.x - TARGET_W / 2 - 20}
                  y={frame.minY + 8}
                  width={TARGET_W + 40}
                  height={frame.height - 16}
                  rx={18}
                  className="fill-blue-500/[0.04] stroke-blue-500/25"
                  strokeDasharray="6 6"
                />
              )}
              <text
                x={h.x}
                y={frame.minY + 36}
                textAnchor="middle"
                direction="rtl"
                className={cn(
                  "text-[14px] font-extrabold",
                  h.key === "targets" ? "fill-blue-600 dark:fill-blue-400" : "fill-gray-500",
                )}
              >
                {h.label} · {fa(h.count)}
              </text>
            </g>
          ))}

        {/* یال‌ها زیر گره‌ها کشیده می‌شوند تا از رویشان رد نشوند */}
        <g>
          {data.edges.map((e) => {
            const toId = e.toNodeId ?? e.toTargetId ?? "";
            const from = positions.get(e.fromNodeId);
            const to = positions.get(toId);
            const source = nodeById.get(e.fromNodeId);
            if (!from || !to || !source) return null;
            const tone = toneOf(source.status);
            const isRelated = related?.edges.has(e.id);
            const dimmed = related && !isRelated;
            return (
              <path
                key={e.id}
                d={edgePath(from, NODE_W, to, targetIds.has(toId) ? TARGET_W : NODE_W)}
                fill="none"
                stroke={tone.stroke}
                strokeWidth={isRelated ? 3.2 : 2}
                strokeDasharray={source.relFollow ? undefined : "7 5"}
                strokeLinecap="round"
                opacity={dimmed ? 0.12 : isRelated ? 1 : 0.7}
                markerEnd={`url(#link-arrow-${tone.key})`}
              />
            );
          })}
        </g>

        {data.targets.map((t) => (
          <TargetShape
            key={t.id}
            target={t}
            position={positions.get(t.id)}
            incoming={incomingCount.get(t.id) ?? 0}
            dimmed={Boolean(related && !related.ids.has(t.id))}
            canManage={editable}
            onPointerDown={(e) => onItemPointerDown(e, t.id)}
            onHover={setHovered}
          />
        ))}

        {data.nodes.map((n) => (
          <NodeShape
            key={n.id}
            node={n}
            position={positions.get(n.id)}
            incoming={incomingCount.get(n.id) ?? 0}
            dimmed={Boolean(related && !related.ids.has(n.id))}
            canManage={editable}
            onPointerDown={(e) => onItemPointerDown(e, n.id)}
            onHover={setHovered}
          />
        ))}
      </svg>

      {/* راهنما: رنگ = وضعیت با شمارش، خط = فالو/نوفالو */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 dark:border-white/10 px-4 py-3">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-[12px] text-gray-500">
            <span
              className="h-3.5 w-3.5 rounded-[4px] border-2"
              style={{ background: toneOf(item.tone).fill, borderColor: toneOf(item.tone).stroke }}
            />
            {item.label}
            <span className="font-bold tabular-nums text-gray-900 dark:text-white">
              {fa(statusCount(item.statuses))}
            </span>
          </span>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-gray-200 dark:bg-white/10 sm:block" />
        <span className="flex items-center gap-2 text-[12px] text-gray-500">
          <svg width="30" height="8" aria-hidden>
            <line x1="1" y1="4" x2="29" y2="4" stroke="currentColor" strokeWidth="2.2" />
          </svg>
          فالو
        </span>
        <span className="flex items-center gap-2 text-[12px] text-gray-500">
          <svg width="30" height="8" aria-hidden>
            <line x1="1" y1="4" x2="29" y2="4" stroke="currentColor" strokeWidth="2.2" strokeDasharray="6 4" />
          </svg>
          نوفالو
        </span>
        <span className="flex items-center gap-2 text-[12px] text-gray-500">
          <svg width="18" height="14" aria-hidden>
            <rect x="1" y="1" width="16" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" />
          </svg>
          معلق (بی‌مقصد)
        </span>
      </div>
    </div>
  );
}

function TargetShape({
  target,
  position,
  incoming,
  dimmed,
  canManage,
  onPointerDown,
  onHover,
}: {
  target: CanvasTarget;
  position: Point | undefined;
  incoming: number;
  dimmed: boolean;
  canManage: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onHover: (id: string | null) => void;
}) {
  if (!position) return null;
  const right = TARGET_W - 16;
  return (
    <g
      transform={`translate(${position.x - TARGET_W / 2}, ${position.y - TARGET_H / 2})`}
      onPointerDown={onPointerDown}
      onPointerEnter={() => onHover(target.id)}
      onPointerLeave={() => onHover(null)}
      opacity={dimmed ? 0.35 : 1}
      className={canManage ? "cursor-move" : "cursor-default"}
    >
      <title>
        {`${target.label || "صفحه‌ی هدف"}\n${target.url}${
          target.primaryKeyword ? `\nکلمه‌ی کلیدی: ${target.primaryKeyword}` : ""
        }`}
      </title>
      <rect
        width={TARGET_W}
        height={TARGET_H}
        rx={16}
        className="fill-white dark:fill-gray-900 stroke-blue-500"
        strokeWidth={2.5}
        filter="url(#link-shadow)"
      />
      <rect x={right - 44} y={16} width={44} height={44} rx={12} className="fill-blue-500" />
      <Globe x={right - 44 + 10} y={26} width={24} height={24} color="#ffffff" strokeWidth={2} />

      <text x={right - 56} y={36} direction="rtl" className="fill-gray-900 dark:fill-white text-[15px] font-extrabold">
        {clip(target.label || "صفحه‌ی هدف", 20)}
      </text>
      <text x={right - 56} y={57} direction="rtl" className="fill-gray-500 text-[12.5px]">
        {clip(target.primaryKeyword || "—", 24)}
      </text>
      <text x={16} y={84} direction="ltr" className="fill-gray-400 font-mono text-[11px]">
        {clip(pathOf(target.url), 26)}
      </text>
      <g transform={`translate(${right}, 70)`}>
        <rect x={-62} y={0} width={62} height={20} rx={10} className="fill-blue-50 dark:fill-blue-500/15" />
        <text
          x={-31}
          y={14.5}
          textAnchor="middle"
          direction="rtl"
          className="fill-blue-600 dark:fill-blue-300 text-[11px] font-bold"
        >
          {fa(incoming)} لینک
        </text>
      </g>
    </g>
  );
}

function NodeShape({
  node,
  position,
  incoming,
  dimmed,
  canManage,
  onPointerDown,
  onHover,
}: {
  node: CanvasNode;
  position: Point | undefined;
  incoming: number;
  dimmed: boolean;
  canManage: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onHover: (id: string | null) => void;
}) {
  const [iconFailed, setIconFailed] = useState(false);
  if (!position) return null;

  const tone = toneOf(node.status);
  const title = node.platform?.title ?? node.type.title;
  const subtitle = node.platform ? node.type.title : null;
  const right = NODE_W - 16;
  const iconBox = 44;
  const textRight = right - iconBox - 12;
  const showFavicon = Boolean(node.platform?.iconPath) && !iconFailed;
  const border = node.type.isRisky ? NODE_STATUS_SVG.FAILED.stroke : tone.stroke;

  const chips: { text: string; warn?: boolean }[] = [
    { text: `#${fa(node.code)}` },
    { text: node.tier === null ? "معلق" : `لایه ${fa(node.tier)}` },
    ...(node.relFollow ? [] : [{ text: "nofollow" }]),
    ...(node.type.isRisky ? [{ text: "پرخطر", warn: true }] : []),
    ...(node.assigneeName ? [{ text: clip(node.assigneeName, 12) }] : []),
  ];

  return (
    <g
      transform={`translate(${position.x - NODE_W / 2}, ${position.y - NODE_H / 2})`}
      onPointerDown={onPointerDown}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      opacity={dimmed ? 0.35 : 1}
      className={canManage ? "cursor-move" : "cursor-pointer"}
    >
      <title>
        {[
          `${title}${subtitle ? ` — ${subtitle}` : ""} (#${node.code})`,
          `وضعیت: ${NODE_STATUS_LABELS[node.status]}`,
          `انکر: ${node.anchorText || "—"}`,
          `rel: ${node.relFollow ? "follow" : "nofollow"}`,
          `مسئول: ${node.assigneeName ?? "ارجاع نشده"}`,
          incoming > 0 ? `${incoming} لینک ورودی از لایه‌ی بالاتر` : "",
        ]
          .filter(Boolean)
          .join("\n")}
      </title>
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={14}
        className="fill-white dark:fill-gray-900"
        stroke={border}
        strokeWidth={node.type.isRisky ? 2.5 : 1.6}
        strokeDasharray={node.tier === null ? "6 4" : undefined}
        filter="url(#link-shadow)"
      />
      {/* نوار وضعیت روی لبه‌ی راست — شروع خط فارسی */}
      <rect x={NODE_W - 6} y={12} width={4} height={NODE_H - 24} rx={2} fill={tone.stroke} />

      <rect
        x={right - iconBox}
        y={12}
        width={iconBox}
        height={iconBox}
        rx={12}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeOpacity={0.45}
      />
      {showFavicon ? (
        <image
          href={node.platform!.iconPath!}
          x={right - iconBox + 8}
          y={20}
          width={28}
          height={28}
          preserveAspectRatio="xMidYMid meet"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <LinkTypeIcon
          icon={node.type.icon}
          x={right - iconBox + 10}
          y={22}
          width={24}
          height={24}
          color={tone.stroke}
          strokeWidth={2}
        />
      )}

      <text x={textRight} y={29} direction="rtl" className="fill-gray-900 dark:fill-white text-[14px] font-extrabold">
        {clip(title, 15)}
        {subtitle && <tspan className="fill-gray-400 text-[11px] font-normal">{`  ${clip(subtitle, 12)}`}</tspan>}
      </text>
      <text x={textRight} y={50} direction="rtl" className="fill-gray-500 text-[12px]">
        {node.anchorText ? `«${clip(node.anchorText, 20)}»` : "بدون انکر"}
      </text>

      <Chips chips={chips} y={NODE_H - 21} maxWidth={NODE_W - 28} />
    </g>
  );
}

/** برچسب‌های کوچک پایین گره، از لبه‌ی چپ؛ عرض از طول متن تخمین زده می‌شود */
function Chips({ chips, y, maxWidth }: { chips: { text: string; warn?: boolean }[]; y: number; maxWidth: number }) {
  // جای هر برچسب قبل از رندر حساب می‌شود؛ برچسبی که جا نشود کلاً حذف می‌شود
  // و متن کاملش در راهنمای ماوس هست
  const placed = chips.reduce<{ chip: (typeof chips)[number]; x: number; w: number }[]>((acc, chip) => {
    const w = Math.max(30, chip.text.length * 6.2 + 14);
    const last = acc[acc.length - 1];
    const x = last ? last.x + last.w + 5 : 12;
    if (x + w <= maxWidth) acc.push({ chip, x, w });
    return acc;
  }, []);
  return (
    <g>
      {placed.map(({ chip, x, w }) => (
        <g key={chip.text} transform={`translate(${x}, ${y})`}>
          <rect
            width={w}
            height={17}
            rx={8.5}
            className={chip.warn ? "fill-red-500/15" : "fill-gray-100 dark:fill-white/10"}
          />
          <text
            x={w / 2}
            y={12.5}
            textAnchor="middle"
            className={cn("text-[10.5px] font-bold", chip.warn ? "fill-red-600" : "fill-gray-600 dark:fill-gray-300")}
          >
            {chip.text}
          </text>
        </g>
      ))}
    </g>
  );
}
