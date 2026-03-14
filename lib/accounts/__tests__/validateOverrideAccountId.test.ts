import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateOverrideAccountId } from "../validateOverrideAccountId";

import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

describe("validateOverrideAccountId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful validation", () => {
    it("returns accountId when org has access to target account", async () => {
      const targetAccountId = "target-account-123";
      const orgId = "org-456";

      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: orgId,
        orgId: orgId,
      });
      vi.mocked(canAccessAccount).mockResolvedValue(true);

      const result = await validateOverrideAccountId({
        apiKey: "valid_api_key",
        targetAccountId,
      });

      expect(result).toEqual({ accountId: targetAccountId });
      expect(getApiKeyDetails).toHaveBeenCalledWith("valid_api_key");
      expect(canAccessAccount).toHaveBeenCalledWith({
        orgId,
        targetAccountId,
      });
    });
  });

  describe("missing API key", () => {
    it("returns 500 error when apiKey is null", async () => {
      const result = await validateOverrideAccountId({
        apiKey: null,
        targetAccountId: "target-123",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({
        status: "error",
        message: "Failed to validate API key",
      });
    });
  });

  describe("invalid API key", () => {
    it("returns 500 error when getApiKeyDetails returns null", async () => {
      vi.mocked(getApiKeyDetails).mockResolvedValue(null);

      const result = await validateOverrideAccountId({
        apiKey: "invalid_key",
        targetAccountId: "target-123",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({
        status: "error",
        message: "Failed to validate API key",
      });
    });
  });

  describe("access denied", () => {
    it("returns 403 error when org does not have access to target account", async () => {
      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: "org-123",
        orgId: "org-123",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const result = await validateOverrideAccountId({
        apiKey: "valid_key",
        targetAccountId: "unauthorized-account",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body).toEqual({
        status: "error",
        message: "Access denied to specified accountId",
      });
    });

    it("returns 403 error when API key is personal (no orgId)", async () => {
      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: "personal-account",
        orgId: null,
      });
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const result = await validateOverrideAccountId({
        apiKey: "personal_key",
        targetAccountId: "some-account",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
    });
  });
});
