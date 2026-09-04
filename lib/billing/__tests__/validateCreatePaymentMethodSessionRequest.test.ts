import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePaymentMethodSessionRequest } from "@/lib/billing/validateCreatePaymentMethodSessionRequest";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateGetPaymentMethodParams", () => ({
  validateGetPaymentMethodParams: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const SUCCESS_URL = "https://app.recoupable.dev/billing";
const req = (body: unknown) =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payment-method`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const errorBody = async (res: NextResponse) => {
  const body = await res.json();
  expect(typeof body.error).toBe("string");
  return body;
};

beforeEach(() => vi.clearAllMocks());

describe("validateCreatePaymentMethodSessionRequest", () => {
  it("delegates the path id and auth to validateGetPaymentMethodParams, then parses the body", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    const request = req({ successUrl: SUCCESS_URL });
    const result = await validateCreatePaymentMethodSessionRequest(request, ACCOUNT);
    expect(result).toEqual({ accountId: ACCOUNT, successUrl: SUCCESS_URL });
    expect(validateGetPaymentMethodParams).toHaveBeenCalledWith(request, ACCOUNT);
  });

  it("returns the shared 400 { error } for a non-UUID id", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(
      NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 }),
    );
    const result = (await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL }),
      "nope",
    )) as NextResponse;
    expect(result.status).toBe(400);
    await expect(errorBody(result)).resolves.toEqual({ error: "id must be a valid UUID" });
  });

  it("returns 400 with the documented message for an invalid successUrl", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    const result = (await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: "not a url" }),
      ACCOUNT,
    )) as NextResponse;
    expect(result.status).toBe(400);
    await expect(errorBody(result)).resolves.toEqual({ error: "successUrl must be a valid URL" });
  });

  it("returns 400 { error } when the body carries an unknown key (strict)", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    const result = (await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL, accountId: ACCOUNT }),
      ACCOUNT,
    )) as NextResponse;
    expect(result.status).toBe(400);
    await errorBody(result);
  });

  it("passes an auth denial through unchanged", async () => {
    const denial = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(denial);
    const result = await validateCreatePaymentMethodSessionRequest(
      req({ successUrl: SUCCESS_URL }),
      ACCOUNT,
    );
    expect(result).toBe(denial);
  });
});
