/**
 * خواندن فایل اکسل (xlsx) یا CSV — بی‌وابستگی، فقط سمت سرور (zlib).
 * docs/plans/inventory-items.md بخش ۶.
 *
 * xlsx یک zip است: `xl/workbook.xml` (نام برگه‌ها) + `xl/_rels/workbook.xml.rels`
 * (برگه ← فایل) + `xl/sharedStrings.xml` + `xl/worksheets/sheetN.xml`. فقط مقدار
 * خانه‌ها خوانده می‌شود؛ فرمول = آخرین نتیجه‌ی ذخیره‌شده، قالب‌بندی نه. تاریخ
 * عددی اکسل همان عدد می‌ماند و `parseImportDate` تبدیلش می‌کند.
 * xls قدیمی (BIFF) پشتیبانی نمی‌شود — پیام می‌دهد «Save As ← xlsx».
 */

import { inflateRawSync } from "node:zlib";
import { AccError } from "../errors";

export interface Sheet {
  name: string;
  rows: string[][];
}

export const SHEET_MAX_ROWS = 20_000;

// ── zip ──────────────────────────────────────────────────────────────

function unzip(buf: Buffer): Map<string, Buffer> {
  // انتهای دایرکتوری مرکزی: امضای 0x06054b50 در ۶۵ کیلوبایت آخر
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new AccError("فایل اکسل خراب است یا xlsx نیست");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new AccError("فایل اکسل خراب است");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? Buffer.from(data) : method === 8 ? inflateRawSync(data) : Buffer.alloc(0));
  }
  return out;
}

// ── xml ──────────────────────────────────────────────────────────────

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()],
  );
}
/** متن همه‌ی `<t>`های یک تکه (رشته‌ی چندتکه‌ی قالب‌دار) — بی آوانویسی `<rPh>` */
const textOf = (xml: string) =>
  unescape(
    [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)].map((m) => m[1] ?? "").join(""),
  );
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheetXml(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rAttr = rm[1] ?? rm[3] ?? "";
    const r = Number(attr(rAttr, "r") ?? rows.length + 1) - 1;
    const cells: string[] = [];
    let auto = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = cm[1];
      const ref = attr(ca, "r");
      const ci = ref ? colIndex(ref) : auto;
      auto = ci + 1;
      const t = attr(ca, "t");
      const body = cm[2] ?? "";
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = "";
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = textOf(body);
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      else val = v !== undefined ? unescape(v) : "";
      cells[ci] = val.trim();
    }
    for (let i = 0; i < cells.length; i++) cells[i] ??= "";
    rows[r] = cells;
    if (rows.length > SHEET_MAX_ROWS + 1) throw new AccError(`بیشتر از ${SHEET_MAX_ROWS} ردیف — فایل را چند تکه کنید`);
  }
  for (let i = 0; i < rows.length; i++) rows[i] ??= [];
  return rows;
}

export function readXlsx(buf: Buffer): Sheet[] {
  if (buf.readUInt32LE(0) === 0xe011cfd0) throw new AccError("این فایل اکسل قدیمی (xls) است — در اکسل «Save As» و نوع «Excel Workbook (xlsx)» یا CSV را انتخاب کنید");
  const files = unzip(buf);
  const str = (n: string) => files.get(n)?.toString("utf8") ?? "";
  const shared = [...str("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const rels = new Map(
    [...str("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [attr(m[1], "Id"), attr(m[1], "Target")] as const),
  );
  const sheets: Sheet[] = [];
  for (const m of str("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unescape(attr(m[1], "name") ?? `Sheet${sheets.length + 1}`);
    const target = rels.get(attr(m[1], "r:id"));
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = str(path);
    if (xml) sheets.push({ name, rows: readSheetXml(xml, shared) });
  }
  if (!sheets.length) throw new AccError("برگه‌ای در فایل پیدا نشد");
  return sheets;
}

// ── csv ──────────────────────────────────────────────────────────────

/** CSV با جداکننده‌ی خودکار (, ; تب)، نقل‌قول دوتایی، BOM؛ UTF-8 یا Windows-1256 */
export function readCsv(buf: Buffer): Sheet[] {
  let text = buf.toString("utf8");
  // بایت نامعتبر UTF-8 = احتمالاً CSV فارسی ویندوز (عربی ۱۲۵۶)
  if (text.includes("�")) text = new TextDecoder("windows-1256").decode(buf);
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell) quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      if (rows.length > SHEET_MAX_ROWS + 1) throw new AccError(`بیشتر از ${SHEET_MAX_ROWS} ردیف — فایل را چند تکه کنید`);
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return [{ name: "CSV", rows }];
}

export function readSheetFile(name: string, buf: Buffer): Sheet[] {
  if (!buf.length) throw new AccError("فایل خالی است");
  const isZip = buf.readUInt32LE(0) === 0x04034b50;
  if (isZip || /\.xlsx$/i.test(name)) return readXlsx(buf);
  if (/\.xls$/i.test(name)) return readXlsx(buf); // پیام xls قدیمی را همان‌جا می‌دهد
  return readCsv(buf);
}
