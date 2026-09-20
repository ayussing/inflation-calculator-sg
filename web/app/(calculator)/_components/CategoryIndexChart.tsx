"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CpiResponse } from "@/lib/cpi/schema";
import { chartColorFor } from "../_lib/chartColors";

type SeriesPoint = CpiResponse["series"][number];

function pivotByPeriod(series: SeriesPoint[]): Record<string, string | number>[] {
  const byPeriod = new Map<string, Record<string, string | number>>();
  for (const point of series) {
    const row = byPeriod.get(point.periodDate) ?? { periodDate: point.periodDate };
    row[point.categoryCode] = point.indexValue;
    byPeriod.set(point.periodDate, row);
  }
  return Array.from(byPeriod.values()).sort((a, b) =>
    String(a.periodDate).localeCompare(String(b.periodDate))
  );
}

export function CategoryIndexChart({
  codes,
  series,
  labelByCode,
}: {
  codes: string[];
  series: SeriesPoint[];
  labelByCode: Record<string, string>;
}) {
  const data = pivotByPeriod(series);
  const codesWithData = new Set(series.map((point) => point.categoryCode));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-panel-border" />
          <XAxis dataKey="periodDate" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {codes
            .filter((code) => codesWithData.has(code))
            .map((code, index) => (
              <Line
                key={code}
                type="monotone"
                dataKey={code}
                name={labelByCode[code] ?? code}
                stroke={chartColorFor(index)}
                dot={false}
                connectNulls={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
