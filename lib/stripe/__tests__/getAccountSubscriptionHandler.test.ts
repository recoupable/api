import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAccountSubscriptionHandler } from "@/lib/stripe/getAccountSubscriptionHandler";

import { validateAccountSubscriptionParams } from "@/lib/stripe/validateAccountSubscriptionParams";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateAccountSubscriptionParams", () => ({
  validateAccountSubscriptionParams: vi.fn(),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/getOrgSubscription", () => ({
  getOrgSubscription: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const buildRequest = () => new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/subscription`);

const buildParams = () => Promise.resolve({ id: ACCOUNT });

describe("getAccountSubscriptionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards validation/auth errors as { error } with original status", async () => {
    const denial = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAccountSubscriptionParams).mockResolvedValue(denial);

    const res = await getAccountSubscriptionHandler(buildRequest(), buildParams());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns the resource shape for an active account subscription", async () => {
    vi.mocked(validateAccountSubscriptionParams).mockResolvedValue(ACCOUNT);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
      id: "sub_1",
      status: "active",
      canceled_at: null,
    } as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const res = await getAccountSubscriptionHandler(buildRequest(), buildParams());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      isPro: true,
      status: "active",
      plan: "pro",
      source: "account",
    });
  });

  it("returns source: organization when only the org subscription is active", async () => {
    vi.mocked(validateAccountSubscriptionParams).mockResolvedValue(ACCOUNT);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue({
      id: "sub_org",
      status: "trialing",
      canceled_at: null,
    } as never);

    const res = await getAccountSubscriptionHandler(buildRequest(), buildParams());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      isPro: true,
      status: "trialing",
      plan: "pro",
      source: "organization",
    });
  });

  it("returns isPro:false / none / null when neither subscription is active", async () => {
    vi.mocked(validateAccountSubscriptionParams).mockResolvedValue(ACCOUNT);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const res = await getAccountSubscriptionHandler(buildRequest(), buildParams());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      isPro: false,
      status: "none",
      plan: null,
      source: null,
    });
  });
});
