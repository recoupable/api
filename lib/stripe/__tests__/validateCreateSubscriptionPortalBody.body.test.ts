import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateCreateSubscriptionPortalBody (body)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 { error } for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: "not-json",
    });
    const res = await validateCreateSubscriptionPortalBody(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 { error } when returnUrl is missing", async () => {
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({}),
    });
    const res = await validateCreateSubscriptionPortalBody(req);
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j).toEqual({ error: expect.stringMatching(/returnUrl|Invalid input/i) });
  });

  it("returns 400 for unknown body keys (strict)", async () => {
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        returnUrl: "https://chat.recoupable.com/billing",
        extra: true,
      }),
    });
    expect((await validateCreateSubscriptionPortalBody(req)).status).toBe(400);
  });
});
