import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreatePortalParams } from "@/lib/billing/validateCreatePortalParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const RETURN_URL = "https://app.recoupable.dev/billing";

const post = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

describe("validateCreatePortalParams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when id is not a UUID", async () => {
    const res = await validateCreatePortalParams(
      post(JSON.stringify({ returnUrl: RETURN_URL })),
      "nope",
    );
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "id must be a valid UUID",
    });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const res = await validateCreatePortalParams(post("not-json"), ACCOUNT);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when returnUrl is missing", async () => {
    const res = await validateCreatePortalParams(post(JSON.stringify({})), ACCOUNT);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body).toEqual({ error: expect.stringMatching(/returnUrl|Invalid input/i) });
  });

  it("returns 400 when returnUrl is not a URL", async () => {
    const res = await validateCreatePortalParams(post(JSON.stringify({ returnUrl: "x" })), ACCOUNT);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({
      error: "returnUrl must be a valid URL",
    });
  });

  it("maps auth failure to { error } and preserves status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 }),
    );
    const res = await validateCreatePortalParams(
      post(JSON.stringify({ returnUrl: RETURN_URL }), { "x-api-key": "k" }),
      ACCOUNT,
    );
    expect((res as NextResponse).status).toBe(403);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns the path id and returnUrl when auth succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const req = post(JSON.stringify({ returnUrl: RETURN_URL }), { "x-api-key": "k" });
    const out = await validateCreatePortalParams(req, ACCOUNT);
    expect(out).toEqual({ accountId: ACCOUNT, returnUrl: RETURN_URL });
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: ACCOUNT });
  });
});
