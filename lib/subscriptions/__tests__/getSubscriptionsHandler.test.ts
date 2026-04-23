import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSubscriptionsHandler } from "../getSubscriptionsHandler";
import { validateGetSubscriptionRequest } from "../validateGetSubscriptionRequest";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { isEnterprise } from "@/lib/enterprise/isEnterprise";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetSubscriptionRequest", () => ({
  validateGetSubscriptionRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/enterprise/isEnterprise", () => ({
  isEnterprise: vi.fn(),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const makeRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${accountId}/subscription`, { method: "GET" });

describe("getSubscriptionsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the validator error when validation fails", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue(err);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));

    expect(res).toBe(err);
    expect(selectAccountEmails).not.toHaveBeenCalled();
  });

  it("returns 404 when the account has no emails", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ status: "error", error: "Account not found" });
  });

  it("returns 200 isEnterprise for enterprise accounts without calling Stripe", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountEmails).mockResolvedValue([
      { email: "someone@recoupable.com" },
    ] as never);
    vi.mocked(isEnterprise).mockReturnValue(true);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "success", isEnterprise: true });
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns 404 when no active subscription exists for a non-enterprise account", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "user@example.com" }] as never);
    vi.mocked(isEnterprise).mockReturnValue(false);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ status: "error", error: "No active subscription found" });
  });

  it("returns 200 with the subscription for a paid account", async () => {
    const subscription = {
      id: "sub_123",
      metadata: { accountId },
    } as never;
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "user@example.com" }] as never);
    vi.mocked(isEnterprise).mockReturnValue(false);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(subscription);

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      subscription: { id: "sub_123", metadata: { accountId } },
    });
    expect(getActiveSubscriptionDetails).toHaveBeenCalledWith(accountId);
  });

  it("returns 500 generic error and never leaks the raw exception message", async () => {
    vi.mocked(validateGetSubscriptionRequest).mockResolvedValue({ accountId });
    vi.mocked(selectAccountEmails).mockRejectedValue(
      new Error("db down: connection refused at 10.0.0.1:5432"),
    );

    const res = await getSubscriptionsHandler(makeRequest(), Promise.resolve({ id: accountId }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    expect(body.error).not.toContain("db down");
  });
});
