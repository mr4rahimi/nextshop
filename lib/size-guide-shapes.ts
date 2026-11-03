/**
 * هندسه‌ی طرح خطی لباس‌ها (viewBox ۲۰۰×۲۳۰) — docs/features/size-guide.md.
 * هم `SizeGuideDiagram` (صفحه) و هم `size-guide-image` (عکس گالری) از همین می‌کشند.
 * کلید `lines` همان کلید ستون در `SIZE_GUIDE_KINDS` است.
 */

import type { SizeGuideKind } from "@/lib/size-guide";

export type Line = { x1: number; y1: number; x2: number; y2: number; ticks?: boolean };

export interface Shape {
  outline: string;
  details: string[];
  dots?: [number, number][];
  lines: Record<string, Line>;
}

function top(o: { sleeve: "long" | "short"; hem: number; flare?: number; placket?: boolean; zipper?: boolean; collar?: boolean }): Shape {
  const f = o.flare ?? 0;
  const body = `L${62 - f},${o.hem} L${138 + f},${o.hem}`;
  const outline =
    o.sleeve === "long"
      ? `M85,22 L55,32 L22,148 L40,154 L62,78 ${body} L138,78 L160,154 L178,148 L145,32 L115,22 Q100,34 85,22 Z`
      : `M85,22 L55,32 L30,72 L48,82 L62,64 ${body} L138,64 L152,82 L170,72 L145,32 L115,22 Q100,34 85,22 Z`;
  const chestY = o.sleeve === "long" ? 90 : 80;
  const details: string[] = [];
  const dots: [number, number][] = [];
  if (o.collar) details.push("M85,22 L94,37 L100,31 L106,37 L115,22");
  if (o.placket) {
    details.push(`M100,31 L100,${o.hem}`);
    for (let y = 50; y < o.hem - 10; y += 24) dots.push([104, y]);
  }
  if (o.zipper) details.push(`M100,27 L100,${o.hem}`, `M${62 - f},${o.hem - 9} L${138 + f},${o.hem - 9}`);
  return {
    outline,
    details,
    dots,
    lines: {
      chest: { x1: 62, y1: chestY, x2: 138, y2: chestY },
      shoulder: { x1: 55, y1: 11, x2: 145, y2: 11, ticks: true },
      length: { x1: 124, y1: 27, x2: 124, y2: o.hem },
      sleeve: o.sleeve === "long" ? { x1: 46, y1: 29.5, x2: 13, y2: 145.5 } : { x1: 47.4, y1: 27.2, x2: 22.4, y2: 67.2 },
      hip: { x1: 62 - f * 0.7, y1: o.hem - 30, x2: 138 + f * 0.7, y2: o.hem - 30 },
    },
  };
}

export const SIZE_SHAPES: Record<Exclude<SizeGuideKind, "custom">, Shape> = {
  shirt: top({ sleeve: "long", hem: 196, placket: true, collar: true }),
  tshirt: top({ sleeve: "short", hem: 190 }),
  outer: top({ sleeve: "long", hem: 190, zipper: true }),
  manto: top({ sleeve: "long", hem: 218, flare: 8, placket: true, collar: true }),
  pants: {
    outline: "M60,20 L140,20 L150,205 L108,205 L100,82 L92,205 L50,205 Z",
    details: ["M59.5,30 L140.5,30", "M100,30 Q107,52 100,68"],
    lines: {
      waist: { x1: 60, y1: 10, x2: 140, y2: 10, ticks: true },
      length: { x1: 162, y1: 20, x2: 162, y2: 205, ticks: true },
      rise: { x1: 100, y1: 21, x2: 100, y2: 82 },
      hem: { x1: 108, y1: 215, x2: 150, y2: 215 },
      hip: { x1: 58, y1: 60, x2: 142, y2: 60 },
    },
  },
};

/** جای دایره‌ی حرف روی فلش — حرف سینه کمی کنار تا روی دکمه‌ها نیفتد */
export const labelPos = (key: string, l: Line): [number, number] => [(l.x1 + l.x2) / 2 - (key === "chest" ? 18 : 0), (l.y1 + l.y2) / 2];
