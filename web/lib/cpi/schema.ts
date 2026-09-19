import { z } from "zod";

export const CpiSeriesSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().nonnegative(),
  parentId: z.number().int().positive().nullable(),
  baseYear: z.number().int(),
});

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
