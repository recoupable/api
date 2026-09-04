import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePaymentMethodSessionRequest } from "@/lib/billing/validateCreatePaymentMethodSessionRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const SUCCESS_URL = "https://app.recoupable.dev/billing";
const req = (body: unknown) =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payment-method`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("validateCreatePaymentMethodSessionRequest", () => {
  it("returns the path account id and successUrl on a valid request", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const result = await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL }),
      ACCOUNT,
    );
    expect(result).toEqual({ accountId: ACCOUNT, successUrl: SUCCESS_URL });
    expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { accountId: ACCOUNT });
  });

  it("returns 400 for a non-UUID id before touching auth", async () => {
    const result = await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL }),
      "nope",
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 with the documented message for an invalid successUrl", async () => {
    const result = (await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: "not a url" }),
      ACCOUNT,
    )) as NextResponse;
    expect(result.status).toBe(400);
    await expect(result.json()).resolves.toEqual({ error: "successUrl must be a valid URL" });
  });

  it("returns 400 when the body carries an unknown key (strict)", async () => {
    const result = (await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL, accountId: ACCOUNT }),
      ACCOUNT,
    )) as NextResponse;
    expect(result.status).toBe(400);
  });

  it("maps an auth denial to { error } with the same status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 }),
    );
    const result = (await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL }),
      ACCOUNT,
    )) as NextResponse;
    expect(result.status).toBe(403);
    await expect(result.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
