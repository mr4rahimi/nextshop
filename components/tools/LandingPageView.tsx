"use client";

/**
 * نمای لندینگ — هم صفحه‌ی عمومی `/l/<slug>` و هم پیش‌نمایش ویرایشگر.
 *
 * - رنگ‌ها **هگز ثابت** از تنظیمات همان لندینگ‌اند، نه توکن‌های پنل یا تم
 *   شب سایت: صفحه روی گوشی مشتری باز می‌شود و باید همیشه همان باشد که ادمین دید.
 * - نقشه‌ی جاسازی‌شده نداریم (از اینترنت خارجی لود می‌شود)؛ فقط دکمه‌ی مسیریابی.
 * - «الان باز است» پس از mount حساب می‌شود تا رندر سرور و مرورگر یکی بماند.
 * - در پیش‌نمایش (`preview`) فرم ارسال نمی‌شود.
 *
 * مستندات: docs/features/tools.md بخش ۳
 */

import { useState, useSyncExternalStore } from "react";
import {
  ChevronDown, Gift, Instagram, Link2, Mail, MapPin, MessageCircle, Navigation, Phone, Send, ShoppingCart, Star,
  type LucideIcon,
} from "lucide-react";
import {
  SOCIALS, WEEKDAYS, mapLinks, openNow, socialUrl,
  type Block, type ButtonIcon, type HoursDay, type LandingTheme, type SocialKey,
} from "@/lib/tools/landing-blocks";
import type { LandingProduct } from "@/lib/tools/landings";

const BUTTON_ICON: Record<ButtonIcon, LucideIcon> = {
  link: Link2, phone: Phone, cart: ShoppingCart, map: MapPin, instagram: Instagram, telegram: Send,
  whatsapp: MessageCircle, mail: Mail, gift: Gift, star: Star,
};

const SOCIAL_ICON: Record<SocialKey, LucideIcon> = {
  instagram: Instagram, telegram: Send, whatsapp: MessageCircle, eitaa: MessageCircle, rubika: MessageCircle, bale: MessageCircle,
};

/** متن روی رنگ برند — از روشناییِ خود رنگ، وگرنه برند روشن با متن سفید خوانا نیست */
function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const y = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return y > 160 ? "#111827" : "#ffffff";
}

const fmtPrice = (n: number) => n.toLocaleString("fa-IR");

/**
 * همان قاعده‌ی `normalizeTarget`: مسیر سایت (`/products/…`) می‌ماند، دامنه‌ی بی‌طرح
 * `https://` می‌گیرد، و هر طرح دیگری (`javascript:`) هرگز به href نمی‌رسد.
 */
function href(url: string): string {
  const u = url.trim();
  if (/^(https?:\/\/|tel:|mailto:|\/(?!\/))/i.test(u)) return u;
  if (/^[^\s/:]+\.[^\s/]+/.test(u)) return `https://${u}`;
  return "#";
}

export interface LandingViewProps {
  slug: string;
  blocks: Block[];
  theme: LandingTheme;
  products: Record<string, LandingProduct>;
  reviewPlatforms: { key: string; label: string; url: string }[];
  preview?: boolean;
}

export default function LandingPageView({ slug, blocks, theme, products, reviewPlatforms, preview }: LandingViewProps) {
  const fg = onColor(theme.primary);
  return (
    <div style={{ background: theme.background, color: "#1f2937" }} className="min-h-full w-full" dir="rtl">
      <main className="mx-auto w-full max-w-[480px] px-4 pb-10 pt-6 space-y-4">
        {blocks.map((b) => (
          <BlockView
            key={b.id}
            block={b}
            theme={theme}
            fg={fg}
            products={products}
            reviewPlatforms={reviewPlatforms}
            slug={slug}
            preview={preview}
          />
        ))}
      </main>
    </div>
  );
}

const card = "rounded-2xl bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)]";

function BlockView({
  block: b, theme, fg, products, reviewPlatforms, slug, preview,
}: {
  block: Block; theme: LandingTheme; fg: string; products: Record<string, LandingProduct>;
  reviewPlatforms: { key: string; label: string; url: string }[]; slug: string; preview?: boolean;
}) {
  switch (b.type) {
    case "header":
      return (
        <header className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)]">
          {b.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- آدرس آپلود؛ اندازه از پیش معلوم نیست
            <img src={b.cover} alt="" className="h-36 w-full object-cover" />
          ) : (
            <div className="h-20 w-full" style={{ background: theme.primary }} />
          )}
          <div className="-mt-10 flex flex-col items-center px-4 pb-5 text-center">
            {b.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo} alt={b.name} className="h-20 w-20 rounded-full border-4 border-white bg-white object-contain shadow" />
            ) : (
              <div className="h-20 w-20 rounded-full border-4 border-white shadow" style={{ background: theme.primary }} />
            )}
            {b.name && <h1 className="mt-3 text-xl font-black text-gray-900">{b.name}</h1>}
            {b.tagline && <p className="mt-1 text-sm leading-6 text-gray-500">{b.tagline}</p>}
          </div>
        </header>
      );

    case "buttons":
      return (
        <div className="space-y-2.5">
          {b.items.map((it, i) => {
            const I = BUTTON_ICON[it.icon] ?? Link2;
            return (
              <a
                key={i}
                href={href(it.url)}
                target={/^https?:/i.test(href(it.url)) ? "_blank" : undefined}
                rel="noopener"
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-bold shadow-sm transition active:scale-[0.98]"
                style={{ background: theme.primary, color: fg }}
              >
                <I className="h-5 w-5 flex-shrink-0" aria-hidden />
                <span className="flex-1 text-center">{it.label}</span>
                <span className="w-5" aria-hidden />
              </a>
            );
          })}
        </div>
      );

    case "social": {
      const items = SOCIALS.filter((s) => b.links[s.key]);
      if (!items.length) return null;
      return (
        <div className="flex flex-wrap justify-center gap-3">
          {items.map((s) => {
            const I = SOCIAL_ICON[s.key];
            return (
              <a
                key={s.key}
                href={socialUrl(s.key, b.links[s.key]!)}
                target="_blank"
                rel="noopener"
                aria-label={s.label}
                title={s.label}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"
                style={{ color: theme.primary }}
              >
                <I className="h-6 w-6" aria-hidden />
              </a>
            );
          })}
        </div>
      );
    }

    case "text":
      return (
        <section className={card}>
          {b.title && <h2 className="mb-2 text-base font-black text-gray-900">{b.title}</h2>}
          {b.body.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line text-sm leading-7 text-gray-600">
              {p}
            </p>
          ))}
        </section>
      );

    case "image":
      if (!b.images.length) return null;
      return (
        <figure className="space-y-2">
          <div className={b.images.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
            {b.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={b.caption || ""} loading="lazy" className="w-full rounded-2xl object-cover" />
            ))}
          </div>
          {b.caption && <figcaption className="text-center text-xs text-gray-500">{b.caption}</figcaption>}
        </figure>
      );

    case "products": {
      const list = b.productIds.map((id) => products[id]).filter(Boolean);
      if (!list.length) return null;
      return (
        <section className="space-y-2.5">
          {b.title && <h2 className="px-1 text-base font-black text-gray-900">{b.title}</h2>}
          <div className="grid grid-cols-2 gap-2.5">
            {list.map((p) => (
              <a key={p.id} href={p.url} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="aspect-square w-full bg-gray-50">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                  <p className="line-clamp-2 text-[12.5px] font-bold leading-5 text-gray-800">{p.title}</p>
                  <div className="mt-auto">
                    {!p.inStock ? (
                      <p className="text-xs font-bold text-gray-400">ناموجود</p>
                    ) : p.price > 0 ? (
                      <div className="text-left">
                        {p.salePrice !== null && <p className="text-[11px] text-gray-400 line-through">{fmtPrice(p.price)}</p>}
                        <p className="text-sm font-black text-gray-900">
                          {fmtPrice(p.salePrice ?? p.price)} <span className="text-[10px] font-bold text-gray-500">تومان</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-gray-500">تماس بگیرید</p>
                    )}
                  </div>
                  <span className="mt-1 rounded-xl py-1.5 text-center text-xs font-bold" style={{ background: theme.primary, color: fg }}>
                    مشاهده و خرید
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      );
    }

    case "callback":
      return <CallbackForm slug={slug} title={b.title} text={b.text} theme={theme} fg={fg} preview={preview} />;

    case "address": {
      const links = mapLinks(b.lat, b.lng);
      return (
        <section className={card}>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: theme.primary }} aria-hidden />
            <p className="text-sm leading-7 text-gray-700">{b.address || "موقعیت ما روی نقشه"}</p>
          </div>
          {links.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {links.map((l) => (
                <a
                  key={l.key}
                  href={l.url}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 py-2 text-xs font-bold text-gray-700"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden />
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </section>
      );
    }

    case "hours":
      return <HoursView days={b.days} note={b.note} theme={theme} />;

    case "faq":
      return (
        <section className={card}>
          {b.title && <h2 className="mb-2 text-base font-black text-gray-900">{b.title}</h2>}
          <div className="divide-y divide-gray-100">
            {b.items.filter((x) => x.q.trim()).map((x, i) => (
              <details key={i} className="group py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-gray-800">
                  {x.q}
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-600">{x.a}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case "review":
      // بدون سکوی تنظیم‌شده نمایش داده نمی‌شود — دکمه‌ی بی‌مقصد بدتر از نبودن است
      if (!reviewPlatforms.length) {
        return preview ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
            بلوک «ثبت نظر» تا وقتی آدرس نشان، بلد یا گوگل در «درخواست ثبت نظر» ثبت نشود نمایش داده نمی‌شود.
          </p>
        ) : null;
      }
      return (
        <section className={`${card} text-center`}>
          <Star className="mx-auto h-7 w-7" style={{ color: theme.primary }} aria-hidden />
          {b.title && <h2 className="mt-2 text-base font-black text-gray-900">{b.title}</h2>}
          {b.text && <p className="mt-1 text-sm leading-6 text-gray-500">{b.text}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {reviewPlatforms.map((p) => (
              <a key={p.key} href={p.url} className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: theme.primary, color: fg }}>
                {p.label}
              </a>
            ))}
          </div>
        </section>
      );
  }
}

const noopSubscribe = () => () => {};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => null;

function HoursView({ days, note, theme }: { days: HoursDay[]; note: string; theme: LandingTheme }) {
  // دقیقه‌ی جاری فقط در مرورگر؛ سرور `null` می‌دهد تا هیدریشن یکی بماند
  const minute = useSyncExternalStore(noopSubscribe, currentMinute, serverMinute);
  const now = minute === null ? null : new Date(minute * 60_000);
  const open = now ? openNow(days, now) : null;
  const today = now
    ? ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", weekday: "short" }).format(now),
      )
    : -1;

  return (
    <section className={card}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-black text-gray-900">ساعت کاری</h2>
        {open !== null && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${open ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {open ? "الان باز است" : "الان بسته است"}
          </span>
        )}
      </div>
      <ul className="space-y-1 text-sm">
        {days.map((d, i) => (
          <li
            key={i}
            className="flex justify-between rounded-lg px-2 py-1"
            style={i === today ? { background: `${theme.primary}14`, fontWeight: 700 } : undefined}
          >
            <span className="text-gray-700">{WEEKDAYS[i]}</span>
            <span className="tabular-nums text-gray-600" dir="ltr">
              {d.open ? `${d.from} – ${d.to}` : "تعطیل"}
            </span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs leading-6 text-gray-500">{note}</p>}
    </section>
  );
}

function CallbackForm({
  slug, title, text, theme, fg, preview,
}: { slug: string; title: string; text: string; theme: LandingTheme; fg: string; preview?: boolean }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; msg?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) {
      setState({ kind: "error", msg: "در پیش‌نمایش ارسال نمی‌شود." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const r = await fetch(`/api/store/landing/${encodeURIComponent(slug)}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, website: trap }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "ارسال نشد");
      setState({ kind: "done" });
    } catch (err) {
      setState({ kind: "error", msg: err instanceof Error ? err.message : "ارسال نشد" });
    }
  }

  const input = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

  return (
    <section className={card}>
      {title && <h2 className="text-base font-black text-gray-900">{title}</h2>}
      {text && <p className="mt-1 text-sm leading-6 text-gray-500">{text}</p>}
      {state.kind === "done" ? (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">
          درخواست شما ثبت شد؛ به‌زودی تماس می‌گیریم.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <input className={input} placeholder="نام (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <input
            className={input}
            placeholder="شماره موبایل"
            inputMode="tel"
            dir="ltr"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={14}
          />
          {/* فیلد تله — انسان نمی‌بیند */}
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            name="website"
          />
          {state.kind === "error" && <p className="text-xs font-bold text-red-600">{state.msg}</p>}
          <button
            type="submit"
            disabled={state.kind === "sending"}
            className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-60"
            style={{ background: theme.primary, color: fg }}
          >
            {state.kind === "sending" ? "در حال ارسال…" : "درخواست تماس"}
          </button>
        </form>
      )}
    </section>
  );
}
