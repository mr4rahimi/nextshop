/**
 * اطلاعات فروشگاه برای چت — docs/plans/storefront-chat.md بخش ۳
 *
 * همه از داده‌ای که مدیر قبلاً جای دیگر پنل ثبت کرده: تنظیمات سایت (تماس، آدرس، نماد)،
 * روش‌های ارسال (`ShippingMethod`) و برگه‌ها (قوانین، مرجوعی، درباره ما). فیلدهای قدیمی
 * تنظیمات چت (`chatSettings`) فقط وقتی خوانده می‌شوند که جای اصلی خالی است یا متنی دارند
 * که جای دیگری نیست (ارسال، گارانتی، درباره‌ی کسب‌وکار).
 *
 * ⚠️ کارت بانکی، کلید پیامک و درگاه هرگز بیرون نمی‌روند — select صریح است.
 */
import { prisma } from "@/lib/prisma";
import { normalizePageBlocks } from "@/lib/pages";
import { FEE_PAYER_LABELS, slaLabel } from "@/lib/shipping-methods";
import { htmlToText, priceLabel } from "./text";

export type LegacyChatSettings = {
  phone?: string;
  email?: string;
  address?: string;
  workingHours?: string;
  socials?: { instagram?: string; telegram?: string; whatsapp?: string };
  shippingInfo?: string;
  shippingCost?: string;
  warrantyInfo?: string;
  aboutBusiness?: string;
  faq?: { question: string; answer: string }[];
  welcomeMessage?: string;
  isEnabled?: boolean;
};

const pick = (...vals: (string | null | undefined)[]) => vals.map((v) => v?.trim()).find(Boolean) || null;

export async function loadStoreBasics() {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      storeName: true, siteDescription: true, sitePhone: true, siteEmail: true, siteAddress: true, siteCity: true,
      siteProvince: true, openingHours: true, socialInstagram: true, socialTelegram: true, socialWhatsapp: true,
      enamadCode: true, samanCode: true, chatSettings: true,
    },
  });
  return { s, chat: ((s?.chatSettings as LegacyChatSettings | null) ?? {}) as LegacyChatSettings };
}

export async function storeInfo() {
  const [{ s, chat }, shipping, pages] = await Promise.all([
    loadStoreBasics(),
    prisma.shippingMethod.findMany({
      where: { isActive: true, useInCheckout: true },
      orderBy: { sortOrder: "asc" },
      select: { title: true, type: true, fee: true, feePayer: true, slaMinutes: true, cities: true, description: true },
    }),
    prisma.page.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, title: true, template: true, blocks: true } }),
  ]);

  const contactPage = pages.find((p) => p.template === "CONTACT");
  const contact = contactPage ? normalizePageBlocks(contactPage.blocks).contact : null;
  const address = pick([s?.siteProvince, s?.siteCity, s?.siteAddress].filter(Boolean).join("، "), contact?.address, chat.address);

  return {
    storeName: s?.storeName?.trim() || null,
    about: pick(chat.aboutBusiness, s?.siteDescription),
    contact: {
      phone: pick(s?.sitePhone, contact?.phone, chat.phone),
      mobile: contact?.mobile?.trim() || null,
      email: pick(s?.siteEmail, contact?.email, chat.email),
      address,
      workingHours: pick(chat.workingHours, contact?.workHours, s?.openingHours),
      instagram: pick(s?.socialInstagram, chat.socials?.instagram),
      telegram: pick(s?.socialTelegram, chat.socials?.telegram),
      whatsapp: pick(s?.socialWhatsapp, chat.socials?.whatsapp),
    },
    // نماد فقط «دارد/ندارد» — کد خام به کار مشتری نمی‌آید و نشانش پایین سایت است
    trust: { enamad: !!s?.enamadCode?.trim(), samandehi: !!s?.samanCode?.trim() },
    shippingMethods: shipping.map((m) => ({
      title: m.title,
      kind: m.type === "EXPRESS" ? "پیک / تحویل سریع" : "ارسال عادی",
      fee: m.feePayer === "FREE" ? "رایگان" : m.feePayer === "COLLECT" ? FEE_PAYER_LABELS.COLLECT : m.fee > BigInt(0) ? priceLabel(m.fee) : "طبق تعرفه",
      deliveryTime: slaLabel(m.slaMinutes),
      cities: m.cities.length ? m.cities.slice(0, 15) : "همه‌ی شهرها",
      description: m.description?.trim() || null,
    })),
    shippingNotes: pick([chat.shippingInfo, chat.shippingCost].filter((t) => t?.trim()).join("\n")),
    warrantyNotes: chat.warrantyInfo?.trim() || null,
    pages: pages.map((p) => ({ slug: p.slug, title: p.title, url: `/${p.slug}` })),
  };
}

/** متن یک برگه (قوانین، مرجوعی، …) — با نامک یا بخشی از عنوان */
export async function readPage(slugOrTitle: string) {
  const key = slugOrTitle.trim().replace(/^\//, "");
  const page =
    (await prisma.page.findFirst({ where: { slug: key, isActive: true } })) ??
    (await prisma.page.findFirst({ where: { title: { contains: key, mode: "insensitive" }, isActive: true } }));
  if (!page) return { found: false, note: "این برگه نیست؛ فهرست برگه‌ها در store_info است" };
  const blocks = normalizePageBlocks(page.blocks);
  return {
    found: true,
    title: page.title,
    url: `/${page.slug}`,
    text: htmlToText(page.contentHtml ?? "", 5000),
    faq: blocks.faq.slice(0, 20).map((f) => ({ question: f.q, answer: f.a })),
  };
}
