import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionPortalRequest } from "@/lib/stripe/validateCreateSubscriptionPortalRequest";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { selectStripeBillingCustomerByAccountId } from "@/lib/supabase/billing_customers/selectStripeBillingCustomerByAccountId";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

describe("POST /api/subscriptions/portal (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      body: "{}",
    });
    expect(await POST(req)).toBe(err);
    expect(selectStripeBillingCustomerByAccountId).not.toHaveBeenCalled();
  });

  it("returns 400 when no billing customer", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectStripeBillingCustomerByAccountId).mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Billing customer not found" });
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue({
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

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    });
  });

  it("returns 400 when session.url is null", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue({
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
      url: null,
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Billing portal URL missing" });
  });

  it("returns 500 when createBillingPortalSession throws", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue({
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

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
