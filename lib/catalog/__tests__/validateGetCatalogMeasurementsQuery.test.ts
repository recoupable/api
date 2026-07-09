import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetCatalogMeasurementsQuery } from "../validateGetCatalogMeasurementsQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

const makeRequest = (query = "") =>
  new NextRequest(`http://localhost/api/catalogs/${catalogId}/measurements${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "t",
  } as never);
});

describe("validateGetCatalogMeasurementsQuery", () => {
  it("returns the auth error before validating params when credentials are missing", async () => {
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr as never);

    const result = await validateGetCatalogMeasurementsQuery(makeRequest(), "not-a-uuid");

    expect(result).toBe(authErr);
  });

  it("returns the validated request with the caller accountId for a valid path catalogId", async () => {
    const result = await validateGetCatalogMeasurementsQuery(makeRequest(), catalogId);

    expect(result).toEqual({ accountId, catalogId, page: 1, limit: 50 });
  });

  it("returns 400 when the path catalogId is not a uuid", async () => {
    const result = await validateGetCatalogMeasurementsQuery(makeRequest(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
  });

  it("accepts an optional artist_account_id uuid", async () => {
    const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";
    const result = await validateGetCatalogMeasurementsQuery(
      makeRequest(`?artist_account_id=${artistAccountId}`),
      catalogId,
    );

    expect(result).toEqual({
      accountId,
      catalogId,
      artist_account_id: artistAccountId,
      page: 1,
      limit: 50,
    });
  });

  it("returns 400 when artist_account_id is malformed", async () => {
    const result = await validateGetCatalogMeasurementsQuery(
      makeRequest("?artist_account_id=not-a-uuid"),
      catalogId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
  });

  it("accepts explicit page and limit", async () => {
    const result = await validateGetCatalogMeasurementsQuery(
      makeRequest("?page=3&limit=100"),
      catalogId,
    );

    expect(result).toEqual({ accountId, catalogId, page: 3, limit: 100 });
  });

  it("returns 400 when page is not a positive integer", async () => {
    for (const page of ["0", "-1", "abc", "1.5"]) {
      const result = await validateGetCatalogMeasurementsQuery(
        makeRequest(`?page=${page}`),
        catalogId,
      );
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("returns 400 when limit is out of range", async () => {
    for (const limit of ["0", "101", "abc"]) {
      const result = await validateGetCatalogMeasurementsQuery(
        makeRequest(`?limit=${limit}`),
        catalogId,
      );
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("ignores a catalogId smuggled into the query string in favor of the path", async () => {
    const result = await validateGetCatalogMeasurementsQuery(
      makeRequest("?catalogId=b1814076-8e19-4a77-9dea-2ec150e26aaa"),
      catalogId,
    );

    expect(result).toEqual({ accountId, catalogId, page: 1, limit: 50 });
  });
});
