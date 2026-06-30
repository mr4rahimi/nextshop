import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const platforms = await prisma.integPlatform.findMany({
    where:   { isActive: true },
    include: { connections: true },
    orderBy: { type: "asc" },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">اتصالات</h1>
        <p className="text-sm text-gray-500 mt-1">اتصال به حسابداری و مارکت‌پلیس‌ها</p>
      </div>

      {["ACCOUNTING", "MARKETPLACE"].map(type => {
        const list = platforms.filter(p => p.type === type);
        if (!list.length) return null;
        return (
          <div key={type}>
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              {type === "ACCOUNTING" ? "حسابداری" : "مارکت‌پلیس‌ها"}
            </h2>
            <div className="space-y-2">
              {list.map(p => {
                const conn = p.connections[0];
                return (
                  <Link key={p.code} href={`/admin/integration/connections/${p.code}`}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] hover:border-blue-300 dark:hover:border-blue-500/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center font-black text-gray-500">
                      {p.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {conn ? `آخرین sync: ${conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString("fa-IR") : "هرگز"}` : "هنوز متصل نشده"}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                      conn?.status === "CONNECTED"
                        ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                        : "bg-gray-100 dark:bg-white/5 text-gray-500"
                    }`}>
                      {conn?.status === "CONNECTED" ? "متصل" : "غیر متصل"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
