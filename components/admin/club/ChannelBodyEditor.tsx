"use client";

import { useEffect, useState } from "react";

/**
 * ویرایشگر متن قالب برای کانال‌های پیام‌رسان
 *
 * ⚠️ پیامک اینجا نیست — متن پیامک همان `SmsTemplate.body` بالای همین مودال
 *    است. دو جای ویرایش برای یک متن یعنی یکی همیشه کهنه می‌ماند.
 *
 * ⚠️ متن خالی یعنی «این قالب روی این کانال نرود» — نه اینکه متن پیامک
 *    فرستاده شود. متن پیامک کوتاه و بی‌قالب است و روی بله بد خوانده می‌شود.
 */

interface ChannelInfo {
  channel: string;
  title: string;
}

interface ChannelBody {
  channel: string;
  body: string;
  isActive: boolean;
}

export default function ChannelBodyEditor({
  templateId,
  variables,
}: {
  templateId: string;
  variables: { key: string; label: string }[];
}) {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    fetch(`/api/admin/club/templates/${templateId}/channels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setChannels(d.channels ?? []);
        const map: Record<string, string> = {};
        for (const b of (d.bodies ?? []) as ChannelBody[]) map[b.channel] = b.body;
        setBodies(map);
        setSaved(map);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [templateId]);

  async function save(channel: string) {
    setBusy(channel);
    try {
      const res = await fetch(`/api/admin/club/templates/${templateId}/channels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, body: bodies[channel] ?? "" }),
      });
      if (res.ok) setSaved((s) => ({ ...s, [channel]: bodies[channel] ?? "" }));
    } finally {
      setBusy(null);
    }
  }

  if (loading || channels.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div>
        <p className="text-[10px] font-black text-gray-500">متن کانال‌های پیام‌رسان</p>
        <p className="text-[10px] font-bold text-gray-400 mt-1 leading-relaxed">
          خالی گذاشتن یعنی این قالب روی آن کانال ارسال نمی‌شود.
        </p>
      </div>

      {channels.map((c) => {
        const value = bodies[c.channel] ?? "";
        const dirty = value !== (saved[c.channel] ?? "");

        return (
          <div key={c.channel} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-600 dark:text-gray-300">
                {c.title}
              </span>
              <button
                type="button"
                onClick={() => save(c.channel)}
                disabled={!dirty || busy === c.channel}
                className="px-3 py-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-black disabled:opacity-30 transition-opacity"
              >
                {busy === c.channel ? "..." : dirty ? "ذخیره" : "ذخیره شد"}
              </button>
            </div>

            <textarea
              rows={3}
              value={value}
              onChange={(e) => setBodies((b) => ({ ...b, [c.channel]: e.target.value }))}
              placeholder={`متن مخصوص ${c.title} — می‌تواند بلندتر و با قالب‌بندی باشد`}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[11px] font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 resize-none leading-relaxed transition-colors"
            />

            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() =>
                    setBodies((b) => ({ ...b, [c.channel]: (b[c.channel] ?? "") + `{${v.key}}` }))
                  }
                  className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[10px] font-black text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition-all"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
