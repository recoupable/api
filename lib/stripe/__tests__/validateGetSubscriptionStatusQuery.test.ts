import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetSubscriptionStatusQuery } from "@/lib/stripe/validateGetSubscriptionStatusQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

function getRequest(url: string) {
  return new NextRequest(url, { headers: { "x-api-key": "test-key" } });
}

describe("validateGetSubscriptionStatusQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 { error: accountId is required } when accountId is missing", async () => {
    const req = getRequest("http://localhost/api/subscriptions/status");
    const res = await validateGetSubscriptionStatusQuery(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "accountId is required" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when accountId is empty string", async () => {
    const req = getRequest(`http://localhost/api/subscriptions/status?accountId=`);
    const res = await validateGetSubscriptionStatusQuery(req);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "accountId is required" });
  });

  it("returns 400 for invalid UUID", async () => {
    const req = getRequest(`http://localhost/api/subscriptions/status?accountId=not-a-uuid`);
    const res = await validateGetSubscriptionStatusQuery(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toMatch(/accountId must be a valid UUID/i);
  });

  it("maps auth failure to { error } and preserves status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const req = getRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`);
    const res = await validateGetSubscriptionStatusQuery(req);
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
  });

  it("returns accountId when auth succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "tok",
    });
    const req = getRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`);
    const res = await validateGetSubscriptionStatusQuery(req);
    expect(res).toEqual({ accountId: ACCOUNT });
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: ACCOUNT });
  });
});
