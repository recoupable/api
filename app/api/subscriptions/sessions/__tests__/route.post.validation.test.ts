import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const { POST } = await import("../route");

async function loadRealValidate() {
  const mod = await vi.importActual<
    typeof import("@/lib/stripe/validateCreateSubscriptionSessionRequest")
  >("@/lib/stripe/validateCreateSubscriptionSessionRequest");
  return mod.validateCreateSubscriptionSessionRequest;
}

describe("POST /api/subscriptions/sessions (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionSessionRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns 400 when body is invalid JSON", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockImplementationOnce(
      await loadRealValidate(),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 400 when successUrl is missing", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockImplementationOnce(
      await loadRealValidate(),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: expect.stringMatching(/successUrl|Invalid input/i) });
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    vi.mocked(validateCreateSubscriptionSessionRequest).mockImplementationOnce(
      await loadRealValidate(),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ successUrl: "https://chat.recoupable.com/ok" }),
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(createStripeSession).not.toHaveBeenCalled();
  });
});
