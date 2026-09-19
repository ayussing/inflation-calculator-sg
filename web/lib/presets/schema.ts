import { z } from "zod";

export const PresetWeightSchema = z.object({
  categoryCode: z.string(),
  weightPer10000: z.number().int().min(0).max(10000),
});

export type PresetWeight = z.infer<typeof PresetWeightSchema>;

export const BasketPresetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  incomeGroup: z.string(),
  sourceYear: z.number().int(),
  weights: z.array(PresetWeightSchema),
});

export type BasketPreset = z.infer<typeof BasketPresetSchema>;

export const PresetsResponseSchema = z.object({
  presets: z.array(BasketPresetSchema),
});

export type PresetsResponse = z.infer<typeof PresetsResponseSchema>;
