import { z, type ZodType } from "zod";
import { createDocument } from "zod-openapi";
import { CategoriesResponseSchema, CpiResponseSchema, YearMonthSchema } from "@/lib/cpi/schema";
import { PresetsResponseSchema } from "@/lib/presets/schema";
import {
  PersonalInflationRequestSchema,
  PersonalInflationResponseSchema,
} from "@/lib/inflation/schema";
import { InsightsResponseSchema } from "@/lib/insights/schema";
import { ErrorResponseSchema } from "@/lib/http/apiError";

// Ad hoc, documentation-only schemas for the two routes that predate the Zod-schema convention
// (health, ingest) — their runtime logic isn't Zod-validated, so these describe the response
// shapes without being wired into the actual route handlers.
const HealthOkResponseSchema = z
  .object({ status: z.literal("ok"), db: z.literal("ok") })
  .meta({ id: "HealthOkResponse" });

const HealthErrorResponseSchema = z
  .object({ status: z.literal("error"), db: z.literal("error"), message: z.string() })
  .meta({ id: "HealthErrorResponse" });

const IngestErrorResponseSchema = z
  .object({ status: z.literal("error"), message: z.string() })
  .meta({ id: "IngestErrorResponse" });

// Matches lib/ingestion/runIngestion.ts's IngestionResult exactly.
const IngestionResultSchema = z
  .object({
    runId: z.number().int(),
    status: z.enum(["success", "failed"]),
    rowsUpserted: z.number().int(),
    error: z.string().optional(),
  })
  .meta({
    id: "IngestionResult",
    description: "Result of an ingestion run; returned for both 200 (success) and 502 (failed).",
  });

function jsonResponse(description: string, schema: ZodType) {
  return { description, content: { "application/json": { schema } } };
}

function errorResponse(description: string) {
  return jsonResponse(description, ErrorResponseSchema);
}

export function buildOpenApiDocument() {
  return createDocument({
    // Pinned to 3.0.3 (not zod-openapi's default 3.1.x) because swagger-ui-react's OpenAPI 3.1
    // parser (@swagger-api/apidom-ns-openapi3-1) throws `OpenApi3_1Element.refract is not a
    // function` under Turbopack's ESM bundling. 3.0.x uses swagger-ui's older, stable parser.
    openapi: "3.0.3",
    info: {
      title: "Inflation Calculator SG API",
      version: "0.1.0",
      description:
        "Personal inflation calculator API: CPI category/time-series data, official basket presets, the core personal-inflation calculation, and precomputed insights.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Bearer token matching the server's INGEST_SECRET env var.",
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          summary: "Liveness and readiness check",
          responses: {
            200: jsonResponse("Service and database are healthy.", HealthOkResponseSchema),
            503: jsonResponse("Database is unreachable.", HealthErrorResponseSchema),
          },
        },
      },
      "/api/ingest": {
        get: {
          summary: "Trigger a CPI data ingestion run",
          security: [{ bearerAuth: [] }],
          responses: {
            200: jsonResponse("Ingestion completed successfully.", IngestionResultSchema),
            401: jsonResponse("Missing or invalid bearer token.", IngestErrorResponseSchema),
            500: jsonResponse(
              "INGEST_SECRET is not configured, or an unexpected error occurred.",
              IngestErrorResponseSchema
            ),
            502: jsonResponse("Ingestion ran but reported failure.", IngestionResultSchema),
          },
        },
      },
      "/api/categories": {
        get: {
          summary: "List CPI categories",
          responses: {
            200: jsonResponse("The full CPI category tree.", CategoriesResponseSchema),
            500: errorResponse("Unexpected server error."),
          },
        },
      },
      "/api/cpi": {
        get: {
          summary: "Get CPI time series for one or more categories",
          requestParams: {
            query: z.object({
              categories: z.string().meta({
                description: "Comma-separated category codes.",
                example: "all-items,all-items/food",
              }),
              from: YearMonthSchema.optional(),
              to: YearMonthSchema.optional(),
            }),
          },
          responses: {
            200: jsonResponse("Long-format CPI observations.", CpiResponseSchema),
            400: errorResponse("Invalid query parameters (bad format, or from after to)."),
            404: errorResponse("One or more requested category codes do not exist."),
            500: errorResponse("Unexpected server error."),
          },
        },
      },
      "/api/presets": {
        get: {
          summary: "List official basket weight presets by income group",
          responses: {
            200: jsonResponse("All basket presets with their category weights.", PresetsResponseSchema),
            500: errorResponse("Unexpected server error."),
          },
        },
      },
      "/api/inflation/personal": {
        post: {
          summary: "Calculate a personal inflation rate from a spending basket",
          requestBody: {
            content: { "application/json": { schema: PersonalInflationRequestSchema } },
          },
          responses: {
            200: jsonResponse(
              "Personal inflation rate, headline comparison, and per-category contributions.",
              PersonalInflationResponseSchema
            ),
            400: errorResponse("Invalid request body, or from after to."),
            404: errorResponse("One or more requested category codes do not exist."),
            422: errorResponse("No usable CPI data for the requested categories/period."),
            500: errorResponse("Unexpected server error."),
          },
        },
      },
      "/api/insights": {
        get: {
          summary: "Get precomputed general insights (top movers, income-group divergence, volatility)",
          responses: {
            200: jsonResponse("Precomputed insight summary.", InsightsResponseSchema),
            500: errorResponse("Unexpected server error."),
            503: errorResponse("No CPI data has been ingested yet."),
          },
        },
      },
    },
  });
}
