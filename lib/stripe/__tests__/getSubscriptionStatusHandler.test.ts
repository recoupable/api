import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatusHandler } from "@/lib/stripe/getSubscriptionStatusHandler";

import { validateGetSubscriptionStatusQuery } from "@/lib/stripe/validateGetSubscriptionStatusQuery";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateGetSubscriptionStatusQuery", () => ({
  validateGetSubscriptionStatusQuery: vi.fn(),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/getOrgSubscription", () => ({
  getOrgSubscription: vi.fn(),
}));

vi.mock("@/lib/stripe/isActiveSubscription", () => ({
  default: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("getSubscriptionStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards validation error response", async () => {
    const denied = NextResponse.json({ error: "accountId is required" }, { status: 400 });
    vi.mocked(validateGetSubscriptionStatusQuery).mockResolvedValue(denied);
    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`);
    const res = await getSubscriptionStatusHandler(req);
    expect(res.status).toBe(400);
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns { isPro: true } when account subscription is active", async () => {
    vi.mocked(validateGetSubscriptionStatusQuery).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({ id: "sub_1" } as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockImplementation(sub => !!sub);

    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`);
    const res = await getSubscriptionStatusHandler(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });

  it("returns { isPro: true } when only org subscription is active", async () => {
    vi.mocked(validateGetSubscriptionStatusQuery).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue({ id: "sub_org" } as never);
    vi.mocked(isActiveSubscription).mockImplementation(sub => !!sub);

    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`);
    const res = await getSubscriptionStatusHandler(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });

  it("returns { isPro: false } when neither subscription is active", async () => {
    vi.mocked(validateGetSubscriptionStatusQuery).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockReturnValue(false);

    const req = new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`);
    const res = await getSubscriptionStatusHandler(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: false });
  });
});
