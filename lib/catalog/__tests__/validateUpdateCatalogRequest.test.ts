import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateUpdateCatalogRequest } from "../validateUpdateCatalogRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const catalogId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const makeRequest = (body: unknown) =>
  new NextRequest(`http://localhost/api/catalogs/${catalogId}`, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const okAuth = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });

describe("validateUpdateCatalogRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth error before reading the body", async () => {
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const result = await validateUpdateCatalogRequest(makeRequest({ name: "X" }), catalogId);

    expect(result).toBe(authErr);
  });

  it("400s a catalogId that is not a UUID", async () => {
    okAuth();

    const result = await validateUpdateCatalogRequest(makeRequest({ name: "X" }), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      status: "error",
      error: "catalogId must be a valid UUID",
    });
  });

  it("400s a missing name", async () => {
    okAuth();

    const result = await validateUpdateCatalogRequest(makeRequest({}), catalogId);

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      status: "error",
      missing_fields: ["name"],
      error: "name is required",
    });
  });

  it("400s an empty or whitespace-only name", async () => {
    okAuth();

    const result = await validateUpdateCatalogRequest(makeRequest({ name: "   " }), catalogId);

    expect(result).toBeInstanceOf(NextResponse);
    expect(await (result as NextResponse).json()).toMatchObject({
      error: "name must not be empty",
    });
  });

  it("returns the trimmed name with the caller's account and catalog", async () => {
    okAuth();

    const result = await validateUpdateCatalogRequest(
      makeRequest({ name: "  Bad Bunny  " }),
      catalogId,
    );

    expect(result).toEqual({ accountId, catalogId, name: "Bad Bunny" });
  });
});
