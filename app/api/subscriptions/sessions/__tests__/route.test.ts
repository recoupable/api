import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionSessionRequest", () => ({
  validateCreateSubscriptionSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createStripeSession", () => ({
  createStripeSession: vi.fn(),
}));

const { POST, OPTIONS } = await import("../route");
const { validateCreateSubscriptionSessionRequest } = await import(
  "@/lib/stripe/validateCreateSubscriptionSessionRequest"
);
const { createStripeSession } = await import("@/lib/stripe/createStripeSession");
const { getCorsHeaders } = await import("@/lib/networking/getCorsHeaders");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

async function loadRealValidate() {
  const mod = await vi.importActual<
    typeof import("@/lib/stripe/validateCreateSubscriptionSessionRequest")
  >("@/lib/stripe/validateCreateSubscriptionSessionRequest");
  return mod.validateCreateSubscriptionSessionRequest;
}

describe("OPTIONS /api/subscriptions/sessions", () => {
  it("returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("POST /api/subscriptions/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionSessionRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/subscriptions/sessions", {
      method: "POST",
      body: "{}",
    });
    expect(await POST(req)).toBe(err);
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const realValidate = await loadRealValidate();
    vi.mocked(validateCreateSubscriptionSessionRequest).mockImplementationOnce(realValidate);
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 400 when successUrl is missing", async () => {
    const realValidate = await loadRealValidate();
    vi.mocked(validateCreateSubscriptionSessionRequest).mockImplementationOnce(realValidate);
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: expect.stringMatching(/successUrl|Invalid input/i) });
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const realValidate = await loadRealValidate();
    vi.mocked(validateCreateSubscriptionSessionRequest).mockImplementationOnce(realValidate);
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ successUrl: "https://chat.recoupable.com/ok" }),
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createStripeSession).mockResolvedValue({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    } as Awaited<ReturnType<typeof createStripeSession>>);

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    });
  });

  it("returns 400 { error } when session.url is null", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createStripeSession).mockResolvedValue({
      id: "cs_test_abc",
      url: null,
    } as Awaited<ReturnType<typeof createStripeSession>>);

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Checkout session URL missing" });
  });

  it("returns 400 { error } when createStripeSession throws", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/ok",
    });
    vi.mocked(createStripeSession).mockRejectedValue(new Error("Stripe down"));

    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Stripe down" });
  });
});
