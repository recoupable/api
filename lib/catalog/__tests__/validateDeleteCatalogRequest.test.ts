import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateDeleteCatalogRequest } from "../validateDeleteCatalogRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const catalogId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const makeRequest = () =>
  new NextRequest(`http://localhost/api/catalogs/${catalogId}`, { method: "DELETE" });

describe("validateDeleteCatalogRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth error when unauthenticated", async () => {
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const result = await validateDeleteCatalogRequest(makeRequest(), catalogId);

    expect(result).toBe(authErr);
  });

  it("400s a catalogId that is not a UUID", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });

    const result = await validateDeleteCatalogRequest(makeRequest(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      status: "error",
      error: "catalogId must be a valid UUID",
    });
  });

  it("returns the caller's account with the catalog id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });

    const result = await validateDeleteCatalogRequest(makeRequest(), catalogId);

    expect(result).toEqual({ accountId, catalogId });
  });
});
