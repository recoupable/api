import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updatePulseHandler } from "../updatePulseHandler";

vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/accounts/validateOverrideAccountId", () => ({
  validateOverrideAccountId: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/supabase/pulse_accounts/upsertPulseAccount", () => ({
  upsertPulseAccount: vi.fn(),
}));

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";

/**
 * Creates a mock NextRequest for testing.
 *
 * @param url - The request URL
 * @param headers - Optional headers object
 * @returns A mock NextRequest
 */
function createMockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { method: "PATCH", headers });
}

describe("updatePulseHandler", () => {
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
      const response = await updatePulseHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 when active field is missing", async () => {
      const accountId = "account-123";
      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(safeParseJson).mockResolvedValue({});

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await updatePulseHandler(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 when active is not a boolean", async () => {
      const accountId = "account-123";
      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(safeParseJson).mockResolvedValue({ active: "true" });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await updatePulseHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe("upserting pulse record", () => {
    it("upserts record with active: true", async () => {
      const accountId = "account-123";
      const pulseId = "pulse-456";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(safeParseJson).mockResolvedValue({ active: true });
      vi.mocked(upsertPulseAccount).mockResolvedValue({
        id: pulseId,
        account_id: accountId,
        active: true,
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await updatePulseHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(upsertPulseAccount).toHaveBeenCalledWith({ account_id: accountId, active: true });
      expect(body).toEqual({
        status: "success",
        pulse: {
          id: pulseId,
          account_id: accountId,
          active: true,
        },
      });
    });

    it("upserts record with active: false", async () => {
      const accountId = "account-123";
      const pulseId = "pulse-456";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(safeParseJson).mockResolvedValue({ active: false });
      vi.mocked(upsertPulseAccount).mockResolvedValue({
        id: pulseId,
        account_id: accountId,
        active: false,
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await updatePulseHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pulse.active).toBe(false);
    });
  });

  describe("account_id override for org API keys", () => {
    it("uses target account_id when provided and authorized", async () => {
      const orgAccountId = "11111111-1111-4111-a111-111111111111";
      const targetAccountId = "22222222-2222-4222-a222-222222222222";
      const pulseId = "33333333-3333-4333-a333-333333333333";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(orgAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({ active: true, account_id: targetAccountId });
      vi.mocked(validateOverrideAccountId).mockResolvedValue({ accountId: targetAccountId });
      vi.mocked(upsertPulseAccount).mockResolvedValue({
        id: pulseId,
        account_id: targetAccountId,
        active: true,
      });

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "org-api-key",
      });
      const response = await updatePulseHandler(request);
      const body = await response.json();

      expect(validateOverrideAccountId).toHaveBeenCalledWith({
        apiKey: "org-api-key",
        targetAccountId,
      });
      expect(upsertPulseAccount).toHaveBeenCalledWith({
        account_id: targetAccountId,
        active: true,
      });
      expect(body.pulse.account_id).toBe(targetAccountId);
    });

    it("returns 403 when org does not have access to target account", async () => {
      const { NextResponse } = await import("next/server");
      const orgAccountId = "11111111-1111-4111-a111-111111111111";
      const targetAccountId = "22222222-2222-4222-a222-222222222222";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(orgAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({ active: true, account_id: targetAccountId });
      vi.mocked(validateOverrideAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Access denied to specified accountId" },
          { status: 403 },
        ),
      );

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "org-api-key",
      });
      const response = await updatePulseHandler(request);

      expect(response.status).toBe(403);
    });
  });

  describe("error handling", () => {
    it("returns 500 when upsert fails", async () => {
      const accountId = "account-123";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(accountId);
      vi.mocked(safeParseJson).mockResolvedValue({ active: true });
      vi.mocked(upsertPulseAccount).mockResolvedValue(null);

      const request = createMockRequest("https://api.example.com/api/pulse", {
        "x-api-key": "valid-key",
      });
      const response = await updatePulseHandler(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
