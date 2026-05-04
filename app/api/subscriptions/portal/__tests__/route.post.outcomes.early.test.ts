import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionPortalRequest } from "@/lib/stripe/validateCreateSubscriptionPortalRequest";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { selectStripeBillingCustomerByAccountId } from "@/lib/supabase/billing_customers/selectStripeBillingCustomerByAccountId";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

describe("POST /api/subscriptions/portal (handler outcomes — validation & missing customer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.mocked(console.error).mockRestore());

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

  it("returns 500 when billing customer lookup fails", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectStripeBillingCustomerByAccountId).mockRejectedValue(new Error("supabase down"));
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
