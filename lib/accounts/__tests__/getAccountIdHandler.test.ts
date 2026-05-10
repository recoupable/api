import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAccountIdHandler } from "@/lib/accounts/getAccountIdHandler";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/accounts/validateAccountIdHeaders", () => ({
  validateAccountIdHeaders: vi.fn(),
}));

function buildRequest(): NextRequest {
  return new NextRequest("http://localhost/api/accounts/id");
}

describe("getAccountIdHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with accountId when validation succeeds", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({ accountId: "acc-1" });

    const res = await getAccountIdHandler(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "success", accountId: "acc-1" });
  });

  it("forwards the validator's error response", async () => {
    const errorResponse = NextResponse.json({ status: "error", message: "boom" }, { status: 401 });
    vi.mocked(validateAccountIdHeaders).mockResolvedValue(errorResponse);

    const res = await getAccountIdHandler(buildRequest());

    expect(res).toBe(errorResponse);
  });

  it("returns 500 when the validator throws", async () => {
    vi.mocked(validateAccountIdHeaders).mockRejectedValue(new Error("unexpected"));

    const res = await getAccountIdHandler(buildRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("Internal server error");
  });
});
