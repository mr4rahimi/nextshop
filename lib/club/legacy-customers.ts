/**
 * انتقال مشتریان از نرم‌افزار قبلی (وب حساب) — docs/plans/webhesab-parity.md بخش ۲۴.
 *
 * ورودی: جدول خروجی `scripts/webhesab/export-customers.py` (یا هر اکسلی با همین سرستون‌ها).
 * هر سطر = یک مشتری با کد تفصیل. برای هر سطر:
 *   - پرونده‌ی `LegacyCustomer` (کلید = کد) — اجرای دوباره همان را به‌روز می‌کند؛
 *   - موبایل معتبر و فعال ← کاربر + عضو باشگاه (بی امتیاز عضویت/رضایت، چون امتیاز اعتبار پولی است)؛
 *   - شخص حسابداری (مشتری) با `externalCode` = کد، تا صندوق با نام/موبایل پیدایش کند و
 *     ورود مانده‌ی اشخاص با همان کد بخورد. یک موبایل = یک شخص.
 *   - گروه امتیازدهی ← برچسب عضو (`وب حساب: vip`)، نه سطح (تصمیم کاربر: سطح فقط با کارت).
 * پر کردن فقط خالی‌ها: نام، تولد و نشانی‌ای که در پنل عوض شده بازنویسی نمی‌شود.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "./phone";
import { parseJalaliInput, toJalali } from "./jalali";
import { recomputePurchaseStatsMany } from "./profile";
import { GLOBAL_SEQ } from "@/lib/accounting/ledger/sequence";
import { PARTY_CODE_START } from "@/lib/accounting/parties";

type Tx = Prisma.TransactionClient;

export class LegacyError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export const LEGACY_SOURCE = "وب حساب";
export const groupTag = (g: string) => `${LEGACY_SOURCE}: ${g}`;

const HEADERS: Record<string, string[]> = {
  code: ["کد", "کد تفصیل", "کد مشتری", "کد شخص", "code"],
  sourceId: ["شناسه وب حساب", "شماره پرونده", "debtor_no"],
  name: ["نام", "مشتری", "نام مشتری", "name"],
  mobile: ["موبایل", "تلفن همراه", "شماره موبایل", "mobile"],
  phone: ["تلفن", "تلفن ثابت", "phone"],
  address: ["آدرس", "نشانی", "address"],
  region: ["منطقه", "منطقه فروش", "شهر"],
  store: ["انبار", "انبار پیش فرض", "فروشگاه"],
  group: ["گروه", "گروه امتیازدهی", "گروه فروش"],
  card: ["شماره کارت", "شماره کارت اشتراک"],
  registered: ["تاریخ ثبت"],
  status: ["وضعیت"],
  gender: ["جنسیت"],
  birth: ["تاریخ تولد"],
  marriage: ["تاریخ ازدواج"],
  invoices: ["تعداد فاکتور"],
  spentRial: ["مبلغ خرید (ریال)"],
  spentToman: ["مبلغ خرید (تومان)", "مبلغ خرید"],
  last: ["آخرین خرید", "تاریخ آخرین خرید"],
};
const norm = (h: string) => h.replace(/[‌\s_]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
const latin = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const cleanName = (v: string) => v.replace(/\s+/g, " ").replace(/[\s.]+$/, "").replace(/^[\s.]+/, "").trim();
const opt = (v: string) => (v.trim() ? v.trim() : null);

export interface LegacyRow {
  line: number;
  code: string;
  sourceId: string | null;
  name: string;
  mobile: string | null;
  rawMobile: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  store: string | null;
  group: string | null;
  card: string | null;
  registeredAt: Date | null;
  isActive: boolean;
  gender: "MALE" | "FEMALE" | null;
  legal: boolean;
  birthRaw: string | null;
  marriageRaw: string | null;
  /** تاریخ تولد پذیرفته‌شده؛ null اگر خالی یا مشکوک */
  birth: Date | null;
  invoices: number;
  spent: bigint;
  lastAt: Date | null;
}

/** تاریخ تولد پیش‌فرض/مشکوک: برابر تاریخ ازدواج (پیش‌فرض فرم)، صفر، یا کمتر از ۵ سال پیش */
function acceptBirth(raw: string | null, marriage: string | null): Date | null {
  if (!raw || /^0+\/0+\/0+$/.test(raw)) return null;
  if (marriage && raw === marriage) return null;
  const d = parseJalaliInput(raw);
  if (!d) return null;
  const y = toJalali(d).year;
  const now = toJalali(new Date()).year;
  if (y < 1290 || y > now - 5) return null;
  return d;
}

/** جدول (سطر اول سرستون) ← سطرهای یکدست + خطا و هشدار */
export function parseLegacy(table: string[][], unit: "rial" | "toman" = "rial") {
  const head = (table[0] ?? []).map((h) => norm(String(h ?? "")));
  const col = (k: string) => head.findIndex((h) => HEADERS[k].some((a) => norm(a) === h));
  const idx = Object.fromEntries(Object.keys(HEADERS).map((k) => [k, col(k)]));
  if (idx.code < 0) throw new LegacyError("ستون «کد» (کد تفصیل مشتری) در سطر اول پیدا نشد");
  if (idx.name < 0) throw new LegacyError("ستون «نام» در سطر اول پیدا نشد");
  const errors: { line: number; text: string }[] = [];
  const warnings: { line: number; text: string }[] = [];
  const rows: LegacyRow[] = [];
  const seen = new Map<string, number>();
  table.slice(1).forEach((raw, i) => {
    const line = i + 2;
    if (!raw.some((c) => String(c ?? "").trim())) return;
    const v = (k: string) => (idx[k] >= 0 ? String(raw[idx[k]] ?? "").trim() : "");
    const code = latin(v("code")).replace(/\s/g, "");
    if (!code) return errors.push({ line, text: "کد مشتری خالی است" });
    if (seen.has(code)) return errors.push({ line, text: `کد ${code} تکراری است (سطر ${seen.get(code)})` });
    seen.set(code, line);
    const name = cleanName(v("name"));
    if (!name) return errors.push({ line, text: `نام مشتری ${code} خالی است` });
    const rawMobile = opt(v("mobile"));
    const mobile = rawMobile ? normalizePhone(latin(rawMobile)) : null;
    if (rawMobile && !mobile && latin(rawMobile).replace(/\D/g, "").replace(/^0+$/, "")) warnings.push({ line, text: `موبایل «${rawMobile}» درست نیست — فقط شخص حسابداری ساخته می‌شود` });
    const num = (k: string) => {
      const x = latin(v(k)).replace(/[,،٬\s]/g, "");
      if (!x) return 0;
      const n = Number(x);
      if (!Number.isFinite(n)) {
        errors.push({ line, text: `«${v(k)}» عدد نیست` });
        return 0;
      }
      return n;
    };
    let spent = 0n;
    if (idx.spentRial >= 0) spent = BigInt(Math.round(num("spentRial") / 10));
    else if (idx.spentToman >= 0) spent = BigInt(Math.round(unit === "rial" ? num("spentToman") / 10 : num("spentToman")));
    const date = (k: string) => {
      const x = latin(v(k));
      if (!x) return null;
      const d = parseJalaliInput(x.split(/\s/)[0]);
      if (!d) warnings.push({ line, text: `تاریخ «${v(k)}» شمسی درست نیست` });
      return d;
    };
    const birthRaw = opt(latin(v("birth")));
    const marriageRaw = opt(latin(v("marriage")));
    const g = v("gender");
    const st = v("status");
    rows.push({
      line,
      code,
      sourceId: opt(v("sourceId")),
      name,
      mobile,
      rawMobile,
      phone: opt(latin(v("phone")).replace(/[^\d]/g, "")),
      address: opt(v("address")),
      region: opt(v("region")),
      store: opt(v("store")),
      group: opt(v("group")),
      card: opt(v("card")),
      registeredAt: date("registered"),
      isActive: !/غیر\s*فعال|inactive/i.test(st),
      gender: g === "آقا" || /^m/i.test(g) ? "MALE" : g === "خانم" || /^f/i.test(g) ? "FEMALE" : null,
      legal: g === "شرکت",
      birthRaw,
      marriageRaw,
      birth: acceptBirth(birthRaw, marriageRaw),
      invoices: Math.max(0, Math.round(num("invoices"))),
      spent: spent < 0n ? 0n : spent,
      lastAt: date("last"),
    });
  });
  return { rows, errors, warnings };
}

/** پیش‌نمایش: شمارش‌ها در برابر داده‌ی فعلی پنل (چیزی نوشته نمی‌شود) */
export async function previewLegacy(table: string[][], unit: "rial" | "toman" = "rial") {
  const { rows, errors, warnings } = parseLegacy(table, unit);
  const mobiles = [...new Set(rows.filter((r) => r.mobile && r.isActive).map((r) => r.mobile!))];
  const byMobile = new Map<string, number>();
  for (const r of rows) if (r.mobile) byMobile.set(r.mobile, (byMobile.get(r.mobile) ?? 0) + 1);
  const [users, legacy, parties] = await Promise.all([
    chunked(mobiles, (m) => prisma.user.findMany({ where: { phone: { in: m } }, select: { phone: true } })),
    chunked(rows.map((r) => r.code), (c) => prisma.legacyCustomer.findMany({ where: { code: { in: c } }, select: { code: true } })),
    chunked(rows.map((r) => r.code), (c) => prisma.accParty.findMany({ where: { externalCode: { in: c } }, select: { externalCode: true } })),
  ]);
  const groups: Record<string, number> = {};
  for (const r of rows) if (r.group) groups[r.group] = (groups[r.group] ?? 0) + 1;
  return {
    errors,
    warnings: warnings.slice(0, 200),
    warningCount: warnings.length,
    sample: rows.slice(0, 30),
    summary: {
      rows: rows.length,
      active: rows.filter((r) => r.isActive).length,
      inactive: rows.filter((r) => !r.isActive).length,
      withMobile: rows.filter((r) => r.mobile).length,
      noMobile: rows.filter((r) => !r.mobile).length,
      members: mobiles.length,
      sharedMobiles: [...byMobile.values()].filter((n) => n > 1).length,
      existingUsers: users.length,
      newUsers: mobiles.length - users.length,
      alreadyImported: legacy.length,
      existingParties: parties.length,
      birthKept: rows.filter((r) => r.birth).length,
      birthDropped: rows.filter((r) => r.birthRaw && !r.birth).length,
      buyers: rows.filter((r) => r.invoices > 0 || r.spent > 0n).length,
      invoices: rows.reduce((a, r) => a + r.invoices, 0),
      spent: rows.reduce((a, r) => a + r.spent, 0n),
      groups,
      cards: rows.filter((r) => r.card).length,
    },
  };
}

async function chunked<T, R>(list: T[], fn: (part: T[]) => Promise<R[]>, size = 5000): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < list.length; i += size) out.push(...(await fn(list.slice(i, i + size))));
  return out;
}

/** چند شماره‌ی پیوسته یک‌جا (کد شخص) — مثل `nextNumber` ولی بلوکی */
async function reserveNumbers(tx: Tx, key: string, count: number, start: number): Promise<number> {
  const rows = await tx.$queryRaw<{ n: number }[]>`
    INSERT INTO "AccSequence" ("yearId", "key", "next")
    VALUES (${GLOBAL_SEQ}, ${key}, ${start + count})
    ON CONFLICT ("yearId", "key") DO UPDATE SET "next" = "AccSequence"."next" + ${count}
    RETURNING ("next" - ${count})::int AS n
  `;
  return Number(rows[0].n);
}

export interface CommitResult {
  rows: number;
  newUsers: number;
  newMembers: number;
  newParties: number;
  linkedParties: number;
  consented: number;
}

/**
 * ثبت یک دسته (رابط دسته‌های ۵۰۰تایی می‌فرستد). همه‌ی دسته در یک تراکنش؛ خطا = هیچ.
 * `consent`: رضایت پیامک برای عضوهای تازه‌ی همین ورود (مشتری‌ای که در پنل لغو کرده نه).
 */
export async function commitLegacy(rows: LegacyRow[], opts: { consent: boolean; actor: string }): Promise<CommitResult> {
  const res: CommitResult = { rows: rows.length, newUsers: 0, newMembers: 0, newParties: 0, linkedParties: 0, consented: 0 };
  if (!rows.length) return res;
  const touched = new Set<string>();
  await prisma.$transaction(
    async (tx) => {
      const now = new Date();
      // ── کاربر و عضو باشگاه (موبایل معتبر، مشتری فعال) ──
      const live = rows.filter((r) => r.mobile && r.isActive);
      const mobiles = [...new Set(live.map((r) => r.mobile!))];
      const first = new Map<string, LegacyRow>();
      for (const r of live) if (!first.has(r.mobile!)) first.set(r.mobile!, r);
      const had = await tx.user.findMany({ where: { phone: { in: mobiles } }, select: { phone: true } });
      const hadSet = new Set(had.map((u) => u.phone));
      const fresh = mobiles.filter((m) => !hadSet.has(m));
      if (fresh.length) {
        res.newUsers = (
          await tx.user.createMany({
            data: fresh.map((m) => ({ phone: m, lastName: first.get(m)!.name, role: "CUSTOMER" as const, passwordHash: null, createdAt: first.get(m)!.registeredAt ?? now })),
            skipDuplicates: true,
          })
        ).count;
      }
      const users = await tx.user.findMany({
        where: { phone: { in: mobiles } },
        select: { id: true, phone: true, firstName: true, lastName: true, clubProfile: { select: { id: true, birthDate: true, gender: true, tags: true } } },
      });
      const userOf = new Map(users.map((u) => [u.phone, u]));
      // نام خالی کاربر موجود
      for (const u of users) {
        if (!u.firstName && !u.lastName && first.get(u.phone)) await tx.user.update({ where: { id: u.id }, data: { lastName: first.get(u.phone)!.name } });
      }
      const noProfile = users.filter((u) => !u.clubProfile);
      if (noProfile.length) {
        res.newMembers = (
          await tx.clubProfile.createMany({
            data: noProfile.map((u) => {
              const r = first.get(u.phone)!;
              const seen = r.registeredAt ?? now;
              const b = r.birth ? toJalali(r.birth) : null;
              return {
                userId: u.id,
                source: "IN_STORE" as const,
                firstSource: "IN_STORE" as const,
                firstSeenAt: seen,
                joinedAt: seen,
                gender: r.gender,
                birthDate: r.birth,
                birthMonth: b?.month ?? null,
                birthDay: b?.day ?? null,
                note: `از ${LEGACY_SOURCE} (کد ${r.code})`,
              };
            }),
            skipDuplicates: true,
          })
        ).count;
      }
      const profiles = await tx.clubProfile.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        select: { id: true, userId: true, birthDate: true, gender: true, tags: true, smsConsent: true },
      });
      const profileOf = new Map(profiles.map((p) => [p.userId, p]));
      const newProfileIds = new Set(noProfile.map((u) => profileOf.get(u.id)?.id).filter(Boolean) as string[]);
      for (const u of users) {
        const p = profileOf.get(u.id);
        if (!p) continue;
        const rs = live.filter((r) => r.mobile === u.phone);
        const data: Prisma.ClubProfileUpdateInput = {};
        const b = rs.find((r) => r.birth)?.birth;
        if (!p.birthDate && b) {
          const j = toJalali(b);
          Object.assign(data, { birthDate: b, birthMonth: j.month, birthDay: j.day });
        }
        const g = rs.find((r) => r.gender)?.gender;
        if (!p.gender && g) data.gender = g;
        const tags = [...new Set(rs.filter((r) => r.group).map((r) => groupTag(r.group!)))].filter((t) => !p.tags.includes(t));
        if (tags.length) data.tags = { set: [...p.tags, ...tags] };
        if (Object.keys(data).length) await tx.clubProfile.update({ where: { id: p.id }, data });
        touched.add(u.id);
      }
      // رضایت پیامک فقط برای عضوهای تازه و نه شماره‌ای که لغو کرده
      if (opts.consent && newProfileIds.size) {
        const fresh = profiles.filter((p) => newProfileIds.has(p.id) && !p.smsConsent);
        const out = new Set(
          (await tx.smsOptOut.findMany({ where: { phone: { in: users.filter((u) => fresh.some((p) => p.userId === u.id)).map((u) => u.phone) } }, select: { phone: true } })).map((o) => o.phone),
        );
        const ok = fresh.filter((p) => !out.has(users.find((u) => u.id === p.userId)!.phone));
        if (ok.length) {
          await tx.clubProfile.updateMany({ where: { id: { in: ok.map((p) => p.id) } }, data: { smsConsent: true, consentAt: now } });
          await tx.clubConsentEvent.createMany({
            data: ok.map((p) => ({ profileId: p.id, channel: "SMS" as const, granted: true, source: "IMPORT" as const, note: `مشتری ${LEGACY_SOURCE} — ${opts.actor}` })),
          });
          res.consented = ok.length;
        }
      }

      // ── شخص حسابداری ──
      const codes = rows.map((r) => r.code);
      const userIds = users.map((u) => u.id);
      const [legacy, byCode, byUser, byMob] = await Promise.all([
        tx.legacyCustomer.findMany({ where: { code: { in: codes } }, select: { code: true, partyId: true } }),
        tx.accParty.findMany({ where: { externalCode: { in: codes } }, select: { id: true, externalCode: true, userId: true, mobile: true, mergedIntoId: true } }),
        tx.accParty.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, externalCode: true, mobile: true, mergedIntoId: true } }),
        tx.accParty.findMany({ where: { mobile: { in: [...new Set(rows.filter((r) => r.mobile).map((r) => r.mobile!))] } }, select: { id: true, userId: true, externalCode: true, mobile: true, mergedIntoId: true } }),
      ]);
      const partyById = new Map<string, { id: string; userId: string | null; externalCode: string | null; mobile: string | null; mergedIntoId: string | null }>();
      for (const p of [...byCode, ...byUser, ...byMob]) partyById.set(p.id, p);
      const legacyParty = new Map(legacy.map((l) => [l.code, l.partyId]));
      const partyOfUser = new Map(byUser.map((p) => [p.userId!, p.id]));
      const partyOfMobile = new Map<string, string>();
      for (const p of byMob) if (!p.mergedIntoId && !partyOfMobile.has(p.mobile!)) partyOfMobile.set(p.mobile!, p.id);
      const partyOfCode = new Map(byCode.map((p) => [p.externalCode!, p.id]));

      const toCreate: LegacyRow[] = [];
      const chosen = new Map<string, string>(); // code → partyId
      const planned = new Map<string, LegacyRow>(); // موبایل ← اولین سطر تازه‌ی همین دسته
      for (const r of rows) {
        const u = r.mobile ? userOf.get(r.mobile) : undefined;
        let pid = legacyParty.get(r.code) ?? partyOfCode.get(r.code) ?? (u ? partyOfUser.get(u.id) : undefined) ?? (r.mobile ? partyOfMobile.get(r.mobile) : undefined);
        if (pid && partyById.get(pid)?.mergedIntoId) pid = partyById.get(pid)!.mergedIntoId!;
        if (pid) chosen.set(r.code, pid);
        else if (r.mobile && planned.has(r.mobile)) continue; // هم‌موبایلِ سطر تازه‌ی قبلی — بعد از ساخت
        else {
          toCreate.push(r);
          if (r.mobile) planned.set(r.mobile, r);
        }
      }
      if (toCreate.length) {
        const start = await reserveNumbers(tx, "party", toCreate.length, PARTY_CODE_START);
        await tx.accParty.createMany({
          data: toCreate.map((r, i) => {
            const u = r.mobile && r.isActive ? userOf.get(r.mobile) : undefined;
            return {
              code: start + i,
              personType: r.legal ? ("LEGAL" as const) : ("REAL" as const),
              name: r.name,
              lastName: r.legal ? null : r.name,
              companyName: r.legal ? r.name : null,
              mobile: r.mobile,
              phone: r.phone,
              address: r.address,
              city: r.region,
              isCustomer: true,
              isActive: r.isActive,
              externalCode: r.code,
              userId: u && !partyOfUser.has(u.id) ? u.id : null,
              note: `از ${LEGACY_SOURCE}${r.registeredAt ? ` — ثبت ${toJalaliStr(r.registeredAt)}` : ""}`,
            };
          }),
        });
        res.newParties = toCreate.length;
        const made = await tx.accParty.findMany({ where: { externalCode: { in: toCreate.map((r) => r.code) } }, select: { id: true, externalCode: true, mobile: true, userId: true } });
        for (const p of made) {
          chosen.set(p.externalCode!, p.id);
          if (p.mobile) partyOfMobile.set(p.mobile, p.id);
          if (p.userId) partyOfUser.set(p.userId, p.id);
        }
        // هم‌موبایل‌های همین دسته به همان شخص
        for (const r of rows) if (!chosen.has(r.code) && r.mobile && partyOfMobile.has(r.mobile)) chosen.set(r.code, partyOfMobile.get(r.mobile)!);
      }
      // شخص موجود: وصل به کاربر، کد قبلی و فیلدهای خالی
      const existing = rows.filter((r) => chosen.has(r.code) && !toCreate.includes(r));
      if (existing.length) {
        const ps = await tx.accParty.findMany({ where: { id: { in: [...new Set(existing.map((r) => chosen.get(r.code)!))] } } });
        const pmap = new Map(ps.map((p) => [p.id, p]));
        for (const r of existing) {
          const p = pmap.get(chosen.get(r.code)!);
          if (!p) continue;
          const u = r.mobile && r.isActive ? userOf.get(r.mobile) : undefined;
          const data: Prisma.AccPartyUncheckedUpdateInput = {};
          if (!p.externalCode) data.externalCode = r.code;
          if (!p.isCustomer) data.isCustomer = true;
          if (u && !p.userId && !partyOfUser.has(u.id)) {
            data.userId = u.id;
            partyOfUser.set(u.id, p.id);
            res.linkedParties++;
          }
          if (!p.mobile && r.mobile && !partyOfMobile.has(r.mobile)) data.mobile = r.mobile;
          if (!p.phone && r.phone) data.phone = r.phone;
          if (!p.address && r.address) data.address = r.address;
          if (!p.city && r.region) data.city = r.region;
          if (Object.keys(data).length) {
            const next = await tx.accParty.update({ where: { id: p.id }, data });
            pmap.set(p.id, next);
          }
        }
      }

      // ── پرونده‌ی قبلی ──
      for (const r of rows) {
        const u = r.mobile && r.isActive ? userOf.get(r.mobile) : undefined;
        const data = {
          source: LEGACY_SOURCE,
          sourceId: r.sourceId,
          name: r.name,
          mobile: r.mobile,
          rawMobile: r.rawMobile,
          phone: r.phone,
          address: r.address,
          region: r.region,
          store: r.store,
          groupName: r.group,
          cardNumber: r.card,
          gender: r.gender,
          birthDate: r.birthRaw,
          marriageDate: r.marriageRaw,
          registeredAt: r.registeredAt,
          isActive: r.isActive,
          invoiceCount: r.invoices,
          spent: r.spent,
          lastPurchaseAt: r.lastAt,
          partyId: chosen.get(r.code) ?? null,
          userId: u?.id ?? null,
        };
        await tx.legacyCustomer.upsert({ where: { code: r.code }, create: { code: r.code, ...data }, update: data });
        if (u) touched.add(u.id);
      }
      await recomputePurchaseStatsMany([...touched], tx);
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
  return res;
}

function toJalaliStr(d: Date) {
  const j = toJalali(d);
  return `${j.year}/${String(j.month).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
}

/** فهرست پرونده‌های قبلی برای صفحه‌ی انتقال (جستجو، صفحه‌بندی) */
export async function listLegacy(q: { search?: string; filter?: "all" | "noMobile" | "inactive" | "buyers" | "unlinked"; page?: number }) {
  const where: Prisma.LegacyCustomerWhereInput = {};
  const s = q.search?.trim();
  if (s) {
    const d = latin(s).replace(/\s/g, "");
    where.OR = [{ name: { contains: s, mode: "insensitive" } }, { code: d }, ...(d.length >= 4 ? [{ mobile: { contains: d } }] : [])];
  }
  if (q.filter === "noMobile") where.mobile = null;
  if (q.filter === "inactive") where.isActive = false;
  if (q.filter === "buyers") where.invoiceCount = { gt: 0 };
  if (q.filter === "unlinked") where.partyId = null;
  const page = Math.max(1, q.page ?? 1);
  const [total, rows, agg] = await Promise.all([
    prisma.legacyCustomer.count({ where }),
    prisma.legacyCustomer.findMany({ where, orderBy: [{ spent: "desc" }, { code: "asc" }], skip: (page - 1) * 50, take: 50 }),
    prisma.legacyCustomer.aggregate({ _count: { _all: true }, _sum: { spent: true, invoiceCount: true }, _max: { updatedAt: true } }),
  ]);
  const profiles = await prisma.clubProfile.findMany({ where: { userId: { in: rows.map((r) => r.userId).filter(Boolean) as string[] } }, select: { id: true, userId: true } });
  const pOf = new Map(profiles.map((p) => [p.userId, p.id]));
  const [members, noMobile, inactive] = await Promise.all([
    prisma.legacyCustomer.count({ where: { userId: { not: null } } }),
    prisma.legacyCustomer.count({ where: { mobile: null } }),
    prisma.legacyCustomer.count({ where: { isActive: false } }),
  ]);
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / 50)),
    rows: rows.map((r) => ({ ...r, profileId: r.userId ? pOf.get(r.userId) ?? null : null })),
    totals: { all: agg._count._all, spent: agg._sum.spent ?? 0n, invoices: agg._sum.invoiceCount ?? 0, lastImport: agg._max.updatedAt, members, noMobile, inactive },
  };
}

/** سابقه‌ی نرم‌افزار قبلی یک کاربر یا شخص — برای صفحه‌ی عضو و صفحه‌ی شخص */
export async function legacyOf(where: { userId?: string; partyId?: string }) {
  if (!where.userId && !where.partyId) return [];
  return prisma.legacyCustomer.findMany({
    where: { OR: [...(where.userId ? [{ userId: where.userId }] : []), ...(where.partyId ? [{ partyId: where.partyId }] : [])] },
    orderBy: { code: "asc" },
    select: { code: true, source: true, name: true, store: true, region: true, groupName: true, registeredAt: true, invoiceCount: true, spent: true, lastPurchaseAt: true, isActive: true, cardNumber: true },
  });
}
