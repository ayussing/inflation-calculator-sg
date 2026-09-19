import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./document";

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument();

  it("declares the expected OpenAPI version and info", () => {
    // Pinned to 3.0.3, not zod-openapi's default 3.1.x — see the comment in document.ts.
    expect(doc.openapi).toBe("3.0.3");
    expect(doc.info.title).toBe("Inflation Calculator SG API");
  });

  it("has exactly the expected path keys", () => {
    expect(Object.keys(doc.paths ?? {}).sort()).toEqual(
      [
        "/api/categories",
        "/api/cpi",
        "/api/health",
        "/api/inflation/personal",
        "/api/ingest",
        "/api/insights",
        "/api/presets",
      ].sort()
    );
  });

  it("uses the expected HTTP method per path", () => {
    const paths = doc.paths ?? {};
    expect(Object.keys(paths["/api/inflation/personal"] ?? {})).toContain("post");
    for (const path of [
      "/api/categories",
      "/api/cpi",
      "/api/health",
      "/api/ingest",
      "/api/insights",
      "/api/presets",
    ]) {
      expect(Object.keys(paths[path] ?? {})).toContain("get");
    }
  });

  it("declares the expected response status codes per operation", () => {
    const paths = doc.paths as Record<string, Record<string, { responses?: Record<string, unknown> }>>;

    const expected: Record<string, [string, string[]]> = {
      "/api/health": ["get", ["200", "503"]],
      "/api/ingest": ["get", ["200", "401", "500", "502"]],
      "/api/categories": ["get", ["200", "500"]],
      "/api/cpi": ["get", ["200", "400", "404", "500"]],
      "/api/presets": ["get", ["200", "500"]],
      "/api/inflation/personal": ["post", ["200", "400", "404", "422", "500"]],
      "/api/insights": ["get", ["200", "500", "503"]],
    };

    for (const [path, [method, statusCodes]] of Object.entries(expected)) {
      const responses = paths[path]?.[method]?.responses ?? {};
      expect(Object.keys(responses).sort()).toEqual([...statusCodes].sort());
    }
  });

  it("registers the expected component schema ids", () => {
    const schemaIds = Object.keys(doc.components?.schemas ?? {});
    for (const id of [
      "CpiSeries",
      "ErrorResponse",
      "PersonalInflationRequest",
      "PersonalInflationResponse",
      "IngestionResult",
      "InsightsResponse",
      "BasketPreset",
    ]) {
      expect(schemaIds).toContain(id);
    }
  });

  it("renders the /api/cpi from/to query params in pre-transform (YYYY-MM) form, not YYYY-MM-01", () => {
    const cpiGet = (
      doc.paths as Record<
        string,
        Record<string, { parameters?: { name: string; schema?: { allOf?: { $ref?: string }[] } }[] }>
      >
    )["/api/cpi"].get;
    const fromParam = cpiGet.parameters?.find((p) => p.name === "from");

    // Registered as a reusable component (YearMonthSchema has a `.meta({id})`), so the param
    // references it — OpenAPI 3.0 can't combine `$ref` with siblings, so zod-openapi wraps it in
    // `allOf: [{$ref}]`. Assert the referenced component renders the pre-transform shape.
    expect(fromParam?.schema?.allOf?.[0]?.$ref).toBe("#/components/schemas/YearMonth");

    const yearMonthComponent = (
      doc.components?.schemas as Record<string, { pattern?: string; example?: string }> | undefined
    )?.YearMonth;
    expect(yearMonthComponent?.pattern).toBe("^\\d{4}-\\d{2}$");
    expect(yearMonthComponent?.example).toBe("2024-01");
  });

  it("registers the bearer auth security scheme, used only by /api/ingest", () => {
    expect(doc.components?.securitySchemes?.bearerAuth).toBeDefined();
    const paths = doc.paths as Record<string, Record<string, { security?: unknown }>>;
    expect(paths["/api/ingest"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/health"].get.security).toBeUndefined();
  });
});
