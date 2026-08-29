import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateMock, resolvePriceMock, createSessionMock } = vi.hoisted(() => ({
  validateMock: vi.fn(),
  resolvePriceMock: vi.fn(),
  createSessionMock: vi.fn(),
}));
vi.mock("../validateCreateCheckoutRequest", () => ({
  validateCreateCheckoutRequest: validateMock,
}));
vi.mock("../resolveCheckoutPrice", () => ({ resolveCheckoutPrice: resolvePriceMock }));
vi.mock("../createCheckoutSession", () => ({ createCheckoutSession: createSessionMock }));

const { createCheckoutHandler } = await import("../createCheckoutHandler");

const req = () =>
  new NextRequest("http://localhost/api/subscriptions/checkout", { method: "POST" });
const validated = {
  plan: "starter",
  successUrl: "https://app/",
  cancelUrl: undefined,
  accountId: null,
};

describe("createCheckoutHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    validateMock.mockResolvedValue(validated);
    resolvePriceMock.mockReturnValue({ price: "price_starter" });
    createSessionMock.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/c/1" });
  });

  it("returns the session id and url", async () => {
    const res = await createCheckoutHandler(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_1",
      url: "https://checkout.stripe.com/c/1",
    });
    expect(createSessionMock).toHaveBeenCalledWith({
      ...validated,
      price: { price: "price_starter" },
    });
  });

  it("returns 400 starter_unavailable when the Starter price is not configured", async () => {
    resolvePriceMock.mockReturnValue(null);
    const res = await createCheckoutHandler(req());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "starter_unavailable" });
  });

  it("passes validation errors through and maps thrown errors to 500", async () => {
    validateMock.mockResolvedValue(
      NextResponse.json({ error: "plan is required" }, { status: 400 }),
    );
    expect((await createCheckoutHandler(req())).status).toBe(400);

    validateMock.mockResolvedValue(validated);
    createSessionMock.mockRejectedValue(new Error("stripe"));
    const res = await createCheckoutHandler(req());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
