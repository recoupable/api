import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateBodyMock, resolveCustomerMock, setOptOutMock } = vi.hoisted(() => ({
  validateBodyMock: vi.fn(),
  resolveCustomerMock: vi.fn(),
  setOptOutMock: vi.fn(),
}));

vi.mock("@/lib/billing/validateUpdateAutoRechargeBody", () => ({
  validateUpdateAutoRechargeBody: validateBodyMock,
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

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/auto-recharge`, {
    method: "PATCH",
  });
}

describe("updateAutoRechargeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    resolveCustomerMock.mockResolvedValue("cus_x");
    setOptOutMock.mockResolvedValue(undefined);
  });

  it("forwards validation error responses (auth, params, and body errors alike)", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    validateBodyMock.mockResolvedValue(err);

    const res = await updateAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    expect(res.status).toBe(401);
    expect(setOptOutMock).not.toHaveBeenCalled();
  });

  it("opts out: resolves the customer by accountId and stamps the flag", async () => {
    validateBodyMock.mockResolvedValue({ accountId: ACCOUNT, enabled: false });

    const res = await updateAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: false });
    expect(validateBodyMock).toHaveBeenCalledWith(expect.any(NextRequest), ACCOUNT);
    expect(resolveCustomerMock).toHaveBeenCalledWith(ACCOUNT);
    expect(setOptOutMock).toHaveBeenCalledWith("cus_x", true);
  });

  it("opts back in: deletes the flag", async () => {
    validateBodyMock.mockResolvedValue({ accountId: ACCOUNT, enabled: true });

    const res = await updateAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ account_id: ACCOUNT, enabled: true });
    expect(setOptOutMock).toHaveBeenCalledWith("cus_x", false);
  });

  it("returns 500 on unexpected errors", async () => {
    validateBodyMock.mockResolvedValue({ accountId: ACCOUNT, enabled: false });
    setOptOutMock.mockRejectedValue(new Error("stripe down"));

    const res = await updateAutoRechargeHandler(makeRequest(), Promise.resolve({ id: ACCOUNT }));
    expect(res.status).toBe(500);
  });
});
