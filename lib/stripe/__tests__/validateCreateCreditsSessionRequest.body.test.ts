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

const URL = "http://localhost/api/credits/sessions";
const HEADERS = { "Content-Type": "application/json", "x-api-key": "k" };

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    successUrl: "https://chat.recoupable.com/done",
    credits: 250,
    ...overrides,
  });

describe("validateCreateCreditsSessionRequest — body validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 { error } for invalid JSON", async () => {
    const req = new NextRequest(URL, { method: "POST", headers: HEADERS, body: "not-json" });
    const res = await validateCreateCreditsSessionRequest(req);
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it.each([
    ["missing successUrl", JSON.stringify({ credits: 100 })],
    ["missing credits", JSON.stringify({ successUrl: "https://chat.recoupable.com/done" })],
    ["credits = 0", body({ credits: 0 })],
    ["credits = -5", body({ credits: -5 })],
    ["credits = 12.5", body({ credits: 12.5 })],
    ["malformed successUrl", body({ successUrl: "not-a-url" })],
    ["bad accountId UUID", body({ accountId: "not-a-uuid" })],
    ["unknown body key (strict)", body({ extra: true })],
  ])("returns 400 for %s", async (_label, jsonBody) => {
    const req = new NextRequest(URL, { method: "POST", headers: HEADERS, body: jsonBody });
    const res = await validateCreateCreditsSessionRequest(req);
    expect((res as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });
});
