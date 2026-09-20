"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartColorFor } from "../_lib/chartColors";

export function BasketAllocationChart({
  slices,
}: {
  slices: { categoryCode: string; label: string; spend: number }[];
}) {
  const total = slices.reduce((sum, s) => sum + s.spend, 0);

  if (total <= 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-foreground/60">
        Enter amounts to see your basket
      </div>
    );
  }

  const data = slices.filter((s) => s.spend > 0);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="spend" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.categoryCode} fill={chartColorFor(index)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, entry) => {
              const numeric = typeof value === "number" ? value : Number(value);
              const percent = total > 0 ? ((numeric / total) * 100).toFixed(0) : "0";
              const label = (entry?.payload as { label?: string } | undefined)?.label ?? "";
              return [`S$${numeric.toLocaleString()} (${percent}%)`, label];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
