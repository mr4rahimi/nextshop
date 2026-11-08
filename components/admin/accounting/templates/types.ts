import type { TemplateAmountKind, TemplateSide } from "@/lib/accounting/ledger/template-calc";

export interface TemplateLine {
  id: string;
  seq: number;
  side: TemplateSide;
  kind: TemplateAmountKind;
  percentBps: number | null;
  fixedAmount: string | null;
  description: string | null;
  account: { id: string; code: string; name: string; detailKind: "NONE" | "PARTY" | "TREASURY" };
  party: { id: string; code: number; name: string; mobile: string | null } | null;
  treasury: { id: string; name: string } | null;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  baseLabel: string;
  baseAmount: string;
  updatedAt: string;
  lines: TemplateLine[];
}

export const KIND_LABELS: Record<TemplateAmountKind, string> = {
  BASE: "مبلغ پایه",
  PERCENT: "درصدی از پایه",
  FIXED: "مبلغ ثابت",
  ASK: "هنگام ثبت",
  REMAINDER: "مانده (ترازکننده)",
};
