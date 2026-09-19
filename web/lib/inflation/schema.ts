import { z } from "zod";

export const PersonalInflationRequestSchema = z.object({
  from: z.string(),
  to: z.string(),
  categories: z
    .array(
      z.object({
        categoryCode: z.string(),
        spend: z.number().nonnegative(),
      })
    )
    .min(1),
});

export type PersonalInflationRequest = z.infer<
  typeof PersonalInflationRequestSchema
>;

export const PersonalInflationResponseSchema = z.object({
  personalInflationRate: z.number(),
  headlineInflationRate: z.number(),
  contributions: z.array(
    z.object({
      categoryCode: z.string(),
      weight: z.number(),
      percentChange: z.number(),
      contribution: z.number(),
    })
  ),
});

export type PersonalInflationResponse = z.infer<
  typeof PersonalInflationResponseSchema
>;
