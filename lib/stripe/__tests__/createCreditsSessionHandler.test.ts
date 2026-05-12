import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createCreditsSessionHandler } from "@/lib/stripe/createCreditsSessionHandler";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateCreditsSessionRequest", () => ({
  validateCreateCreditsSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("createCreditsSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      body: "{}",
    });
    expect(await createCreditsSessionHandler(req)).toBe(err);
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

    const res = await createCreditsSessionHandler(
      new NextRequest("http://localhost/api/credits/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_xyz",
      url: "https://checkout.stripe.com/pay/cs_test_xyz",
    });
    expect(createCreditsStripeSession).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      credits: 500,
      successUrl: "https://chat.recoupable.com/ok",
    });
  });

  it("returns 400 { error } when session.url is null", async () => {
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
      credits: 100,
    });
    vi.mocked(createCreditsStripeSession).mockResolvedValue({
      id: "cs_test_xyz",
      url: null,
    } as Awaited<ReturnType<typeof createCreditsStripeSession>>);

    const res = await createCreditsSessionHandler(
      new NextRequest("http://localhost/api/credits/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 with generic { error } when createCreditsStripeSession throws", async () => {
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
      credits: 100,
    });
    vi.mocked(createCreditsStripeSession).mockRejectedValue(new Error("Stripe down"));

    const res = await createCreditsSessionHandler(
      new NextRequest("http://localhost/api/credits/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
