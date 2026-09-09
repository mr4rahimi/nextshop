"use client";

/**
 * فرم ثبت سریع کار.
 *
 * هدف صریح: **زیر ده ثانیه**. سه ضربه کافی است — نوع کار، مخاطب، نتیجه.
 * هر فیلدی که به نوعِ انتخاب‌شده ربط ندارد اصلاً نشان داده نمی‌شود
 * (`needsCustomer`، `needsAmount`، `needsLink`، `needsCarrier`).
 *
 * دو تصمیم که اصطکاک را می‌کشند:
 *  - نتیجه‌ها **دکمه‌اند نه فیلد متنی**. متن آزاد یعنی نمودار هرگز ساخته نمی‌شود.
 *  - مخاطب با شماره یا نام **تکمیل خودکار** می‌شود، تایپ نام ممنوع نیست ولی لازم نیست.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOMAIN_LABELS, CARRIERS, parseOutcomes } from "@/lib/worklist/types";
import type { StaffDomain } from "@/lib/worklist/types";
import type { TaskTypeLite, ContactSuggestion, TaskItem } from "./types";
import HelpButton from "./HelpButton";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (task: TaskItem) => void;
  /** پیش‌انتخاب مشتری، وقتی فرم از پرونده‌ی مشتری باز می‌شود */
  presetCustomer?: { id: string; name: string; phone: string } | null;
  /** پیش‌انتخاب نوع کار با slug */
  presetTypeSlug?: string | null;
}

export default function QuickTaskForm({
  open,
  onClose,
  onCreated,
  presetCustomer = null,
  presetTypeSlug = null,
}: Props) {
  const [types, setTypes] = useState<TaskTypeLite[]>([]);
  const [typeId, setTypeId] = useState<string>("");
  const [domainFilter, setDomainFilter] = useState<StaffDomain | "ALL">("ALL");

  const [contactQuery, setContactQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [customer, setCustomer] = useState<ContactSuggestion | null>(null);

  const [supplierName, setSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [carrier, setCarrier] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<AbortController | null>(null);

  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId) ?? null,
    [types, typeId],
  );
  const outcomes = useMemo(
    () => parseOutcomes(selectedType?.outcomes),
    [selectedType],
  );

  // ── بارگذاری انواع کار ─────────────────────────────────────────
  useEffect(() => {
    if (!open || types.length) return;
    fetch("/api/admin/worklist/task-types")
      .then((r) => r.json())
      .then((d) => {
        const list: TaskTypeLite[] = d.types ?? [];
        setTypes(list);
        if (presetTypeSlug) {
          const preset = list.find((t) => t.slug === presetTypeSlug);
          if (preset) setTypeId(preset.id);
        }
      })
      .catch(() => setError("بارگذاری انواع کار ناموفق بود"));
  }, [open, types.length, presetTypeSlug]);

  // ── بازنشانی هنگام باز شدن ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(null);
    setOutcome(null);
    setNote("");
    setTitle("");
    setAmount("");
    setLinkUrl("");
    setCarrier("");
    setSupplierName("");
    if (presetCustomer) {
      setCustomer({
        id: presetCustomer.id,
        name: presetCustomer.name,
        phone: presetCustomer.phone,
        isClubMember: true,
        orderCount: 0,
        lastPurchaseAt: null,
      });
      setContactQuery(presetCustomer.name);
    } else {
      setCustomer(null);
      setContactQuery("");
    }
  }, [open, presetCustomer]);

  // ── تکمیل خودکار مخاطب ─────────────────────────────────────────
  useEffect(() => {
    if (!open || customer || contactQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      searchRef.current?.abort();
      const ctrl = new AbortController();
      searchRef.current = ctrl;
      fetch(`/api/admin/worklist/contacts?q=${encodeURIComponent(contactQuery)}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d) => setSuggestions(d.items ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [contactQuery, customer, open]);

  // بستن با Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = useCallback(
    async (closeAfter: boolean) => {
      if (!typeId) {
        setError("نوع کار را انتخاب کنید");
        return;
      }
      setSaving(true);
      setError(null);

      const payload: Record<string, unknown> = {
        typeId,
        outcome,
        note: note.trim() || null,
        title: title.trim() || null,
      };

      if (selectedType?.needsCustomer || customer) {
        payload.customerId = customer?.id ?? null;
        payload.contactName = customer?.name ?? (contactQuery.trim() || null);
        payload.contactPhone = customer?.phone ?? null;
      }
      if (selectedType?.needsAmount) payload.amount = amount.replace(/[^\d]/g, "") || null;
      if (selectedType?.needsLink) payload.linkUrl = linkUrl.trim() || null;
      if (selectedType?.needsCarrier) payload.carrier = carrier || null;
      if (supplierName.trim()) payload.supplierName = supplierName.trim();

      try {
        const res = await fetch("/api/admin/worklist/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "ثبت ناموفق بود");

        onCreated(data.task);
        if (closeAfter) {
          onClose();
        } else {
          // «ثبت و بعدی» — نوع کار می‌ماند، بقیه پاک می‌شود
          setOutcome(null);
          setNote("");
          setTitle("");
          setAmount("");
          setLinkUrl("");
          setCustomer(null);
          setContactQuery("");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "ثبت ناموفق بود");
      } finally {
        setSaving(false);
      }
    },
    [
      typeId, outcome, note, title, selectedType, customer, contactQuery,
      amount, linkUrl, carrier, supplierName, onCreated, onClose,
    ],
  );

  if (!open) return null;

  const domains = Array.from(new Set(types.map((t) => t.domain)));
  const visibleTypes =
    domainFilter === "ALL" ? types : types.filter((t) => t.domain === domainFilter);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">ثبت کار</h2>
            <HelpButton topic="quickForm" size="sm" />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* فیلتر دامنه */}
          {domains.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setDomainFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  domainFilter === "ALL"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                }`}
              >
                همه
              </button>
              {domains.map((d) => (
                <button
                  key={d}
                  onClick={() => setDomainFilter(d)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    domainFilter === d
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {DOMAIN_LABELS[d]}
                </button>
              ))}
            </div>
          )}

          {/* نوع کار */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
              چه کاری انجام دادید؟
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {visibleTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTypeId(t.id);
                    setOutcome(null);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold text-right transition border ${
                    typeId === t.id
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent hover:border-blue-300 dark:hover:border-blue-500/40"
                  }`}
                >
                  <span className="ml-1">{t.icon ?? "•"}</span>
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <>
              {/* مخاطب */}
              {selectedType.needsCustomer && (
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                    مشتری — نام یا شماره
                  </label>
                  {customer ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {customer.name}
                        </p>
                        <p className="text-[11px] text-gray-500">{customer.phone}</p>
                      </div>
                      <button
                        onClick={() => {
                          setCustomer(null);
                          setContactQuery("");
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 font-bold shrink-0"
                      >
                        تغییر
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={contactQuery}
                        onChange={(e) => setContactQuery(e.target.value)}
                        placeholder="۰۹۱۲... یا نام مشتری"
                        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden">
                          {suggestions.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setCustomer(s);
                                setSuggestions([]);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                  {s.name}
                                </p>
                                <p className="text-[11px] text-gray-500">{s.phone}</p>
                              </div>
                              {s.orderCount > 0 && (
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {s.orderCount} سفارش
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-[10px] text-gray-400">
                        اگر مشتری ثبت‌نشده است، همان نام تایپ‌شده ذخیره می‌شود
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* تأمین‌کننده */}
              {selectedType.domain === "PROCUREMENT" && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                    تأمین‌کننده
                  </label>
                  <input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="نام تأمین‌کننده"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                  />
                </div>
              )}

              {/* مبلغ و لینک و باربری */}
              <div className="grid sm:grid-cols-2 gap-3">
                {selectedType.needsAmount && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                      مبلغ (تومان)
                    </label>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="۰"
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                    />
                  </div>
                )}

                {selectedType.needsCarrier && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                      باربری
                    </label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                    >
                      <option value="">انتخاب کنید</option>
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedType.needsLink && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                      آدرس لینک
                    </label>
                    <input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      dir="ltr"
                      placeholder="https://..."
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
                    />
                  </div>
                )}
              </div>

              {/* نتیجه */}
              {outcomes.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                    نتیجه — خالی بگذارید تا کار باز بماند
                    <HelpButton topic="outcome" size="sm" />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {outcomes.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setOutcome(outcome === o.value ? null : o.value)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                          outcome === o.value
                            ? o.isSuccess
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-gray-700 dark:bg-gray-600 text-white border-gray-700 dark:border-gray-600"
                            : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent hover:border-gray-300 dark:hover:border-white/20"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* عنوان دلخواه و یادداشت */}
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                  یادداشت (اختیاری)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="هرچه لازم است بعداً یادتان بماند"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 resize-none"
                />
              </div>

              {selectedType.slaMinutes && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  مهلت این کار خودکار روی {Math.round(selectedType.slaMinutes / 60)} ساعت
                  بعد تنظیم می‌شود
                </p>
              )}
            </>
          )}

          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs font-bold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 px-5 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/10">
          <button
            onClick={() => submit(true)}
            disabled={saving || !typeId}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition"
          >
            {saving ? "در حال ثبت..." : "ثبت"}
          </button>
          <button
            onClick={() => submit(false)}
            disabled={saving || !typeId}
            className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-sm font-bold transition"
          >
            ثبت و بعدی
          </button>
        </div>
      </div>
    </div>
  );
}
