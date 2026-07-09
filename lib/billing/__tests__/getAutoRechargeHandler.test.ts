import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateParamsMock, findCustomerMock, getOptOutMock } = vi.hoisted(() => ({
  validateParamsMock: vi.fn(),
  findCustomerMock: vi.fn(),
  getOptOutMock: vi.fn(),
}));

vi.mock("@/lib/billing/validateAutoRechargeParams", () => ({
  validateAutoRechargeParams: validateParamsMock,
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: findCustomerMock,
}));
vi.mock("@/lib/stripe/getAutoRechargeOptOut", () => ({
  getAutoRechargeOptOut: getOptOutMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { getAutoRechargeHandler } = await import("@/lib/billing/getAutoRechargeHandler");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/auto-recharge`);
}

describe("getAutoRechargeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    validateParamsMock.mockResolvedValue(ACCOUNT);
  });

  it("forwards validation error responses", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    validateParamsMock.mockResolvedValue(err);

    const res = await getAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    expect(res.status).toBe(401);
  });

  it("returns enabled: true when the account has no Stripe customer (default, no side effects)", async () => {
    findCustomerMock.mockResolvedValue(null);

    const res = await getAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: true });
    expect(getOptOutMock).not.toHaveBeenCalled();
  });

  it("returns enabled: false when the customer has opted out", async () => {
    findCustomerMock.mockResolvedValue("cus_x");
    getOptOutMock.mockResolvedValue(true);

    const res = await getAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: false });
    expect(getOptOutMock).toHaveBeenCalledWith("cus_x");
  });

  it("returns enabled: true when the customer exists and has not opted out", async () => {
    findCustomerMock.mockResolvedValue("cus_x");
    getOptOutMock.mockResolvedValue(false);

    const res = await getAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: true });
  });

  it("returns 500 on unexpected errors", async () => {
    findCustomerMock.mockRejectedValue(new Error("stripe down"));

    const res = await getAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    expect(res.status).toBe(500);
  });
});
