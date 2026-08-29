import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateAuthContextMock } = vi.hoisted(() => ({ validateAuthContextMock: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: validateAuthContextMock }));

const { validateCreateCheckoutRequest } = await import("../validateCreateCheckoutRequest");

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/subscriptions/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const body = { plan: "pro", successUrl: "https://app.example.com/?s={CHECKOUT_SESSION_ID}" };

describe("validateCreateCheckoutRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a null accountId for an anonymous request without touching auth", async () => {
    const result = await validateCreateCheckoutRequest(req(body));
    expect(result).toEqual({ ...body, cancelUrl: undefined, accountId: null });
    expect(validateAuthContextMock).not.toHaveBeenCalled();
  });

  it("resolves the account when an auth header is present", async () => {
    validateAuthContextMock.mockResolvedValue({ accountId: "acc_1", orgId: null, authToken: "t" });
    const result = await validateCreateCheckoutRequest(req(body, { authorization: "Bearer t" }));
    expect(result).toMatchObject({ accountId: "acc_1" });
  });

  it("treats an empty auth header as supplied, not anonymous", async () => {
    validateAuthContextMock.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );
    const result = await validateCreateCheckoutRequest(req(body, { "x-api-key": "" }));
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 in the sessions error shape when a supplied auth header is invalid", async () => {
    validateAuthContextMock.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );
    const result = await validateCreateCheckoutRequest(req(body, { "x-api-key": "bad" }));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    await expect((result as NextResponse).json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid JSON and for a bad body", async () => {
    const bad = (await validateCreateCheckoutRequest(req("{nope"))) as NextResponse;
    expect(bad.status).toBe(400);
    const badPlan = (await validateCreateCheckoutRequest(
      req({ plan: "gold", successUrl: "https://x.com" }),
    )) as NextResponse;
    expect(badPlan.status).toBe(400);
  });
});
