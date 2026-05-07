import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountSubscriptionHandler } from "@/lib/stripe/getAccountSubscriptionHandler";

const { GET, OPTIONS } = await import("../route");

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("app/api/accounts/[id]/subscription/route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("GET delegates to getAccountSubscriptionHandler with the path params", async () => {
    const handlerRes = NextResponse.json(
      { isPro: true, status: "active", plan: "pro", source: "account" },
      { status: 200 },
    );
    vi.mocked(getAccountSubscriptionHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest(`http://localhost/api/accounts/${ACCOUNT_ID}/subscription`, {
      headers: { "x-api-key": "test-key" },
    });
    const params = Promise.resolve({ id: ACCOUNT_ID });
    const res = await GET(req, { params });

    expect(getAccountSubscriptionHandler).toHaveBeenCalledTimes(1);
    expect(getAccountSubscriptionHandler).toHaveBeenCalledWith(req, params);
    expect(res).toBe(handlerRes);
    await expect(res.json()).resolves.toEqual({
      isPro: true,
      status: "active",
      plan: "pro",
      source: "account",
    });
  });
});
