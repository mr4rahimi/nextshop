"use client";

/**
 * نمایش امن پاسخ دستیار — زیرمجموعه‌ی کوچکی از مارک‌داون با المان‌های ری‌اکت، بدون HTML خام.
 * لینک فقط برای مسیر داخلی پنل (`/admin…`) ساخته می‌شود؛ هر آدرس دیگری متن ساده می‌ماند.
 * جدول هم پشتیبانی می‌شود چون Claude در آزمون فاز ۰ با وجود دستور، جدول کشید.
 */

import Link from "next/link";
import type { ReactNode } from "react";

/** رقم لاتین ← فارسی، مثل بقیه‌ی پنل؛ آدرس لینک دست نمی‌خورد */
const faDigits = (text: string) => text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(faDigits(text.slice(last, match.index)));
    const key = `${keyBase}-${index++}`;
    if (match[1] !== undefined) {
      nodes.push(<strong key={key} className="font-black">{faDigits(match[1])}</strong>);
    } else if (match[2] !== undefined) {
      const href = match[3] ?? "";
      nodes.push(
        href.startsWith("/admin") ? (
          <Link key={key} href={href} className="font-bold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400">
            {faDigits(match[2])}
          </Link>
        ) : (
          <span key={key}>{faDigits(match[2])}</span>
        ),
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] dark:bg-white/10" dir="auto">
          {match[4]}
        </code>,
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(faDigits(text.slice(last)));
  return nodes;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; rows: string[][] };

const cells = (line: string) => line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || /^-{3,}$/.test(line)) continue;
    const lastBlock = blocks[blocks.length - 1];

    if (line.startsWith("|") && line.endsWith("|")) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // خط جداکننده‌ی سرجدول
      if (lastBlock?.kind === "table") lastBlock.rows.push(cells(line));
      else blocks.push({ kind: "table", rows: [cells(line)] });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^[\d۰-۹]+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const text = (bullet ?? numbered)![1];
      if (lastBlock && lastBlock.kind === kind) lastBlock.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  return blocks;
}

export default function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-[13.5px] leading-7">
      {parse(text).map((block, i) => {
        const key = `b${i}`;
        if (block.kind === "h") return <p key={key} className="font-black">{inline(block.text, key)}</p>;
        if (block.kind === "p") return <p key={key}>{inline(block.text, key)}</p>;
        if (block.kind === "table") {
          const [head, ...body] = block.rows;
          return (
            <div key={key} className="overflow-x-auto rounded-xl border border-[var(--adm-border)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-gray-50 dark:bg-white/[0.04]">
                  <tr>{head.map((c, j) => <th key={j} className="px-2.5 py-1.5 text-right font-black">{inline(c, `${key}-h${j}`)}</th>)}</tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r} className="border-t border-[var(--adm-border)]">
                      {row.map((c, j) => <td key={j} className="px-2.5 py-1.5">{inline(c, `${key}-${r}-${j}`)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List key={key} className={`space-y-1 pr-5 ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}>
            {block.items.map((item, j) => (
              <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
