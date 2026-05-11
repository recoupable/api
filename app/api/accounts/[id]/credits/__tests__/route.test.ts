import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountCreditsHandler } from "@/lib/credits/getAccountCreditsHandler";

const { GET, OPTIONS } = await import("../route");

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("app/api/accounts/[id]/credits/route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("GET delegates to getAccountCreditsHandler with the path params", async () => {
    const handlerRes = NextResponse.json(
      {
        account_id: ACCOUNT_ID,
        remaining_credits: 250,
        total_credits: 333,
        used_credits: 83,
        is_pro: false,
        timestamp: "2026-05-01T12:00:00.000Z",
      },
      { status: 200 },
    );
    vi.mocked(getAccountCreditsHandler).mockResolvedValue(handlerRes);

    const req = new NextRequest(`http://localhost/api/accounts/${ACCOUNT_ID}/credits`, {
      headers: { "x-api-key": "test-key" },
    });
    const params = Promise.resolve({ id: ACCOUNT_ID });
    const res = await GET(req, { params });

    expect(getAccountCreditsHandler).toHaveBeenCalledTimes(1);
    expect(getAccountCreditsHandler).toHaveBeenCalledWith(req, params);
    expect(res).toBe(handlerRes);
  });
});
