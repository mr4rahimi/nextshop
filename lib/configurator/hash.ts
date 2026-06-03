import crypto from "crypto";

export function buildAssembleHash(input: {
  templateId: string;
  rulesVersion: number;
  selections: Array<{ stepKey: string; optionId: string; qty?: number }>;
}) {
  // sort => deterministic
  const normalized = input.selections
    .map((s) => ({ stepKey: s.stepKey, optionId: s.optionId, qty: s.qty ?? 1 }))
    .sort((a, b) =>
      a.stepKey === b.stepKey ? a.optionId.localeCompare(b.optionId) : a.stepKey.localeCompare(b.stepKey)
    );

  const payload = JSON.stringify({
    templateId: input.templateId,
    rulesVersion: input.rulesVersion,
    selections: normalized,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}
