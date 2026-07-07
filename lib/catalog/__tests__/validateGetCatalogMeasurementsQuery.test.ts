import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateGetCatalogMeasurementsQuery } from "../validateGetCatalogMeasurementsQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";

describe("validateGetCatalogMeasurementsQuery", () => {
  it("returns the validated request for a valid path catalogId with default pagination", () => {
    const result = validateGetCatalogMeasurementsQuery(new URLSearchParams(), catalogId);

    expect(result).toEqual({ catalogId, page: 1, limit: 50 });
  });

  it("returns 400 when the path catalogId is not a uuid", async () => {
    const result = validateGetCatalogMeasurementsQuery(new URLSearchParams(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
  });

  it("accepts an optional artist_account_id uuid", () => {
    const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ artist_account_id: artistAccountId }),
      catalogId,
    );

    expect(result).toEqual({
      catalogId,
      artist_account_id: artistAccountId,
      page: 1,
      limit: 50,
    });
  });

  it("returns 400 when artist_account_id is malformed", async () => {
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ artist_account_id: "not-a-uuid" }),
      catalogId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
  });

  it("accepts explicit page and limit", () => {
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ page: "3", limit: "100" }),
      catalogId,
    );

    expect(result).toEqual({ catalogId, page: 3, limit: 100 });
  });

  it("returns 400 when page is not a positive integer", () => {
    for (const page of ["0", "-1", "abc", "1.5"]) {
      const result = validateGetCatalogMeasurementsQuery(new URLSearchParams({ page }), catalogId);
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("returns 400 when limit is out of range", () => {
    for (const limit of ["0", "101", "abc"]) {
      const result = validateGetCatalogMeasurementsQuery(new URLSearchParams({ limit }), catalogId);
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("ignores a catalogId smuggled into the query string in favor of the path", () => {
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ catalogId: "b1814076-8e19-4a77-9dea-2ec150e26aaa" }),
      catalogId,
    );

    expect(result).toEqual({ catalogId, page: 1, limit: 50 });
  });
});
