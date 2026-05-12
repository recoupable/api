import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const URL = "http://localhost/api/credits/sessions";
const makeReq = () => new NextRequest(URL, { method: "POST", body: "{}" });

describe("POST /api/credits/sessions (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(err);
    expect(await POST(makeReq())).toBe(err);
    expect(createCreditsStripeSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
      credits: 500,
    });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    });
  });

  it("returns 400 when session.url is null", async () => {
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
      credits: 100,
    });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: null,
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);

    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 when createCreditsStripeSession throws", async () => {
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
      credits: 100,
    });
    vi.mocked(createCreditsStripeSession).mockRejectedValue(new Error("Stripe down"));

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
