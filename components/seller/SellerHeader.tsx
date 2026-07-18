"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  sellerName: string;
  storeName: string | null;
  storeLogo: string | null;
  clubName: string;
}

export default function SellerHeader({
  sellerName,
  storeName,
  storeLogo,
  clubName,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/seller/login");
    router.refresh();
  }

  return (
    <header className="border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0f1117]">
      <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-3">
        {storeLogo ? (
          <Image
            src={storeLogo}
            alt={storeName ?? ""}
            width={32}
            height={32}
            className="rounded-lg object-contain"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <span className="text-primary-600 text-xs font-black">
              {(storeName ?? "ب").slice(0, 1)}
            </span>
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[13px] font-black text-gray-900 dark:text-white truncate">
            {clubName}
          </p>
          <p className="text-[10px] font-bold text-gray-400 truncate">
            {sellerName}
          </p>
        </div>

        <button
          onClick={signOut}
          disabled={busy}
          className="mr-auto text-[11px] font-black text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
        >
          {busy ? "..." : "خروج"}
        </button>
      </div>
    </header>
  );
}