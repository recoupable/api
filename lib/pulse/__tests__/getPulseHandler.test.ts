import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getPulseHandler } from "../getPulseHandler";

vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/accounts/validateOverrideAccountId", () => ({
  validateOverrideAccountId: vi.fn(),
}));

vi.mock("@/lib/supabase/pulse_accounts/selectPulseAccount", () => ({
  selectPulseAccount: vi.fn(),
}));

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { selectPulseAccount } from "@/lib/supabase/pulse_accounts/selectPulseAccount";

/**
 * Creates a mock NextRequest for testing.
 *
 * @param url - The request URL
 * @param headers - Optional headers object
 * @returns A mock NextRequest
 */
function createMockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

describe("getPulseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when API key is missing", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(getApiKeyAccountId).mockResolvedValue(
        NextResponse.json({ status: "error", message: "x-api-key header required" }, { status: 401 }),
      );

      const request = createMockRequest("https://api.example.com/api/pulse");
      const response = await getPulseHandler(request);

      expect(response.status).toBe(401);
    });

    it("returns 401 when API key is invalid", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(getApiKeyAccountId).mockResolvedValue(
        NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "invalid-key",
      });
      const response = await getPulseHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe("successful responses", () => {
    it("returns pulse with active: false when no record exists", async () => {
      const accountId = "account-123";
      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(selectPulseAccount).mockResolvedValue(null);

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await getPulseHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        pulse: {
          id: null,
          account_id: accountId,
          active: false,
        },
      });
    });

    it("returns pulse with active: true when record exists", async () => {
      const accountId = "account-123";
      const pulseId = "pulse-456";
      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(selectPulseAccount).mockResolvedValue({
        id: pulseId,
        account_id: accountId,
        active: true,
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await getPulseHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        pulse: {
          id: pulseId,
          account_id: accountId,
          active: true,
        },
      });
    });

    it("returns pulse with active: false when record has active: false", async () => {
      const accountId = "account-123";
      const pulseId = "pulse-456";
      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(selectPulseAccount).mockResolvedValue({
        id: pulseId,
        account_id: accountId,
        active: false,
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await getPulseHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pulse.active).toBe(false);
    });
  });

  describe("account_id override for org API keys", () => {
    it("uses target account_id when provided and authorized", async () => {
      const orgAccountId = "org-123";
      const targetAccountId = "target-account-456";
      const pulseId = "pulse-789";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(orgAccountId);
      vi.mocked(validateOverrideAccountId).mockResolvedValue({ accountId: targetAccountId });
      vi.mocked(selectPulseAccount).mockResolvedValue({
        id: pulseId,
        account_id: targetAccountId,
        active: true,
      });

      const request = createMockRequest(
        `https://api.example.com/api/pulse?account_id=${targetAccountId}`,
        { "x-api-key": "org-api-key" },
      );
      const response = await getPulseHandler(request);
      const body = await response.json();

      expect(validateOverrideAccountId).toHaveBeenCalledWith({
        apiKey: "org-api-key",
        targetAccountId,
      });
      expect(selectPulseAccount).toHaveBeenCalledWith(targetAccountId);
      expect(body.pulse.account_id).toBe(targetAccountId);
    });

    it("returns 403 when org does not have access to target account", async () => {
      const { NextResponse } = await import("next/server");
      const orgAccountId = "org-123";
      const targetAccountId = "unauthorized-account-456";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(orgAccountId);
      vi.mocked(validateOverrideAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Access denied to specified accountId" },
          { status: 403 },
        ),
      );

      const request = createMockRequest(
        `https://api.example.com/api/pulse?account_id=${targetAccountId}`,
        { "x-api-key": "org-api-key" },
      );
      const response = await getPulseHandler(request);

      expect(response.status).toBe(403);
    });
  });
});
