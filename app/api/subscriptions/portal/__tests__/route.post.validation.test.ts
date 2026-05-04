import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionPortalRequest } from "@/lib/stripe/validateCreateSubscriptionPortalRequest";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const { POST } = await import("../route");

async function loadRealValidate() {
  const mod = await vi.importActual<
    typeof import("@/lib/stripe/validateCreateSubscriptionPortalRequest")
  >("@/lib/stripe/validateCreateSubscriptionPortalRequest");
  return mod.validateCreateSubscriptionPortalRequest;
}

describe("POST /api/subscriptions/portal (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns 400 when body is invalid JSON", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockImplementationOnce(
      await loadRealValidate(),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it("returns 400 when returnUrl is missing", async () => {
    vi.mocked(validateCreateSubscriptionPortalRequest).mockImplementationOnce(
      await loadRealValidate(),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "k" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: expect.stringMatching(/returnUrl|Invalid input/i) });
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    vi.mocked(validateCreateSubscriptionPortalRequest).mockImplementationOnce(
      await loadRealValidate(),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnUrl: "https://chat.recoupable.com/billing" }),
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });
});
