"use client";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import type { PersonalInflationResponse } from "@/lib/inflation/schema";

type Contribution = PersonalInflationResponse["contributions"][number];
type Row = Contribution & { id: string; label: string };

function SignedPercent({ value }: { value: number }) {
  const tone = value > 0 ? "text-negative" : value < 0 ? "text-positive" : "";
  const sign = value > 0 ? "+" : "";
  return <span className={tone}>{`${sign}${value.toFixed(1)}%`}</span>;
}

export function ContributionBreakdown({
  contributions,
  categoryLabels,
}: {
  contributions: Contribution[];
  categoryLabels: Record<string, string>;
}) {
  const rows: Row[] = contributions
    .map((c) => ({ ...c, id: c.categoryCode, label: categoryLabels[c.categoryCode] ?? c.categoryCode }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const total = contributions.reduce((sum, c) => sum + c.contribution, 0);

  const columns: DataTableColumn<Row>[] = [
    { key: "label", header: "Category", render: (row) => row.label },
    { key: "weight", header: "Share of spend", align: "right", render: (row) => `${row.displayWeightPercent}%` },
    {
      key: "change",
      header: "Price change",
      align: "right",
      render: (row) => <SignedPercent value={row.categoryPercentChange} />,
    },
    {
      key: "contribution",
      header: "Contribution",
      align: "right",
      render: (row) => <SignedPercent value={row.contribution} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      footer={["Total", "", "", <SignedPercent key="total" value={total} />]}
    />
  );
}
