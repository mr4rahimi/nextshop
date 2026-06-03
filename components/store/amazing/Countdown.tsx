"use client";
 import React from "react"
import { useEffect, useState } from "react";

interface Props {
  endsAt?: string; // ISO date string
}

export default function Countdown({ endsAt }: Props) {
  const [time, setTime] = useState({ hours: "00", minutes: "00", seconds: "00" });

  useEffect(() => {
    const target = endsAt ? new Date(endsAt) : (() => {
      const d = new Date();
      d.setHours(d.getHours() + 8);
      return d;
    })();

    const interval = setInterval(() => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTime({ hours: "00", minutes: "00", seconds: "00" });
        clearInterval(interval);
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTime({
        hours: String(h).padStart(2, "0"),
        minutes: String(m).padStart(2, "0"),
        seconds: String(s).padStart(2, "0"),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

    return (
    <div className="bg-black/5 dark:bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border border-black/5 dark:border-white/10 shadow-inner" dir="ltr">
      <div className="flex flex-row-reverse justify-between items-center text-center gap-2">
        {(["seconds", "minutes", "hours"] as const).map((item, i) => (
          <React.Fragment key={item}>
            <div key={item} className="flex flex-col items-center">
              <span className="text-3xl font-black text-gray-900 dark:text-secondary-400 tracking-tighter">
                {time[item]}
              </span>
            </div>
            {i !== 2 && (
              <span key={`sep-${i}`} className="text-secondary-500 font-black animate-pulse text-2xl pb-1">:</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
