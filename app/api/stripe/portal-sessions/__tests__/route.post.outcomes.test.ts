import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePortalSessionRequest } from "@/lib/stripe/validateCreatePortalSessionRequest";
import { createPortalSession } from "@/lib/stripe/createPortalSession";
import { getStripeCustomerIdByAccountId } from "@/lib/supabase/billing_customers/getStripeCustomerIdByAccountId";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

describe("POST /api/stripe/portal-sessions (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreatePortalSessionRequest).mockReset();
    vi.mocked(getStripeCustomerIdByAccountId).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreatePortalSessionRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/stripe/portal-sessions", {
      method: "POST",
      body: "{}",
    });
    expect(await POST(req)).toBe(err);
    expect(getStripeCustomerIdByAccountId).not.toHaveBeenCalled();
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 404 when account has no Stripe customer", async () => {
    vi.mocked(validateCreatePortalSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/back",
    });
    vi.mocked(getStripeCustomerIdByAccountId).mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "No Stripe customer found for this account",
    });
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreatePortalSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/back",
    });
    vi.mocked(getStripeCustomerIdByAccountId).mockResolvedValue("cus_123");
    vi.mocked(createPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: "https://billing.stripe.com/p/session/abc",
    } as Awaited<ReturnType<typeof createPortalSession>>);

    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "bps_test_abc",
      url: "https://billing.stripe.com/p/session/abc",
    });
    expect(createPortalSession).toHaveBeenCalledWith("cus_123", "https://chat.recoupable.com/back");
  });

  it("returns 400 when session.url is missing", async () => {
    vi.mocked(validateCreatePortalSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/back",
    });
    vi.mocked(getStripeCustomerIdByAccountId).mockResolvedValue("cus_123");
    vi.mocked(createPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: null,
    } as unknown as Awaited<ReturnType<typeof createPortalSession>>);

    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Portal session URL missing" });
  });

  it("returns 500 when createPortalSession throws", async () => {
    vi.mocked(validateCreatePortalSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/back",
    });
    vi.mocked(getStripeCustomerIdByAccountId).mockResolvedValue("cus_123");
    vi.mocked(createPortalSession).mockRejectedValue(new Error("Stripe down"));

    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
