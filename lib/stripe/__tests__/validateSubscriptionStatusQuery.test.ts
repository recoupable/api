import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateSubscriptionStatusQuery } from "@/lib/stripe/validateSubscriptionStatusQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({ validateAccountIdOverride: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const url = (q: string) => `http://localhost/api/subscriptions/status${q}`;
const hdr = (k: boolean) => ({ headers: k ? { "x-api-key": "k" } : {} });

describe("validateSubscriptionStatusQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when accountId is missing", async () => {
    const res = await validateSubscriptionStatusQuery(
      new NextRequest(url(""), hdr(true) as RequestInit),
    );
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: "accountId is required" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 400 when accountId is not a UUID", async () => {
    const res = await validateSubscriptionStatusQuery(
      new NextRequest(url("?accountId=not-a-uuid"), hdr(true) as RequestInit),
    );
    expect((res as NextResponse).status).toBe(400);
    const j = await (res as NextResponse).json();
    expect(j).toEqual({ error: expect.stringMatching(/uuid|UUID|valid/i) });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("maps auth failure to { error }", async () => {
    const msg = "Exactly one of x-api-key or Authorization must be provided";
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: msg }, { status: 401 }),
    );
    const res = await validateSubscriptionStatusQuery(
      new NextRequest(url(`?accountId=${ACCOUNT}`), hdr(false) as RequestInit),
    );
    expect((res as NextResponse).status).toBe(401);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: msg });
    expect(validateAccountIdOverride).not.toHaveBeenCalled();
  });

  it("maps account override denial to { error }", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const denied = "Access denied to specified account_id";
    vi.mocked(validateAccountIdOverride).mockResolvedValue(
      NextResponse.json({ status: "error", error: denied }, { status: 403 }),
    );
    const other = "123e4567-e89b-12d3-a456-426614174001";
    const res = await validateSubscriptionStatusQuery(
      new NextRequest(url(`?accountId=${other}`), hdr(true) as RequestInit),
    );
    expect((res as NextResponse).status).toBe(403);
    await expect((res as NextResponse).json()).resolves.toEqual({ error: denied });
  });

  it("returns accountId when auth and override succeed", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    vi.mocked(validateAccountIdOverride).mockResolvedValue({ accountId: ACCOUNT });
    const out = await validateSubscriptionStatusQuery(
      new NextRequest(url(`?accountId=${ACCOUNT}`), hdr(true) as RequestInit),
    );
    expect(out).toEqual({ accountId: ACCOUNT });
    expect(validateAccountIdOverride).toHaveBeenCalledWith({
      currentAccountId: ACCOUNT,
      targetAccountId: ACCOUNT,
    });
  });
});
