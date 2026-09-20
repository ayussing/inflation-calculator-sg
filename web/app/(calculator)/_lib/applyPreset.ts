import type { BasketPreset } from "@/lib/presets/schema";
import type { BasketEntry } from "./basketUrl";

/** Presets only carry relative weights, not dollar amounts. Splits a user-supplied total monthly
 * spend across categories proportional to the preset's weights; categories the calculator doesn't
 * know about (not in `knownCodes`) are dropped and reported, mirroring the URL basket's handling
 * of unknown category codes. */
export function presetToBasket(
  preset: BasketPreset,
  totalSpend: number,
  knownCodes: ReadonlySet<string>
): { basket: BasketEntry[]; droppedCodes: string[] } {
  const basket: BasketEntry[] = [];
  const droppedCodes: string[] = [];

  for (const weight of preset.weights) {
    if (!knownCodes.has(weight.categoryCode)) {
      droppedCodes.push(weight.categoryCode);
      continue;
    }
    const spend = Math.round((weight.weightPer10000 / 10000) * totalSpend);
    if (spend > 0) {
      basket.push({ categoryCode: weight.categoryCode, spend });
    }
  }

  return { basket, droppedCodes };
}
