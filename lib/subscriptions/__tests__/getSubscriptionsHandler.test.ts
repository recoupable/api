import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSubscriptionsHandler } from "../getSubscriptionsHandler";
import { validateGetSubscriptionRequest } from "../validateGetSubscriptionRequest";
import { getAccountSubscription } from "../getAccountSubscription";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetSubscriptionRequest", () => ({
  validateGetSubscriptionRequest: vi.fn(),
}));

vi.mock("../getAccountSubscription", () => ({
  getAccountSubscription: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const validated = { account_id: accountId };
const makeRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${accountId}/subscription`, { method: "GET" });

describe("getSubscriptionsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the validator error when validation fails", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue(err);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res).toBe(err);
    expect(getAccountSubscription).not.toHaveBeenCalled();
  });

  it("returns 200 isEnterprise for enterprise accounts", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue(validated);
    vi.mocked(getAccountSubscription).mockResolvedValue({ isEnterprise: true });

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", isEnterprise: true });
  });

  it("returns 200 with the subscription for a paid account", async () => {
    const subscription = { id: "sub_123", metadata: { accountId } } as never;
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue(validated);
    vi.mocked(getAccountSubscription).mockResolvedValue({ subscription });

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "success",
      subscription: { id: "sub_123", metadata: { accountId } },
    });
    expect(getAccountSubscription).toHaveBeenCalledWith(accountId);
  });

  it("returns 404 when no active subscription exists", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue(validated);
    vi.mocked(getAccountSubscription).mockResolvedValue(null);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "No active subscription found" });
  });

  it("returns 500 generic error and never leaks the raw exception message", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue(validated);
    vi.mocked(getAccountSubscription).mockImplementation(() => {
      throw new Error("db down: connection refused at 10.0.0.1:5432");
    });

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    expect(body.error).not.toContain("db down");
  });
});
