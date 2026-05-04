import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { validateCreateSubscriptionPortalRequest } from "@/lib/stripe/validateCreateSubscriptionPortalRequest";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { selectStripeBillingCustomerByAccountId } from "@/lib/supabase/billing_customers/selectStripeBillingCustomerByAccountId";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

const row = {
  id: 1,
  account_id: ACCOUNT,
  customer_id: "cus_test_123",
  email: null,
  provider: "stripe" as const,
};

function mockValidated() {
  vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue({
    accountId: ACCOUNT,
    returnUrl: "https://chat.recoupable.com/billing",
  });
  vi.mocked(selectStripeBillingCustomerByAccountId).mockResolvedValue(row);
}

describe("POST /api/subscriptions/portal (portal session errors)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalRequest).mockReset();
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
