import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetPaymentsParams } from "@/lib/billing/validateGetPaymentsParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const req = (query = "") =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payments${query}`);

beforeEach(() => vi.clearAllMocks());

describe("validateGetPaymentsParams", () => {
  it("returns 400 for a non-UUID id without calling auth", async () => {
    const res = await validateGetPaymentsParams(req(), "nope");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({
      status: "error",
      error: "id must be a valid UUID",
    });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when limit is out of range", async () => {
    const res = await validateGetPaymentsParams(req("?limit=0"), ACCOUNT);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({
      status: "error",
      error: "limit must be between 1 and 100",
    });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when limit is not an integer", async () => {
    const res = await validateGetPaymentsParams(req("?limit=abc"), ACCOUNT);
    expect((res as NextResponse).status).toBe(400);
  });

  it("forwards the auth failure response", async () => {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied);
    const res = await validateGetPaymentsParams(req(), ACCOUNT);
    expect(res).toBe(denied);
    expect(validateAuthContext).toHaveBeenCalledWith(expect.any(NextRequest), {
      accountId: ACCOUNT,
    });
  });

  it("returns the account id with default limit and no cursor", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    await expect(validateGetPaymentsParams(req(), ACCOUNT)).resolves.toEqual({
      accountId: ACCOUNT,
      limit: 20,
      startingAfter: undefined,
    });
  });

  it("returns the parsed limit and cursor when provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    await expect(
      validateGetPaymentsParams(req("?limit=5&startingAfter=in_123"), ACCOUNT),
    ).resolves.toEqual({ accountId: ACCOUNT, limit: 5, startingAfter: "in_123" });
  });
});
