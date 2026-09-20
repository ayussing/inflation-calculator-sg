// Fixed categorical palette for Recharts series (JS color values, not CSS variables — Recharts
// takes color props directly). Colorblind-friendly-ish, works reasonably on light and dark panels.
export const CHART_COLORS = [
  "#2563eb",
  "#d97706",
  "#059669",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

export function chartColorFor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
