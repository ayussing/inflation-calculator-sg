import { calculateCategoryPercentChange } from "@/lib/inflation/calculate";

// Sample standard deviation (ddof=1) of month-over-month % change across a sorted observation
// series. Pure, no I/O. Returns null when there are too few observations (<3, i.e. <2 % changes)
// for a meaningful stddev, so callers can exclude the category rather than report a misleading 0.
export function calculateVolatility(
  observations: { periodDate: string; indexValue: number }[]
): number | null {
  const sorted = [...observations].sort((a, b) => a.periodDate.localeCompare(b.periodDate));
  if (sorted.length < 3) return null;

  const changes: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    changes.push(calculateCategoryPercentChange(sorted[i - 1].indexValue, sorted[i].indexValue));
  }

  const mean = changes.reduce((sum, c) => sum + c, 0) / changes.length;
  const variance =
    changes.reduce((sum, c) => sum + (c - mean) ** 2, 0) / (changes.length - 1);
  return Math.sqrt(variance);
}

// Pure date-string arithmetic on "YYYY-MM-01" values — avoids pulling in a date library for two
// simple offsets.
export function subtractYears(periodDate: string, years: number): string {
  const [y, m, d] = periodDate.split("-");
  return `${String(Number(y) - years).padStart(4, "0")}-${m}-${d}`;
}

export function subtractMonths(periodDate: string, months: number): string {
  const [y, m] = periodDate.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) - months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}-01`;
}
