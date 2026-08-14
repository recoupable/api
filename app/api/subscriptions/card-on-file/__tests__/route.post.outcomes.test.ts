import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateCardOnFileSessionRequest } from "@/lib/stripe/validateCreateCardOnFileSessionRequest";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";
const SUCCESS_URL = "https://recoupable.dev/card-saved";

function postRequest(): NextRequest {
  return new NextRequest("http://localhost/api/subscriptions/card-on-file", {
    method: "POST",
    body: "{}",
  });
}

describe("POST /api/subscriptions/card-on-file (handler outcomes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateCardOnFileSessionRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateCardOnFileSessionRequest).mockResolvedValue(err);
    expect(await POST(postRequest())).toBe(err);
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url for the authenticated account", async () => {
    vi.mocked(validateCreateCardOnFileSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: SUCCESS_URL,
    });
    vi.mocked(createCardOnFileSession).mockResolvedValue({
      id: "cs_test_setup",
      url: "https://checkout.stripe.com/pay/cs_test_setup",
    } as Awaited<ReturnType<typeof createCardOnFileSession>>);

    const res = await POST(postRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_setup",
      url: "https://checkout.stripe.com/pay/cs_test_setup",
    });
    expect(createCardOnFileSession).toHaveBeenCalledWith(ACCOUNT, SUCCESS_URL);
  });

  it("returns 500 when session.url is null", async () => {
    vi.mocked(validateCreateCardOnFileSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: SUCCESS_URL,
    });
    vi.mocked(createCardOnFileSession).mockResolvedValue({
      id: "cs_test_setup",
      url: null,
    } as Awaited<ReturnType<typeof createCardOnFileSession>>);

    const res = await POST(postRequest());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 500 when createCardOnFileSession throws", async () => {
    vi.mocked(validateCreateCardOnFileSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: SUCCESS_URL,
    });
    vi.mocked(createCardOnFileSession).mockRejectedValue(new Error("Stripe down"));

    const res = await POST(postRequest());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
