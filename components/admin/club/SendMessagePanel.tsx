"use client";

import { useEffect, useState } from "react";

/**
 * ارسال انبوه یا انتخابی
 *
 * ⚠️ کانال اینجا فقط «انتخاب می‌شود»، پیاده‌سازی نمی‌شود. متن هر کانال جداست
 *    چون متن پیامک روی بله بد خوانده می‌شود و برعکس.
 *
 * ⚠️ پیش از ارسال، تعداد واقعی گیرندگان از سرور پرسیده می‌شود. ادمین باید
 *    ببیند پیام به چند نفر می‌رسد — نه اینکه بعد از ارسال بفهمد صفر بوده.
 */

interface Props {
  profileIds: string[];
  onClose: () => void;
  onSent: () => void;
}

const CHANNEL_FA: Record<string, string> = { SMS: "پیامک", BALE: "بله", TELEGRAM: "تلگرام" };

export default function SendMessagePanel({ profileIds, onClose, onSent }: Props) {
  const [channels, setChannels] = useState<string[]>(["BALE"]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"MARKETING" | "TRANSACTIONAL">("MARKETING");
  const [preview, setPreview] = useState<{ total: number; byChannel: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch("/api/admin/club/send", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileIds }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setPreview(d));

    return () => { alive = false; };
  }, [profileIds]);

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function send() {
    setBusy(true);
    setError("");

    const bodyByChannel: Record<string, string> = {};
    for (const c of channels) {
      const t = (texts[c] ?? "").trim();
      if (t) bodyByChannel[c] = t;
    }

    if (Object.keys(bodyByChannel).length === 0) {
      setError("برای حداقل یک کانال متن بنویسید");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/club/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds, kind, bodyByChannel }),
      });
      const d = await res.json();

      if (!res.ok) {
        setError(d.error ?? "ارسال ناموفق بود");
        return;
      }

      setDone(
        `${Number(d.recipients).toLocaleString("fa-IR")} گیرنده در صف قرار گرفت` +
          (d.delayedUntilAllowedHours ? " — خارج از ساعت مجاز، به بازه‌ی بعدی موکول شد" : "")
      );
      onSent();
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-6" dir="rtl">
      <div className="bg-white dark:bg-gray-900 w-full md:max-w-lg rounded-t-3xl md:rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">
            ارسال پیام به {profileIds.length.toLocaleString("fa-IR")} عضو
          </h2>
          <button onClick={onClose} className="text-xs font-black text-gray-400">بستن</button>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-relaxed">
              {done}
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black"
            >
              باشه
            </button>
          </div>
        ) : (
          <>
            {preview && (
              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4 space-y-1">
                <p className="text-[11px] font-black text-gray-700 dark:text-gray-300">
                  قابل دسترس: {preview.total.toLocaleString("fa-IR")} نفر
                </p>
                <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
                  {Object.entries(preview.byChannel).length > 0
                    ? Object.entries(preview.byChannel)
                        .map(([c, n]) => `${CHANNEL_FA[c] ?? c}: ${n.toLocaleString("fa-IR")}`)
                        .join(" · ")
                    : "هیچ‌کدام در پیام‌رسان عضو نیستند — همه از پیامک پیام می‌گیرند"}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-500">نوع پیام</p>
              <div className="flex gap-2">
                {(["MARKETING", "TRANSACTIONAL"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors ${
                      kind === k
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "bg-gray-100 dark:bg-white/5 text-gray-500"
                    }`}
                  >
                    {k === "MARKETING" ? "تبلیغاتی" : "خدماتی"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
                تبلیغاتی: فقط در ساعت مجاز، با خط تبلیغاتی و شمارش در سقف ماهانه.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-500">کانال‌ها</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(CHANNEL_FA).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors ${
                      channels.includes(c)
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 dark:bg-white/5 text-gray-500"
                    }`}
                  >
                    {CHANNEL_FA[c]}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
                هر عضو فقط از <b>یک</b> کانال پیام می‌گیرد — اولین کانالی که در
                دسترسش باشد. انتخاب چند کانال یعنی «هرکدام ممکن بود».
              </p>
            </div>

            {channels.map((c) => (
              <div key={c} className="space-y-1.5">
                <p className="text-[10px] font-black text-gray-500">متن {CHANNEL_FA[c]}</p>
                <textarea
                  rows={3}
                  value={texts[c] ?? ""}
                  onChange={(e) => setTexts((t) => ({ ...t, [c]: e.target.value }))}
                  placeholder={`سلام {name} عزیز، ...`}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[11px] font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 resize-none leading-relaxed"
                />
              </div>
            ))}

            {error && (
              <p className="text-[11px] font-black text-red-500 leading-relaxed">{error}</p>
            )}

            <button
              onClick={send}
              disabled={busy || channels.length === 0}
              className="w-full py-3 rounded-2xl bg-primary-600 text-white text-xs font-black disabled:opacity-40"
            >
              {busy ? "..." : "ارسال"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
