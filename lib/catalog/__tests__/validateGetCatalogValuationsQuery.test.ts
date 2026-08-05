import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetCatalogValuationsQuery } from "../validateGetCatalogValuationsQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";

const makeRequest = (query = "") =>
  new NextRequest(`http://localhost/api/catalogs/${catalogId}/valuations${query}`);

const okAuth = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null } as never);

describe("validateGetCatalogValuationsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the auth error before touching params", async () => {
    const denied = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied as never);

    const result = await validateGetCatalogValuationsQuery(makeRequest(), catalogId);

    expect(result).toBe(denied);
  });

  it("returns the accountId, catalogId and default limit of 30", async () => {
    okAuth();

    const result = await validateGetCatalogValuationsQuery(makeRequest(), catalogId);

    expect(result).toEqual({ accountId, catalogId, limit: 30 });
  });

  it("accepts an explicit limit", async () => {
    okAuth();

    const result = await validateGetCatalogValuationsQuery(makeRequest("?limit=1"), catalogId);

    expect(result).toEqual({ accountId, catalogId, limit: 1 });
  });

  it("rejects a non-UUID catalogId with 400", async () => {
    okAuth();

    const result = await validateGetCatalogValuationsQuery(makeRequest(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects limit above 100 with 400", async () => {
    okAuth();

    const result = await validateGetCatalogValuationsQuery(makeRequest("?limit=101"), catalogId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects a non-numeric limit with 400", async () => {
    okAuth();

    const result = await validateGetCatalogValuationsQuery(makeRequest("?limit=abc"), catalogId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
