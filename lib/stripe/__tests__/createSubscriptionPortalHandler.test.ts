import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSubscriptionPortalHandler } from "@/lib/stripe/createSubscriptionPortalHandler";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";
import { selectStripeBillingCustomerByAccountId } from "@/lib/supabase/billing_customers/selectStripeBillingCustomerByAccountId";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionPortalBody", () => ({
  validateCreateSubscriptionPortalBody: vi.fn(),
}));

vi.mock("@/lib/supabase/billing_customers/selectStripeBillingCustomerByAccountId", () => ({
  selectStripeBillingCustomerByAccountId: vi.fn(),
}));

vi.mock("@/lib/stripe/createBillingPortalSession", () => ({
  createBillingPortalSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("createSubscriptionPortalHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      body: "{}",
    });
    expect(await createSubscriptionPortalHandler(req)).toBe(err);
    expect(selectStripeBillingCustomerByAccountId).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectStripeBillingCustomerByAccountId).mockResolvedValue({
      id: 1,
      account_id: ACCOUNT,
      customer_id: "cus_test_123",
      email: null,
      provider: "stripe",
    });
    vi.mocked(createBillingPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);

    const res = await createSubscriptionPortalHandler(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    });
  });

  it("returns 500 when createBillingPortalSession throws", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectStripeBillingCustomerByAccountId).mockResolvedValue({
      id: 1,
      account_id: ACCOUNT,
      customer_id: "cus_test_123",
      email: null,
      provider: "stripe",
    });
    vi.mocked(createBillingPortalSession).mockRejectedValue(new Error("Stripe down"));

    const res = await createSubscriptionPortalHandler(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
