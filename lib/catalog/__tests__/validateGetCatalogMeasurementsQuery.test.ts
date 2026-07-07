import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateGetCatalogMeasurementsQuery } from "../validateGetCatalogMeasurementsQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";

describe("validateGetCatalogMeasurementsQuery", () => {
  it("returns the validated query for a valid catalogId", () => {
    const result = validateGetCatalogMeasurementsQuery(new URLSearchParams({ catalogId }));

    expect(result).toEqual({ catalogId });
  });

  it("returns 400 when catalogId is missing", async () => {
    const result = validateGetCatalogMeasurementsQuery(new URLSearchParams());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
  });

  it("returns 400 when catalogId is not a uuid", () => {
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ catalogId: "not-a-uuid" }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("accepts an optional artist_account_id uuid", () => {
    const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ catalogId, artist_account_id: artistAccountId }),
    );

    expect(result).toEqual({ catalogId, artist_account_id: artistAccountId });
  });

  it("returns 400 when artist_account_id is malformed", async () => {
    const result = validateGetCatalogMeasurementsQuery(
      new URLSearchParams({ catalogId, artist_account_id: "not-a-uuid" }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
  });
});
