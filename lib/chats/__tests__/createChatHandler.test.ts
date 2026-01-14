import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createChatHandler } from "../createChatHandler";

// Mock dependencies
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/insertRoom", () => ({
  insertRoom: vi.fn(),
}));

vi.mock("@/lib/uuid/generateUUID", () => ({
  generateUUID: vi.fn(() => "generated-uuid-123"),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getApiKeyDetails } from "@/lib/auth/getApiKeyDetails";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import { safeParseJson } from "@/lib/networking/safeParseJson";

function createMockRequest(apiKey = "test-api-key"): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "x-api-key" ? apiKey : null),
    },
  } as unknown as NextRequest;
}

describe("createChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without accountId override", () => {
    it("uses API key's accountId when no accountId in body", async () => {
      const apiKeyAccountId = "api-key-account-123";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({ artistId });
      vi.mocked(insertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(insertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: null,
      });
    });
  });

  describe("with accountId override", () => {
    it("uses body accountId when org has access (Recoup admin)", async () => {
      const apiKeyAccountId = "recoup-org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        accountId: targetAccountId,
      });
      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: apiKeyAccountId,
        orgId: "recoup-admin-org-id",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(true);
      vi.mocked(insertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(canAccessAccount).toHaveBeenCalledWith({
        orgId: "recoup-admin-org-id",
        targetAccountId,
      });
      expect(insertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: artistId,
        topic: null,
      });
    });

    it("uses body accountId when org has access (org member)", async () => {
      const apiKeyAccountId = "org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const orgId = "regular-org-id";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: apiKeyAccountId,
        orgId,
      });
      vi.mocked(canAccessAccount).mockResolvedValue(true);
      vi.mocked(insertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: null,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(insertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: null,
        topic: null,
      });
    });

    it("returns 403 when org lacks access to target account", async () => {
      const apiKeyAccountId = "org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const orgId = "regular-org-id";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: apiKeyAccountId,
        orgId,
      });
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified accountId");
      expect(insertRoom).not.toHaveBeenCalled();
    });

    it("returns 403 when personal key tries to use accountId override", async () => {
      const apiKeyAccountId = "personal-account-123";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(getApiKeyDetails).mockResolvedValue({
        accountId: apiKeyAccountId,
        orgId: null, // Personal key has no org
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified accountId");
      expect(insertRoom).not.toHaveBeenCalled();
    });

    it("returns 500 when getApiKeyDetails fails", async () => {
      const apiKeyAccountId = "org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(getApiKeyDetails).mockResolvedValue(null);

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Failed to validate API key");
      expect(insertRoom).not.toHaveBeenCalled();
    });
  });
});
