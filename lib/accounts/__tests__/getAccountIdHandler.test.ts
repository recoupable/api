import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getAccountIdHandler } from "@/lib/accounts/getAccountIdHandler";
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

describe("getAccountIdHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auth header validation", () => {
    it("returns 401 when no auth header is provided", async () => {
      const res = await getAccountIdHandler(buildRequest({}));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("returns 401 when both x-api-key and Authorization are provided", async () => {
      const res = await getAccountIdHandler(
        buildRequest({
          "x-api-key": "key",
          authorization: "Bearer token",
        }),
      );

      expect(res.status).toBe(401);
    });
  });

  describe("x-api-key path", () => {
    it("returns 200 with accountId when api key resolves", async () => {
      vi.mocked(getApiKeyAccountId).mockResolvedValue("acc-from-api-key");

      const res = await getAccountIdHandler(buildRequest({ "x-api-key": "valid-key" }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "success", accountId: "acc-from-api-key" });
      expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
    });
  });

  describe("Bearer token path", () => {
    it("returns 200 with existing accountId for a known email", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("acc-existing");

      const res = await getAccountIdHandler(buildRequest({ authorization: "Bearer privy-token" }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "success", accountId: "acc-existing" });
      expect(getOrCreateAccountIdByAuthToken).toHaveBeenCalledWith("privy-token");
    });

    it("returns 200 with newly-provisioned accountId for a brand-new email", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("acc-new");

      const res = await getAccountIdHandler(
        buildRequest({ authorization: "Bearer privy-token-new-user" }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "success", accountId: "acc-new" });
    });

    it("returns 401 when token verification throws", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockRejectedValue(
        new Error("Invalid authentication token"),
      );

      const res = await getAccountIdHandler(buildRequest({ authorization: "Bearer bad-token" }));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("Invalid authentication token");
    });

    it("returns 401 when no email is linked on Privy", async () => {
      vi.mocked(getOrCreateAccountIdByAuthToken).mockRejectedValue(
        new Error("No email found in user account"),
      );

      const res = await getAccountIdHandler(
        buildRequest({ authorization: "Bearer no-email-token" }),
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("No email found in user account");
    });
  });
});
