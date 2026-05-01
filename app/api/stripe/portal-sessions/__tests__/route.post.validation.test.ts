import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePortalSessionRequest } from "@/lib/stripe/validateCreatePortalSessionRequest";
import { createPortalSession } from "@/lib/stripe/createPortalSession";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const { POST } = await import("../route");

async function loadRealValidate() {
  const mod = await vi.importActual<
    typeof import("@/lib/stripe/validateCreatePortalSessionRequest")
  >("@/lib/stripe/validateCreatePortalSessionRequest");
  return mod.validateCreatePortalSessionRequest;
}

describe("POST /api/stripe/portal-sessions (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreatePortalSessionRequest).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns 400 when body is invalid JSON", async () => {
    vi.mocked(validateCreatePortalSessionRequest).mockImplementationOnce(await loadRealValidate());
    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 400 when returnUrl is missing", async () => {
    vi.mocked(validateCreatePortalSessionRequest).mockImplementationOnce(await loadRealValidate());
    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: expect.stringMatching(/returnUrl|Invalid input/i) });
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    vi.mocked(validateCreatePortalSessionRequest).mockImplementationOnce(await loadRealValidate());
    const res = await POST(
      new NextRequest("http://localhost/api/stripe/portal-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnUrl: "https://chat.recoupable.com/back" }),
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(createPortalSession).not.toHaveBeenCalled();
  });
});
