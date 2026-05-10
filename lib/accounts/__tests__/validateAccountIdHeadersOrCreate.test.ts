import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAccountIdHeadersOrCreate } from "@/lib/accounts/validateAccountIdHeadersOrCreate";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));

function buildRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/accounts/id", { headers });
}

describe("validateAccountIdHeadersOrCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("header validation", () => {
    it("returns 401 when neither x-api-key nor Authorization is provided", async () => {
      const result = await validateAccountIdHeadersOrCreate(buildRequest({}));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
      const body = await (result as NextResponse).json();
      expect(body.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("returns 401 when both headers are provided", async () => {
      const result = await validateAccountIdHeadersOrCreate(
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

      const result = await validateAccountIdHeadersOrCreate(buildRequest({ "x-api-key": "valid" }));

      expect(result).toEqual({ accountId: "acc-from-api-key" });
      expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
    });

    it("forwards the api-key validator's error response", async () => {
      const errorResponse = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(getApiKeyAccountId).mockResolvedValue(errorResponse);

      const result = await validateAccountIdHeadersOrCreate(buildRequest({ "x-api-key": "bad" }));

      expect(result).toBe(errorResponse);
    });
  });

  describe("Bearer path", () => {
    it("returns the resolved accountId for an existing user", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("acc-existing");

      const result = await validateAccountIdHeadersOrCreate(
        buildRequest({ authorization: "Bearer token" }),
      );

      expect(result).toEqual({ accountId: "acc-existing" });
      expect(getOrCreateAccountIdByAuthToken).toHaveBeenCalledWith("token");
    });

    it("returns the newly-provisioned accountId for a brand-new user", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("acc-new");

      const result = await validateAccountIdHeadersOrCreate(
        buildRequest({ authorization: "Bearer fresh-token" }),
      );

      expect(result).toEqual({ accountId: "acc-new" });
    });

    it("returns 401 when the bearer token is malformed", async () => {
      const result = await validateAccountIdHeadersOrCreate(
        buildRequest({ authorization: "NotBearer foo" }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
      const body = await (result as NextResponse).json();
      expect(body.message).toBe("Authorization header with Bearer token required");
    });

    it("returns 401 when verification throws", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockRejectedValue(
        new Error("Invalid authentication token"),
      );

      const result = await validateAccountIdHeadersOrCreate(
        buildRequest({ authorization: "Bearer bad" }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
      const body = await (result as NextResponse).json();
      expect(body.message).toBe("Invalid authentication token");
    });
  });
});
