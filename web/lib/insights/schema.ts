import { z } from "zod";

export const TopInflationWindowSchema = z
  .object({
    years: z.number().int().positive(),
    from: z.string(),
    to: z.string(),
    warnings: z.array(z.string()),
    insufficientData: z.boolean(),
    topCategories: z.array(z.object({ categoryCode: z.string(), percentChange: z.number() })),
  })
  .meta({ id: "TopInflationWindow" });

export const IncomeGroupInflationSchema = z
  .object({
    presetId: z.number().int(),
    name: z.string(),
    incomeGroup: z.string(),
    personalInflationRate: z.number(),
  })
  .meta({ id: "IncomeGroupInflation" });

export const InsightsResponseSchema = z
  .object({
    asOf: z.string(),
    highestInflationByWindow: z.array(TopInflationWindowSchema),
    incomeGroupDivergence: z.object({
      from: z.string(),
      to: z.string(),
      warnings: z.array(z.string()),
      byIncomeGroup: z.array(IncomeGroupInflationSchema),
      divergencePoints: z.number(),
    }),
    mostVolatileCategories: z.object({
      windowMonths: z.literal(24),
      from: z.string(),
      to: z.string(),
      categories: z.array(
        z.object({
          categoryCode: z.string(),
          volatility: z.number(),
          monthsObserved: z.number().int(),
        })
      ),
    }),
  })
  .meta({ id: "InsightsResponse" });

export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;
