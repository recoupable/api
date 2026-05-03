import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetSubscriptionStatusRequest } from "@/lib/stripe/validateGetSubscriptionStatusRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth/validateAccountIdOverride", () => ({
  validateAccountIdOverride: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("validateGetSubscriptionStatusRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 { error } when accountId is missing", async () => {
    const req = new NextRequest(`http://localhost/api/subscriptions/status`, {
      headers: { "x-api-key": "k" },
    });
    const res = await validateGetSubscriptionStatusRequest(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "accountId is required" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 { error } when accountId is not a valid UUID", async () => {
    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=not-a-uuid`, {
      headers: { "x-api-key": "k" },
    });
    const res = await validateGetSubscriptionStatusRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const j = await (res as NextResponse).json();
    expect(j).toEqual({ error: expect.stringMatching(/uuid|UUID|valid/i) });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("maps auth failure to { error }", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`, {
      headers: {},
    });
    const res = await validateGetSubscriptionStatusRequest(req);
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(validateAccountIdOverride).not.toHaveBeenCalled();
  });

  it("maps account override denial to { error }", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    vi.mocked(validateAccountIdOverride).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );
    const other = "123e4567-e89b-12d3-a456-426614174001";
    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${other}`, {
      headers: { "x-api-key": "k" },
    });
    const res = await validateGetSubscriptionStatusRequest(req);
    expect((res as NextResponse).status).toBe(403);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "Access denied to specified account_id",
    });
  });

  it("returns accountId when auth and override succeed", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: ACCOUNT });

    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`, {
      headers: { "x-api-key": "k" },
    });
    const out = await validateGetSubscriptionStatusRequest(req);
    expect(out).toEqual({ accountId: ACCOUNT });
    expect(validateAccountIdOverride).toHaveBeenCalledWith({
      currentAccountId: ACCOUNT,
      targetAccountId: ACCOUNT,
    });
  });
});
