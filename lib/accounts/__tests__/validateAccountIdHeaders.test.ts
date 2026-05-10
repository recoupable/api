import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

function buildRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/accounts/id", { headers });
}

describe("validateAccountIdHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("header validation", () => {
    it("returns 401 when neither x-api-key nor Authorization is provided", async () => {
      const result = await validateAccountIdHeaders(buildRequest({}));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
      const body = await (result as NextResponse).json();
      expect(body.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("returns 401 when both headers are provided", async () => {
      const result = await validateAccountIdHeaders(
        buildRequest({
          "x-api-key": "key",
          authorization: "Bearer token",
        }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });
  });

  describe("x-api-key path", () => {
    it("returns the resolved accountId on success", async () => {
      vi.mocked(getApiKeyAccountId).mockResolvedValue("acc-from-api-key");

      const result = await validateAccountIdHeaders(buildRequest({ "x-api-key": "valid" }));

      expect(result).toEqual({ accountId: "acc-from-api-key" });
      expect(getAuthenticatedAccountId).not.toHaveBeenCalled();
    });

    it("forwards the api-key validator's error response", async () => {
      const errorResponse = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(getApiKeyAccountId).mockResolvedValue(errorResponse);

      const result = await validateAccountIdHeaders(buildRequest({ "x-api-key": "bad" }));

      expect(result).toBe(errorResponse);
    });
  });

  describe("Bearer path", () => {
    it("delegates to getAuthenticatedAccountId with default createIfMissing=false", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("acc-existing");

      await validateAccountIdHeaders(buildRequest({ authorization: "Bearer t" }));

      expect(getAuthenticatedAccountId).toHaveBeenCalledWith(expect.any(NextRequest), {
        createIfMissing: false,
      });
    });

    it("forwards createIfMissing: true to getAuthenticatedAccountId", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("acc-new");

      await validateAccountIdHeaders(buildRequest({ authorization: "Bearer t" }), {
        createIfMissing: true,
      });

      expect(getAuthenticatedAccountId).toHaveBeenCalledWith(expect.any(NextRequest), {
        createIfMissing: true,
      });
    });

    it("returns the resolved accountId on success", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("acc-existing");

      const result = await validateAccountIdHeaders(buildRequest({ authorization: "Bearer t" }));

      expect(result).toEqual({ accountId: "acc-existing" });
    });

    it("forwards the bearer validator's error response", async () => {
      const errorResponse = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue(errorResponse);

      const result = await validateAccountIdHeaders(buildRequest({ authorization: "Bearer bad" }));

      expect(result).toBe(errorResponse);
    });
  });
});
