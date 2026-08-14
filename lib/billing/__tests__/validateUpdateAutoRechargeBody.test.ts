import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateParamsMock } = vi.hoisted(() => ({
  validateParamsMock: vi.fn(),
}));

vi.mock("@/lib/billing/validateAutoRechargeParams", () => ({
  validateAutoRechargeParams: validateParamsMock,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { validateUpdateAutoRechargeBody } = await import(
  "@/lib/billing/validateUpdateAutoRechargeBody"
);

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/auto-recharge`, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("validateUpdateAutoRechargeBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateParamsMock.mockResolvedValue(ACCOUNT);
  });

  it("forwards params/auth error responses without reading the body", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    validateParamsMock.mockResolvedValue(err);

    const result = await validateUpdateAutoRechargeBody(makeRequest({ enabled: false }), ACCOUNT);
    expect(result).toBe(err);
  });

  it("returns 400 when enabled is not a boolean", async () => {
    const result = await validateUpdateAutoRechargeBody(makeRequest({ enabled: "nope" }), ACCOUNT);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toEqual({
      error: "enabled must be a boolean",
    });
  });

  it("returns 400 when the body is not valid JSON (safeParseJson empty-object fallback)", async () => {
    const result = await validateUpdateAutoRechargeBody(makeRequest("not json"), ACCOUNT);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns the validated accountId and enabled on success", async () => {
    const result = await validateUpdateAutoRechargeBody(makeRequest({ enabled: false }), ACCOUNT);

    expect(result).toEqual({ accountId: ACCOUNT, enabled: false });
    expect(validateParamsMock).toHaveBeenCalledWith(expect.any(NextRequest), ACCOUNT);
  });

  it("passes enabled: true through", async () => {
    const result = await validateUpdateAutoRechargeBody(makeRequest({ enabled: true }), ACCOUNT);

    expect(result).toEqual({ accountId: ACCOUNT, enabled: true });
  });
});
