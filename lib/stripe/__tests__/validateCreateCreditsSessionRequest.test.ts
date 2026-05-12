import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const ADMIN = "123e4567-e89b-12d3-a456-426614174001";

describe("validateCreateCreditsSessionRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 { error } for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: "not-json",
    });
    const res = await validateCreateCreditsSessionRequest(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when successUrl is missing", async () => {
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({ credits: 100 }),
    });
    const res = await validateCreateCreditsSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when credits is missing", async () => {
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({ successUrl: "https://chat.recoupable.com/done" }),
    });
    const res = await validateCreateCreditsSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when credits is not a positive integer", async () => {
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({ successUrl: "https://chat.recoupable.com/done", credits: 0 }),
    });
    const res = await validateCreateCreditsSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
  });

  it("maps auth failure to { error } and preserves status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        successUrl: "https://chat.recoupable.com/done",
        credits: 100,
      }),
    });
    const res = await validateCreateCreditsSessionRequest(req);
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
  });

  it("returns accountId, successUrl, credits when auth succeeds (no override)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        successUrl: "https://chat.recoupable.com/done",
        credits: 250,
      }),
    });
    const out = await validateCreateCreditsSessionRequest(req);
    expect(out).toEqual({
      accountId: ACCOUNT,
      successUrl: "https://chat.recoupable.com/done",
      credits: 250,
    });
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: undefined });
  });

  it("forwards accountId override to validateAuthContext", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ADMIN,
      orgId: null,
      authToken: "t",
    });
    const req = new NextRequest("http://localhost/api/credits/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        successUrl: "https://chat.recoupable.com/done",
        credits: 100,
        accountId: ADMIN,
      }),
    });
    const out = await validateCreateCreditsSessionRequest(req);
    expect(out).toEqual({
      accountId: ADMIN,
      successUrl: "https://chat.recoupable.com/done",
      credits: 100,
    });
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: ADMIN });
  });
});
