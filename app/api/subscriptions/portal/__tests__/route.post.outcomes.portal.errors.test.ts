import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

function mockValidated() {
  vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
    accountId: ACCOUNT,
    returnUrl: "https://chat.recoupable.com/billing",
  });
  vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
    customer: "cus_test_123",
  } as Awaited<ReturnType<typeof getActiveSubscriptionDetails>>);
}

describe("POST /api/subscriptions/portal (portal session errors)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalBody).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 400 when session.url is null", async () => {
    mockValidated();
    vi.mocked(createBillingPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: null,
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Billing portal URL missing" });
  });

  it("returns 500 when createBillingPortalSession throws", async () => {
    mockValidated();
    vi.mocked(createBillingPortalSession).mockRejectedValue(new Error("Stripe down"));
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
