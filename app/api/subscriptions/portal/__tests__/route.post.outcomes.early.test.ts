import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { selectBillingCustomers } from "@/lib/supabase/billing_customers/selectBillingCustomers";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

describe("POST /api/subscriptions/portal (handler outcomes — validation & missing customer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalBody).mockReset();
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
    expect(await POST(req)).toBe(err);
    expect(selectBillingCustomers).not.toHaveBeenCalled();
  });

  it("returns 400 when no billing customer", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectBillingCustomers).mockResolvedValue([]);
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Billing customer not found" });
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it("returns 500 when billing customer lookup fails", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectBillingCustomers).mockRejectedValue(new Error("supabase down"));
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
