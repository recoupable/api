import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateCheckoutSessionRequest } from "@/lib/stripe/checkout/validateCreateCheckoutSessionRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("validateCreateCheckoutSessionRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 { error } for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: "not-json",
    });
    const res = await validateCreateCheckoutSessionRequest(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 { error } when successUrl is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({}),
    });
    const res = await validateCreateCheckoutSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const j = await (res as NextResponse).json();
    expect(j).toEqual({ error: expect.stringMatching(/successUrl|Invalid input/i) });
  });

  it("returns 400 when successUrl is not a valid URL", async () => {
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({ successUrl: "not-a-url" }),
    });
    const res = await validateCreateCheckoutSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 { error } for unknown body keys (strict)", async () => {
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        successUrl: "https://chat.recoupable.com/done",
        extra: true,
      }),
    });
    const res = await validateCreateCheckoutSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("maps auth failure to { error } and preserves status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ successUrl: "https://chat.recoupable.com/done" }),
    });
    const res = await validateCreateCheckoutSessionRequest(req);
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
  });

  it("returns accountId and successUrl when auth succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const req = new NextRequest("http://localhost/api/stripe/checkout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        successUrl: "https://chat.recoupable.com/done",
      }),
    });
    const out = await validateCreateCheckoutSessionRequest(req);
    expect(out).toEqual({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/done",
    });
    expect(validateAuthContext).toHaveBeenCalledWith(req, {});
  });
});
