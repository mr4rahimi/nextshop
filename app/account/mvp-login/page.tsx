"use client";

import { useEffect, useState } from "react";
import { getMvpUserId, setMvpUserId } from "@/lib/mvpUser";

function makeLocalUserId(phone: string) {
  return "mvp_" + phone.replace(/\D/g, "");
}

export default function MvpLoginPage() {
  const [phone, setPhone] = useState("09123334444");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getMvpUserId());
  }, []);

  function loginLocal() {
    if (!phone || phone.length < 10) {
      alert("شماره صحیح وارد کن");
      return;
    }
    const uid = makeLocalUserId(phone);
    setMvpUserId(uid);
    setUserId(uid);
    alert("✅ برای MVP ذخیره شد");
  }

  function clear() {
    localStorage.removeItem("mvp_user_id");
    setUserId(null);
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-3">
      <h1 className="text-xl font-bold">MVP Login (Local)</h1>

      <input
        className="w-full border rounded p-2"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="شماره موبایل"
      />

      <button className="w-full rounded bg-black text-white p-2" onClick={loginLocal}>
        ورود (LocalStorage)
      </button>

      <button className="w-full rounded border p-2" onClick={clear}>
        پاک کردن userId
      </button>

      <div className="text-sm break-all">
        userId فعلی: <b>{userId ?? "ندارد"}</b>
      </div>

      <p className="text-sm opacity-70">
        این فقط برای MVP است. بعداً با NextAuth/Clerk جایگزین می‌شود.
      </p>
    </div>
  );
}
