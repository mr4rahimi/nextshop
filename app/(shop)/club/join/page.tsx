import { Suspense } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadPointRules } from "@/lib/club/points";
import ClubJoinClient from "@/components/club/ClubJoinClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "عضویت در باشگاه مشتریان",
  description: "عضو باشگاه مشتریان شوید و از تخفیف‌ها و جشنواره‌ها باخبر بمانید.",
  // ⚠️ صفحه‌ی فرود QR ارزش سئویی ندارد و نباید در نتایج بیاید؛ مقصدش فقط
  //    کسی است که کد را اسکن کرده.
  robots: { index: false, follow: false },
};

export default async function ClubJoinPage() {
  const [settings, rules] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { clubEnabled: true, clubName: true, storeName: true },
    }),
    loadPointRules(),
  ]);

  return (
    // useSearchParams باید داخل Suspense باشد وگرنه بیلد خطا می‌دهد
    <Suspense fallback={null}>
      <ClubJoinClient
        enabled={settings?.clubEnabled ?? false}
        clubName={settings?.clubName ?? null}
        storeName={settings?.storeName ?? null}
        signupPoints={rules.onSignup}
        consentPoints={rules.onConsent}
      />
    </Suspense>
  );
}
