export type RangePreset = "12m" | "5y" | "10y" | "custom";

export const RANGE_PRESET_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "12m", label: "12 months" },
  { value: "5y", label: "5 years" },
  { value: "10y", label: "10 years" },
  { value: "custom", label: "Custom" },
];

export function formatYearMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseYearMonth(yearMonth: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export function isValidYearMonth(yearMonth: string): boolean {
  return parseYearMonth(yearMonth) !== null;
}

export function presetToRange(
  preset: Exclude<RangePreset, "custom">,
  today: Date = new Date()
): { from: string; to: string } {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const from = new Date(to);
  const monthsBack = preset === "12m" ? 12 : preset === "5y" ? 5 * 12 : 10 * 12;
  from.setUTCMonth(from.getUTCMonth() - monthsBack);
  return { from: formatYearMonth(from), to: formatYearMonth(to) };
}
