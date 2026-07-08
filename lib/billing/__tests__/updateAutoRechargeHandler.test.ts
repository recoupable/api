import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateParamsMock, resolveCustomerMock, setOptOutMock } = vi.hoisted(() => ({
  validateParamsMock: vi.fn(),
  resolveCustomerMock: vi.fn(),
  setOptOutMock: vi.fn(),
}));

vi.mock("@/lib/billing/validateAutoRechargeParams", () => ({
  validateAutoRechargeParams: validateParamsMock,
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveCustomerMock,
}));
vi.mock("@/lib/stripe/setAutoRechargeOptOut", () => ({
  setAutoRechargeOptOut: setOptOutMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { updateAutoRechargeHandler } = await import("@/lib/billing/updateAutoRechargeHandler");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/auto-recharge`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("updateAutoRechargeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    validateParamsMock.mockResolvedValue(ACCOUNT);
    resolveCustomerMock.mockResolvedValue("cus_x");
    setOptOutMock.mockResolvedValue(undefined);
  });

  it("forwards validation error responses", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    validateParamsMock.mockResolvedValue(err);

    const res = await updateAutoRechargeHandler(
      makeRequest({ enabled: false }),
      Promise.resolve({ id: ACCOUNT }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when enabled is missing or not a boolean", async () => {
    const res = await updateAutoRechargeHandler(
      makeRequest({ enabled: "nope" }),
      Promise.resolve({ id: ACCOUNT }),
    );
    expect(res.status).toBe(400);
    expect(setOptOutMock).not.toHaveBeenCalled();
  });

  it("opts out: resolves the customer by accountId and stamps the flag", async () => {
    const res = await updateAutoRechargeHandler(
      makeRequest({ enabled: false }),
      Promise.resolve({ id: ACCOUNT }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: false });
    expect(resolveCustomerMock).toHaveBeenCalledWith(ACCOUNT);
    expect(setOptOutMock).toHaveBeenCalledWith("cus_x", true);
  });

  it("opts back in: deletes the flag", async () => {
    const res = await updateAutoRechargeHandler(
      makeRequest({ enabled: true }),
      Promise.resolve({ id: ACCOUNT }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: true });
    expect(setOptOutMock).toHaveBeenCalledWith("cus_x", false);
  });

  it("returns 500 on unexpected errors", async () => {
    setOptOutMock.mockRejectedValue(new Error("stripe down"));

    const res = await updateAutoRechargeHandler(
      makeRequest({ enabled: false }),
      Promise.resolve({ id: ACCOUNT }),
    );
    expect(res.status).toBe(500);
  });
});
