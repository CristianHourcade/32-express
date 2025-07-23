import { Tooltip } from "react-tooltip"; // o cualquier lib de tooltip que uses
import { Building } from "lucide-react";

export default function RankingCard({
  businesses,
  currentBusinessId,
  monthlySales,
}: {
  businesses: { id: string; name: string }[];
  currentBusinessId?: string;
  monthlySales: { business_id: string; total: number }[];
}) {
  const totalsMap = new Map<string, number>();

  monthlySales.forEach((s) => {
    totalsMap.set(s.business_id, (totalsMap.get(s.business_id) || 0) + s.total);
  });

  const sorted = [...totalsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, total]) => ({
      id,
      name: businesses.find((b) => b.id === id)?.name ?? "Sin nombre",
      total,
    }));

  const max = sorted[0]?.total || 1;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-md border border-slate-200 dark:border-slate-700 space-y-6">
      <h2 className="text-2xl font-bold text-center text-indigo-600 dark:text-indigo-300">🏆 Ranking de Locales</h2>

      <ul className="space-y-4">
        {sorted.map((biz, i) => {
          const percent = Math.round((biz.total / max) * 100);
          const isCurrent = biz.id === currentBusinessId;

          const icon =
            i === 0 ? "🥇" :
            i === 1 ? "🥈" :
            i === 2 ? "🥉" :
            `#${i + 1}`;

          const ahead = sorted[i - 1];
          const diff = ahead ? ahead.total - biz.total : 0;
          const percentBehind = ahead && diff > 0 ? Math.round((diff / ahead.total) * 100) : 0;

          return (
            <li
              key={biz.id}
              className={`rounded-xl p-4 border flex items-center justify-between gap-4 transition-all ${
                isCurrent
                  ? "bg-green-100 dark:bg-green-900/20 border-green-400 shadow-lg"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              }`}
            >
              <div className="flex items-center gap-3 w-full">
                <span className="text-2xl">{icon}</span>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{biz.name}</p>

                  {isCurrent && percentBehind > 0 && ahead && (
                    <p className="text-xs text-amber-600 mt-1">
                      🔥 Estás a {percentBehind}% de superar a <strong>{ahead.name}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="w-1/3 hidden sm:block">
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isCurrent ? "bg-green-500" : "bg-indigo-500"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
