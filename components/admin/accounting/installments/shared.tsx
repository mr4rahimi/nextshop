"use client";

/** اجزای مشترک اقساط — برچسب وضعیت با رنگ و چک هر قسط */

import { INSTALLMENT_STATE_LABELS, type InstallmentState } from "@/lib/accounting/installments-calc";
import { CHEQUE_LABEL } from "../cash/ChequesList";
import { Badge } from "../ui";

export interface InstRow {
  id: string;
  planId: string;
  seq: number;
  count: number;
  dueDate: string;
  amount: string;
  paid: string;
  left: string;
  state: InstallmentState;
  cheque: { id: string; serialNo: string; status: string; direction: string } | null;
  invoice: { id: string; type: "SALES" | "PURCHASE"; number: number | null; date: string };
  party: { id: string; name: string; mobile: string | null };
}

const TONE: Record<InstallmentState, "green" | "red" | "amber" | "blue" | "gray"> = {
  PAID: "green",
  PARTIAL: "blue",
  OVERDUE: "red",
  DUE_SOON: "amber",
  UPCOMING: "gray",
};

/**
 * قسطی که با چک پوشیده شده «پرداخت شد» حساب می‌شود ولی تا چک وصول نشده، وضعیت
 * چک هم کنارش می‌آید — برگشتی قرمز.
 */
export function StateBadge({ row }: { row: Pick<InstRow, "state" | "cheque"> }) {
  const c = row.cheque;
  if (c && row.state === "PAID" && c.status !== "CLEARED") {
    const bad = c.status === "BOUNCED" || c.status === "RETURNED";
    return <Badge tone={bad ? "red" : "blue"}>چک {CHEQUE_LABEL(c.direction as "RECEIVED" | "ISSUED", c.status)}</Badge>;
  }
  return <Badge tone={TONE[row.state]}>{INSTALLMENT_STATE_LABELS[row.state]}</Badge>;
}
