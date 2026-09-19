import { z } from "zod";

export const CpiSeriesSchema = z
  .object({
    id: z.number().int().positive(),
    code: z.string().min(1),
    name: z.string().min(1),
    level: z.number().int().nonnegative(),
    parentId: z.number().int().positive().nullable(),
    baseYear: z.number().int(),
  })
  .meta({ id: "CpiSeries", description: "A CPI category/series definition." });

export type CpiSeries = z.infer<typeof CpiSeriesSchema>;

// Shape used to upsert a series before it has a DB-assigned id.
export const NewCpiSeriesSchema = CpiSeriesSchema.omit({ id: true });

export type NewCpiSeries = z.infer<typeof NewCpiSeriesSchema>;

export const CpiObservationSchema = z.object({
  seriesId: z.number().int().positive(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-01$/, "periodDate must be YYYY-MM-01"),
  indexValue: z.number(),
});

export type CpiObservation = z.infer<typeof CpiObservationSchema>;

// External API params use YYYY-MM (no day-of-month); normalized to the stored YYYY-MM-01 form.
export const YearMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "must be in YYYY-MM format")
  .transform((s) => `${s}-01`)
  .meta({ id: "YearMonth", description: "Year-month in YYYY-MM format.", example: "2024-01" });

export const CategoriesResponseSchema = z
  .object({
    categories: z.array(CpiSeriesSchema),
  })
  .meta({ id: "CategoriesResponse" });

export type CategoriesResponse = z.infer<typeof CategoriesResponseSchema>;

export const CpiQuerySchema = z
  .object({
    categories: z
      .string()
      .min(1, "categories is required")
      .transform((s) =>
        s
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      )
      .pipe(z.array(z.string().min(1)).min(1, "at least one category code is required")),
    from: YearMonthSchema.optional(),
    to: YearMonthSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "from must not be after to",
    path: ["from"],
  });

export type CpiQuery = z.infer<typeof CpiQuerySchema>;

export const CpiObservationEntrySchema = z
  .object({
    categoryCode: z.string(),
    periodDate: z.string(),
    indexValue: z.number(),
  })
  .meta({ id: "CpiObservationEntry" });

export const CpiResponseSchema = z
  .object({
    series: z.array(CpiObservationEntrySchema),
  })
  .meta({ id: "CpiResponse" });

export type CpiResponse = z.infer<typeof CpiResponseSchema>;
