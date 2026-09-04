import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPaymentMethodSessionHandler } from "@/lib/billing/createPaymentMethodSessionHandler";
import { validateCreatePaymentMethodSessionRequest } from "@/lib/billing/validateCreatePaymentMethodSessionRequest";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateCreatePaymentMethodSessionRequest", () => ({
  validateCreatePaymentMethodSessionRequest: vi.fn(),
}));
vi.mock("@/lib/stripe/createCardOnFileSession", () => ({ createCardOnFileSession: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const SUCCESS_URL = "https://app.recoupable.dev/billing";
const buildRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payment-method`, { method: "POST" });
const buildParams = () => Promise.resolve({ id: ACCOUNT });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("createPaymentMethodSessionHandler", () => {
  it("returns 200 with the setup session id and url", async () => {
    vi.mocked(validateCreatePaymentMethodSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: SUCCESS_URL,
    });
    vi.mocked(createCardOnFileSession).mockResolvedValue({
      id: "cs_setup",
      url: "https://checkout.stripe.com/c/pay/cs_setup",
    } as Awaited<ReturnType<typeof createCardOnFileSession>>);

    const res = await createPaymentMethodSessionHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_setup",
      url: "https://checkout.stripe.com/c/pay/cs_setup",
    });
    expect(createCardOnFileSession).toHaveBeenCalledWith(ACCOUNT, SUCCESS_URL);
    expect(validateCreatePaymentMethodSessionRequest).toHaveBeenCalledWith(
      expect.any(NextRequest),
      ACCOUNT,
    );
  });

  it("returns the validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreatePaymentMethodSessionRequest).mockResolvedValue(err);
    expect(await createPaymentMethodSessionHandler(buildRequest(), buildParams())).toBe(err);
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 500 when Stripe returns a session without a url", async () => {
    vi.mocked(validateCreatePaymentMethodSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: SUCCESS_URL,
    });
    vi.mocked(createCardOnFileSession).mockResolvedValue({ id: "cs", url: null } as Awaited<
      ReturnType<typeof createCardOnFileSession>
    >);
    const res = await createPaymentMethodSessionHandler(buildRequest(), buildParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 with a masked message when Stripe throws", async () => {
    vi.mocked(validateCreatePaymentMethodSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: SUCCESS_URL,
    });
    vi.mocked(createCardOnFileSession).mockRejectedValue(new Error("stripe-down"));
    const res = await createPaymentMethodSessionHandler(buildRequest(), buildParams());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
