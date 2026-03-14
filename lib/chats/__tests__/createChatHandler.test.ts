import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createChatHandler } from "../createChatHandler";

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { upsertRoom } from "@/lib/supabase/rooms/upsertRoom";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { generateChatTitle } from "../generateChatTitle";

// Mock dependencies
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/accounts/validateOverrideAccountId", () => ({
  validateOverrideAccountId: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/upsertRoom", () => ({
  upsertRoom: vi.fn(),
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

vi.mock("../generateChatTitle", () => ({
  generateChatTitle: vi.fn(),
}));

/**
 *
 * @param apiKey
 */
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
      vi.mocked(upsertRoom).mockResolvedValue({
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
      expect(validateOverrideAccountId).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: null,
      });
    });
  });

  describe("with accountId override", () => {
    it("uses body accountId when validation succeeds", async () => {
      const apiKeyAccountId = "recoup-org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        accountId: targetAccountId,
      });
      vi.mocked(validateOverrideAccountId).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
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
      expect(validateOverrideAccountId).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        targetAccountId,
      });
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: artistId,
        topic: null,
      });
    });

    it("returns 403 when validation returns access denied", async () => {
      const apiKeyAccountId = "org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(validateOverrideAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Access denied to specified accountId" },
          { status: 403 },
        ),
      );

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified accountId");
      expect(upsertRoom).not.toHaveBeenCalled();
    });

    it("returns 500 when validation returns API key error", async () => {
      const apiKeyAccountId = "org-account";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(validateOverrideAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Failed to validate API key" },
          { status: 500 },
        ),
      );

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Failed to validate API key");
      expect(upsertRoom).not.toHaveBeenCalled();
    });
  });

  describe("with topic parameter", () => {
    it("uses provided topic directly without generating", async () => {
      const apiKeyAccountId = "api-key-account-123";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "My Custom Topic";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        topic,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic,
      });
    });

    it("uses provided topic even when firstMessage is also provided", async () => {
      const apiKeyAccountId = "api-key-account-123";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "My Custom Topic";
      const firstMessage = "What marketing strategies should I use?";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        topic,
        firstMessage,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic,
      });
    });
  });

  describe("with firstMessage (title generation)", () => {
    it("generates a title from firstMessage when provided", async () => {
      const apiKeyAccountId = "api-key-account-123";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const firstMessage = "What marketing strategies should I use?";
      const generatedTitle = "Marketing Plan";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        firstMessage,
      });
      vi.mocked(generateChatTitle).mockResolvedValue(generatedTitle);
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: generatedTitle,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).toHaveBeenCalledWith(firstMessage);
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: generatedTitle,
      });
    });

    it("uses null topic when firstMessage is not provided", async () => {
      const apiKeyAccountId = "api-key-account-123";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);

      expect(response.status).toBe(200);
      expect(generateChatTitle).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: null,
      });
    });

    it("handles title generation failure gracefully (uses null)", async () => {
      const apiKeyAccountId = "api-key-account-123";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const firstMessage = "What marketing strategies should I use?";

      vi.mocked(getApiKeyAccountId).mockResolvedValue(apiKeyAccountId);
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        firstMessage,
      });
      vi.mocked(generateChatTitle).mockRejectedValue(new Error("AI generation failed"));
      vi.mocked(upsertRoom).mockResolvedValue({
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
      expect(generateChatTitle).toHaveBeenCalledWith(firstMessage);
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: apiKeyAccountId,
        artist_id: artistId,
        topic: null,
      });
    });
  });
});
