import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const body = { plan: "pro", successUrl: "https://chat.recoupable.dev/done" };

const req = (payload: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/subscriptions/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

describe("validateCreateSubscriptionSessionRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a null accountId for an anonymous request without touching auth", async () => {
    const out = await validateCreateSubscriptionSessionRequest(req(body));
    expect(out).toEqual({ ...body, cancelUrl: undefined, accountId: null });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("defaults plan to pro when omitted", async () => {
    const out = await validateCreateSubscriptionSessionRequest(
      req({ successUrl: "https://chat.recoupable.dev/done" }),
    );
    expect(out).toMatchObject({ plan: "pro", accountId: null });
  });

  it("resolves the account when an auth header is present", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const out = await validateCreateSubscriptionSessionRequest(
      req(body, { authorization: "Bearer t" }),
    );
    expect(out).toMatchObject({ accountId: ACCOUNT, plan: "pro" });
  });

  it("returns 400 { error } for invalid JSON", async () => {
    const res = await validateCreateSubscriptionSessionRequest(req("not-json"));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when successUrl is missing", async () => {
    const res = await validateCreateSubscriptionSessionRequest(req({ plan: "pro" }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("maps auth failure to { error } when a header is supplied", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );
    const res = await validateCreateSubscriptionSessionRequest(req(body, { "x-api-key": "bad" }));
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
