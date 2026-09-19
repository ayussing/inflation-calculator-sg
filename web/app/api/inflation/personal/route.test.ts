import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cpiRepository from "@/lib/cpi/repository";
import { POST } from "./route";

vi.mock("@/lib/cpi/repository");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/inflation/personal", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/inflation/personal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 on an invalid request body", async () => {
    const response = await POST(makeRequest({ from: "2023-01", to: "2024-01", categories: [] }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.status).toBe("error");
  });

  it("returns 404 when a requested category code does not exist", async () => {
    vi.mocked(cpiRepository.getSeriesByCodes).mockResolvedValue([
      { id: 1, code: "all-items", name: "All Items", level: 0, parentId: null, baseYear: 2024 },
    ]);

    const response = await POST(
      makeRequest({
        from: "2023-01",
        to: "2024-01",
        categories: [{ categoryCode: "all-items/not-a-real-category", spend: 100 }],
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.message).toContain("all-items/not-a-real-category");
  });

  it("returns 200 with the calculated result on a valid request", async () => {
    vi.mocked(cpiRepository.getSeriesByCodes).mockResolvedValue([
      { id: 1, code: "all-items", name: "All Items", level: 0, parentId: null, baseYear: 2024 },
      { id: 2, code: "all-items/food", name: "Food", level: 1, parentId: 1, baseYear: 2024 },
    ]);
    vi.mocked(cpiRepository.getAvailablePeriods).mockResolvedValue(["2023-01-01", "2024-01-01"]);
    vi.mocked(cpiRepository.getObservationsByCodesAndPeriods).mockResolvedValue([
      { categoryCode: "all-items", periodDate: "2023-01-01", indexValue: 100 },
      { categoryCode: "all-items", periodDate: "2024-01-01", indexValue: 103 },
      { categoryCode: "all-items/food", periodDate: "2023-01-01", indexValue: 100 },
      { categoryCode: "all-items/food", periodDate: "2024-01-01", indexValue: 108 },
    ]);

    const response = await POST(
      makeRequest({
        from: "2023-01",
        to: "2024-01",
        categories: [{ categoryCode: "all-items/food", spend: 500 }],
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.personalInflationRate).toBeCloseTo(8, 10);
    expect(body.headlineInflationRate).toBeCloseTo(3, 10);
    expect(body.resolvedPeriod).toEqual({ from: "2023-01-01", to: "2024-01-01", warnings: [] });
    expect(body.contributions).toHaveLength(1);
    expect(body.contributions[0].categoryCode).toBe("all-items/food");
  });
});
