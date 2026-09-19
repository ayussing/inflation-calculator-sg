import { z } from "zod";
import { YearMonthSchema } from "@/lib/cpi/schema";

export const PersonalInflationRequestSchema = z
  .object({
    from: YearMonthSchema,
    to: YearMonthSchema,
    categories: z
      .array(
        z.object({
          categoryCode: z.string().min(1),
          spend: z.number().nonnegative(),
        })
      )
      .min(1),
  })
  .refine((d) => d.from <= d.to, { message: "from must not be after to", path: ["from"] })
  .meta({ id: "PersonalInflationRequest" });

export type PersonalInflationRequest = z.infer<typeof PersonalInflationRequestSchema>;

// Field names match lib/inflation/calculate.ts's CategoryContribution exactly, so the route maps
// calculatePersonalInflation's result onto this schema with no field renaming.
export const CategoryContributionSchema = z
  .object({
    categoryCode: z.string(),
    weight: z.number(),
    displayWeightPercent: z.number().int(),
    categoryPercentChange: z.number(),
    contribution: z.number(),
  })
  .meta({ id: "CategoryContribution" });

export const PersonalInflationResponseSchema = z
  .object({
    personalInflationRate: z.number(),
    personalIndexStart: z.number(),
    personalIndexEnd: z.number(),
    headlineInflationRate: z.number(),
    resolvedPeriod: z.object({
      from: z.string(),
      to: z.string(),
      warnings: z.array(z.string()),
    }),
    contributions: z.array(CategoryContributionSchema),
  })
  .meta({ id: "PersonalInflationResponse" });

export type PersonalInflationResponse = z.infer<typeof PersonalInflationResponseSchema>;
